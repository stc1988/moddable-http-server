import listen from "listen";
import Headers from "headers";
import { URLSearchParams } from "url";

class Request {
	raw;

	constructor(request) {
		this.raw = request;
	}
	get method() {
		return this.raw.method.toLowerCase();
	}
	get path() {
		return this.raw.url.pathname;
	}
	get url() {
		return this.raw.url.href;
	}
	header(key) {
		return this.raw.headers.get(key.toLowerCase());
	}
	query(key) {
		return key ? this.raw.url.searchParams.get(key) : Object.fromEntries(this.raw.url.searchParams.entries());
	}
	get params() {
		return this.raw.params ?? {};
	}
	set params(params) {
		this.raw.params = params;
	}
	async text() {
		return await this.raw.text();
	}
	async json() {
		return await this.raw.json();
	}
	async formData() {
		const queryString = await this.text();
		return Object.fromEntries(new URLSearchParams(queryString));
	}
}

class Response {
	#body;
	#headers;
	#status = 200;
	constructor(body, options) {
		if (body instanceof ArrayBuffer) {
			this.#body = body;
		} else if (typeof body === "string") {
			this.#body = ArrayBuffer.fromString(body);
		} else if (body === undefined || body === null) {
			this.#body = new ArrayBuffer(0);
		} else {
			this.#body = ArrayBuffer.fromString(String(body));
		}
		const headers = new Headers();
		if (options.headers) {
			for (const [key, value] of Object.entries(options.headers)) {
				headers.set(key, value);
			}
		}

		if (headers.get("content-type") === undefined) {
			headers.set("content-type", "application/octet-stream");
		}

		if (headers.get("content-length") === undefined) {
			headers.set("content-length", this.#body.byteLength.toString());
		}
		this.#headers = headers;

		this.#status = options?.status ? options.status : 200;

		if (this.#status === 204 || this.#status === 304) {
			this.#body = new ArrayBuffer(0);
			headers.delete("content-length");
		}
	}
	get body() {
		return this.#body;
	}
	get headers() {
		return this.#headers;
	}
	get status() {
		return this.#status;
	}
	async arrayBuffer() {
		let body = this.#body;
		if (body) {
			this.#body = undefined;
			body = await body;
		}
		return body;
	}
	async json() {
		let body = this.#body;
		if (body) {
			this.#body = undefined;
			body = await body;
			body = String.fromArrayBuffer(body);
			return JSON.parse(body);
		}
		return body;
	}
	async text() {
		let body = this.#body;
		if (body) {
			this.#body = undefined;
			body = await body;
			body = String.fromArrayBuffer(body);
		}
		return body;
	}
}

class Context {
	#req;
	#status;
	#headers = new Headers();

	constructor(request) {
		this.#req = new Request(request);
	}
	get req() {
		return this.#req;
	}
	param(key) {
		const params = this.#req.params;
		return key ? params[key] : params;
	}
	status(status) {
		this.#status = status;
	}
	header(key, value) {
		this.#headers.set(key, value);
	}
	text(text, status) {
		this.#headers.set("Content-type", "text/plain");
		return new Response(text, {
			status: status ?? this.#status,
			headers: Object.fromEntries(this.#headers.entries()),
		});
	}
	json(json, status) {
		this.#headers.set("Content-type", "application/json");
		return new Response(JSON.stringify(json), {
			status: status ?? this.#status,
			headers: Object.fromEntries(this.#headers.entries()),
		});
	}
	notFound() {
		return this.text("Resource Not Found", 404);
	}
}

class Router {
	#routes = {
		get: { static: new Map(), dynamic: [] },
		post: { static: new Map(), dynamic: [] },
		put: { static: new Map(), dynamic: [] },
		patch: { static: new Map(), dynamic: [] },
		delete: { static: new Map(), dynamic: [] },
	};

	add(method, path, handler) {
		const routes = this.#routes[method];
		if (!routes) return;

		if (path.includes(":") || path.includes("*")) {
			routes.dynamic.push({ path, handler });
		} else {
			routes.static.set(path, handler);
		}
	}

	find(method, path) {
		const normalizedPath = this.#normalizePath(path);
		const matched = this.#findInMethod(method, path, normalizedPath);
		if (matched) {
			return matched;
		}

		if (method === "head") {
			return this.#findInMethod("get", path, normalizedPath);
		}

		return null;
	}

	#findInMethod(method, path, normalizedPath = this.#normalizePath(path)) {
		const routes = this.#routes[method];
		if (!routes) return null;

		const exactHandler = routes.static.get(normalizedPath) ?? routes.static.get(path);
		if (exactHandler) {
			return { handler: exactHandler, params: {} };
		}

		for (const route of routes.dynamic) {
			const params = this.#matchPath(route.path, normalizedPath);
			if (params) {
				return { handler: route.handler, params };
			}
		}

		return null;
	}

	#normalizePath(path) {
		if (!path || path === "/") {
			return "/";
		}

		const normalized = path.replace(/\/+$/u, "");
		return normalized || "/";
	}

	#splitPath(path) {
		const normalized = this.#normalizePath(path);
		if (normalized === "/") {
			return [];
		}
		return normalized.slice(1).split("/");
	}

	#matchPath(routePath, actualPath) {
		const routeSegments = this.#splitPath(routePath);
		const actualSegments = this.#splitPath(actualPath);
		const params = {};

		let routeIndex = 0;
		let actualIndex = 0;

		while (routeIndex < routeSegments.length) {
			const routeSegment = routeSegments[routeIndex];

			if (routeSegment === "*") {
				params["*"] = decodeURIComponent(actualSegments.slice(actualIndex).join("/"));
				return params;
			}

			const actualSegment = actualSegments[actualIndex];
			if (actualSegment === undefined) {
				return null;
			}

			if (routeSegment.startsWith(":")) {
				const key = routeSegment.slice(1);
				if (!key) {
					return null;
				}
				params[key] = decodeURIComponent(actualSegment);
			} else if (routeSegment !== actualSegment) {
				return null;
			}

			routeIndex += 1;
			actualIndex += 1;
		}

		if (actualIndex !== actualSegments.length) {
			return null;
		}

		return params;
	}
}

class HttpServer {
	#router = new Router();

	get = (path, handler) => this.#router.add("get", path, handler);
	post = (path, handler) => this.#router.add("post", path, handler);
	put = (path, handler) => this.#router.add("put", path, handler);
	patch = (path, handler) => this.#router.add("patch", path, handler);
	delete = (path, handler) => this.#router.add("delete", path, handler);

	constructor(options = {}) {
		const port = options?.port;
		this.#listen(port);
	}

	async #listen(port) {
		for await (const connection of listen({ port })) {
			const context = new Context(connection.request);
			const req = context.req;
			let response;

			try {
				if (req.method === "options") {
					const allow = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
					response = new Response("", { status: 204, headers: { Allow: allow.join(", ") } });
				} else {
					const matched = this.#router.find(req.method, req.path);
					if (!matched) {
						response = context.notFound();
					} else {
						req.params = matched.params;
						response = await matched.handler(context);
					}
				}
			} catch (e) {
				trace(`HTTP Error: ${e}\n`);
				response = context.text("Internal Server Error", 500);
			} finally {
				if (response?.headers && response.headers.get("connection") === undefined) {
					response.headers.set("connection", "close");
				}
				connection.respondWith(response);
			}
		}
	}
}

export { HttpServer, Response };

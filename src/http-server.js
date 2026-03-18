import listen from "listen";
import Headers from "headers";
// biome-ignore lint/style/useNodejsImportProtocol: use Moddable's built-in url Module
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
		return this.raw.text();
	}
	async json() {
		return this.raw.json();
	}
	async arrayBuffer() {
		return this.raw.arrayBuffer();
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
	constructor(body, options = {}) {
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
	applyHeaders(response) {
		if (!response?.headers) {
			return response;
		}

		for (const [key, value] of this.#headers.entries()) {
			response.headers.set(key, value);
		}

		return response;
	}
	text(text, status) {
		this.#headers.set("Content-type", "text/plain");
		return new Response(text, {
			status: status ?? this.#status,
		});
	}
	json(json, status) {
		this.#headers.set("Content-type", "application/json");
		return new Response(JSON.stringify(json), {
			status: status ?? this.#status,
		});
	}
	redirect(location, status) {
		this.#headers.set("Location", location);
		return new Response("", {
			status: status ?? this.#status ?? 302,
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
		const normalizedPath = this.#normalizePath(path);

		if (path.includes(":") || path.includes("*")) {
			routes.dynamic.push({
				handler,
				segments: this.#splitPath(normalizedPath),
			});
		} else {
			routes.static.set(normalizedPath, handler);
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

	allowedMethods(path) {
		const normalizedPath = this.#normalizePath(path);
		const allow = [];

		for (const method of Object.keys(this.#routes)) {
			if (this.#findInMethod(method, path, normalizedPath)) {
				allow.push(method.toUpperCase());
			}
		}

		if (allow.includes("GET") && !allow.includes("HEAD")) {
			allow.push("HEAD");
		}

		allow.push("OPTIONS");

		return allow;
	}

	#findInMethod(method, path, normalizedPath = this.#normalizePath(path)) {
		const routes = this.#routes[method];
		if (!routes) return null;

		const exactHandler = routes.static.get(normalizedPath);
		if (exactHandler) {
			return { handler: exactHandler, params: {} };
		}

		for (const route of routes.dynamic) {
			const params = this.#matchPath(route.segments, normalizedPath);
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

	#matchPath(routeSegments, actualPath) {
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
	#middlewares = [];

	get = (path, handler) => this.#router.add("get", path, handler);
	post = (path, handler) => this.#router.add("post", path, handler);
	put = (path, handler) => this.#router.add("put", path, handler);
	patch = (path, handler) => this.#router.add("patch", path, handler);
	delete = (path, handler) => this.#router.add("delete", path, handler);
	use = (...args) => {
		let path = "*";
		let handlers = args;

		if (typeof args[0] === "string") {
			path = args[0];
			handlers = args.slice(1);
		}

		for (const handler of handlers) {
			if (typeof handler !== "function") {
				continue;
			}

			const normalizedPath = this.#normalizePath(path);
			const isWildcard = !path || path === "*";
			const isPrefixWildcard = !isWildcard && normalizedPath.endsWith("/*");
			const prefix = isPrefixWildcard ? normalizedPath.slice(0, -2) : normalizedPath;
			this.#middlewares.push({
				isPrefixWildcard,
				isWildcard,
				prefix,
				handler,
			});
		}
	};

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
				const matched = this.#router.find(req.method, req.path);
				response = await this.#dispatch(context, async () => {
					if (req.method === "options") {
						const allow = this.#router.allowedMethods(req.path);
						return new Response("", { status: 204, headers: { Allow: allow.join(", ") } });
					}

					if (!matched) {
						const allow = this.#router.allowedMethods(req.path);
						if (allow.some((method) => method !== "OPTIONS")) {
							context.header("Allow", allow.join(", "));
							return context.text("Method Not Allowed", 405);
						}
						return context.notFound();
					}

					req.params = matched.params;
					return await matched.handler(context);
				});

				if (response === undefined) {
					response = context.text("Internal Server Error", 500);
				}
			} catch (e) {
				trace(`HTTP Error: ${e}\n`);
				response = context.text("Internal Server Error", 500);
			} finally {
				if (response) {
					response = context.applyHeaders(response);
				}

				if (req.method === "head" && response) {
					response = new Response("", {
						status: response.status,
						headers: Object.fromEntries(response.headers.entries()),
					});

					response.headers.set("content-length", "0");
				}

				if (response?.headers && response.headers.get("connection") === undefined) {
					response.headers.set("connection", "close");
				}
				connection.respondWith(response);
			}
		}
	}

	async #dispatch(context, handler) {
		const middlewares = this.#middlewares;
		const requestPath = this.#normalizePath(context.req.path);
		let index = -1;
		const dispatch = (i) => {
			if (i <= index) {
				return Promise.reject(new Error("next() called multiple times"));
			}
			index = i;

			let fn;
			let nextIndex = i;
			while (nextIndex < middlewares.length) {
				const middleware = middlewares[nextIndex];
				if (this.#matchMiddlewarePath(middleware, requestPath)) {
					fn = middleware.handler;
					break;
				}
				nextIndex += 1;
			}

			if (fn === undefined) {
				return Promise.resolve(handler(context));
			}

			try {
				return Promise.resolve(fn(context, () => dispatch(nextIndex + 1)));
			} catch (error) {
				return Promise.reject(error);
			}
		};

		return await dispatch(0);
	}

	#matchMiddlewarePath(middleware, requestPath) {
		if (middleware.isWildcard) {
			return true;
		}

		if (middleware.isPrefixWildcard) {
			return requestPath === middleware.prefix || requestPath.startsWith(`${middleware.prefix}/`);
		}

		return requestPath === middleware.prefix;
	}

	#normalizePath(path) {
		if (!path || path === "/") {
			return "/";
		}

		const normalized = path.replace(/\/+$/u, "");
		return normalized || "/";
	}
}

export { HttpServer, Response };

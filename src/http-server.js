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
				normalizedPath,
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

		const actualSegments = this.#splitPath(normalizedPath);

		for (const route of routes.dynamic) {
			const params = this.#matchPath(route.segments, route.normalizedPath, normalizedPath, actualSegments);
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

	#matchPath(routeSegments, routePath, actualPath, actualSegments = this.#splitPath(actualPath)) {
		const params = {};

		if (routeSegments.length === 0) {
			return actualSegments.length === 0 ? params : null;
		}

		if (!routePath.includes("*") && routeSegments.length !== actualSegments.length) {
			return null;
		}

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
	#notFoundHandler;
	#methodNotAllowedHandler;
	#errorHandler;

	get = (path, handler) => this.#router.add("get", path, handler);
	post = (path, handler) => this.#router.add("post", path, handler);
	put = (path, handler) => this.#router.add("put", path, handler);
	patch = (path, handler) => this.#router.add("patch", path, handler);
	delete = (path, handler) => this.#router.add("delete", path, handler);
	onNotFound = (handler) => {
		this.#notFoundHandler = typeof handler === "function" ? handler : undefined;
		return this;
	};
	onMethodNotAllowed = (handler) => {
		this.#methodNotAllowedHandler = typeof handler === "function" ? handler : undefined;
		return this;
	};
	onError = (handler) => {
		this.#errorHandler = typeof handler === "function" ? handler : undefined;
		return this;
	};
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
							return await this.#handleMethodNotAllowed(context, allow);
						}
						return await this.#handleNotFound(context);
					}

					req.params = matched.params;
					return await matched.handler(context);
				});

				if (response === undefined) {
					response = await this.#handleError(context, new Error("Response was undefined"));
				}
			} catch (e) {
				trace(`HTTP Error: ${e}\n`);
				response = await this.#handleError(context, e);
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

	async #handleNotFound(context) {
		if (!this.#notFoundHandler) {
			return context.notFound();
		}

		const response = await this.#notFoundHandler(context);
		return response ?? context.notFound();
	}

	async #handleMethodNotAllowed(context, allow) {
		context.header("Allow", allow.join(", "));
		if (!this.#methodNotAllowedHandler) {
			return context.text("Method Not Allowed", 405);
		}

		const response = await this.#methodNotAllowedHandler(context, allow);
		return response ?? context.text("Method Not Allowed", 405);
	}

	async #handleError(context, error) {
		if (!this.#errorHandler) {
			return context.text("Internal Server Error", 500);
		}

		try {
			const response = await this.#errorHandler(error, context);
			return response ?? context.text("Internal Server Error", 500);
		} catch (handlerError) {
			trace(`HTTP Error Handler Error: ${handlerError}\n`);
			return context.text("Internal Server Error", 500);
		}
	}

	async #dispatch(context, handler) {
		const matchedMiddlewares = [];
		const requestPath = this.#normalizePath(context.req.path);

		for (const middleware of this.#middlewares) {
			if (this.#matchMiddlewarePath(middleware, requestPath)) {
				matchedMiddlewares.push(middleware.handler);
			}
		}

		const createDeferred = () => {
			let resolve;
			let reject;
			const promise = new Promise((res, rej) => {
				resolve = res;
				reject = rej;
			});
			return { promise, resolve, reject };
		};

		const settle = async (promise) => {
			try {
				return { type: "return", value: await promise };
			} catch (error) {
				return { type: "throw", error };
			}
		};

		const frames = [];
		let index = 0;
		let completion;

		while (true) {
			if (index >= matchedMiddlewares.length) {
				completion = await settle(Promise.resolve(handler(context)));
				break;
			}

			const fn = matchedMiddlewares[index];
			const nextDeferred = createDeferred();
			const nextCalled = createDeferred();
			let nextUsed = false;
			let middlewareResult;

			try {
				middlewareResult = Promise.resolve(
					fn(context, () => {
						if (nextUsed) {
							return Promise.reject(new Error("next() called multiple times"));
						}

						nextUsed = true;
						nextCalled.resolve(true);
						return nextDeferred.promise;
					}),
				);
			} catch (error) {
				completion = { type: "throw", error };
				break;
			}

			const step = await Promise.race([
				nextCalled.promise.then(() => ({ type: "next" })),
				settle(middlewareResult),
			]);

			if (step.type === "next") {
				frames.push({ middlewareResult, nextDeferred });
				index += 1;
				continue;
			}

			completion = step;
			break;
		}

		while (frames.length > 0) {
			const frame = frames.pop();
			if (completion.type === "throw") {
				frame.nextDeferred.reject(completion.error);
			} else {
				frame.nextDeferred.resolve(completion.value);
			}

			completion = await settle(frame.middlewareResult);
		}

		if (completion.type === "throw") {
			throw completion.error;
		}

		return completion.value;
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

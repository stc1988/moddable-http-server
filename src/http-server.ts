import Headers from "headers";
import listen from "listen";
import TextDecoder from "text/decoder";
import TextEncoder from "text/encoder";
// biome-ignore lint/style/useNodejsImportProtocol: use Moddable's built-in url Module
import type URL from "url";
// biome-ignore lint/style/useNodejsImportProtocol: use Moddable's built-in url Module
import { URLSearchParams } from "url";

type MaybePromise<T> = T | Promise<T>;
type Params = Record<string, string>;
type Query = Record<string, string>;
type ResponseResult = MaybePromise<Response | undefined>;

interface RawRequest {
	method: string;
	url: URL;
	headers: Headers;
	params?: Params;
	validated?: unknown;
	arrayBuffer(): Promise<ArrayBuffer | null | undefined>;
}

interface ResponseOptions {
	status?: number;
	headers?: Record<string, string>;
}

interface HttpServerOptions {
	port?: number;
}

type RouteHandler = (context: Context) => ResponseResult;
type Next = () => Promise<Response | undefined>;
type Middleware = (context: Context, next: Next) => ResponseResult;
type NotFoundHandler = (context: Context) => ResponseResult;
type MethodNotAllowedHandler = (context: Context, allow: string[]) => ResponseResult;
type ErrorHandler = (error: unknown, context: Context) => ResponseResult;

class Request {
	raw: RawRequest;

	constructor(request: RawRequest) {
		this.raw = request;
	}
	get method(): string {
		return this.raw.method.toLowerCase();
	}
	get path(): string {
		return this.raw.url.pathname;
	}
	get url(): string {
		return this.raw.url.href;
	}
	header(key: string): string | undefined {
		return this.raw.headers.get(key.toLowerCase());
	}
	query(key: string): string | null;
	query(): Query;
	query(key?: string): string | null | Query {
		return key ? this.raw.url.searchParams.get(key) : Object.fromEntries(this.raw.url.searchParams);
	}
	get params(): Params {
		return this.raw.params ?? {};
	}
	set params(params: Params) {
		this.raw.params = params;
	}
	get validated(): unknown {
		return this.raw.validated;
	}
	set validated(value: unknown) {
		this.raw.validated = value;
	}
	async text(): Promise<string | null | undefined> {
		const body = await this.raw.arrayBuffer();
		return body == null ? body : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(body);
	}
	async json(): Promise<unknown> {
		const text = await this.text();
		return text == null ? text : JSON.parse(text);
	}
	async arrayBuffer(): Promise<ArrayBuffer | null | undefined> {
		return this.raw.arrayBuffer();
	}
	async formData(): Promise<Query> {
		const queryString = await this.text();
		return Object.fromEntries(new URLSearchParams(queryString as string));
	}
}

class Response {
	#body: ArrayBuffer | undefined;
	#headers: Headers;
	#status: number;
	constructor(body?: unknown, options: ResponseOptions = {}) {
		if (body instanceof ArrayBuffer) {
			this.#body = body;
		} else if (typeof body === "string") {
			this.#body = new TextEncoder().encode(body).buffer as ArrayBuffer;
		} else if (body === undefined || body === null) {
			this.#body = new ArrayBuffer(0);
		} else {
			this.#body = new TextEncoder().encode(String(body)).buffer as ArrayBuffer;
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
	get body(): ArrayBuffer | undefined {
		return this.#body;
	}
	get headers(): Headers {
		return this.#headers;
	}
	get status(): number {
		return this.#status;
	}
	async arrayBuffer(): Promise<ArrayBuffer | undefined> {
		let body = this.#body;
		if (body) {
			this.#body = undefined;
			body = await body;
		}
		return body;
	}
	async json(): Promise<unknown> {
		const body = this.#body;
		if (body) {
			this.#body = undefined;
			const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await body);
			return JSON.parse(text);
		}
		return body;
	}
	async text(): Promise<string | undefined> {
		const body = this.#body;
		if (body) {
			this.#body = undefined;
			return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await body);
		}
		return body;
	}
}

class Context {
	#req: Request;
	#status: number | undefined;
	#headers = new Headers();

	constructor(request: RawRequest) {
		this.#req = new Request(request);
	}
	get req(): Request {
		return this.#req;
	}
	param(key: string): string | undefined;
	param(): Params;
	param(key?: string): string | Params | undefined {
		const params = this.#req.params;
		return key ? params[key] : params;
	}
	status(status: number): void {
		this.#status = status;
	}
	header(key: string, value: string): void {
		this.#headers.set(key, value);
	}
	applyHeaders(response: Response | undefined): Response | undefined {
		if (!response?.headers) {
			return response;
		}

		for (const [key, value] of this.#headers.entries()) {
			response.headers.set(key, value);
		}

		return response;
	}
	text(text: unknown, status?: number): Response {
		this.#headers.set("Content-type", "text/plain");
		return new Response(text, {
			status: status ?? this.#status,
		});
	}
	json(json: unknown, status?: number): Response {
		this.#headers.set("Content-type", "application/json");
		return new Response(JSON.stringify(json), {
			status: status ?? this.#status,
		});
	}
	redirect(location: string, status?: number): Response {
		this.#headers.set("Location", location);
		return new Response("", {
			status: status ?? this.#status ?? 302,
		});
	}
	notFound(): Response {
		return this.text("Resource Not Found", 404);
	}
}

interface DynamicRoute {
	handler: RouteHandler;
	segments: string[];
	normalizedPath: string;
}

interface RouteMatch {
	handler: RouteHandler;
	params: Params;
}

interface RegisteredMiddleware {
	isPrefixWildcard: boolean;
	isWildcard: boolean;
	prefix: string;
	handler: Middleware;
}

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: unknown) => void;
}

type Completion<T> = { type: "return"; value: T } | { type: "throw"; error: unknown };

class Router {
	#routes: Record<string, { static: Map<string, RouteHandler>; dynamic: DynamicRoute[] }> = {
		get: { static: new Map(), dynamic: [] },
		post: { static: new Map(), dynamic: [] },
		put: { static: new Map(), dynamic: [] },
		patch: { static: new Map(), dynamic: [] },
		delete: { static: new Map(), dynamic: [] },
	};

	add(method: string, path: string, handler: RouteHandler): void {
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

	find(method: string, path: string): RouteMatch | null {
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

	allowedMethods(path: string): string[] {
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

	#findInMethod(method: string, path: string, normalizedPath = this.#normalizePath(path)): RouteMatch | null {
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

	#normalizePath(path: string): string {
		if (!path || path === "/") {
			return "/";
		}

		const normalized = path.replace(/\/+$/u, "");
		return normalized || "/";
	}

	#splitPath(path: string): string[] {
		const normalized = this.#normalizePath(path);
		if (normalized === "/") {
			return [];
		}
		return normalized.slice(1).split("/");
	}

	#matchPath(
		routeSegments: string[],
		routePath: string,
		actualPath: string,
		actualSegments = this.#splitPath(actualPath),
	): Params | null {
		const params: Params = {};

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
	#middlewares: RegisteredMiddleware[] = [];
	#notFoundHandler: NotFoundHandler | undefined;
	#methodNotAllowedHandler: MethodNotAllowedHandler | undefined;
	#errorHandler: ErrorHandler | undefined;

	get = (path: string, handler: RouteHandler): void => this.#router.add("get", path, handler);
	post = (path: string, handler: RouteHandler): void => this.#router.add("post", path, handler);
	put = (path: string, handler: RouteHandler): void => this.#router.add("put", path, handler);
	patch = (path: string, handler: RouteHandler): void => this.#router.add("patch", path, handler);
	delete = (path: string, handler: RouteHandler): void => this.#router.add("delete", path, handler);
	onNotFound = (handler: NotFoundHandler): this => {
		this.#notFoundHandler = typeof handler === "function" ? handler : undefined;
		return this;
	};
	onMethodNotAllowed = (handler: MethodNotAllowedHandler): this => {
		this.#methodNotAllowedHandler = typeof handler === "function" ? handler : undefined;
		return this;
	};
	onError = (handler: ErrorHandler): this => {
		this.#errorHandler = typeof handler === "function" ? handler : undefined;
		return this;
	};
	use: {
		(...handlers: Middleware[]): void;
		(path: string, ...handlers: Middleware[]): void;
	} = (...args: [string, ...Middleware[]] | Middleware[]) => {
		let path = "*";
		let handlers: Middleware[] = args as Middleware[];

		if (typeof args[0] === "string") {
			path = args[0];
			handlers = args.slice(1) as Middleware[];
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

	constructor(options: HttpServerOptions = {}) {
		const port = options?.port ?? 80;
		this.#listen(port);
		trace(`[http] Listening on port ${port}\n`);
	}

	async #listen(port: number): Promise<void> {
		for await (const connection of listen({ port })) {
			const context = new Context(connection.request);
			const req = context.req;
			let response: Response | undefined;

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

	async #handleNotFound(context: Context): Promise<Response> {
		if (!this.#notFoundHandler) {
			return context.notFound();
		}

		const response = await this.#notFoundHandler(context);
		return response ?? context.notFound();
	}

	async #handleMethodNotAllowed(context: Context, allow: string[]): Promise<Response> {
		context.header("Allow", allow.join(", "));
		if (!this.#methodNotAllowedHandler) {
			return context.text("Method Not Allowed", 405);
		}

		const response = await this.#methodNotAllowedHandler(context, allow);
		return response ?? context.text("Method Not Allowed", 405);
	}

	async #handleError(context: Context, error: unknown): Promise<Response> {
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

	async #dispatch(context: Context, handler: RouteHandler): Promise<Response | undefined> {
		const matchedMiddlewares: Middleware[] = [];
		const requestPath = this.#normalizePath(context.req.path);

		for (const middleware of this.#middlewares) {
			if (this.#matchMiddlewarePath(middleware, requestPath)) {
				matchedMiddlewares.push(middleware.handler);
			}
		}

		const createDeferred = <T>(): Deferred<T> => {
			let resolve!: Deferred<T>["resolve"];
			let reject!: Deferred<T>["reject"];
			const promise = new Promise<T>((res, rej) => {
				resolve = res;
				reject = rej;
			});
			return { promise, resolve, reject };
		};

		const settle = async <T>(promise: Promise<T>): Promise<Completion<T>> => {
			try {
				return { type: "return", value: await promise };
			} catch (error) {
				return { type: "throw", error };
			}
		};

		const frames: Array<{
			middlewareResult: Promise<Response | undefined>;
			nextDeferred: Deferred<Response | undefined>;
		}> = [];
		let index = 0;
		let completion: Completion<Response | undefined>;

		while (true) {
			if (index >= matchedMiddlewares.length) {
				completion = await settle(Promise.resolve(handler(context)));
				break;
			}

			const fn = matchedMiddlewares[index];
			const nextDeferred = createDeferred<Response | undefined>();
			const nextCalled = createDeferred<boolean>();
			let nextUsed = false;
			let middlewareResult: Promise<Response | undefined>;

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
				nextCalled.promise.then(() => ({ type: "next" }) as const),
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
			if (!frame) {
				break;
			}
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

	#matchMiddlewarePath(middleware: RegisteredMiddleware, requestPath: string): boolean {
		if (middleware.isWildcard) {
			return true;
		}

		if (middleware.isPrefixWildcard) {
			return requestPath === middleware.prefix || requestPath.startsWith(`${middleware.prefix}/`);
		}

		return requestPath === middleware.prefix;
	}

	#normalizePath(path: string): string {
		if (!path || path === "/") {
			return "/";
		}

		const normalized = path.replace(/\/+$/u, "");
		return normalized || "/";
	}
}

export { HttpServer, Response };
export type { Context, HttpServerOptions, Middleware, Next, Request, ResponseOptions, RouteHandler };

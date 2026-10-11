import { basicAuth } from "basic-auth";
import { HttpServer, Response } from "http-server";
import { rateLimit } from "rate-limit";
import TextDecoder from "text/decoder";
import { validate } from "validate";

const app = new HttpServer();

app.use("/limited/*", rateLimit({ limit: 2, windowMs: 1000 }));
app.get("/limited/hello", (c) => c.text("hello"));

app.use(
	"/validated/*",
	validate({
		json: (value) =>
			value !== null &&
			!Array.isArray(value) &&
			typeof value === "object" &&
			typeof value.name === "string" &&
			value.name.length > 0 &&
			value.name.length <= 32,
	}),
);
app.post("/validated/hello", (c) => c.json({ name: c.req.validated.name }));

app.onNotFound((c) => {
	return c.json(
		{
			error: "Not Found",
			path: c.req.path,
		},
		404,
	);
});

app.onMethodNotAllowed((c, allow) => {
	return c.json(
		{
			error: "Method Not Allowed",
			allow,
		},
		405,
	);
});

app.onError((error, c) => {
	trace(`[http] custom error handler path=${c.req.path} error=${error}\n`);
	return c.json(
		{
			error: "Internal Server Error",
		},
		500,
	);
});

app.use(async (c, next) => {
	const startedAt = Date.now();
	const method = c.req.method.toUpperCase();
	const path = c.req.path;

	try {
		const response = await next();
		c.header("X-Powered-By", "moddable-http-server");
		const duration = Date.now() - startedAt;
		const status = response?.status ?? 500;
		const contentLength = response?.headers?.get("content-length") ?? "-";
		trace(`[http] ${method} ${path} -> ${status} ${duration}ms length=${contentLength}\n`);
		return response;
	} catch (error) {
		const duration = Date.now() - startedAt;
		trace(`[http] ${method} ${path} -> 500 ${duration}ms error=${error}\n`);
		throw error;
	}
});

app.use(
	"/private/*",
	basicAuth({
		username: "admin",
		password: "secret",
		realm: "Example",
	}),
);

app.get("/response", (_c) => {
	return new Response("Thank you for coming", {
		status: 201,
		headers: {
			"X-Message": "Hello",
			"Content-Type": "text/plain",
		},
	});
});

app.get("/response/default", () => {
	return new Response("Default response");
});

app.get("/response/text", async (c) => {
	return c.text(await new Response("こんにちは🌍").text());
});

app.get("/response/json", async (c) => {
	return c.json(await new Response(JSON.stringify({ message: "こんにちは🌍" })).json());
});

app.get("/header", (c) => {
	const userAgent = c.req.header("User-Agent");
	return c.text(`Your UserAgent is ${userAgent}`);
});

app.get("/query", (c) => {
	const text = c.req.query("text");
	return c.text(`Your  query is ${text}`);
});

app.get("/redirect", (c) => {
	return c.redirect("/json");
});

app.get("/redirect/307", (c) => {
	c.status(307);
	return c.redirect("/json");
});

app.get("/json", (c) => {
	const posts = [
		{ id: 1, title: "Good Morning" },
		{ id: 2, title: "Good Afternoon" },
		{ id: 3, title: "Good Evening" },
		{ id: 4, title: "Good Night" },
	];
	return c.json(posts);
});

app.post("/post/text", async (c) => {
	const text = await c.req.text();
	return c.json({ message: `${text} received!` }, 201);
});

app.post("/post/json", async (c) => {
	const json = await c.req.json();
	return c.json(json);
});

app.post("/post/binary", async (c) => {
	const body = await c.req.arrayBuffer();
	return c.text(`bytes: ${body.byteLength}, text: ${new TextDecoder("utf-8", { fatal: true }).decode(body)}`);
});

app.post("/post/form", async (c) => {
	const form = await c.req.formData();
	return c.text(`form: ${JSON.stringify(form)}`);
});

app.get("/users/:id", (c) => {
	return c.json({
		route: "/users/:id",
		id: c.param("id"),
	});
});

app.get("/files/*", (c) => {
	return c.json({
		route: "/files/*",
		path: c.param("*"),
	});
});

app.get("/private/secret", (c) => {
	return c.json({
		message: "Authenticated",
		user: "admin",
	});
});

app.use("/unicode-private/*", basicAuth({ username: "利用者🌍", password: "秘密🔑" }));
app.get("/unicode-private/secret", (c) => c.text("Authenticated"));

app.get("/status/204", () => {
	return new Response("", { status: 204 });
});

app.get("/status/304", () => {
	return new Response("", { status: 304 });
});

app.get("/error", () => {
	throw new Error("boom");
});

import { HttpServer, Response } from "http-server";

const app = new HttpServer();

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
	return c.text(`bytes: ${body.byteLength}, text: ${String.fromArrayBuffer(body)}`);
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

app.get("/status/204", () => {
	return new Response("", { status: 204 });
});

app.get("/status/304", () => {
	return new Response("", { status: 304 });
});

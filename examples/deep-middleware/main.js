import { HttpServer } from "http-server";

const app = new HttpServer();

for (let index = 0; index < 256; index += 1) {
	app.use("/deep-stack/*", async (_c, next) => {
		return await next();
	});
}

app.get("/deep-stack/ok", (c) => {
	return c.json({
		message: "deep middleware ok",
		path: c.req.path,
	});
});

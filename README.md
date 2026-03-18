# moddable-http-server

Lightweight HTTP server for the [Moddable SDK](https://github.com/Moddable-OpenSource/moddable).

It provides a small but practical API:

- Routing (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
- Path params (`/users/:id`) and wildcard routes (`/files/*`)
- Middleware (`app.use(...)`)
- Context helpers for text/JSON/redirect responses
- Request helpers for headers, query, body parsing

## Requirements

- Node.js / npm
- Moddable SDK (`mcconfig` command available)
- Hurl (`hurl` command available)

## Project Structure

- `src/http-server.js`: core implementation (`HttpServer`, `Response`)
- `src/manifest.json`: module manifest
- `examples/basic/main.js`: runnable example app
- `tests/*.hurl`: HTTP behavior tests

## Quick Start

Install dependencies:

```bash
npm install
```

Run the example server:

```bash
npm run start
```

The example manifest starts a server on port `80` by default.

Run HTTP tests (expects server at `http://localhost:80`):

```bash
npm run test:http
```

Run start + tests together:

```bash
npm test
```

## Usage

### Import

```js
import { HttpServer, Response } from "http-server";
```

### Minimal App

```js
import { HttpServer } from "http-server";

const app = new HttpServer({ port: 80 });

app.get("/", (c) => c.text("hello"));
app.get("/users/:id", (c) => c.json({ id: c.param("id") }));
app.get("/files/*", (c) => c.json({ path: c.param("*") }));
```

### Middleware

```js
app.use(async (c, next) => {
  const res = await next();
  c.header("X-Powered-By", "moddable-http-server");
  return res;
});

app.use("/api/*", async (c, next) => {
  return await next();
});
```

`app.use(path, ...handlers)` supports:

- `"*"` (default): applies to all routes
- exact path: `"/api"`
- prefix wildcard: `"/api/*"`

## API

### `new HttpServer(options?)`

- `options.port` (optional): server port

### Route Registration

- `app.get(path, handler)`
- `app.post(path, handler)`
- `app.put(path, handler)`
- `app.patch(path, handler)`
- `app.delete(path, handler)`

`handler` signature:

```js
(c) => Response | Promise<Response>
```

### Context (`c`)

- `c.req`: request object
- `c.param(key?)`: route params (`key` omitted => full params object)
- `c.status(code)`: set default status for `c.text()` / `c.json()` / `c.redirect()`
- `c.header(key, value)`: set a header on the final response
- `c.text(body, status?)`: create text response
- `c.json(value, status?)`: create JSON response
- `c.redirect(location, status?)`: create redirect response
- `c.notFound()`: `404 Resource Not Found`

### Request (`c.req`)

- `method`: lowercased HTTP method
- `path`: pathname
- `url`: full URL
- `header(name)`: get request header
- `query(key?)`: query value or full query object
- `params`: matched route params
- `await text()`
- `await json()`
- `await arrayBuffer()`
- `await formData()` (URL-encoded form data)

### `new Response(body, options?)`

- `options.status` (default: `200`)
- `options.headers`

Behavior:

- Default `content-type`: `application/octet-stream`
- Default `content-length`: computed from body bytes
- For `204` / `304`: body is cleared and `content-length` is removed

Headers queued with `c.header()` are merged into the final returned `Response`, so middleware can set headers either before or after `await next()`.

## Routing and HTTP Behavior

Current behavior (validated by tests):

- Trailing slash normalization (`/users/123/` matches `/users/:id`)
- `HEAD` falls back to `GET` route matching
- `OPTIONS` returns `204` with route-specific `Allow` header
- Method mismatch on existing route returns `405 Method Not Allowed` with `Allow` header
- Unmatched route returns `404 Resource Not Found`
- Handler/middleware errors fall back to `500 Internal Server Error`
- If a handler returns `undefined`, it falls back to `500 Internal Server Error`
- `connection: close` is added when missing

## License

[MIT](./LICENSE)

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

- `src/http-server.ts`: TypeScript core implementation (`HttpServer`, `Response`)
- `src/manifest.json`: module manifest
- `examples/basic/main.js`: basic feature example app
- `examples/deep-middleware/main.js`: deep middleware chain example app
- `middleware/basic-auth/`: optional Basic 認証ミドルウェア
- `tests/*.hurl`: HTTP behavior tests

## Quick Start

Install dependencies:

```bash
npm install
```

Run the basic example server:

```bash
npm run start
```

The example manifest starts a server on port `80` by default.

Run HTTP tests (expects server at `http://localhost:80`):

```bash
npm run test:http
```

Type-check the server and middleware implementations:

```bash
npm run typecheck
```

Run the separate deep-middleware example + test when you want to validate long middleware chains:

```bash
npm run start:deep-middleware
npm run test:http:deep-middleware
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

### Optional Middleware Modules

Optional middleware lives under `middleware/<name>/` and is enabled by adding its `manifest.json` to your app manifest.

```json
{
  "include": [
    "../../src/manifest.json",
    "../../middleware/basic-auth/manifest.json"
  ]
}
```

Basic auth usage:

```js
import { basicAuth } from "basic-auth";

app.use("/private/*", basicAuth({
  username: "admin",
  password: "secret",
  realm: "Example"
}));
```

When authentication fails, the middleware returns `401 Unauthorized` with a `WWW-Authenticate` header.

### Rate limiting

Include `middleware/rate-limit/manifest.json` alongside the server manifest:

```js
import { rateLimit } from "rate-limit";

app.use("/api/*", rateLimit({ limit: 60, windowMs: 60_000 }));
```

`limit` defaults to 60 requests; `windowMs` defaults to 60,000 milliseconds
(valid range: 1–2,147,483,647). Both must be positive integers; `limit` must be a safe integer.
Invalid options throw at registration time.

Each call to `rateLimit()` creates one shared counter for all matching requests,
regardless of client or path. Use separate instances for independent route budgets,
or `app.use(rateLimit(...))` for a server-wide budget. All methods and downstream
failures count, including authentication failures and unmatched routes. Register
the limiter before authentication or validation to count rejected attempts.

The fixed window starts with the first admitted request and resets on the first
request after expiration. Excess requests receive `429` and `Retry-After` in whole
seconds; rejection does not extend the window. Window boundaries can admit a burst
of up to twice the limit. The counter uses elapsed system time, requires constant
memory, and resets when the application restarts. It is not an IP-based limiter.

### JSON validation

Include `middleware/validate/manifest.json` alongside the server manifest:

```js
import { validate } from "validate";

app.use("/api/*", validate({
  json: (value) => value !== null && typeof value === "object"
    && !Array.isArray(value) && typeof value.name === "string"
    && value.name.length > 0 && value.name.length <= 32
}));
app.post("/api/users", (c) => c.json({ name: c.req.validated.name }));
```

`json(value, context)` is required and may be asynchronous. Return exactly `true`
to accept the parsed value; other results produce `400`. Define required fields,
types, lengths, and unknown-field policy in this function. Exceptions thrown by
the validator follow the server's normal `500` error handling.

The middleware accepts `application/json` (case-insensitive, with optional media
type parameters). Missing or other content types produce `415`; empty bodies,
malformed JSON, and invalid UTF-8 produce `400`. Successful validation stores the
parsed value in `c.req.validated`. The body is consumed: downstream handlers must
use that property rather than read the body again. Apply one body validator per
request, before other body readers. Scope it to paths/methods that require JSON;
it does not automatically skip `GET`, `HEAD`, or `OPTIONS`.

These middleware operate after HTTP parsing. They do not impose receive-size,
connection-count, or receive-time limits, and cannot prevent the transport layer
from buffering a request body.

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

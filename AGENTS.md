# AGENTS.md

This file defines working guidelines for AI agents contributing to this repository.

## 1. Project Summary
- Name: `moddable-http-server`
- Purpose: Lightweight HTTP server for Moddable SDK (router, request/response, context API)
- Core implementation: `src/http-server.js`
- Usage example: `examples/basic/main.js`
- API tests: `tests/*.hurl`

## 2. Key Directories
- `src/`
  - Library implementation (`HttpServer`, `Router`, `Request`, `Response`, `Context`)
- `examples/basic/`
  - Example app covering routes, headers, JSON, and status handling
- `tests/`
  - HTTP API tests written in Hurl
- `package.json`
  - Development scripts (`format`, `lint`, `start`, `test`)

## 3. Prerequisites
- Node.js / npm
- Moddable SDK (`mcconfig` command available)
- Hurl (`hurl` command available)

`npm test` runs both `npm run start` (via `mcconfig`) and Hurl tests, so missing tools will cause failures.

## 4. Development Commands
- Format: `npm run format`
- Lint: `npm run lint`
- Run example app: `npm run start`
- Run HTTP tests only: `npm run test:http`
- Start + test: `npm test`

## 5. Change Policy
- Keep changes minimal and preserve existing API behavior.
- Do not break routing behavior:
  - Static routes, parameter routes (`:param`), wildcard routes (`*`)
  - Trailing slash normalization
  - `HEAD` fallback to `GET`
  - `OPTIONS` handling with `204` + `Allow` header
- Preserve `Response` behavior:
  - Default `content-type` / `content-length`
  - No body for `204` and `304` (and no `content-length`)
- Preserve current error fallback behavior (`500 Internal Server Error`).

## 6. Implementation Guidance
- Check `examples/basic/main.js` and `tests/*.hurl` first to understand expected behavior.
- For Hurl syntax, sections, request body writing, and CLI/report options, always refer to the official Hurl documentation first: https://hurl.dev/docs/request.html , https://hurl.dev/docs/grammar.html , https://hurl.dev/docs/running-tests.html , https://hurl.dev/docs/manual.html
- Do not invent or guess unsupported Hurl syntax, section names, or options. If a construct cannot be verified in the official Hurl docs or existing repo tests, treat it as uncertain rather than proposing it as valid.
- Add or update tests for any API behavior change.
- Avoid renaming public interfaces (`Context`, `Request`, `Response`, `HttpServer`) unless explicitly required.
- Keep header handling aligned with existing normalization logic.

## 7. Test Strategy
- For behavior changes, run at least `npm run test:http`.
- If routing or status behavior changes, prefer full `npm test`.
- When adding tests, include edge cases (trailing slash, unmatched routes, empty bodies), not only happy paths.

## 8. Recommended Agent Workflow
1. Identify target code and related tests (`src/http-server.js`, `examples/basic/main.js`, `tests/*.hurl`).
2. Implement the smallest possible diff.
3. Run `npm run lint`.
4. Run `npm run test:http` or `npm test` based on impact.
5. Report what changed and what was verified.

## 9. Anti-Patterns
- Do not mix unrelated large refactors with focused fixes.
- Do not change behavior without updating tests.
- Do not add dependencies without clear necessity.
- Do not break behavior demonstrated in `examples/`.

import Time from "time";
import type { Middleware } from "http-server";

interface RateLimitOptions {
	limit?: number;
	windowMs?: number;
}

function rateLimit({ limit = 60, windowMs = 60_000 }: RateLimitOptions = {}): Middleware {
	if (!Number.isSafeInteger(limit) || limit < 1) {
		throw new RangeError("limit must be a positive safe integer");
	}
	if (!Number.isInteger(windowMs) || windowMs < 1 || windowMs > 0x7fffffff) {
		throw new RangeError("windowMs must be between 1 and 2147483647");
	}

	let startedAt: number | undefined;
	let count = 0;
	return (c, next) => {
		const now = Time.ticks;
		let elapsed = startedAt === undefined ? windowMs : Time.delta(startedAt, now);
		if (elapsed < 0 || elapsed >= windowMs) {
			startedAt = now;
			count = 0;
			elapsed = 0;
		}
		if (count >= limit) {
			c.header("Retry-After", String(Math.ceil((windowMs - elapsed) / 1000)));
			return c.text("Too Many Requests", 429);
		}
		count += 1;
		return next();
	};
}

export { rateLimit };
export type { RateLimitOptions };

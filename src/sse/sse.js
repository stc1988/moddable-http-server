import { Response } from "http-server";

function appendLines(lines, field, value) {
	if (value === undefined || value === null) {
		return;
	}

	const normalized = String(value).replace(/\r\n?/gu, "\n");
	for (const line of normalized.split("\n")) {
		lines.push(`${field}: ${line}`);
	}
}

function encodeServerSentEvent(event) {
	if (typeof event === "string") {
		return `data: ${event}\n\n`;
	}

	if (!event || typeof event !== "object") {
		return "\n";
	}

	const lines = [];

	if (event.comment !== undefined && event.comment !== null) {
		const normalizedComment = String(event.comment).replace(/\r\n?/gu, "\n");
		for (const line of normalizedComment.split("\n")) {
			lines.push(`: ${line}`);
		}
	}

	appendLines(lines, "id", event.id);
	appendLines(lines, "event", event.event);
	appendLines(lines, "retry", event.retry);

	const data = typeof event.data === "object" && event.data !== null ? JSON.stringify(event.data) : event.data;
	appendLines(lines, "data", data);

	return `${lines.join("\n")}\n\n`;
}

class EventStreamResponse extends Response {
	constructor(events = [], options = {}) {
		const items = Array.isArray(events) ? events : [events];
		const body = items.map((event) => encodeServerSentEvent(event)).join("");
		super(body, {
			...options,
			headers: {
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"Content-Type": "text/event-stream",
				...(options.headers ?? {}),
			},
		});
	}
}

function sse(events, options) {
	return new EventStreamResponse(events, options);
}

export { encodeServerSentEvent, EventStreamResponse, sse };

function validate({ json } = {}) {
	if (typeof json !== "function") {
		throw new TypeError("json must be a validation function");
	}
	return async (c, next) => {
		const contentType = c.req.header("content-type")?.split(";", 1)[0].trim().toLowerCase();
		if (contentType !== "application/json") {
			return c.text("Unsupported Media Type", 415);
		}

		let value;
		try {
			const text = await c.req.text();
			if (text == null || text.length === 0) {
				return c.text("Bad Request", 400);
			}
			value = JSON.parse(text);
		} catch {
			return c.text("Bad Request", 400);
		}
		// Validator exceptions are programming errors and follow the server's 500 handling.
		if ((await json(value, c)) !== true) {
			return c.text("Bad Request", 400);
		}
		c.req.validated = value;
		return next();
	};
}

export { validate };

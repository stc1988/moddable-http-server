import { Response } from "http-server";

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBase64(input) {
	let clean = "";
	for (let i = 0; i < input.length; i += 1) {
		const char = input[i];
		if (char !== "\r" && char !== "\n" && char !== "\t" && char !== " ") {
			clean += char;
		}
	}

	if (clean.length === 0 || clean.length % 4 !== 0) {
		return null;
	}

	let output = "";
	for (let i = 0; i < clean.length; i += 4) {
		const chunk = clean.slice(i, i + 4);
		let padding = 0;
		const values = [];

		for (let j = 0; j < chunk.length; j += 1) {
			const char = chunk[j];
			if (char === "=") {
				padding += 1;
				values.push(0);
				continue;
			}

			const value = BASE64_ALPHABET.indexOf(char);
			if (value < 0) {
				return null;
			}
			values.push(value);
		}

		const buffer = (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];
		output += String.fromCharCode((buffer >> 16) & 255);
		if (padding < 2) {
			output += String.fromCharCode((buffer >> 8) & 255);
		}
		if (padding < 1) {
			output += String.fromCharCode(buffer & 255);
		}
	}

	return output;
}

function createUnauthorizedResponse(realm) {
	return new Response("Unauthorized", {
		status: 401,
		headers: {
			"Content-Type": "text/plain",
			"WWW-Authenticate": `Basic realm="${realm}"`,
		},
	});
}

function parseCredentials(headerValue) {
	if (!headerValue) {
		return null;
	}

	const separatorIndex = headerValue.indexOf(" ");
	if (separatorIndex < 0) {
		return null;
	}

	const scheme = headerValue.slice(0, separatorIndex).toLowerCase();
	if (scheme !== "basic") {
		return null;
	}

	const encoded = headerValue.slice(separatorIndex + 1);
	const decoded = decodeBase64(encoded);
	if (!decoded) {
		return null;
	}

	const credentialSeparatorIndex = decoded.indexOf(":");
	if (credentialSeparatorIndex < 0) {
		return null;
	}

	return {
		username: decoded.slice(0, credentialSeparatorIndex),
		password: decoded.slice(credentialSeparatorIndex + 1),
	};
}

function basicAuth(options = {}) {
	const username = options.username ?? "";
	const password = options.password ?? "";
	const realm = options.realm ?? "Restricted";

	return async (c, next) => {
		const credentials = parseCredentials(c.req.header("authorization"));
		if (!credentials || credentials.username !== username || credentials.password !== password) {
			return createUnauthorizedResponse(realm);
		}

		return await next();
	};
}

export { basicAuth };

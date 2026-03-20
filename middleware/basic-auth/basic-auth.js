import { Response } from "http-server";
import Base64 from "base64";

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

	try {
		return String.fromArrayBuffer(Base64.decode(clean));
	} catch {
		return null;
	}
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

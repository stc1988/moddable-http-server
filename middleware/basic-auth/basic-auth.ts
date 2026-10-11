import { Response } from "http-server";
import type { Middleware } from "http-server";
import TextDecoder from "text/decoder";

interface BasicAuthOptions {
	username?: string;
	password?: string;
	realm?: string;
}

interface Credentials {
	username: string;
	password: string;
}

const Uint8ArrayWithBase64 = Uint8Array as typeof Uint8Array & {
	fromBase64(input: string): Uint8Array;
};

function decodeBase64(input: string): string | null {
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
		return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Uint8ArrayWithBase64.fromBase64(clean));
	} catch {
		return null;
	}
}

function createUnauthorizedResponse(realm: string): Response {
	return new Response("Unauthorized", {
		status: 401,
		headers: {
			"Content-Type": "text/plain",
			"WWW-Authenticate": `Basic realm="${realm}"`,
		},
	});
}

function parseCredentials(headerValue: string | undefined): Credentials | null {
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

function basicAuth(options: BasicAuthOptions = {}): Middleware {
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
export type { BasicAuthOptions };

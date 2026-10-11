declare module "listen" {
	import type Headers from "headers";
	// biome-ignore lint/style/useNodejsImportProtocol: use Moddable's built-in url module
	import type URL from "url";

	interface ListenOptions {
		port?: number;
	}

	interface ListenRequest {
		readonly method: string;
		readonly url: URL;
		readonly headers: Headers;
		arrayBuffer(): Promise<ArrayBuffer | null | undefined>;
	}

	interface ListenResponse {
		readonly status: number;
		readonly headers: Headers;
		arrayBuffer(): Promise<ArrayBuffer | undefined>;
	}

	interface Connection {
		readonly request: ListenRequest;
		close(): void;
		respondWith(response: ListenResponse | PromiseLike<ListenResponse> | undefined): Promise<void>;
	}

	export default function listen(options?: ListenOptions): AsyncIterable<Connection>;
}

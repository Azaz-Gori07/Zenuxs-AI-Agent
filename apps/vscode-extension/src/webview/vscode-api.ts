import type { WebviewMessage } from "./types.js";

declare function acquireVsCodeApi(): {
	postMessage(message: WebviewMessage): void;
	getState(): Record<string, unknown> | undefined;
	setState(state: Record<string, unknown>): void;
};

const api = typeof (window as any).vscodeApi !== "undefined"
	? (window as any).vscodeApi
	: acquireVsCodeApi();

if (typeof (window as any).vscodeApi === "undefined") {
	(window as any).vscodeApi = api;
}

export function postMessage(message: WebviewMessage): void {
	api.postMessage(message);
}

export { api as vscodeApi };

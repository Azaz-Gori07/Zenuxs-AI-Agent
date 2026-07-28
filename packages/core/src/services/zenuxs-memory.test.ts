import { describe, expect, it, mock } from "bun:test";
import { fetchZenuxsMemory } from "./zenuxs-memory";
import { createRemoteConversation, addRemoteMessages } from "./zenuxs-conversation-sync";

describe("ZenuxsMemory & Conversation Sync", () => {
	it("skips network call and returns empty context when authToken is empty", async () => {
		const result = await fetchZenuxsMemory("   ");
		expect(result.hasMemories).toBe(false);
		expect(result.promptBlock).toBe("");
	});

	it("handles 401 response from memory endpoint gracefully with warning", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = mock(async () => {
			return new Response("Unauthorized token", {
				status: 401,
				statusText: "Unauthorized",
				headers: { "x-request-id": "req-12345" },
			});
		}) as unknown as typeof fetch;

		try {
			const result = await fetchZenuxsMemory("invalid_token");
			expect(result.hasMemories).toBe(false);
			expect(result.promptBlock).toBe("");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("skips remote conversation creation when token is empty", async () => {
		const convId = await createRemoteConversation("");
		expect(convId).toBeNull();
	});

	it("handles 401 on conversation creation gracefully", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = mock(async () => {
			return new Response("Unauthorized", {
				status: 401,
				headers: { "x-request-id": "req-999" },
			});
		}) as unknown as typeof fetch;

		try {
			const convId = await createRemoteConversation("expired_token");
			expect(convId).toBeNull();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("skips message push when remoteConvId is empty", async () => {
		const success = await addRemoteMessages("valid_token", "", []);
		expect(success).toBe(false);
	});
});

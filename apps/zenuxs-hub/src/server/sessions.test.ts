import { describe, expect, it, vi } from "vitest";
import { createSession, sendMessage } from "./sessions";
import { HubContext } from "./state";
import type { BrowserPeer } from "./types";

function createPeer(): BrowserPeer & { sent: unknown[] } {
	const sent: unknown[] = [];
	return {
		displayName: "test-peer",
		sending: false,
		sent,
		socket: {
			send: (payload: string) => {
				sent.push(JSON.parse(payload) as unknown);
			},
		} as BrowserPeer["socket"],
	};
}

describe("hub sessions", () => {
	it("starts a new session when the selected provider/model changes", async () => {
		const ctx = new HubContext();
		const start = vi
			.fn()
			.mockResolvedValueOnce({ sessionId: "sess-cline" })
			.mockResolvedValueOnce({ sessionId: "sess-openrouter" });
		const send = vi.fn();
		ctx.cline = {
			start,
			send,
		} as never;
		const peer = createPeer();

		await createSession(ctx, peer, "first", {
			provider: "cline",
			model: "anthropic/claude-sonnet-4.6",
		});
		await sendMessage(ctx, peer, "second", {
			provider: "openrouter",
			model: "openai/gpt-oss-120b:free",
		});

		expect(start).toHaveBeenCalledTimes(2);
		expect(start.mock.calls[1]?.[0]).toMatchObject({
			config: {
				providerId: "openrouter",
				modelId: "openai/gpt-oss-120b:free",
			},
		});
		expect(peer.selectedSessionId).toBe("sess-openrouter");
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: "sess-openrouter",
				prompt: "second",
			}),
		);
		expect(send).not.toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: "sess-cline",
				prompt: "second",
			}),
		);
	});
});

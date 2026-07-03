import { describe, expect, it } from "vitest";
import type {
	GatewayProviderContext,
	GatewayStreamRequest,
} from "@cline/shared";
import { composeAiSdkProviderOptions } from "./provider-options";
import { ANTHROPIC_AND_QWEN_CACHE_ROUTING_METADATA } from "./anthropic-compatible";

/**
 * Reproduces the user's exact scenario: cline + deepseek-v4-flash with
 * reasoning.effort set but enabled unset. The Cline gateway API rejects
 * 'reasoningSummary', 'effort', 'reasoning' as unsupported parameters.
 */
function makeClineDeepseekContext(): GatewayProviderContext {
	const providerId = "cline";
	const modelId = "deepseek/deepseek-v4-flash";
	return {
		provider: {
			id: providerId,
			name: "Cline",
			defaultModelId: modelId,
			models: [{ id: modelId, name: modelId, providerId, capabilities: ["reasoning", "prompt-cache"] }],
			// Cline is registered with ANTHROPIC_AND_QWEN_CACHE_ROUTING_METADATA
			metadata: ANTHROPIC_AND_QWEN_CACHE_ROUTING_METADATA,
		},
		model: {
			id: modelId,
			name: modelId,
			providerId,
			capabilities: ["reasoning"],
			metadata: { family: "deepseek" },
		},
		config: { providerId },
	};
}

describe("user repro: cline + deepseek-v4-flash + effort only", () => {
	it("prints composed provider options for the user scenario", () => {
		const request: GatewayStreamRequest = {
			providerId: "cline",
			modelId: "deepseek/deepseek-v4-flash",
			messages: [],
			reasoning: {
				effort: "high",
				budgetTokens: 6000,
			},
		};
		const context = makeClineDeepseekContext();
		const options = composeAiSdkProviderOptions(request, context);
		// eslint-disable-next-line no-console
		console.log(
			"COMPOSED OPTIONS (cline+deepseek+effortOnly):\n" +
				JSON.stringify(options, null, 2),
		);
		expect(options).toBeDefined();
	});
});

import { describe, expect, it } from "vitest";
import { safeParseSettings, toProviderConfig } from "./provider-settings";

describe("provider settings", () => {
	it("normalizes OpenCode Zen docs and endpoint URLs to the API root", () => {
		for (const baseUrl of [
			"https://opencode.ai/zen",
			"https://opencode.ai/zen/",
			"https://opencode.ai/zen/v1",
			"https://opencode.ai/zen/v1/responses",
			"https://opencode.ai/zen/v1/chat/completions",
		]) {
			const config = toProviderConfig({
				provider: "opencode-zen",
				model: "deepseek-v4-flash-free",
				apiKey: "zen-key",
				baseUrl,
			});

			expect(config.baseUrl, baseUrl).toBe("https://opencode.ai/zen/v1");
		}
	});

	it("formats Cline OAuth access tokens for runtime API keys", () => {
		const config = toProviderConfig({
			provider: "cline",
			model: "anthropic/claude-sonnet-4.6",
			auth: {
				accessToken: "oauth-access-token",
			},
		});

		expect(config.apiKey).toBe("workos:oauth-access-token");
		expect(config.accessToken).toBe("oauth-access-token");
	});

	it("does not expose OAuth access tokens on API-key provider configs", () => {
		for (const provider of [
			"openrouter",
			"nvidia",
			"openai-compatible",
			"anthropic",
			"gemini",
			"groq",
			"deepseek",
		]) {
			const config = toProviderConfig({
				provider,
				model: "test-model",
				auth: {
					accessToken: "workos:cline-token",
				},
			});

			expect(config.apiKey, provider).toBeUndefined();
			expect(config.accessToken, provider).toBeUndefined();
		}
	});

	it("accepts the Bedrock apikey authentication alias", () => {
		const result = safeParseSettings({
			provider: "bedrock",
			model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
			aws: {
				authentication: "apikey",
				region: "us-east-1",
			},
		});

		expect(result.success).toBe(true);
		if (!result.success) {
			throw new Error("expected Bedrock apikey settings to parse");
		}

		expect(toProviderConfig(result.data).aws).toEqual(
			expect.objectContaining({
				authentication: "apikey",
			}),
		);
	});
});

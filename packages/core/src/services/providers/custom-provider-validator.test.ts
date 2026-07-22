import { afterEach, describe, expect, it, vi } from "vitest";
import { validateCustomProviderConfig } from "./custom-provider-validator";

const ORIGINAL_FETCH = globalThis.fetch;

describe("custom-provider-validator", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		globalThis.fetch = ORIGINAL_FETCH;
	});

	it("throws 'Invalid Base URL' for malformed URLs", async () => {
		await expect(
			validateCustomProviderConfig({
				baseUrl: "not-a-valid-url",
				modelId: "gpt-4",
			}),
		).rejects.toThrow("Invalid Base URL");
	});

	it("throws 'Invalid Base URL' when endpoint is unreachable", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

		await expect(
			validateCustomProviderConfig({
				baseUrl: "https://unreachable.endpoint.local/v1",
				modelId: "gpt-4",
			}),
		).rejects.toThrow("Invalid Base URL");
	});

	it("throws 'Invalid API Key' when response is 401 Unauthorized", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		);

		await expect(
			validateCustomProviderConfig({
				baseUrl: "https://api.custom.com/v1",
				apiKey: "bad-key",
				modelId: "gpt-4",
			}),
		).rejects.toThrow("Invalid API Key");
	});

	it("throws 'Invalid Model' when model is not found in /models and completion returns 404", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [{ id: "other-model" }] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ error: { message: "model_not_found" } }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					},
				),
			);

		await expect(
			validateCustomProviderConfig({
				baseUrl: "https://api.custom.com/v1",
				apiKey: "valid-key",
				modelId: "nonexistent-model",
			}),
		).rejects.toThrow("Invalid Model");
	});

	it("succeeds when model is listed in /models endpoint", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({ data: [{ id: "custom-model-v1" }] }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			),
		);

		const result = await validateCustomProviderConfig({
			baseUrl: "https://api.custom.com/v1",
			apiKey: "valid-key",
			modelId: "custom-model-v1",
		});

		expect(result.success).toBe(true);
		expect(result.normalizedBaseUrl).toBe("https://api.custom.com/v1");
	});

	it("succeeds when model completion succeeds", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						choices: [{ message: { content: "pong" } }],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			);

		const result = await validateCustomProviderConfig({
			baseUrl: "https://api.custom.com/v1/",
			apiKey: "valid-key",
			modelId: "llama-3-70b",
		});

		expect(result.success).toBe(true);
		expect(result.normalizedBaseUrl).toBe("https://api.custom.com/v1");
	});
});

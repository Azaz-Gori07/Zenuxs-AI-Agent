import { afterEach, describe, expect, it, vi } from "vitest";
import { createSapAiCoreProviderModule, createOpenCodeProviderModule } from "./community";

const originalServiceKey = process.env.AICORE_SERVICE_KEY;

const mockCreateOpencode = vi.fn().mockImplementation((options) => {
	const modelFn = (modelId: string) => ({ modelId, options });
	return modelFn;
});

vi.mock("ai-sdk-provider-opencode-sdk", () => ({
	get createOpencode() {
		return mockCreateOpencode;
	},
}));

describe("createSapAiCoreProviderModule", () => {
	afterEach(() => {
		if (originalServiceKey === undefined) {
			delete process.env.AICORE_SERVICE_KEY;
		} else {
			process.env.AICORE_SERVICE_KEY = originalServiceKey;
		}
	});

	it("passes SAP credentials as a provider destination without mutating process env", async () => {
		process.env.AICORE_SERVICE_KEY = "existing-service-key";

		const provider = await createSapAiCoreProviderModule({
			providerId: "sapaicore",
			baseUrl: "https://api.ai.example.aws.ml.hana.ondemand.com",
			options: {
				clientId: "sap-client",
				clientSecret: "sap-secret",
				tokenUrl: "https://auth.example",
				deploymentId: "deployment-id",
			},
		});

		const model = provider.model("anthropic--claude-4.6-sonnet") as {
			config?: { destination?: Record<string, unknown> };
		};

		expect(process.env.AICORE_SERVICE_KEY).toBe("existing-service-key");
		expect(model.config?.destination).toMatchObject({
			authentication: "OAuth2ClientCredentials",
			clientId: "sap-client",
			clientSecret: "sap-secret",
			tokenServiceUrl: "https://auth.example/oauth/token",
			url: "https://api.ai.example.aws.ml.hana.ondemand.com",
		});
	}, 20000);

	it("fails fast for partial explicit SAP configuration", async () => {
		await expect(
			createSapAiCoreProviderModule({
				providerId: "sapaicore",
				options: {
					clientId: "sap-client",
					clientSecret: "sap-secret",
					tokenUrl: "https://auth.example",
				},
			}),
		).rejects.toThrow(/baseUrl/);
	});
});

describe("createOpenCodeProviderModule", () => {
	it("correctly resolves api keys and configures OpencodeProviderSettings", async () => {
		mockCreateOpencode.mockClear();

		const mockFetch = vi.fn();
		const provider = await createOpenCodeProviderModule({
			providerId: "opencode",
			apiKey: "test-opencode-key",
			baseUrl: "https://opencode.ai/zen/v1",
			fetch: mockFetch as any,
			headers: { "x-custom-header": "value" },
			options: {
				hostname: "localhost",
				port: 8080,
				autoStartServer: false,
			},
		});

		expect(mockCreateOpencode).toHaveBeenCalledTimes(1);
		expect(mockCreateOpencode).toHaveBeenCalledWith(
			expect.objectContaining({
				hostname: "localhost",
				port: 8080,
				autoStartServer: false,
				baseUrl: "https://opencode.ai/zen/v1",
				clientOptions: expect.objectContaining({
					auth: "test-opencode-key",
					fetch: mockFetch,
					headers: expect.objectContaining({
						"x-api-key": "test-opencode-key",
						"x-custom-header": "value",
					}),
				}),
			})
		);

		const modelResult = provider.model("openai/gpt-5.5") as any;
		expect(modelResult.modelId).toBe("openai/gpt-5.5");
	});
});

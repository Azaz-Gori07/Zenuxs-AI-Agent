import type { ProviderSettings } from "@cline/core";
import { describe, expect, it } from "vitest";
import { getAuthKind, isProviderConfigured } from "./provider-auth";

describe("getAuthKind", () => {
	it("keeps each account login distinct", () => {
		expect(getAuthKind("zenuxs")).toBe("zenuxs");
		expect(getAuthKind("openai-codex")).toBe("chatgpt");
		expect(getAuthKind("codex")).toBe("chatgpt");
		expect(getAuthKind("cline")).toBe("cline");
		expect(getAuthKind("cline-pass")).toBe("cline-pass");
		expect(getAuthKind("oca")).toBe("oca");
	});

	it("treats API-key and custom-model providers as a separate path", () => {
		expect(getAuthKind("openai-compatible")).toBe("api-key");
		expect(getAuthKind("zai")).toBe("api-key");
		expect(getAuthKind("anthropic")).toBe("api-key");
	});
});

describe("isProviderConfigured", () => {
	it("returns false when settings is undefined", () => {
		expect(isProviderConfigured("anthropic", undefined)).toBe(false);
	});

	it("returns false when api-key settings have no useful fields", () => {
		expect(
			isProviderConfigured("anthropic", {
				provider: "anthropic",
			} satisfies ProviderSettings),
		).toBe(false);
	});

	it("treats any persisted api key as configured", () => {
		expect(
			isProviderConfigured("anthropic", {
				provider: "anthropic",
				apiKey: "sk-test",
			} satisfies ProviderSettings),
		).toBe(true);
	});

	it("treats a persisted base URL as configured", () => {
		expect(
			isProviderConfigured("ollama", {
				provider: "ollama",
				baseUrl: "http://localhost:11434/v1",
			} satisfies ProviderSettings),
		).toBe(true);
	});

	it("treats a persisted model id as configured", () => {
		expect(
			isProviderConfigured("ollama", {
				provider: "ollama",
				model: "llama3.1",
			} satisfies ProviderSettings),
		).toBe(true);
	});

	it("treats lmstudio with model + base url as configured", () => {
		expect(
			isProviderConfigured("lmstudio", {
				provider: "lmstudio",
				model: "qwen2",
				baseUrl: "http://localhost:1234/v1",
			} satisfies ProviderSettings),
		).toBe(true);
	});

	it("requires an OAuth access token for cline", () => {
		expect(
			isProviderConfigured("cline", {
				provider: "cline",
			} satisfies ProviderSettings),
		).toBe(false);

		expect(
			isProviderConfigured("cline", {
				provider: "cline",
				auth: { accessToken: "workos:abc" },
			} satisfies ProviderSettings),
		).toBe(true);
	});
});

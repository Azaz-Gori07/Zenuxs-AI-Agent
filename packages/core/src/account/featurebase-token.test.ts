import { describe, expect, it, vi } from "vitest";
import { ZenuxsAccountService } from "./zenuxs-account-service";
import type {
	ZenuxsAccountOperations,
} from "./rpc";
import {
	executeZenuxsAccountAction,
	RpcZenuxsAccountService,
} from "./rpc";

describe("ZenuxsAccountService.fetchFeaturebaseToken", () => {
	it("returns token when endpoint succeeds", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					success: true,
					data: { featurebaseJwt: "fb-token-123" },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});

		const service = new ZenuxsAccountService({
			apiBaseUrl: "http://127.0.0.1:8787",
			getAuthToken: async () => "workos:token-123",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		const result = await service.fetchFeaturebaseToken();
		expect(result).toEqual({ featurebaseJwt: "fb-token-123" });
	});

	it("returns undefined when endpoint returns non-ok", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response("Internal Server Error", { status: 500 });
		});

		const service = new ZenuxsAccountService({
			apiBaseUrl: "http://127.0.0.1:8787",
			getAuthToken: async () => "workos:token-123",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		const result = await service.fetchFeaturebaseToken();
		expect(result).toBeUndefined();
	});

	it("returns undefined when fetch throws", async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error("Network error");
		});

		const service = new ZenuxsAccountService({
			apiBaseUrl: "http://127.0.0.1:8787",
			getAuthToken: async () => "workos:token-123",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		const result = await service.fetchFeaturebaseToken();
		expect(result).toBeUndefined();
	});

	it("returns undefined when JSON parsing fails", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response("not json", { status: 200 });
		});

		const service = new ZenuxsAccountService({
			apiBaseUrl: "http://127.0.0.1:8787",
			getAuthToken: async () => "workos:token-123",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		const result = await service.fetchFeaturebaseToken();
		expect(result).toBeUndefined();
	});
});

describe("executeZenuxsAccountAction - fetchFeaturebaseToken", () => {
	it("delegates to service.fetchFeaturebaseToken when operation matches", async () => {
		const service: ZenuxsAccountOperations = {
			fetchMe: vi.fn(),
			fetchFeaturebaseToken: vi.fn(async () => ({
				featurebaseJwt: "fb-token-rpc",
			})),
		} as unknown as ZenuxsAccountOperations;

		const result = await executeZenuxsAccountAction(
			{ action: "clineAccount", operation: "fetchFeaturebaseToken" },
			service,
		);
		expect(result).toEqual({ featurebaseJwt: "fb-token-rpc" });
	});

	it("returns undefined when the service method is not implemented", async () => {
		const service: ZenuxsAccountOperations = {
			fetchMe: vi.fn(),
		} as unknown as ZenuxsAccountOperations;

		const result = await executeZenuxsAccountAction(
			{ action: "clineAccount", operation: "fetchFeaturebaseToken" },
			service,
		);
		expect(result).toBeUndefined();
	});
});

describe("RpcZenuxsAccountService.fetchFeaturebaseToken", () => {
	it("delegates fetchFeaturebaseToken to the executor", async () => {
		const runProviderAction = vi.fn(async () => ({
			result: { featurebaseJwt: "fb-token-rpc" },
		}));
		const service = new RpcZenuxsAccountService({ runProviderAction });
		const token = await service.fetchFeaturebaseToken();
		expect(token).toEqual({ featurebaseJwt: "fb-token-rpc" });
	});
});

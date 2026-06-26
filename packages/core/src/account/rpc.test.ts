import { describe, expect, it } from "vitest";
import type {
	ZenuxsAccountOperations,
} from "./rpc";
import {
	executeZenuxsAccountAction,
	RpcZenuxsAccountService,
} from "./rpc";

describe("executeZenuxsAccountAction", () => {
	it("routes fetchMe to the service", async () => {
		const service: ZenuxsAccountOperations = {
			fetchMe: async () => ({
				id: "u-1",
				email: "u@example.com",
				displayName: "User",
				photoUrl: "",
				createdAt: "2025-01-01T00:00:00Z",
				updatedAt: "2025-01-01T00:00:00Z",
				organizations: [],
			}),
		} as ZenuxsAccountOperations;
		const result = await executeZenuxsAccountAction(
			{ action: "clineAccount", operation: "fetchMe" },
			service,
		);
		expect(result).toMatchObject({ id: "u-1" });
	});
});

describe("RpcZenuxsAccountService", () => {
	it("delegates fetchMe to the executor", async () => {
		const runProviderAction = async () => ({
			result: { id: "u-1" },
		});
		const service = new RpcZenuxsAccountService({ runProviderAction });
		const user = await service.fetchMe();
		expect(user).toMatchObject({ id: "u-1" });
	});
});

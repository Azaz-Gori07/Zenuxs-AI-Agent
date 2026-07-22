import { afterEach, describe, expect, it, vi } from "vitest";
import type { ZenuxsOAuthCredentials } from "./zenuxs";
import {
	getValidZenuxsCredentials,
	loginZenuxsOAuth,
	startZenuxsDeviceAuth,
} from "./zenuxs";

const PROVIDER_OPTIONS = {
	apiBaseUrl: "https://auth.example.com",
};
const ORIGINAL_FETCH = globalThis.fetch;

function createCredentials(
	overrides: Partial<ZenuxsOAuthCredentials> = {},
): ZenuxsOAuthCredentials {
	return {
		access: "access-old",
		refresh: "refresh-old",
		expires: 0,
		accountId: "acct-1",
		email: "user@example.com",
		metadata: { provider: "google" },
		...overrides,
	};
}

describe("auth/zenuxs getValidZenuxsCredentials", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		globalThis.fetch = ORIGINAL_FETCH;
	});

	it("returns existing credentials when not expired", async () => {
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(10_000);
		const current = createCredentials({ expires: 400_000 });
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await getValidZenuxsCredentials(current, PROVIDER_OPTIONS);
		expect(result).toBe(current);
		expect(fetchMock).not.toHaveBeenCalled();
		nowSpy.mockRestore();
	});

	it("refreshes expired credentials", async () => {
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(100_000);
		const current = createCredentials({ expires: 101_000 });
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						success: true,
						data: {
							accessToken: "access-new",
							refreshToken: "refresh-new",
							tokenType: "Bearer",
							expiresAt: "2030-01-01T00:00:00.000Z",
							userInfo: {
								subject: "sub-1",
								email: "user@example.com",
								name: "User",
								clineUserId: "acct-1",
								accounts: ["acct-1"],
							},
						},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await getValidZenuxsCredentials(current, PROVIDER_OPTIONS);
		expect(result).toMatchObject({
			access: "access-new",
			refresh: "refresh-new",
		});
		nowSpy.mockRestore();
	});

	it("throws when refresh fails with invalid_grant", async () => {
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(100_000);
		const current = createCredentials({ expires: 101_000 });
		globalThis.fetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						error: "invalid_grant",
						error_description: "refresh expired",
					}),
					{
						status: 401,
						headers: { "Content-Type": "application/json" },
					},
				),
		) as unknown as typeof fetch;

		await expect(
			getValidZenuxsCredentials(current, PROVIDER_OPTIONS),
		).rejects.toThrow("Zenuxs AI session expired");
		nowSpy.mockRestore();
	});

	it("returns existing credentials inside the refresh buffer when the token is still valid", async () => {
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(100_000);
		const current = createCredentials({ expires: 500_000 });
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await getValidZenuxsCredentials(current, PROVIDER_OPTIONS);
		expect(result).toBe(current);
		expect(fetchMock).not.toHaveBeenCalled();
		nowSpy.mockRestore();
	});
});

describe("auth/zenuxs loginZenuxsOAuth", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		globalThis.fetch = ORIGINAL_FETCH;
	});

	it("completes WorkOS device auth and registers tokens", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						device_code: "dev-code-1",
						user_code: "ABCD-EFGH",
						verification_uri: "https://example.com/device",
						verification_uri_complete:
							"https://example.com/device?user_code=ABCD-EFGH",
						expires_in: 300,
						interval: 1,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						access_token: "workos-access",
						refresh_token: "workos-refresh",
						token_type: "Bearer",
						expires_in: 3600,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						success: true,
						data: {
							accessToken: "zenuxs-access",
							refreshToken: "zenuxs-refresh",
							tokenType: "Bearer",
							expiresAt: "2030-01-01T00:00:00.000Z",
							userInfo: {
								subject: "sub-1",
								email: "user@example.com",
								name: "User",
								clineUserId: "acct-1",
								accounts: ["acct-1"],
							},
						},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const onAuth = vi.fn();
		const credentials = await loginZenuxsOAuth({
			apiBaseUrl: "https://api.zenuxs.bot",
			useWorkOSDeviceAuth: true,
			callbacks: {
				onAuth,
				onPrompt: async () => "",
			},
		});

		expect(onAuth).toHaveBeenCalledTimes(1);
		expect(onAuth.mock.calls[0]?.[0]).toMatchObject({
			url: "https://example.com/device?user_code=ABCD-EFGH",
		});
		expect(credentials).toMatchObject({
			access: "zenuxs-access",
			refresh: "zenuxs-refresh",
			accountId: "acct-1",
			email: "user@example.com",
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			"https://api.workos.com/user_management/authorize/device",
		);
		const registerCallBody = JSON.parse(
			String(fetchMock.mock.calls[2]?.[1]?.body ?? "{}"),
		);
		const deviceAuthBody = String(fetchMock.mock.calls[0]?.[1]?.body ?? "");
		const deviceAuthParams = new URLSearchParams(deviceAuthBody);
		expect(deviceAuthParams.get("client_id")).toBe(
			"client_01K3A541FN8TA3EPPHTD2325AR",
		);
		expect(registerCallBody).toMatchObject({
			accessToken: "workos-access",
			refreshToken: "workos-refresh",
		});
	});

	it("starts device auth against the WorkOS API with the WorkOS client id", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						device_code: "dev-code-1",
						user_code: "ABCD-EFGH",
						verification_uri: "https://example.com/device",
						expires_in: 300,
						interval: 1,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await startZenuxsDeviceAuth({ apiBaseUrl: "https://api.cline.bot" });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			"https://api.workos.com/user_management/authorize/device",
		);
	});
});

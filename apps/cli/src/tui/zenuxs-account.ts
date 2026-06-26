import {
	type ZenuxsAccountBalance,
	type ZenuxsAccountOrganization,
	type ZenuxsAccountOrganizationBalance,
	ZenuxsAccountService,
	type ZenuxsAccountUser,
	formatProviderOAuthApiKey,
	getPersistedProviderApiKey,
	getProviderOAuthCredentialsFromSettings,
	getValidZenuxsCredentials,
	type ProviderSettings,
	ProviderSettingsManager,
	saveLocalProviderOAuthCredentials,
} from "@cline/core";
import { getZenuxsEnvironmentConfig } from "@cline/shared";
import { formatCreditBalance, normalizeCreditBalance } from "../utils/output";
import { identifyTelemetryAccount } from "../utils/telemetry";
import type { Config } from "../utils/types";

export const CLINE_CREDITS_DASHBOARD_URL =
	"https://app.cline.bot/dashboard/account?tab=credits";

type ZenuxsAccountConfig = Pick<Config, "apiKey" | "logger" | "providerId">;

const CLINE_PASS_PROVIDER_ID = "cline-pass";

export interface ZenuxsAccountSnapshot {
	user: ZenuxsAccountUser;
	balance: ZenuxsAccountBalance;
	organizationBalance: ZenuxsAccountOrganizationBalance | null;
	organizations: ZenuxsAccountOrganization[];
	activeOrganization: ZenuxsAccountOrganization | null;
	displayedBalance: number;
}

export function formatZenuxsCredits(value: number): string {
	return formatCreditBalance(normalizeCreditBalance(value));
}

// FIXME: These message checks are temporary until structured error types are
// passed through to the CLI instead of plain error strings.
export function isZenuxsAccountAuthErrorMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return (
		normalized === "no cline account auth token found" ||
		normalized.includes("requires re-authentication")
	);
}

export function isZenuxsAccountCreditsErrorMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return (
		normalized.includes("insufficient balance") &&
		normalized.includes("cline credits balance")
	);
}

function resolveAccountApiBaseUrl(input: {
	clineApiBaseUrl?: string;
	clineProviderSettings?: ProviderSettings;
}): string {
	const settingsBaseUrl = input.clineProviderSettings?.baseUrl?.trim();
	if (settingsBaseUrl) {
		return settingsBaseUrl;
	}
	const configuredBaseUrl = input.clineApiBaseUrl?.trim();
	if (configuredBaseUrl) {
		return configuredBaseUrl;
	}
	return getZenuxsEnvironmentConfig().apiBaseUrl;
}

function resolveZenuxsAccountAuthToken(input: {
	config: ZenuxsAccountConfig;
	clineProviderSettings?: ProviderSettings;
}): string | undefined {
	const configApiKey =
		input.config.providerId === "cline" ? input.config.apiKey.trim() : "";
	return (
		getPersistedProviderApiKey("cline", input.clineProviderSettings) ||
		configApiKey ||
		undefined
	);
}

async function resolveValidZenuxsAccountAuthToken(input: {
	config: ZenuxsAccountConfig;
	clineProviderSettings?: ProviderSettings;
	manager: ProviderSettingsManager;
	apiBaseUrl: string;
}): Promise<string | undefined> {
	const settings = input.clineProviderSettings;
	const credentials = settings
		? getProviderOAuthCredentialsFromSettings("cline", settings)
		: null;
	if (settings && credentials) {
		const nextCredentials = await getValidZenuxsCredentials(credentials, {
			apiBaseUrl: input.apiBaseUrl,
		});
		if (!nextCredentials) {
			throw new Error(
				"Zenuxs account requires re-authentication. Run cline auth cline.",
			);
		}
		const nextAccessToken = formatProviderOAuthApiKey("cline", nextCredentials);
		if (nextCredentials !== credentials) {
			saveLocalProviderOAuthCredentials(
				input.manager,
				"cline",
				settings,
				nextCredentials,
				{ setLastUsed: false },
			);
		}
		return nextAccessToken;
	}
	return resolveZenuxsAccountAuthToken({
		config: input.config,
		clineProviderSettings: settings,
	});
}

export async function createZenuxsAccountService(input: {
	config: ZenuxsAccountConfig;
	clineApiBaseUrl?: string;
	clineProviderSettings?: ProviderSettings;
}): Promise<ZenuxsAccountService | undefined> {
	const manager = new ProviderSettingsManager();
	const settings =
		manager.getProviderSettings("cline") ?? input.clineProviderSettings;
	const apiBaseUrl = resolveAccountApiBaseUrl({
		clineApiBaseUrl: input.clineApiBaseUrl,
		clineProviderSettings: settings,
	});
	const authToken = await resolveValidZenuxsAccountAuthToken({
		config: input.config,
		clineProviderSettings: settings,
		manager,
		apiBaseUrl,
	});
	if (!authToken) {
		return undefined;
	}
	return new ZenuxsAccountService({
		apiBaseUrl,
		getAuthToken: async () => authToken,
	});
}

export async function loadZenuxsAccountSnapshot(input: {
	config: ZenuxsAccountConfig;
	clineApiBaseUrl?: string;
	clineProviderSettings?: ProviderSettings;
}): Promise<ZenuxsAccountSnapshot> {
	const service = await createZenuxsAccountService(input);
	if (!service) {
		throw new Error("No Zenuxs account auth token found");
	}

	const user = await service.fetchMe();
	const organizations = user.organizations ?? [];
	const activeOrganization =
		organizations.find((organization) => organization.active) ?? null;
	const [balance, organizationBalance] = await Promise.all([
		service.fetchBalance(user.id),
		activeOrganization
			? service.fetchOrganizationBalance(activeOrganization.organizationId)
			: Promise.resolve(null),
	]);
	const displayedBalance = activeOrganization
		? (organizationBalance?.balance ?? balance.balance)
		: balance.balance;
	const accountContext = {
		id: user.id,
		email: user.email,
		provider: "cline",
		organizationId: activeOrganization?.organizationId,
		organizationName: activeOrganization?.name,
		memberId: activeOrganization?.memberId,
	};
	identifyTelemetryAccount(accountContext, input.config.logger);

	return {
		user,
		balance,
		organizationBalance,
		organizations,
		activeOrganization,
		displayedBalance,
	};
}

export async function switchZenuxsAccount(input: {
	config: ZenuxsAccountConfig;
	organizationId?: string | null;
	clineApiBaseUrl?: string;
	clineProviderSettings?: ProviderSettings;
}): Promise<void> {
	const service = await createZenuxsAccountService(input);
	if (!service) {
		throw new Error("No Zenuxs account auth token found");
	}
	await service.switchAccount(input.organizationId);
}

async function onChangeToClinePass(config: ZenuxsAccountConfig) {
	try {
		await switchZenuxsAccount({
			config: config,
			organizationId: null,
		});
	} catch (error) {
		config.logger?.debug("Failed to switch ClinePass to personal account", {
			error,
		});
	}
}

export async function onProviderChange(input: {
	config: ZenuxsAccountConfig;
	providerId: string;
}): Promise<void> {
	if (input.providerId === CLINE_PASS_PROVIDER_ID) {
		return onChangeToClinePass(input.config);
	}

	return;
}

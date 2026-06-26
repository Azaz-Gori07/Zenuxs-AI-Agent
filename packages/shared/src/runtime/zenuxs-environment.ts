export const ZENUXS_ENVIRONMENT_ENV = "ZENUXS_ENVIRONMENT";
export const ZENUXS_ENVIRONMENT_OVERRIDE_ENV = "ZENUXS_ENVIRONMENT_OVERRIDE";

export type ZenuxsEnvironment = "production" | "staging" | "local";

export interface ZenuxsEnvironmentConfig {
	readonly environment: ZenuxsEnvironment;
	readonly appBaseUrl: string;
	readonly apiBaseUrl: string;
	readonly mcpBaseUrl: string;
	readonly workOsClientId: string;
}

export const ZENUXS_ENVIRONMENTS: Readonly<
	Record<ZenuxsEnvironment, ZenuxsEnvironmentConfig>
> = {
	production: {
		environment: "production",
		appBaseUrl: "https://app.cline.bot",
		apiBaseUrl: "https://api.cline.bot",
		mcpBaseUrl: "http://127.0.0.1:8787/v1/mcp",
		workOsClientId: "client_01K3A541FN8TA3EPPHTD2325AR",
	},
	staging: {
		environment: "staging",
		appBaseUrl: "https://staging-app.cline.bot",
		apiBaseUrl: "https://core-api.staging.int.cline.bot",
		mcpBaseUrl: "https://core-api.staging.int.cline.bot/v1/mcp",
		workOsClientId: "client_01K3A5415VF6QBQBG3XYCW91G6",
	},
	local: {
		environment: "local",
		appBaseUrl: "http://localhost:3000",
		apiBaseUrl: "http://localhost:7777",
		mcpBaseUrl: "http://localhost:7777/v1/mcp",
		workOsClientId: "client_01K6XQAY7JK6T5HXVSZW2S5VYK",
	},
};

export const DEFAULT_ZENUXS_ENVIRONMENT: ZenuxsEnvironment = "production";

export interface ResolveZenuxsEnvironmentOptions {
	env?: Partial<NodeJS.ProcessEnv>;
}

function normalizeZenuxsEnvironment(
	value: string | undefined,
): ZenuxsEnvironment | undefined {
	const normalized = value?.trim().toLowerCase();
	if (
		normalized === "production" ||
		normalized === "staging" ||
		normalized === "local"
	) {
		return normalized;
	}
	return undefined;
}

function readProcessEnv(): NodeJS.ProcessEnv {
	// `process` may be absent in browser-style runtimes (this module ships
	// from the browser entry of `@zenuxs/shared`). Treat its absence as "no
	// env vars set" so callers always get a deterministic default.
	if (typeof process === "undefined" || !process?.env) {
		return {};
	}
	return process.env;
}

export function resolveZenuxsEnvironment(): ZenuxsEnvironment {
	const env = readProcessEnv();
	return (
		normalizeZenuxsEnvironment(env[ZENUXS_ENVIRONMENT_OVERRIDE_ENV]) ??
		normalizeZenuxsEnvironment(env[ZENUXS_ENVIRONMENT_ENV]) ??
		DEFAULT_ZENUXS_ENVIRONMENT
	);
}

function getEnvConfig(env?: ZenuxsEnvironment) {
	if (typeof env === "string") {
		return ZENUXS_ENVIRONMENTS[env];
	}
	return ZENUXS_ENVIRONMENTS[resolveZenuxsEnvironment()];
}

function applyConfigOverrides(
	config: ZenuxsEnvironmentConfig,
	env: NodeJS.ProcessEnv,
): ZenuxsEnvironmentConfig {
	if (env.CLINE_API_BASE_URL) {
		config = {
			...config,
			apiBaseUrl: env.CLINE_API_BASE_URL,
			mcpBaseUrl: `${env.CLINE_API_BASE_URL}/v1/mcp`,
		};
	}

	return config;
}

export function getZenuxsEnvironmentConfig(
	env?: ZenuxsEnvironment,
): ZenuxsEnvironmentConfig {
	const config = getEnvConfig(env);

	return applyConfigOverrides(config, readProcessEnv());
}

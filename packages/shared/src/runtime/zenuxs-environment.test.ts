import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ZENUXS_ENVIRONMENT_ENV,
	ZENUXS_ENVIRONMENT_OVERRIDE_ENV,
	ZENUXS_ENVIRONMENTS,
	DEFAULT_ZENUXS_ENVIRONMENT,
	getZenuxsEnvironmentConfig,
	resolveZenuxsEnvironment,
} from "./zenuxs-environment";

const ENV_KEYS = [
	ZENUXS_ENVIRONMENT_ENV,
	ZENUXS_ENVIRONMENT_OVERRIDE_ENV,
	"CLINE_API_BASE_URL",
] as const;

const originalEnvValues = Object.fromEntries(
	ENV_KEYS.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
	vi.unstubAllGlobals();
	for (const key of ENV_KEYS) {
		delete process.env[key];
	}
});

afterEach(() => {
	vi.unstubAllGlobals();
	for (const key of ENV_KEYS) {
		const value = originalEnvValues[key];
		if (typeof value === "string") {
			process.env[key] = value;
		} else {
			delete process.env[key];
		}
	}
});

describe("resolveZenuxsEnvironment", () => {
	it("defaults to production when no env var is set", () => {
		expect(resolveZenuxsEnvironment()).toBe(DEFAULT_ZENUXS_ENVIRONMENT);
	});

	it("reads ZENUXS_ENVIRONMENT from process.env", () => {
		process.env[ZENUXS_ENVIRONMENT_ENV] = "staging";
		expect(resolveZenuxsEnvironment()).toBe("staging");

		process.env[ZENUXS_ENVIRONMENT_ENV] = "local";
		expect(resolveZenuxsEnvironment()).toBe("local");
	});

	it("prefers ZENUXS_ENVIRONMENT_OVERRIDE over ZENUXS_ENVIRONMENT", () => {
		process.env[ZENUXS_ENVIRONMENT_OVERRIDE_ENV] = "local";
		process.env[ZENUXS_ENVIRONMENT_ENV] = "staging";

		expect(resolveZenuxsEnvironment()).toBe("local");
	});

	it("normalizes case and surrounding whitespace", () => {
		process.env[ZENUXS_ENVIRONMENT_ENV] = "  STAGING  ";

		expect(resolveZenuxsEnvironment()).toBe("staging");
	});

	it("ignores unknown values and falls through to the next source", () => {
		process.env[ZENUXS_ENVIRONMENT_OVERRIDE_ENV] = "qa";
		process.env[ZENUXS_ENVIRONMENT_ENV] = "staging";
		expect(resolveZenuxsEnvironment()).toBe("staging");

		delete process.env[ZENUXS_ENVIRONMENT_OVERRIDE_ENV];
		process.env[ZENUXS_ENVIRONMENT_ENV] = "qa";
		expect(resolveZenuxsEnvironment()).toBe(DEFAULT_ZENUXS_ENVIRONMENT);
	});

	it("defaults to production when process is unavailable", () => {
		vi.stubGlobal("process", undefined);

		expect(resolveZenuxsEnvironment()).toBe(DEFAULT_ZENUXS_ENVIRONMENT);
	});
});

describe("getZenuxsEnvironmentConfig", () => {
	it("returns the config for an explicit environment", () => {
		expect(getZenuxsEnvironmentConfig("staging")).toBe(
			ZENUXS_ENVIRONMENTS.staging,
		);
		expect(getZenuxsEnvironmentConfig("local")).toBe(ZENUXS_ENVIRONMENTS.local);
		expect(getZenuxsEnvironmentConfig("production")).toBe(
			ZENUXS_ENVIRONMENTS.production,
		);
	});

	it("falls back to production by default", () => {
		expect(getZenuxsEnvironmentConfig()).toBe(ZENUXS_ENVIRONMENTS.production);
	});

	it("uses the resolved process.env environment when no explicit environment is provided", () => {
		process.env[ZENUXS_ENVIRONMENT_ENV] = "staging";

		expect(getZenuxsEnvironmentConfig()).toBe(ZENUXS_ENVIRONMENTS.staging);
	});

	it("applies CLINE_API_BASE_URL without mutating the catalog config", () => {
		process.env.CLINE_API_BASE_URL = "http://127.0.0.1:3000";

		expect(getZenuxsEnvironmentConfig("local")).toEqual({
			...ZENUXS_ENVIRONMENTS.local,
			apiBaseUrl: "http://127.0.0.1:3000",
			mcpBaseUrl: "http://127.0.0.1:3000/v1/mcp",
		});
		expect(ZENUXS_ENVIRONMENTS.local.apiBaseUrl).toBe("http://localhost:7777");
	});

	it("defaults to production when process is unavailable", () => {
		vi.stubGlobal("process", undefined);

		expect(getZenuxsEnvironmentConfig()).toBe(ZENUXS_ENVIRONMENTS.production);
	});
});

describe("ZENUXS_ENVIRONMENTS catalog", () => {
	it("exposes an environment field that matches its key", () => {
		for (const [key, config] of Object.entries(ZENUXS_ENVIRONMENTS)) {
			expect(config.environment).toBe(key);
		}
	});

	it("populates appBaseUrl, apiBaseUrl, and mcpBaseUrl for every environment", () => {
		for (const config of Object.values(ZENUXS_ENVIRONMENTS)) {
			expect(config.appBaseUrl).toMatch(/^https?:\/\//);
			expect(config.apiBaseUrl).toMatch(/^https?:\/\//);
			expect(config.mcpBaseUrl).toMatch(/^https?:\/\//);
		}
	});
});

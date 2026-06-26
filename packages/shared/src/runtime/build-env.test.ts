import { describe, expect, it } from "vitest";
import {
	augmentNodeCommandForDebug,
	ZENUXS_BUILD_ENV_ENV,
	ZENUXS_DEBUG_HOST_ENV,
	ZENUXS_DEBUG_PORT_BASE_ENV,
	resolveZenuxsBuildEnv,
	withResolvedZenuxsBuildEnv,
} from "./build-env";

describe("build env helpers", () => {
	it("prefers explicit ZENUXS_BUILD_ENV", () => {
		expect(
			resolveZenuxsBuildEnv({
				env: { [ZENUXS_BUILD_ENV_ENV]: "development", NODE_ENV: "production" },
			}),
		).toBe("development");
	});

	it("treats development conditions as a development build", () => {
		expect(
			resolveZenuxsBuildEnv({
				env: {},
				execArgv: ["--conditions=development"],
			}),
		).toBe("development");
	});

	it("defaults to production otherwise", () => {
		expect(resolveZenuxsBuildEnv({ env: {}, execArgv: [] })).toBe("production");
	});

	it("treats NODE_ENV=development as a development build", () => {
		expect(
			resolveZenuxsBuildEnv({ env: { NODE_ENV: "development" }, execArgv: [] }),
		).toBe("development");
	});

	it("does not treat NODE_ENV=test as a development build", () => {
		expect(
			resolveZenuxsBuildEnv({ env: { NODE_ENV: "test" }, execArgv: [] }),
		).toBe("production");
	});

	it("does not treat NODE_ENV=staging as a development build", () => {
		expect(
			resolveZenuxsBuildEnv({ env: { NODE_ENV: "staging" }, execArgv: [] }),
		).toBe("production");
	});

	it("materializes ZENUXS_BUILD_ENV when absent", () => {
		expect(
			withResolvedZenuxsBuildEnv({ NODE_ENV: "development" }, { execArgv: [] })[
				ZENUXS_BUILD_ENV_ENV
			],
		).toBe("development");
	});

	it("adds dynamic inspect and source maps for node commands in development", () => {
		expect(
			augmentNodeCommandForDebug(["node", "script.js"], {
				env: { [ZENUXS_BUILD_ENV_ENV]: "development" },
				debugRole: "rpc",
			}),
		).toEqual([
			"node",
			"--inspect=127.0.0.1:0",
			"--enable-source-maps",
			"script.js",
		]);
	});

	it("allows overriding the debug host and base port", () => {
		expect(
			augmentNodeCommandForDebug(["node", "script.js"], {
				env: {
					[CLINE_BUILD_ENV_ENV]: "development",
					[ZENUXS_DEBUG_HOST_ENV]: "0.0.0.0",
					[ZENUXS_DEBUG_PORT_BASE_ENV]: "9500",
				},
				debugRole: "plugin-sandbox",
			}),
		).toEqual([
			"node",
			"--inspect=0.0.0.0:9502",
			"--enable-source-maps",
			"script.js",
		]);
	});

	it("adds inspect and source maps for bun commands in development", () => {
		expect(
			augmentNodeCommandForDebug(["/usr/local/bin/bun", "script.js"], {
				env: { [ZENUXS_BUILD_ENV_ENV]: "development" },
				debugRole: "rpc",
			}),
		).toEqual([
			"/usr/local/bin/bun",
			"--inspect=127.0.0.1:0",
			"--enable-source-maps",
			"script.js",
		]);
	});

	it("does not duplicate existing node debug flags", () => {
		expect(
			augmentNodeCommandForDebug(["node", "--inspect=9229", "script.js"], {
				env: {
					[CLINE_BUILD_ENV_ENV]: "development",
					NODE_OPTIONS: "--enable-source-maps",
				},
			}),
		).toEqual(["node", "--inspect=9229", "script.js"]);
	});
});

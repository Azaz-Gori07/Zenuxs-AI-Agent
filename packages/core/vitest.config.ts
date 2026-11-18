import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		exclude: ["src/**/*.e2e.test.ts"],
		// The suite runs serially with a single worker on CI; a few bootstrap
		// and hub tests need more than Vitest's 5s default under load.
		testTimeout: 20_000,
	},
});

// Launch an Extension Development Host that stays alive for CDP drivers.
import { runTests } from "@vscode/test-electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const fixture = join(root, "tests/extension-e2e/fixture");
mkdirSync(fixture, { recursive: true });
writeFileSync(join(fixture, "sample.ts"), "const answer = 42;\nexport default answer;\n");

const port = process.env.ZENUXS_CDP_PORT || "9242";

await runTests({
	extensionDevelopmentPath: join(root, "apps/vscode-extension"),
	extensionTestsPath: join(here, "suite/keepalive.cjs"),
	launchArgs: [
		fixture,
		"--disable-extensions",
		`--remote-debugging-port=${port}`,
		"--no-sandbox",
	],
	version: "stable",
});

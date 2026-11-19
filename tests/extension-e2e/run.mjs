// Launches a VS Code Extension Development Host and runs suite/index.cjs inside it.
import { runTests } from "@vscode/test-electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const out = process.env.ZENUXS_EXT_E2E_OUT || join(root, "docs/evidence/F-ext/e2e-result.json");
mkdirSync(dirname(out), { recursive: true });

const fixture = join(root, "tests/extension-e2e/fixture");
mkdirSync(fixture, { recursive: true });
writeFileSync(join(fixture, "sample.ts"), "const answer = 42;\nexport default answer;\n");

try {
  await runTests({
    extensionDevelopmentPath: join(root, "apps/vscode-extension"),
    extensionTestsPath: join(here, "suite/index.cjs"),
    launchArgs: [
      fixture,
      "--disable-extensions",
      "--remote-debugging-port=9233",
      "--no-sandbox",
    ],
    version: "stable",
  });
  console.log("EXT_E2E_LAUNCH_OK");
} catch (error) {
  console.error("EXT_E2E_LAUNCH_FAILED", error);
  process.exitCode = 1;
}

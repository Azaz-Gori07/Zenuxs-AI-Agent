import * as pty from "node-pty";
import { writeFileSync } from "node:fs";
const root = process.cwd();
const child = pty.spawn(`${process.env.HOME}/.bun/bin/bun`, [`${root}/apps/cli/src/index.ts`, "--tui"], {
  cwd: root,
  env: { ...process.env, TERM: "xterm-256color", ZENUXS_PROVIDER_SETTINGS_PATH: `${root}/tests/fixtures/l3/providers.json`, CLINE_DIR: `${root}/.tmp/pty-compact`, CLINE_DATA_DIR: `${root}/.tmp/pty-compact` },
  cols: 120, rows: 32,
});
let out = "";
child.onData((d) => { out += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(4000);
child.write("/compact\r");
await sleep(5000);
child.write("\u0003");
await sleep(1000);
child.kill();
await sleep(300);
writeFileSync("docs/evidence/F-ctx/pty-manual-compact.log", `=== SHA: ${(await import("node:child_process")).execFileSync("git",["rev-parse","HEAD"]).toString().trim()} ===\n` + out);
console.log(JSON.stringify({ bytes: out.length, hasCompact: /compact/i.test(out) }));

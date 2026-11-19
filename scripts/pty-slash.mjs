import * as pty from "node-pty";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const root = process.cwd();
const child = pty.spawn(`${process.env.HOME}/.bun/bin/bun`, [`${root}/apps/cli/src/index.ts`, "--tui"], {
  cwd: root,
  env: { ...process.env, TERM: "xterm-256color", ZENUXS_PROVIDER_SETTINGS_PATH: `${root}/tests/fixtures/l3/providers.json`, CLINE_DIR: `${root}/.tmp/pty-slash`, CLINE_DATA_DIR: `${root}/.tmp/pty-slash` },
  cols: 140, rows: 36,
});
let out = "";
child.onData((d) => { out += d; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(5000);
for (const cmd of ["/help", "/fork", "/rewind", "/compact"]) {
  for (const ch of cmd) { child.write(ch); await sleep(40); }
  child.write("\r");
  await sleep(3000);
}
child.write("\u0003");
await sleep(1000);
child.kill();
await sleep(300);
writeFileSync("docs/evidence/F-tui/pty-slash-commands.log", `=== SHA: ${execFileSync("git",["rev-parse","HEAD"]).toString().trim()} ===\n` + out);
console.log(JSON.stringify({ bytes: out.length }));

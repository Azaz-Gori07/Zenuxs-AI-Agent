// Restore a real checkpoint into an isolated git fixture, then report file content.
import { Database } from "bun:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { applyCheckpointToWorktree } from "../../../packages/core/src/session/checkpoint-restore.ts";

const [dbPath, sessionId, filePath] = process.argv.slice(2);
const db = new Database(dbPath, { readonly: true });
const row = db.query("SELECT session_id, cwd, workspace_root, metadata_json FROM sessions WHERE session_id = ?").get(sessionId);
if (!row) { console.log(JSON.stringify({ error: "session not found" })); process.exit(1); }
const metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
const checkpoint = metadata?.checkpoint?.latest;
if (!checkpoint) { console.log(JSON.stringify({ error: "no checkpoint in metadata" })); process.exit(1); }
writeFileSync(filePath, "MODIFIED_CONTENT\n");
const before = readFileSync(filePath, "utf8").trim();
await applyCheckpointToWorktree(row.cwd, checkpoint);
const after = readFileSync(filePath, "utf8").trim();
console.log(JSON.stringify({ checkpointRef: checkpoint.ref, before, after, restored: after === "CHECKPOINT_STATE" }));

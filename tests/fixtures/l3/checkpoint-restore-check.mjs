// Verify the shipped checkpoint restore-plan API against a real session record.
import { Database } from "bun:sqlite";
import { readSessionCheckpointHistory, createCheckpointRestorePlan } from "../../../packages/core/src/session/checkpoint-restore.ts";

const dbPath = process.argv[2];
const sessionId = process.argv[3];
const db = new Database(dbPath, { readonly: true });
let row = null;
try {
  row = db.query("SELECT session_id, cwd, workspace_root, metadata_json FROM sessions WHERE session_id = ?").get(sessionId);
} catch {
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(JSON.stringify({ error: "sessions query failed", tables }));
  process.exit(0);
}
if (!row) { console.log(JSON.stringify({ error: "session not found" })); process.exit(0); }
const session = { sessionId: row.session_id, cwd: row.cwd, workspaceRoot: row.workspace_root, metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined };
const history = readSessionCheckpointHistory(session);
let messages;
try { messages = JSON.parse(await Bun.file(process.argv[4]).text()).messages; } catch { messages = []; }
let plan = null;
try {
  plan = history.length ? createCheckpointRestorePlan({ session, messages, checkpointRunCount: history[0].runCount, cwd: session.cwd, restoreMessages: true }) : null;
} catch (e) { plan = { error: String(e) }; }
console.log(JSON.stringify({ sessionId, checkpointCount: history.length, plan }));

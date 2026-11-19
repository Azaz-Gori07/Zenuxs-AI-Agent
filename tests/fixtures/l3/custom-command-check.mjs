// Verify custom slash commands are discovered from an installed plugin.
import { createWorkspaceChatCommandHost } from "../../../apps/cli/src/utils/plugin-chat-commands.ts";
const cwd = process.argv[2];
try {
  const result = await createWorkspaceChatCommandHost({ cwd });
  const names = (result.pluginSlashCommands ?? []).map((c) => c.name);
  console.log(JSON.stringify({ cwd, customCommands: names }));
  await result.shutdown?.();
} catch (e) {
  console.log(JSON.stringify({ error: String(e) }));
}

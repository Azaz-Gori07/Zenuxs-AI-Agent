const vscode = require("vscode");
const fs = require("fs");

module.exports.run = async () => {
  const ready = process.env.ZENUXS_READY_FILE || "/tmp/zenuxs-ext-ready";
  const ext = vscode.extensions.all.find((e) => e.id.toLowerCase().includes("zenuxs"));
  if (ext) await ext.activate();
  await vscode.commands.executeCommand("zenuxs.chat");
  await vscode.commands.executeCommand("workbench.view.extension.zenuxs");
  await new Promise((r) => setTimeout(r, 2500));
  fs.writeFileSync(ready, JSON.stringify({
    active: ext ? ext.isActive : false,
    commands: (await vscode.commands.getCommands(true)).filter((c) => c.startsWith("zenuxs.")),
    at: new Date().toISOString(),
  }));
  // Keep the Extension Development Host alive for CDP-driven scenarios.
  await new Promise((r) => setTimeout(r, 180000));
};

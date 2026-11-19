// Runs inside the VS Code Extension Development Host.
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

module.exports.run = async () => {
  const out = process.env.ZENUXS_EXT_E2E_OUT || "/tmp/ext-e2e-result.json";
  const result = { startedAt: new Date().toISOString(), checks: [], screenshots: [] };

  const check = (name, ok, detail) => {
    result.checks.push({ name, ok, detail: detail === undefined ? null : String(detail).slice(0, 500) });
  };

  try {
    const ext = vscode.extensions.getExtension("zenuxs.zenuxs-code-vscode") ||
      vscode.extensions.all.find((e) => e.id.toLowerCase().includes("zenuxs"));
    check("extension discovered", !!ext, ext && ext.id);
    if (ext) {
      await ext.activate();
      check("extension activated", ext.isActive, ext.isActive);
    }

    const cmds = await vscode.commands.getCommands(true);
    const zenuxsCmds = cmds.filter((c) => c.startsWith("zenuxs."));
    check("commands registered", zenuxsCmds.length >= 10, zenuxsCmds.join(","));

    await vscode.commands.executeCommand("zenuxs.chat");
    await new Promise((r) => setTimeout(r, 2500));
    check("chat command executed", true);

    const webviews = [];
    for (const panel of vscode.window.tabGroups.all.flatMap((g) => g.tabs)) {
      if (panel.input && typeof panel.input === "object" && "webview" in panel.input) {
        webviews.push(panel);
      }
    }
    check("webview visible", webviews.length > 0, webviews.length);
    if (webviews[0]) {
      const html = webviews[0].input.webview.html;
      check("webview has root element", /id=["']root["']/.test(html), html.length);
      check("webview loads bundled script", /webview\.js|extension-resource/.test(html));
      result.webviewTitle = webviews[0].input.title;
    }

    // Editor context scenario: open a fixture file and capture selection context.
    const fixture = path.join(process.env.ZENUXS_EXT_E2E_FIXTURE || "", "sample.ts");
    if (fs.existsSync(fixture)) {
      const doc = await vscode.workspace.openTextDocument(fixture);
      const editor = await vscode.window.showTextDocument(doc);
      editor.selection = new vscode.Selection(0, 0, 0, 5);
      check("active file context available", vscode.window.activeTextEditor?.document.fileName === fixture, fixture);
    }

    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  } catch (e) {
    result.error = String(e && e.stack || e);
  }

  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("ZENUXS_EXT_E2E_RESULT=" + out);
};

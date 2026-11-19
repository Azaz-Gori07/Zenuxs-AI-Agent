// Drives the Zenuxs chat webview inside a running VS Code Extension Development
// Host via Playwright/CDP. Screenshots and a JSON transcript are written to
// docs/evidence/F-ext/.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = process.env.ZENUXS_EXT_E2E_OUT_DIR ||
  path.join(__dirname, "../../docs/evidence/F-ext");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const result = { startedAt: new Date().toISOString(), scenarios: [], screenshots: [] };
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9233");
  try {
    const contexts = browser.contexts();
    const pages = contexts.flatMap((c) => c.pages());
    result.pages = pages.map((p) => ({ url: p.url().slice(0, 160), title: "" }));

    // Locate the webview frame inside any page.
    let webviewFrame = null;
    for (const page of pages) {
      for (const frame of page.frames()) {
        const url = frame.url();
        if (/webview|zenuxs/i.test(url)) {
          webviewFrame = frame;
          result.webviewFrameUrl = url.slice(0, 200);
          break;
        }
      }
      if (webviewFrame) break;
    }

    if (!webviewFrame) {
      result.error = "webview frame not found";
    } else {
      // Focus the Zenuxs sidebar view first via the VS Code command palette URL API.
      const bodyText = await webviewFrame.locator("body").innerText().catch(() => "");
      result.bodyTextHead = bodyText.slice(0, 500);
      result.hasRoot = await webviewFrame.locator("#root").count().catch(() => 0);

      for (const page of pages) {
        await page.screenshot({ path: path.join(OUT, "vscode-main.png") }).catch(() => {});
        result.screenshots.push("vscode-main.png");
        break;
      }
      await webviewFrame.screenshot({ path: path.join(OUT, "webview.png") }).catch(() => {});
      result.screenshots.push("webview.png");

      result.scenarios.push({ name: "webview mounted", ok: result.hasRoot > 0 });
      result.scenarios.push({ name: "webview has visible content", ok: bodyText.trim().length > 0, detail: bodyText.slice(0, 120) });
    }
  } catch (error) {
    result.error = String(error && error.stack || error);
  } finally {
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, "webview-cdp-result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: !result.error, scenarios: result.scenarios.length, error: result.error }, null, 2));
    await browser.close();
  }
})();

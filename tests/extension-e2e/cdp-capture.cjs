// Captures a stable snapshot of the running Extension Development Host:
// activates the Zenuxs view, records the webview frame and screenshots.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = process.env.ZENUXS_EXT_E2E_OUT_DIR ||
  path.join(__dirname, "../../docs/evidence/F-ext");
const PORT = process.env.ZENUXS_CDP_PORT || "9234";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const result = {
    timestamp: new Date().toISOString(),
    cdpPort: PORT,
    scenarios: [],
  };
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  try {
    const page = browser.contexts().flatMap((c) => c.pages())[0];
    // Open the Zenuxs sidebar view by clicking its activity-bar action.
    const clicked = await page.evaluate(() => {
      const el = [...document.querySelectorAll("a")].find((e) =>
        /activity-workbench-view-extension-zenuxs/.test((e.className || "").toString()),
      );
      if (!el) return false;
      el.click();
      return true;
    });
    result.scenarios.push({ name: "activity bar action present", ok: clicked });
    await page.waitForTimeout(4000);

    const frames = page.frames().map((f) => f.url());
    result.webviewFrame = frames.find((u) => /extensionId=zenuxs\.zenuxs-code-v/.test(u)) || null;
    result.scenarios.push({ name: "Zenuxs webview frame mounted", ok: !!result.webviewFrame });

    await page.screenshot({ path: path.join(OUT, "cdp-workbench.png") });
    result.screenshot = "cdp-workbench.png";

    const text = await page.evaluate(() => document.body.innerText);
    result.scenarios.push({
      name: "workbench shows Zenuxs UI",
      ok: /Zenuxs/.test(text),
      detail: text.match(/Zenuxs[^\n]{0,60}/g)?.slice(0, 3) || [],
    });
  } catch (error) {
    result.error = String(error && error.stack || error);
  } finally {
    result.sha = require("node:child_process")
      .execFileSync("git", ["rev-parse", "HEAD"], { cwd: path.join(__dirname, "../..") })
      .toString()
      .trim();
    fs.writeFileSync(path.join(OUT, "cdp-capture.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: !result.error && result.scenarios.every((s) => s.ok), scenarios: result.scenarios.length }));
    await browser.close();
  }
})();

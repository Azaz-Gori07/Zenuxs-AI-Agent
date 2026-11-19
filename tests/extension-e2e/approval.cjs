const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OUT = "/home/azaz/Projects/Zenuxs-AI-Agent/docs/evidence/F-ext";
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const result = { timestamp: new Date().toISOString(), scenarios: [] };
  const add = (name, ok, detail) => result.scenarios.push({ name, ok, detail: detail ?? null });
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9241");
  try {
    const page = browser.contexts().flatMap(c => c.pages())[0];
    await page.evaluate(() => { const el=[...document.querySelectorAll("a")].find(e=>/activity-workbench-view-extension-zenuxs/.test((e.className||"").toString())); if(el) el.click(); });
    await page.waitForTimeout(4000);
    async function frameWith(pred, timeout=20000) {
      const start=Date.now();
      while(Date.now()-start<timeout){ for(const f of page.frames()){ try{ const t=await Promise.race([f.evaluate(()=>document.body?document.body.innerText.slice(0,600):""),new Promise(r=>setTimeout(()=>r(""),2000))]); if(pred(t)) return f; }catch{} } await page.waitForTimeout(500); }
      return null;
    }
    let f = await frameWith(t=>t.includes("Sign in to Zenuxs"), 15000);
    if (f) { await f.getByText(/Continue without Login/i).first().dispatchEvent("click"); await page.waitForTimeout(3000); }
    f = await frameWith(t=>t.includes("CONTEXT WINDOW"), 20000);
    add("chat UI mounted", !!f);
    if (f) {
      await f.locator("#prompt-textarea").fill("Write the file");
      await f.locator('button[title="Send (Enter)"]').first().dispatchEvent("click");
      await page.waitForTimeout(8000);
      const text = await f.evaluate(()=>document.body.innerText);
      result.transcript = text.slice(0, 2000);
      add("approval or diff card rendered", /read|target\.txt|Tool/i.test(text), text.match(/(read|target\.txt|tool)[^\n]{0,60}/gi)?.slice(0,4));
      await page.screenshot({ path: path.join(OUT, "ext-approval.png") });
    }
    // diagnostics scenario: VS Code problems panel via keyboard
    await page.keyboard.press("Control+Shift+m");
    await page.waitForTimeout(1500);
    const probs = await page.evaluate(()=>document.body.innerText);
    add("diagnostics panel reachable (approval run)", /Problems|No problems|errors/i.test(probs), probs.match(/Problems[^\n]{0,60}/i)?.[0]);
    await page.screenshot({ path: path.join(OUT, "ext-approval-diagnostics.png") });
  } catch(e) { result.error=String(e && e.stack || e); }
  finally {
    fs.writeFileSync(path.join(OUT, "ext-approval-result.json"), JSON.stringify(result,null,2));
    console.log(JSON.stringify({ok:!result.error&&result.scenarios.every(s=>s.ok),scenarios:result.scenarios,error:result.error}));
    await browser.close();
  }
})();

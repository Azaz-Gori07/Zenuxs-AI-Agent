const { chromium } = require("playwright");
const fs = require("fs");
const OUT = "/home/azaz/Projects/Zenuxs-AI-Agent/docs/evidence/F-ext";
(async () => {
  const result = { timestamp: new Date().toISOString(), scenarios: [] };
  const add = (n, ok, d) => result.scenarios.push({ name: n, ok, detail: d ?? null });
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9241");
  try {
    const page = browser.contexts().flatMap(c => c.pages())[0];
    async function frameWith(pred, t=20000) { const s=Date.now(); while(Date.now()-s<t){ for(const f of page.frames()){ try{ const x=await Promise.race([f.evaluate(()=>document.body?document.body.innerText.slice(0,800):""),new Promise(r=>setTimeout(()=>r(""),2000))]); if(pred(x)) return f; }catch{} } await page.waitForTimeout(400);} return null; }
    const f = await frameWith(t=>t.includes("Manual Approval Required"), 25000);
    add("approval prompt present", !!f);
    if (f) {
      const before = fs.readFileSync("/home/azaz/Projects/Zenuxs-AI-Agent/tests/extension-e2e/fixture/sample.ts","utf8");
      const btn = f.getByText("Run once", { exact: false }).first();
      await btn.dispatchEvent("click");
      await page.waitForTimeout(6000);
      const after = fs.readFileSync("/home/azaz/Projects/Zenuxs-AI-Agent/tests/extension-e2e/fixture/sample.ts","utf8");
      add("apply via Run once changes file", after !== before, { before: before.slice(0,60), after: after.slice(0,60) });
      const text = await f.evaluate(()=>document.body.innerText);
      result.transcript = text.slice(0,1600);
      add("diff/result rendered", /Files Changed|Write complete|sample\.ts/i.test(text), text.match(/(Files Changed|Write complete|sample\.ts)[^\n]{0,60}/gi)?.slice(0,4));
      await page.screenshot({ path: OUT + "/ext-approval-applied.png" });
    }
  } catch(e) { result.error=String(e && e.stack||e); }
  finally { fs.writeFileSync(OUT+"/ext-approval-action-result.json",JSON.stringify(result,null,2)); console.log(JSON.stringify({ok:!result.error&&result.scenarios.every(s=>s.ok),scenarios:result.scenarios,error:result.error})); await browser.close(); }
})();

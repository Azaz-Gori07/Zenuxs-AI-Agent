const { chromium } = require("playwright");
const fs = require("fs");
const OUT = "/home/azaz/Projects/Zenuxs-AI-Agent/docs/evidence/F-ext";
(async () => {
  const result = { timestamp: new Date().toISOString(), scenarios: [] };
  const add = (n, ok, d) => result.scenarios.push({ name: n, ok, detail: d ?? null });
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9241");
  try {
    const page = browser.contexts().flatMap(c => c.pages())[0];
    async function frameWith(pred,t=20000){const s=Date.now();while(Date.now()-s<t){for(const f of page.frames()){try{const x=await Promise.race([f.evaluate(()=>document.body?document.body.innerText.slice(0,800):""),new Promise(r=>setTimeout(()=>r(""),2000))]);if(pred(x))return f;}catch{}}await page.waitForTimeout(400);}return null;}
    const f = await frameWith(t=>t.includes("CONTEXT WINDOW"),15000);
    add("chat available", !!f);
    if(f){
      const before = fs.readFileSync("/home/azaz/Projects/Zenuxs-AI-Agent/tests/extension-e2e/fixture/sample.ts","utf8");
      await f.locator("#prompt-textarea").fill("Write deny test");
      await f.locator('button[title="Send (Enter)"]').first().dispatchEvent("click");
      const prompt = await frameWith(t=>t.includes("Manual Approval Required"),25000);
      add("second approval prompt", !!prompt);
      if(prompt){
        await prompt.getByText("Deny",{exact:true}).first().dispatchEvent("click");
        await page.waitForTimeout(4000);
        const after = fs.readFileSync("/home/azaz/Projects/Zenuxs-AI-Agent/tests/extension-e2e/fixture/sample.ts","utf8");
        add("deny leaves file unchanged", after===before, {after:after.slice(0,60)});
        await page.screenshot({path:OUT+"/ext-deny.png"});
      }
    }
  } catch(e){result.error=String(e&&e.stack||e);}
  finally{fs.writeFileSync(OUT+"/ext-deny-result.json",JSON.stringify(result,null,2));console.log(JSON.stringify({ok:!result.error&&result.scenarios.every(s=>s.ok),scenarios:result.scenarios,error:result.error}));await browser.close();}
})();

const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  const app = 'https://bugetjukov.web.app';
  await page.goto(app, { waitUntil: 'domcontentloaded' });
  const today = new Date();
  const mk = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const proj = { id: 'offline-test', owner: 'test@example.com', name: 'Offline test', rates: { ronPerEur:5, mdlPerEur:19.4 }, entries: { [mk]: { incomes: [{ id: 'i1', date: new Date().toISOString().slice(0,10), descriere: 'from-cache', client: 'Valentin', suma: 12, valuta: 'EUR', sumaEUR: 12 }], expenses: [], planner: [] } }, updatedAt: Date.now(), _fallback:true };
  await page.evaluate(p=>{ const ls = localStorage.getItem('local_projects_v1'); const arr = ls?JSON.parse(ls):[]; arr.push(p); localStorage.setItem('local_projects_v1', JSON.stringify(arr)); }, proj);
  await page.click('text=Setări');
  await page.waitForTimeout(800);
  // find the project block and click Load
  const projectBlock = await page.locator('text=Offline test').first().locator('..').first();
  const loadBtn = projectBlock.locator('text=Load').first();
  console.log('Clicking load...');
  await loadBtn.click();
  await page.waitForTimeout(1000);
  const has = await page.locator('text=from-cache').count();
  console.log('from-cache count:', has);
  const content = await page.content();
  console.log('PAGE CONTENT SNIPPET:', content.slice(0,2000));
  await browser.close();
})();
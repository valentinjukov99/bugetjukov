import { chromium } from 'playwright';
(async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://bugetjukov.web.app', { waitUntil: 'domcontentloaded' });
  // set local_projects_v1 like the test
  const today = new Date();
  const mk = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const proj = { id: 'offline-test', owner: 'test@example.com', name: 'Offline test', rates: { ronPerEur:5, mdlPerEur:19.4 }, entries: { [mk]: { incomes: [{ id: 'i1', date: new Date().toISOString().slice(0,10), descriere: 'from-cache', client: 'Valentin', suma: 12, valuta: 'EUR', sumaEUR: 12 }], expenses: [], planner: [] } }, updatedAt: Date.now(), _fallback:true };
  await page.evaluate((p)=>{ const ls = localStorage.getItem('local_projects_v1'); const arr = ls?JSON.parse(ls):[]; arr.push(p); localStorage.setItem('local_projects_v1', JSON.stringify(arr)); }, proj);
  await page.click('text=Setări');
  await page.waitForTimeout(800);
  const html = await page.$eval('text=Proiecte remote', el => el.parentElement?.innerHTML);
  console.log('PROIECTE REMOTE HTML:\n', html);
  const found = await page.$$eval('*', els => els.map(e=>e.textContent).filter(Boolean).join('\n'));
  console.log('PAGE TEXT CONTAINS offline-test?', found.includes('Offline test'));
  await browser.close();
})();
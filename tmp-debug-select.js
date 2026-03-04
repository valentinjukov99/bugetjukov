import { chromium } from 'playwright';
(async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://bugetjukov.web.app', { waitUntil: 'networkidle' });
  await page.click('text=Setări');
  await page.waitForTimeout(1000);
  const selects = await page.$$eval('select', els => els.map(s => ({outer: s.outerHTML, text: s.innerText}))); 
  console.log(JSON.stringify(selects, null, 2));
  const opts = await page.$$eval('option', els => els.map(o => ({value:o.value, text:o.innerText})).slice(0,50));
  console.log('OPTIONS:', JSON.stringify(opts, null, 2));
  await browser.close();
})();
const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(process.argv[2]||'http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const html = await page.content();
  console.log(html.slice(0,2000));
  await browser.close();
})();

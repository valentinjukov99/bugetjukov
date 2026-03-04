const { chromium } = require('playwright');

(async ()=>{
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const url = process.env.APP_URL || 'http://localhost:5173/?e2e=1';
  const logs = [];
  page.on('console', msg => {
    logs.push({type: 'console', level: msg.type(), text: msg.text()});
  });
  page.on('pageerror', err => {
    logs.push({type: 'pageerror', error: String(err)});
  });
  page.on('response', resp => {
    // capture failed responses
    if (resp.status() >= 400) logs.push({type:'response', url: resp.url(), status: resp.status()});
  });
  try{
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1200);
  const ls = await page.evaluate(()=>({ keys: Object.keys(localStorage), state: localStorage.getItem('buget-mobile-state-v3'), projects: localStorage.getItem('local_projects_v1'), lastOpen: (()=>{ try{ const u = window.location; return u && u.search; }catch(e){return null;} })() } ));
  const helpers = await page.evaluate(()=>({ getAppEntries: typeof window.__getAppEntries === 'function', clearUI: typeof window.__clearUI === 'function', loadRemote: typeof window.__loadRemoteProject === 'function', __E2E: window.__E2E }));
    console.log('URL:', url);
    console.log('LocalStorage keys:', ls.keys);
    console.log('Has test helpers:', helpers);
    console.log('buget-mobile-state-v3 exists:', !!ls.state);
    if(ls.state) console.log('State length:', ls.state.length);
    if(ls.projects) console.log('local_projects_v1 length:', ls.projects.length);
    console.log('Console/page logs:');
    for(const l of logs) console.log(l.type, '-', l.level || '', l.text || l.error || JSON.stringify(l));
    await browser.close();
    process.exit(0);
  }catch(err){
    console.error('Runner failed', err);
    await browser.close();
    process.exit(2);
  }
})();
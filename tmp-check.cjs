const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg=> console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err=> console.log('PAGE ERROR:', err && err.stack ? err.stack : err.message));
  page.on('response', resp=>{
    try{ if(resp.status()>=400) console.log('BAD RESP:', resp.status(), resp.url()); }catch(e){ void e; }
  });
  await page.goto(process.argv[2]||'http://127.0.0.1:5174/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const hasSettings = await page.locator('text=Setări').count();
  console.log('Setări count:', hasSettings);
  const banner = await page.locator('#__e2e_local_projects_banner').textContent().catch(()=>null);
  console.log('__e2e_local_projects_banner:', banner);
  const preview = await page.locator('#__e2e_cached_preview').textContent().catch(()=>null);
  console.log('__e2e_cached_preview:', preview);
  // Additional runtime checks
  const reactPresent = await page.evaluate(()=>{ try{ return !!window.React || !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__; }catch(e){ return false; } });
  console.log('React present (window.React or devtools hook):', reactPresent);
  const reactUseEffectType = await page.evaluate(()=>{ try{ const r = window.React; return r? typeof r.useEffect : 'no-react'; }catch(e){ return 'err'; } });
  console.log('typeof React.useEffect:', reactUseEffectType);
  const rootChildren = await page.evaluate(()=>{ try{ const root = document.getElementById('root'); if(!root) return null; return root.innerHTML.slice(0,300); }catch(e){ return null; } });
  console.log('root innerHTML (truncated):', rootChildren? rootChildren.replace(/\n/g,'') : null);
  const bodyHtml = await page.evaluate(()=>{ try{ return document.body ? document.body.innerHTML.slice(0,2000) : null; }catch(e){ return null; } });
  console.log('body innerHTML (truncated 2000):', bodyHtml ? bodyHtml.replace(/\n/g,'') : null);
  const scripts = await page.evaluate(()=> Array.from(document.scripts||[]).map(s=>({src:s.src||null, type:s.type||null, defer: s.defer||false}))); 
  console.log('scripts:', scripts);
  await browser.close();
})();
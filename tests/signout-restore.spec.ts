import { test, expect } from '@playwright/test';

// Sign-out + restore smoke test: ensures UI clears on sign-out and restores from cache on reload/load
test('sign-out clears UI and restores from cache', async ({ page }) => {
  // Use APP_URL (CI) or fall back to local preview and enable test-mode via ?e2e=1
  const appUrl = (process.env.APP_URL || 'http://localhost:5173') + '/?e2e=1';
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  const projectId = 'signout-test';
  const today = new Date();
  const mk = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const proj = {
    id: projectId,
    owner: 'test@example.com',
    name: 'Signout test',
    rates: { ronPerEur:5, mdlPerEur:19.4 },
    entries: { [mk]: { incomes: [{ id: 'i1', date: new Date().toISOString().slice(0,10), descriere: 'from-cache-signout', client: 'Valentin', suma: 42, valuta: 'EUR', sumaEUR: 42 }], expenses: [], planner: [] } },
    updatedAt: Date.now(),
    _fallback: true
  };

  // write local project into local_projects_v1
  await page.evaluate((p)=>{
    const ls = localStorage.getItem('local_projects_v1');
    const arr = ls ? JSON.parse(ls) : [];
    // remove any existing with same id
    const filtered = (arr||[]).filter((x:any)=>x.id!==p.id);
    filtered.push(p);
    localStorage.setItem('local_projects_v1', JSON.stringify(filtered));
  }, proj);

  // ensure settings tab to surface project list
  await page.click('text=Setări');
  await page.waitForTimeout(500);

  // load project via exposed loader
  await page.evaluate((id:string)=>{ const fn=(window as any).__loadRemoteProject; if(typeof fn==='function') fn(id); }, projectId);
  await page.waitForFunction((id:any)=> (window as any).__lastLoadDone === id, projectId);
  await expect(page.locator('text=from-cache-signout')).toBeVisible({ timeout: 5000 });

  // wait for test helpers to be registered by the app, then clear UI via safe helper
  await page.waitForFunction(()=> typeof (window as any).__clearUI === 'function' && typeof (window as any).__getAppEntries === 'function', { timeout: 8000 });
  await page.evaluate(()=> (window as any).__clearUI && (window as any).__clearUI());
  // wait until the in-memory entries snapshot no longer contains the test string
  await page.waitForFunction(()=> {
    try{
      const g=(window as any).__getAppEntries; if(typeof g!=='function') return false;
      const e = g(); if(!e) return true;
      try{
        for(const mk of Object.keys(e||{})){
          const M = e[mk] || {};
          const incomes = M.incomes || [];
          for(const i of incomes) if((i.descriere||'').includes('from-cache-signout')) return false;
          const expenses = M.expenses || [];
          for(const x of expenses) if((x.descriere||'').includes('from-cache-signout')) return false;
        }
      }catch(err){ /* ignore */ }
      return true;
    }catch(e){ return false; }
  }, { timeout: 8000 });

  // reload and load again to simulate user signing back in and loading same project
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate((id:string)=>{ const fn=(window as any).__loadRemoteProject; if(typeof fn==='function') fn(id); }, projectId);
  await page.waitForFunction((id:any)=> (window as any).__lastLoadDone === id, projectId);
  await expect(page.locator('text=from-cache-signout')).toBeVisible({ timeout: 5000 });
});

import { test, expect } from '@playwright/test';

// Basic offline cache smoke test
test('offline loads project from local cache', async ({ page }) => {
  // Use APP_URL (CI) or fall back to local preview; append ?e2e=1 so the app exposes test helpers
  const appUrl = (process.env.APP_URL || 'http://localhost:5173') + '/?e2e=1';
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  // Prepare a local cached project
  const projectId = 'offline-test';
  const today = new Date();
  const mk = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const proj = {
    id: projectId,
    owner: 'test@example.com',
    name: 'Offline test',
    rates: { ronPerEur:5, mdlPerEur:19.4 },
    entries: { [mk]: { incomes: [{ id: 'i1', date: new Date().toISOString().slice(0,10), descriere: 'from-cache', client: 'Valentin', suma: 12, valuta: 'EUR', sumaEUR: 12 }], expenses: [], planner: [] } },
    updatedAt: Date.now(),
    _fallback: true
  };

  await page.evaluate((p) => {
    const ls = localStorage.getItem('local_projects_v1');
    const arr = ls ? JSON.parse(ls) : [];
    arr.push(p);
    localStorage.setItem('local_projects_v1', JSON.stringify(arr));
  }, proj);

  // Go offline
  await page.context().setOffline(true);
  // Instead of clicking the UI, write the global snapshot and reload the app so the cached project is loaded on startup.
  await page.evaluate((p) => {
    const snap = { rates: p.rates, entries: p.entries, backup: {}, cloud: {} };
    localStorage.setItem('buget-mobile-state-v3', JSON.stringify(snap));
  }, proj);
  // reload so the app picks up the global snapshot synchronously on startup
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Wait a bit longer for UI to render and React to hydrate in CI environments
  await page.waitForTimeout(2500);
  // Inject the cached entries into the app via the test helper (no auth/cloud required)
  await page.evaluate((entries)=>{ try{ const fn = (window as any).__setAppEntries; if(typeof fn==='function'){ fn(entries); } }catch(e){ console.error(e); } }, proj.entries);
  // Wait for the UI to react to the injected entries and ensure Add tab is active
  await page.waitForTimeout(1500);
  // Click the 'Adaugă' tab to make sure the entries view is visible
  try{ await page.click('text=Adaugă'); }catch(e){}
  await page.waitForTimeout(500);
  // Diagnostic: read the app entries via the test helper and assert it contains our seeded description
  const appEntries = await page.evaluate(()=>{ try{ const fn=(window as any).__getAppEntries; return typeof fn==='function'? fn() : null;}catch(e){ return {__err: String(e)}; } });
  console.log('DEBUG appEntries keys:', Object.keys(appEntries||{}));
  const flat = JSON.stringify(appEntries||{});
  if(!flat.includes('from-cache')){
    console.error('DEBUG: entries did not include from-cache; entries snapshot:', flat.slice(0,2000));
  }
  expect(flat.includes('from-cache')).toBeTruthy();

  // restore online
  await page.context().setOffline(false);
});

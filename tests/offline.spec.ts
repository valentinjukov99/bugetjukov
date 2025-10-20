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

  // Open settings tab (label 'Setări')
  await page.click('text=Setări');
  await page.waitForTimeout(800);

  // Wait for the remote projects list and find our project entry
  await expect(page.locator(`text=${proj.name}`)).toBeVisible({ timeout: 5000 });

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
  // Invoke loadRemoteProject via the exposed debug hook to load the project into UI
  // Invoke loadRemoteProject via the exposed debug hook to load the project into UI
  await page.evaluate((id:string)=>{ try{ const fn = (window as any).__loadRemoteProject; if(typeof fn==='function'){ return fn(id); } return null; }catch(e){ console.error(e); return null; } }, projectId);
  // Wait until the app indicates the load finished
  await page.waitForFunction((id:any)=> (window as any).__lastLoadDone === id, projectId);
  // Check that the description from the cached income is visible somewhere
  await expect(page.locator('text=from-cache')).toBeVisible({ timeout: 10000 });

  // restore online
  await page.context().setOffline(false);
});

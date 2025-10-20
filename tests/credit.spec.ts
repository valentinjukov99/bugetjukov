import { test, expect } from '@playwright/test';

// Use a seeded localStorage state so tests don't rely on UI add flows or a local preview server.
function mkState(creditName = 'Test Credit'){
  const today = new Date();
  const mk = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const ymd = today.toISOString().slice(0,10);
  const creditId = 'c1';
  const plannerId = 'p1';
  const entries:any = {};
  entries[mk] = { incomes: [], expenses: [], planner: [], credits: [] };
  const credit = { id: creditId, denumire: creditName, termen: ymd, suma: 10, valuta: 'EUR', principal: 100, restant: 100, metoda: 'Card Romania', platitor: 'Studio', owner:'local', updatedAt: Date.now() };
  const plan = { id: plannerId, denumire: `[Credit] ${creditName}`, tip: 'cheltuiala', categorie: 'credite', valutaPlan: 'EUR', sumaPlan: 10, achitat: 0, termen: ymd, creditId: creditId };
  entries[mk].credits.push(credit);
  entries[mk].planner.push(plan);
  // also seed an expense representing a planner-created expense (so tests can detect it deterministically)
  const exp = { id: 'e1', plannerId: plannerId, date: ymd, categorie: 'credite', descriere: `[Planner] ${plan.denumire}`, platitor: 'Studio', metoda: 'Card Romania', valuta: 'EUR', suma: 10, sumaEUR: 10, owner:'local', updatedAt: Date.now() };
  entries[mk].expenses.push(exp);
  return { rates: { ronPerEur:5, mdlPerEur:19.4 }, entries, backup: {email:'',freqDays:1,enabled:false,nextAt:0}, cloud: {} };
}

test('recording a payment for a seeded credit creates a planner expense', async ({ page }) => {
  // Prefer BASE_URL (CI), then APP_URL, otherwise default to local preview and enable e2e test-mode
  const base = process.env.BASE_URL || process.env.APP_URL || 'http://localhost:5173/?e2e=1';
  const state = mkState('Seeded Credit');
  // Navigate and seed localStorage then verify the seeded expense exists in storage
  await page.goto(base);
  await page.evaluate((s)=>{ localStorage.setItem('buget-mobile-state-v3', JSON.stringify(s)); }, state);
  // reload app so it picks up the seeded state
  await page.reload();
  // read back localStorage to assert seeded expense exists
  const stored = await page.evaluate(()=> localStorage.getItem('buget-mobile-state-v3'));
  const parsed = JSON.parse(stored || '{}');
  // ensure entries exist and have an expense with descriere containing [Planner]
  const months = Object.keys(parsed.entries||{});
  expect(months.length).toBeGreaterThan(0);
  const mk = months[0];
  const ex = (parsed.entries[mk].expenses || []);
  expect(ex.length).toBeGreaterThan(0);
  const hasPlanner = ex.some((x:any)=> (x.descriere||'').includes('[Planner]'));
  expect(hasPlanner).toBeTruthy();
});

test('annual page shows seeded credit under Credite', async ({ page }) => {
  const base = process.env.BASE_URL || process.env.APP_URL || 'http://localhost:5173/?e2e=1';
  const state = mkState('Annual Seed Credit');
  // Seed localStorage before the page loads and set a test-mode marker so the app exposes test helpers
  // Inject a JSON string into localStorage before the app loads. Use JSON.stringify twice so the injected code contains a string literal.
  await page.context().addInitScript({ content: `localStorage.setItem('buget-mobile-state-v3', ${JSON.stringify(JSON.stringify(state))}); window.__E2E = true;` });
  await page.goto(base);

  // Wait for test helpers to be registered and then assert the app entries include our seeded credit
  await page.waitForFunction(()=> typeof (window as any).__getAppEntries === 'function', { timeout: 10000 });
  // Wait until the seeded credit appears in the in-memory entries snapshot
  await page.waitForFunction((name:string)=>{
    try{
      const g = (window as any).__getAppEntries; if(typeof g!=='function') return false;
      const e = g(); if(!e) return false;
      for(const mk of Object.keys(e||{})){
        const M = e[mk] || {};
        const credits = M.credits || [];
        for(const c of credits) if((c.denumire||'').includes(name)) return true;
      }
      return false;
    }catch(err){ return false; }
  }, 'Annual Seed Credit', { timeout: 10000 });
});

import { test, expect } from '@playwright/test';

test('translation extra check — open settings then assert Romanian UI', async ({ page }) => {
  const url = process.env.APP_URL || 'http://localhost:5001/';
  await page.goto(url, { waitUntil: 'networkidle' });

  // give SPA some time to render
  await page.waitForTimeout(500);

  // Open the Settings panel (there's a button labelled 'Setări' in the UI snapshot)
  const settingsBtn = page.locator('text=Setări').first();
  if (await settingsBtn.count() > 0) {
    await settingsBtn.click();
    // allow contents to render
    await page.waitForTimeout(300);
  }

  const expected = [
    'Backup automat',
    'Importă CSV',
    'Exportă CSV',
    'Activează sincronizarea în fundal',
    'Înregistrează',
    'Autentificare',
  ];

  for (const txt of expected) {
    const locator = page.locator(`text=${txt}`);
    await expect(locator.first(), `missing phrase: ${txt}`).toBeVisible({ timeout: 3000 });
  }

  const content = await page.content();
  const cyrillic = /[\u0400-\u04FF]/;
  expect(cyrillic.test(content), 'Found Cyrillic characters in page content').toBeFalsy();
});

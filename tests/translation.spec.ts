import { test, expect } from '@playwright/test';

test.describe('UI translation checks', ()=>{
  test('app shows Romanian UI and no Cyrillic', async ({ page }) => {
    const url = process.env.APP_URL || 'http://localhost:5001/';
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait a bit for the SPA to bootstrap
    await page.waitForTimeout(500);

    // Check several Romanian UI phrases that should be visible
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

    // Ensure there are no Cyrillic characters in the rendered page content
    const content = await page.content();
    const cyrillic = /[\u0400-\u04FF]/;
    expect(cyrillic.test(content), 'Found Cyrillic characters in page content').toBeFalsy();
  });
});

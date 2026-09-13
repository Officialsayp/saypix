// Optional browser regression: serve dist, then run with an installed Playwright.
// PLAYWRIGHT_MODULE may point to an existing playwright/index.mjs installation.
// BASE_URL defaults to the project's preview server; BROWSER defaults to chromium.
import assert from 'node:assert/strict';

const { [process.env.BROWSER || 'chromium']: engine } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await engine.launch();
const base = process.env.BASE_URL || 'http://localhost:4173';
let cases = 0;
try {
  for (const width of [320, 375, 390, 768, 1440]) {
    for (const lang of ['ru', 'en']) {
      for (const mode of ['normal', 'reduced', 'no-js']) {
        const context = await browser.newContext({
          viewport: { width, height: 844 },
          isMobile: width < 768,
          hasTouch: width < 768,
          javaScriptEnabled: mode !== 'no-js',
          reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
        });
        const page = await context.newPage();
        await page.goto(`${base}/${lang}/`);
        const checkWidth = async () => {
          const geometry = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
            window: innerWidth,
          }));
          assert.ok(geometry.scroll <= width + 1, JSON.stringify({ width, lang, mode, geometry }));
          assert.ok(geometry.window <= width + 1, 'Mobile viewport must not expand to fit the hidden curtain');
        };
        await checkWidth();
        if (mode === 'normal') {
          // Exercise both off-screen directions and intermediate curtain positions.
          for (const percent of [-100, -80, -60, -40, -20, 0, 20, 40, 60, 80, 100]) {
            await page.locator('[data-reveal]').evaluate((node, x) => {
              node.style.transform = `translate3d(${x}%, 0, 0)`;
            }, percent);
            await checkWidth();
          }
          await page.locator('[data-reveal]').evaluate(node => node.style.removeProperty('transform'));
        }
        const other = lang === 'ru' ? 'en' : 'ru';
        const link = page.locator(`[data-lang-target="${other}"]`);
        await link.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL(`**/${other}/`);
        await checkWidth();
        await context.close();
        cases++;
      }
    }
  }
  console.log(`Layout regression passed: ${cases} language/viewport/motion/JS cases`);
} finally {
  await browser.close();
}

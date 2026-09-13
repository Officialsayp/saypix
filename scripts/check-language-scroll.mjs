// Optional Playwright regression; same environment options as check-layout.mjs.
import assert from 'node:assert/strict';
const { [process.env.BROWSER || 'chromium']: engine } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await engine.launch();
const base = process.env.BASE_URL || 'http://localhost:4173';
try {
  for (const width of [375, 1440]) for (const lang of ['ru', 'en']) {
    for (const section of ['about', 'stack', 'projects']) {
      const page = await browser.newPage({ viewport: { width, height: 812 }, isMobile: width < 768 });
      await page.goto(`${base}/${lang}/`);
      const other = lang === 'ru' ? 'en' : 'ru';
      const link = page.locator(`[data-lang-target="${other}"]`);
      await link.hover();
      await page.waitForTimeout(300);
      await page.locator(`#${section}-${lang}`).evaluate(node => window.scrollTo({
        top: node.offsetTop + node.offsetHeight * 0.2, behavior: 'instant',
      }));
      const box = await link.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForFunction(() => document.querySelector('[data-layer="curtain"] section'));
      await page.mouse.move(other === 'en' ? 5 : width - 5, box.y + box.height / 2, { steps: 30 });
      const expected = await page.locator(`#${section}-${lang}`).evaluate(node => -node.getBoundingClientRect().top / node.offsetHeight);
      await page.mouse.up();
      await page.waitForURL(`**/${other}/`);
      await page.waitForTimeout(200);
      const actual = await page.locator(`#${section}-${other}`).evaluate(node => -node.getBoundingClientRect().top / node.offsetHeight);
      assert.ok(Math.abs(expected - actual) < 0.02, JSON.stringify({ width, lang, section, expected, actual }));
      assert.equal(await page.evaluate(() => sessionStorage.getItem('language-scroll')), null);
      await page.close();
    }
  }
  console.log('Language scroll: 12 bidirectional desktop/mobile drag cases passed');
} finally { await browser.close(); }

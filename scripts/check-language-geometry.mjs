// Optional Playwright regression; environment options match check-layout.mjs.
import assert from 'node:assert/strict';
const { [process.env.BROWSER || 'chromium']: engine } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await engine.launch();
const base = process.env.BASE_URL || 'http://localhost:4173';
const selector = 'section,.hero__lead,.hero__visual,.section h2,.section__body,.project-card,.project-card h3,.project-card p,.project-card__highlights li,.project-card__tags,.project-card__meta';
try {
  for (const width of [320, 375, 390, 430, 560, 561, 768, 860, 861, 1024, 1200, 1440]) {
    const layouts = [];
    for (const lang of ['ru', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: 812 }, javaScriptEnabled: false });
      await page.goto(`${base}/${lang}/`);
      layouts.push(await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, height: rect.height, name: node.id || node.className || node.tagName };
      })));
      await page.close();
    }
    assert.equal(layouts[0].length, layouts[1].length);
    layouts[0].forEach((ru, index) => {
      const en = layouts[1][index];
      for (const key of ['top', 'height']) {
        assert.ok(Math.abs(ru[key] - en[key]) <= 1, JSON.stringify({ width, key, ru, en }));
      }
    });
  }
  console.log('RU/EN block geometry matches at 12 widths without JavaScript');
} finally { await browser.close(); }

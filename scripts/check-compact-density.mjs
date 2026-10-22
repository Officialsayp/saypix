// Optional browser gate for the approved Compact B layout.
// Run with a local dist server and playwright-core (Chromium/Chrome).
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const widths = [320, 340, 360, 375, 390, 414, 430, 480, 560, 561, 585, 700, 768, 860, 861, 1024, 1199, 1200, 1440, 1920];
const selector = [
  'main > section', '.hero__lead', '.hero__visual',
  '.section h2', '.section__body', '.section__body > p',
  '.project-card', '.project-card h3', '.project-card p',
  '.project-card__highlights li', '.project-card__tags',
  '.project-card__meta', '.project-card__status', '.project-card__link',
  '.chips', '.contacts__links'
].join(',');
const coords = els => els.map(el => {
  const r = el.getBoundingClientRect();
  return { top:r.top, height:r.height };
});
try {
  for (const width of widths) {
    const results = [];
    for (const lang of ['ru', 'en']) {
      const page = await browser.newPage({ viewport:{width,height:844}, javaScriptEnabled:false });
      await page.goto(`${base}/${lang}/`);
      const metrics = await page.locator(selector).evaluateAll(coords);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, JSON.stringify({width,lang,overflow}));
      results.push(metrics);
      await page.close();
    }
    assert.equal(results[0].length, results[1].length);
    results[0].forEach((ru,i) => ['top','height'].forEach(field => {
      const diff = Math.abs(ru[field]-results[1][i][field]);
      assert.ok(diff<=1, JSON.stringify({width,i,field,diff,ru,en:results[1][i]}));
    }));
    console.log('Density geometry OK',width);
  }
  // Check the actual production curtain (not the lightweight standalone preview).
  for (const width of [375,1440]) {
    for (const lang of ['ru','en']) {
      const other = lang==='ru' ? 'en' : 'ru';
      const page = await browser.newPage({viewport:{width,height:844}});
      await page.goto(`${base}/${lang}/`);
      const control = page.locator(`[data-lang-target="${other}"]`);
      const errors = [];
      page.on('console', msg => { if (msg.type()==='warning' || msg.type()==='error') errors.push('console: '+msg.text()); });
      page.on('pageerror', err => errors.push('pageerror: '+err.message));
      page.on('requestfailed', req => errors.push('requestfailed: '+req.url()+' '+req.failure()?.errorText));
      await control.hover();
      try {
        await page.waitForFunction(() => !!document.querySelector('[data-layer="curtain"] .page'),{timeout:6500});
      } catch (error) {
        const debug = await page.evaluate(() => ({initial:document.documentElement.dataset.initialLang,fragment:document.documentElement.dataset.curtainFragment,primary:!!document.querySelector('[data-layer="primary"] .page'),navCount:document.querySelectorAll('[data-lang-target]').length,resources:performance.getEntriesByType('resource').map(r=>({name:r.name,status:r.responseStatus})).slice(-10)}));
        console.error('Curtain load debug',JSON.stringify({width,lang,debug,errors}));
        throw error;
      }
      const pair = await page.evaluate(sel => {
        const primary=document.querySelector('[data-layer="primary"]');
        const curtain=document.querySelector('[data-layer="curtain"]');
        const a=Array.from(primary.querySelectorAll(sel));
        const b=Array.from(curtain.querySelectorAll(sel));
        return a.map((e,i) => ({name:e.className||e.tagName,
          dy:Math.abs(e.getBoundingClientRect().top - b[i].getBoundingClientRect().top),
          dh:Math.abs(e.getBoundingClientRect().height - b[i].getBoundingClientRect().height)}));
      },selector);
      assert.ok(pair.every(p=>p.dy<=1&&p.dh<=1), JSON.stringify({width,lang,bad:pair.filter(p=>p.dy>1||p.dh>1).slice(0,5)}));
      // Click completes a full language transition using the deployed JS path.
      await control.click();
      await page.waitForURL(`**/${other}/`);
      await page.close();
      console.log('Curtain layers and navigation OK',width,lang);
    }
  }
  console.log('Compact B: strict RU/EN geometry and curtain checks passed.');
} finally { await browser.close(); }

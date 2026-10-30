// One-off read-only browser audit. Do not import this into the production bundle.
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browserModule = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browserName = process.env.BROWSER_ENGINE || 'chromium';
const browser = await browserModule[browserName].launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  ...(browserName === 'chromium' ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}),
});
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const widths = [320, 333, 334, 335, 340, 360, 375, 390, 414, 430, 480, 560, 561, 585, 700, 768, 860, 861, 1024, 1199, 1200, 1440, 1512, 1920];
const screenshots = new Set([320, 375, 560, 561, 860, 861, 1440, 1920]);
const output = 'geometry-audit';
await mkdir(output, { recursive: true });
const report = { browser: browserName, widths, cases: [], findings: [] };
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

try {
  for (const width of widths) {
    const byLanguage = [];
    for (const lang of ['ru', 'en']) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        javaScriptEnabled: false,
        reducedMotion: 'reduce',
        deviceScaleFactor: 1,
      });
      try {
        const response = await page.goto(`${base}/${lang}/`, { waitUntil: 'load' });
        assert.equal(response?.status(), 200, 'Local static build must load');
        await page.evaluate(() => document.fonts.ready);
        const data = await page.evaluate(() => {
          const q = s => document.querySelector(s);
          const qq = s => Array.from(document.querySelectorAll(s));
          const rect = el => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.left, y: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
          };
          const r = s => rect(q(s));
          const delta = (a, b) => a && b ? +(a.x - b.x).toFixed(3) : null;
          const rootWidth = document.documentElement.clientWidth;
          const head = name => r(`#${name}-${document.documentElement.lang} .section__head h2`);
          const containerEdges = qq('main > section .container').map(rect);
          const tech = qq('[id^="stack-"] .stack-group').map(group => ({
            title: group.querySelector('h3')?.textContent,
            titleRect: rect(group.querySelector('h3')),
            chipsRect: rect(group.querySelector('.chips')),
            firstChipRect: rect(group.querySelector('.chip')),
            rowRect: rect(group)
          }));
          const projectCards = qq('[id^="projects-"] .project-card').map(card => ({
            row: rect(card), content: rect(card.querySelector('.project-card__content')),
            title: rect(card.querySelector('h3')), meta: rect(card.querySelector('.project-card__meta')),
            links: Array.from(card.querySelectorAll('.project-card__link')).map(rect),
          }));
          const links = qq('.nav a').map(rect);
          const codeBox = q('.hero__visual-code');
          const codeContent = q('.hero__visual-code-content');
          const codeStyle = getComputedStyle(codeBox);
          const geometricLeaves = [
            '.nav a','.hero h1 span','.hero__lead','.hero__actions .button',
            '.section h2','.section__body p','.stack-group h3','.chip',
            '.project-card h3','.project-card p','.project-card__highlights li',
            '.project-card__tag','.project-card__status','.project-card__link',
            '.contacts__links .contact-link'
          ];
          const outside = qq(geometricLeaves.join(',')).map(el => ({
            type: el.className || el.tagName, text: (el.textContent || '').trim().slice(0, 45),
            box: rect(el)
          })).filter(item => item.box.x < -1 || item.box.right > rootWidth + 1);
          const overlapX = (a, b) => a && b && a.x < b.right - 0.5 && b.x < a.right - 0.5;
          const overlapY = (a, b) => a && b && a.y < b.bottom - 0.5 && b.y < a.bottom - 0.5;
          const navOverlaps = links.slice(1).flatMap((link, i) =>
            overlapX(link, links[i]) && overlapY(link, links[i]) ? [i] : []);
          const hero = { content: r('.hero__content'), visual: r('.hero__visual'), title: r('.hero h1'),
            actions: r('.hero__actions'), button: r('.hero__actions .button'),
            fontSize: getComputedStyle(q('.hero h1')).fontSize };
          const projectX = projectCards[0]?.content;
          return {
            viewport: rootWidth, documentScroll: document.documentElement.scrollWidth,
            documentOverflow: document.documentElement.scrollWidth - rootWidth,
            containerEdges, hero, nav: { dock: r('.header__inner'), links, overlaps: navOverlaps },
            language: { ru: r('.language-edge--ru'), en: r('.language-edge--en') },
            headBodyAlignment: delta(head('about'), r('[id^="about-"] .section__body')),
            headContactsAlignment: delta(head('contacts'), r('.contacts__links')),
            stackProjectAlignment: tech.flatMap(t => [
              delta(t.titleRect, projectX), delta(t.chipsRect, projectX),
              delta(t.firstChipRect, projectX)]),
            projectCards, tech,
            code: { outer: rect(codeBox), content: rect(codeContent),
              innerOverflow: codeContent.scrollWidth - codeContent.clientWidth,
              paddingLeft: codeStyle.paddingLeft, paddingRight: codeStyle.paddingRight },
            outside
          };
        });
        const findings = [];
        const add = (id, detail) => findings.push({ browser: browserName, width, lang, id, detail });
        if (data.documentOverflow > 1) add('DOCUMENT_OVERFLOW', data.documentOverflow);
        if (data.code.innerOverflow > 1) add('CODE_INNER_OVERFLOW', data.code.innerOverflow);
        if (!near(data.headBodyAlignment, 0)) add('ABOUT_AXIS', data.headBodyAlignment);
        if (!near(data.headContactsAlignment, 0)) add('CONTACTS_AXIS', data.headContactsAlignment);
        for (const dx of data.stackProjectAlignment) if (!near(dx, 0)) add('STACK_PROJECT_AXIS', dx);
        if (data.outside.length) add('LEAVES_OUTSIDE_VIEWPORT', data.outside);
        if (data.nav.overlaps.length) add('NAV_LINK_OVERLAP', data.nav.overlaps);
        if (Math.abs((data.nav.dock.x + data.nav.dock.w / 2) - data.viewport / 2) > 1)
          add('NAV_NOT_CENTERED', data.nav.dock);
        if (Math.abs(data.language.ru.x - (data.viewport - data.language.en.right)) > 1)
          add('LANGUAGE_EDGES_ASYMMETRIC', data.language);
        if (data.hero.content && data.hero.visual && width <= 860 &&
            data.hero.content.bottom > data.hero.visual.y + 1)
          add('HERO_CONTENT_VISUAL_OVERLAP', { content: data.hero.content, visual: data.hero.visual });
        if (data.projectCards.length > 1 && data.projectCards.some(c => c.content && c.meta &&
              c.content.x < c.meta.right - 0.5 && c.meta.x < c.content.right - 0.5 &&
              c.content.y < c.meta.bottom - 0.5 && c.meta.y < c.content.bottom - 0.5 &&
              width > 860))
          add('PROJECT_CONTENT_META_OVERLAP', data.projectCards);
        const single = { width, lang, ...data, findings };
        report.cases.push(single);
        report.findings.push(...findings);
        byLanguage.push(single);
        console.log('GEOMETRY_CASE', JSON.stringify({ browser: browserName, width, lang,
          overflow: data.documentOverflow, codeOverflow: data.code.innerOverflow,
          headBody: data.headBodyAlignment, contacts: data.headContactsAlignment,
          stackDx: data.stackProjectAlignment, heroFont: data.hero.fontSize,
          issues: findings.map(f => f.id) }));
        if (screenshots.has(width) && (browserName === 'chromium' || [375, 1440].includes(width)))
          await page.screenshot({ path: `${output}/${browserName}-${lang}-${width}.png`, fullPage: true,
            animations: 'disabled' });
      } finally { await page.close(); }
    }
    const a = byLanguage[0], b = byLanguage[1];
    if (a && b) {
      const checks = [
        ['hero', a.hero.visual, b.hero.visual],
        ['projects', a.projectCards[0]?.row, b.projectCards[0]?.row],
        ['contacts', a.containerEdges[4], b.containerEdges[4]]
      ];
      for (const [component, l, r] of checks) {
        if (l && r && (!near(l.y, r.y) || !near(l.h, r.h)))
          report.findings.push({ browser: browserName, width, lang: 'comparison',
            id: 'RU_EN_GEOMETRY_DIFFERENCE', detail: { component, ru: l, en: r } });
      }
    }
  }
} finally {
  await writeFile(`${output}/report-${browserName}.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
const totals = Object.fromEntries([...new Set(report.findings.map(f => f.id))]
  .map(id => [id, report.findings.filter(f => f.id === id).length]));
console.log('GEOMETRY_SUMMARY', JSON.stringify({
  browser: browserName, cases: report.cases.length, findings: report.findings.length, byType: totals,
  report: `${output}/report-${browserName}.json`
}));

// Optional browser gate for the approved Compact B layout.
// Run with a local dist server and playwright-core (Chromium/Chrome).
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const widths = [320, 333, 334, 340, 360, 375, 390, 414, 430, 480, 560, 561, 585, 700, 768, 860, 861, 1024, 1199, 1200, 1440, 1920];
const selector = [
  'main > section', '.hero__lead', '.hero__visual',
  '.section h2', '.section__body', '.section__body > p',
  '.project-card', '.project-card h3', '.project-card p',
  '.project-card__highlights li', '.project-card__tags',
  '.project-card__meta', '.project-card__status', '.project-card__link',
  '.chips', '.stack-list', '.stack-group', '.stack-group h3', '.stack-group__content', '.stack-group .chip', '.contacts__links'
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
      // Preserve exactly three visible rules around Projects:
      // the full-width section top, one separator between the two cards,
      // and the next section's full-width top.
      const borders = await page.evaluate(() => {
        const projects = document.querySelector('[id^="projects-"]');
        const contacts = document.querySelector('[id^="contacts-"]');
        const cards = [...projects.querySelectorAll('.project-card')];
        const top = el => getComputedStyle(el).borderTopWidth;
        const bottom = el => getComputedStyle(el).borderBottomWidth;
        return {
          count: cards.length,
          sectionTop: top(projects),
          firstTop: top(cards[0]),
          middleTop: top(cards[1]),
          firstBottom: bottom(cards[0]),
          lastBottom: bottom(cards.at(-1)),
          nextSectionTop: top(contacts)
        };
      });
      assert.deepEqual(borders,{
        count:2, sectionTop:'1px', firstTop:'0px', middleTop:'1px',
        firstBottom:'0px', lastBottom:'0px', nextSectionTop:'1px'
      }, JSON.stringify({width,lang,borders}));
      const stack = await page.evaluate(() => {
        const section = document.querySelector('[id^="stack-"]');
        const rows = [...section.querySelectorAll('.stack-group')];
        const projectContentX = document.querySelector('[id^="projects-"] .project-card__content').getBoundingClientRect().left;
        const projectRowX = document.querySelector('[id^="projects-"] .project-card').getBoundingClientRect().left;
        const alignmentDiffs = rows.flatMap(row => [
          row.querySelector('h3'),
          row.querySelector('.stack-group__content'),
          row.querySelector('.chips'),
          row.querySelector('.chip')
        ].map(el => el.getBoundingClientRect().left - projectContentX));
        const rowEdgeDiffs = rows.map(row => row.getBoundingClientRect().left - projectRowX);
        const border = (el, side) => getComputedStyle(el)[side];
        return {
          count: rows.length,
          numbering: section.querySelectorAll('.stack-group__num').length,
          headings: rows.map(el => el.querySelector('h3').textContent),
          chipCounts: rows.map(el => el.querySelectorAll('.chip').length),
          alignmentDiffs, rowEdgeDiffs,
          topSection: border(section,'borderTopWidth'),
          firstTop: border(rows[0],'borderTopWidth'),
          secondTop: border(rows[1],'borderTopWidth'),
          lastBottom: border(rows[1],'borderBottomWidth'),
          projectSectionTop: border(document.querySelector('[id^="projects-"]'),'borderTopWidth'),
          horizontalOverflow: rows.some(el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1),
          chipOverflow: rows.some(el => [...el.querySelectorAll('.chip')].some(chip =>
            chip.getBoundingClientRect().right > document.documentElement.clientWidth + 1))
        };
      });
      const { alignmentDiffs, rowEdgeDiffs, ...stackStructure } = stack;
      assert.deepEqual(stackStructure, {
        count:2,
        numbering:0,
        headings:['Backend & Data','Infrastructure & DevOps'],
        chipCounts:[6,7],
        topSection:'1px',firstTop:'0px',secondTop:'1px',lastBottom:'0px',
        projectSectionTop:'1px',horizontalOverflow:false,chipOverflow:false
      }, JSON.stringify({width,lang,stack}));
      for (const dx of [...alignmentDiffs, ...rowEdgeDiffs]) {
        assert.ok(Math.abs(dx) <= 1, JSON.stringify({width,lang,dx,alignmentDiffs,rowEdgeDiffs}));
      }
      const geometry = await page.evaluate(() => {
        const x = selector => document.querySelector(selector).getBoundingClientRect().left;
        const code = document.querySelector('.hero__visual-code-content');
        return {
          about: x('[id^="about-"] .section__head h2') - x('[id^="about-"] .section__body'),
          contacts: x('[id^="contacts-"] .section__head h2') - x('.contacts__links'),
          codeOverflow: code.scrollWidth - code.clientWidth,
        };
      });
      assert.ok(Math.abs(geometry.about) <= 1, JSON.stringify({width,lang,geometry}));
      assert.ok(Math.abs(geometry.contacts) <= 1, JSON.stringify({width,lang,geometry}));
      assert.ok(geometry.codeOverflow <= 1, JSON.stringify({width,lang,geometry}));
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
      // Hover only preloads the lazy assets; the translated DOM is inserted on pointerdown.
      // Test actual pointer movement, not an invented 'show on hover' behavior.
      await control.hover();
      const box = await control.boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
      await page.mouse.down();
      await page.waitForFunction(
        () => !!document.querySelector('[data-layer="curtain"] .page'),
        null,
        { timeout: 10000 }
      );
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
      // Drag the real curtain across the viewport and let its own snap complete.
      await page.mouse.move(other==='en'?5:width-5,box.y+box.height/2,{steps:30});
      await page.mouse.up();
      await page.waitForURL(`**/${other}/`,{timeout:12000});
      await page.close();
      console.log('Curtain layers and navigation OK',width,lang);
    }
  }
  console.log('Compact B: strict RU/EN geometry and curtain checks passed.');
} finally { await browser.close(); }

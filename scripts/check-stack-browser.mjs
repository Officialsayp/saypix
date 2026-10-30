import assert from 'node:assert/strict';

const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const browser = await pw[engine].launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  ...(engine === 'chromium' ? { args:['--no-sandbox','--disable-dev-shm-usage'] } : {}),
});
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const widths = [320, 340, 375, 390, 560, 561, 768, 860, 861, 1024, 1200, 1440, 1920];

try {
  for (const width of widths) {
    const geometries = [];
    for (const lang of ['ru','en']) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, javaScriptEnabled: false });
      await page.goto(`${base}/${lang}/`);
      const data = await page.evaluate(() => {
        const section = document.querySelector('[id^="stack-"]');
        const groups = [...section.querySelectorAll('.stack-group')];
        const projectContentX = document.querySelector('[id^="projects-"] .project-card__content').getBoundingClientRect().left;
        const projectRowX = document.querySelector('[id^="projects-"] .project-card').getBoundingClientRect().left;
        const coords = e => {
          const r=e.getBoundingClientRect();
          return { top:r.top, height:r.height, right:r.right };
        };
        return {
          groups: groups.map(group => ({
            title: group.querySelector('h3').textContent,
            count: group.querySelectorAll('.chip').length,
            box: coords(group),
            heading: coords(group.querySelector('h3')),
            content: coords(group.querySelector('.stack-group__content')),
            chipsContainer: coords(group.querySelector('.chips')),
            chips: [...group.querySelectorAll('.chip')].map(coords),
            alignment: [
              group.querySelector('h3'),
              group.querySelector('.chips'),
              group.querySelector('.chip'),
              group.querySelector('.stack-group__content')
            ].map(el => el.getBoundingClientRect().left - projectContentX),
            dividerLeftError: group.getBoundingClientRect().left - projectRowX,
            topBorder: getComputedStyle(group).borderTopWidth,
            bottomBorder: getComputedStyle(group).borderBottomWidth,
          })),
          numbering: section.querySelectorAll('.stack-group__num').length,
          stackTop: getComputedStyle(section).borderTopWidth,
          projectTop: getComputedStyle(document.querySelector('[id^="projects-"]')).borderTopWidth,
          overflow: document.documentElement.scrollWidth-document.documentElement.clientWidth,
        };
      });
      assert.deepEqual(data.groups.map(g=>g.title),['Backend & Data','Infrastructure & DevOps']);
      assert.deepEqual(data.groups.map(g=>g.count),[6,7]);
      assert.equal(data.numbering,0,'Stack group numbering must be absent');
      assert.equal(data.stackTop,'1px');
      assert.equal(data.projectTop,'1px');
      assert.deepEqual(data.groups.map(g=>g.topBorder),['0px','1px']);
      assert.deepEqual(data.groups.map(g=>g.bottomBorder),['0px','0px']);
      assert.ok(data.overflow<=1,JSON.stringify({engine,width,lang,overflow:data.overflow}));
      for(const group of data.groups) {
        assert.ok(group.box.right<=width+1,JSON.stringify({engine,width,lang,group}));
        for(const chip of group.chips)
          assert.ok(chip.right<=width+1,JSON.stringify({engine,width,lang,chip}));
        for (const dx of group.alignment)
          assert.ok(Math.abs(dx)<=1,JSON.stringify({engine,width,lang,alignTo:'project content',dx,group}));
        assert.ok(Math.abs(group.dividerLeftError)<=1,
          JSON.stringify({engine,width,lang,alignTo:'project full-width row',group}));
      }
      geometries.push(data.groups.map(g=>({top:g.box.top,height:g.box.height,headingTop:g.heading.top,headingHeight:g.heading.height})));
      await page.close();
    }
    for (let i=0;i<2;i++) {
      for(const field of ['top','height','headingTop','headingHeight']) {
        const diff=Math.abs(geometries[0][i][field]-geometries[1][i][field]);
        assert.ok(diff<=1,JSON.stringify({engine,width,group:i,field,diff}));
      }
    }
    console.log('STACK_GEOMETRY_OK',engine,width,'RU/EN two groups, 13 chips, one separator');
  }
} finally {
  await browser.close();
}

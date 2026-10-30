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
            chips: [...group.querySelectorAll('.chip')].map(coords),
            topBorder: getComputedStyle(group).borderTopWidth,
            bottomBorder: getComputedStyle(group).borderBottomWidth,
          })),
          stackTop: getComputedStyle(section).borderTopWidth,
          projectTop: getComputedStyle(document.querySelector('[id^="projects-"]')).borderTopWidth,
          overflow: document.documentElement.scrollWidth-document.documentElement.clientWidth,
        };
      });
      assert.deepEqual(data.groups.map(g=>g.title),['Backend & Data','Infrastructure & DevOps']);
      assert.deepEqual(data.groups.map(g=>g.count),[6,7]);
      assert.equal(data.stackTop,'1px');
      assert.equal(data.projectTop,'1px');
      assert.deepEqual(data.groups.map(g=>g.topBorder),['0px','1px']);
      assert.deepEqual(data.groups.map(g=>g.bottomBorder),['0px','0px']);
      assert.ok(data.overflow<=1,JSON.stringify({engine,width,lang,overflow:data.overflow}));
      for(const group of data.groups) {
        assert.ok(group.box.right<=width+1,JSON.stringify({engine,width,lang,group}));
        for(const chip of group.chips)
          assert.ok(chip.right<=width+1,JSON.stringify({engine,width,lang,chip}));
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

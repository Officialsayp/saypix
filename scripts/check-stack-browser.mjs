import assert from 'node:assert/strict';

const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const browser = await pw[engine].launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  ...(engine === 'chromium' ? { args:['--no-sandbox','--disable-dev-shm-usage'] } : {}),
});
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const widths = [320, 321, 333, 334, 340, 375, 390, 393, 559, 560, 561, 562, 768, 859, 860, 861, 862, 900, 960, 1024, 1100, 1150, 1180, 1198, 1199, 1200, 1201, 1280, 1366, 1440, 1512, 1536, 1920, 2560];

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
        const projectHeadingX = document.querySelector('[id^="projects-"] .section__head h2').getBoundingClientRect().left;
        const stackHeadingX = section.querySelector('.section__head h2').getBoundingClientRect().left;
        const projectRows = [...document.querySelectorAll('[id^="projects-"] .project-card')];
        const coords = e => {
          const r=e.getBoundingClientRect();
          return { left:r.left, top:r.top, height:r.height, right:r.right };
        };
        return {
          projectAxis: projectContentX - projectHeadingX,
          projectNumbersAbsent: projectRows.every(row => !row.querySelector('.project-card__num')),
          projectMetaInViewport: projectRows.every(row =>
            row.querySelector('.project-card__meta').getBoundingClientRect().right <=
              document.documentElement.clientWidth + 1),
          metaPositions: projectRows.map(row =>
            row.querySelector('.project-card__meta').getBoundingClientRect().left -
            row.querySelector('.project-card__content').getBoundingClientRect().left),
          textElementAxes: projectRows.flatMap(row =>
            ['h3','p','.project-card__highlights','.project-card__tags'].map(sel =>
              row.querySelector('.project-card__content').querySelector(sel).getBoundingClientRect().left -
              projectHeadingX)),
          actionsBelowText: projectRows.every(row =>
            row.querySelector('.project-card__meta').getBoundingClientRect().top >=
            row.querySelector('.project-card__content').getBoundingClientRect().bottom - 1),
          stackHeaderX: stackHeadingX,
          groups: groups.map(group => ({
            title: group.querySelector('h3').textContent,
            count: group.querySelectorAll('.chip').length,
            box: coords(group),
            heading: coords(group.querySelector('h3')),
            content: coords(group.querySelector('.stack-group__content')),
            chipsContainer: coords(group.querySelector('.chips')),
            chipsRightError: group.querySelector('.chips').getBoundingClientRect().right -
              section.querySelector('.container').getBoundingClientRect().right,
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
          aboutAxis: document.querySelector('[id^="about-"] .section__head h2').getBoundingClientRect().left
            - document.querySelector('[id^="about-"] .section__body').getBoundingClientRect().left,
          contactsAxis: document.querySelector('[id^="contacts-"] .section__head h2').getBoundingClientRect().left
            - document.querySelector('.contacts__links').getBoundingClientRect().left,
          codeOverflow: document.querySelector('.hero__visual-code-content').scrollWidth
            - document.querySelector('.hero__visual-code-content').clientWidth,
        };
      });
      assert.deepEqual(data.groups.map(g=>g.title),['Backend & Data','Infrastructure & DevOps']);
      assert.deepEqual(data.groups.map(g=>g.count),[6,7]);
      assert.equal(data.numbering,0,'Stack group numbering must be absent');
      assert.ok(Math.abs(data.aboutAxis) <= 1, JSON.stringify({engine,width,lang,aboutAxis:data.aboutAxis}));
      assert.ok(Math.abs(data.contactsAxis) <= 1, JSON.stringify({engine,width,lang,contactsAxis:data.contactsAxis}));
      assert.ok(data.codeOverflow <= 1, JSON.stringify({engine,width,lang,codeOverflow:data.codeOverflow}));
      assert.equal(data.projectMetaInViewport, true,
        JSON.stringify({engine,width,lang,projectMetaInViewport:data.projectMetaInViewport}));
      // The user-facing content must start at the large section heading
      // across mobile, tablet, laptop and desktop — not just at >=1200px.
      assert.ok(Math.abs(data.projectAxis) <= 1,
        JSON.stringify({engine,width,lang,projectAxis:data.projectAxis}));
      for(const group of data.groups) {
        const dx = group.heading.left - data.stackHeaderX;
        assert.ok(Math.abs(dx) <= 1,
          JSON.stringify({engine,width,lang,alignTo:'stack h2',dx}));
      }
      assert.equal(data.projectNumbersAbsent, true,
        JSON.stringify({engine,width,lang,projectNumbersAbsent:data.projectNumbersAbsent}));
      for(const dx of data.textElementAxes)
        assert.ok(Math.abs(dx) <= 1,
          JSON.stringify({engine,width,lang,projectTextAxis:dx}));
      if (width <= 1199)
        assert.equal(data.actionsBelowText, true,
          JSON.stringify({engine,width,lang,actionsBelowText:data.actionsBelowText}));
      if (width >= 861 && width <= 1199)
        for(const dx of data.metaPositions)
          assert.ok(Math.abs(dx) <= 1,
            JSON.stringify({engine,width,lang,metaAlignTo:'project content',dx}));
      assert.equal(data.stackTop,'1px');
      assert.equal(data.projectTop,'1px');
      assert.deepEqual(data.groups.map(g=>g.topBorder),['0px','1px']);
      assert.deepEqual(data.groups.map(g=>g.bottomBorder),['0px','0px']);
      assert.ok(data.overflow<=1,JSON.stringify({engine,width,lang,overflow:data.overflow}));
      for(const group of data.groups) {
        assert.ok(group.box.right<=width+1,JSON.stringify({engine,width,lang,group}));
        for(const chip of group.chips)
          assert.ok(chip.right<=width+1,JSON.stringify({engine,width,lang,chip}));
        if (width <= 860)
          assert.ok(Math.abs(group.chipsRightError) <= 1,
            JSON.stringify({engine,width,lang,techChipsUseFullWidth:group.chipsRightError}));
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

import assert from 'node:assert/strict';

const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const widths = [320, 360, 375, 390, 430, 560, 561, 640, 700, 720, 768, 800, 860, 861, 960, 1024, 1200, 1280, 1399, 1400, 1440, 1512, 1728, 1920];
const browser = await pw[engine].launch({
  ...(process.env.BROWSER_EXECUTABLE ? {executablePath: process.env.BROWSER_EXECUTABLE} : {}),
  headless: true,
  ...(engine === 'chromium' ? {args: ['--no-sandbox','--disable-dev-shm-usage']} : {})
});
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';

function near(a,b,tol=.9) { return Math.abs(a-b) <= tol; }

try {
  for (const width of widths) {
    for (const lang of ['ru','en']) {
      const touch=width<=560; // simulators for coarse-pointer mobile input
      const page = await browser.newPage({
        viewport:{width,height:900},
        hasTouch:touch,
        isMobile:touch,
        deviceScaleFactor:1
      });
      await page.goto(`${base}/${lang}/`);
      const button=page.locator('.code-copy');
      await button.scrollIntoViewIfNeeded();
      const m=await page.evaluate(() => {
        const box=e=>{
          const r=e.getBoundingClientRect();
          return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,
            width:r.width,height:r.height,centerX:r.left+r.width/2,centerY:r.top+r.height/2};
        };
        const el=document.querySelector('.code-copy');
        const b=box(el);
        const icon=box(el.querySelector('.code-copy__icons'));
        const code=box(document.querySelector('.hero__visual-code'));
        const nav=box(document.querySelector('.header__inner'));
        const art=box(document.querySelector('.hero__visual'));
        const ps=getComputedStyle(el);
        const hit=(x,y)=>{
          const item=document.elementFromPoint(x,y);
          return item===el||el.contains(item);
        };
        const delta=2;
        const hits={
          topOutside:hit(b.centerX,b.y-delta),
          bottomOutside:hit(b.centerX,b.bottom+delta),
          leftOutside:hit(b.x-delta,b.centerY),
          rightOutside:hit(b.right+delta,b.centerY),
          topInside:hit(b.centerX,b.y+delta),
          bottomInside:hit(b.centerX,b.bottom-delta),
          leftInside:hit(b.x+delta,b.centerY),
          rightInside:hit(b.right-delta,b.centerY),
          center:hit(b.centerX,b.centerY)
        };
        return {b,icon,code,nav,art,hits,border:ps.borderTopWidth,
          pseudo:getComputedStyle(el,'::before').content,
          pointerCoarse:matchMedia('(pointer: coarse)').matches,
          cssSize:ps.getPropertyValue('--copy-size'),
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
      });
      const expectedSize=touch?44:Math.max(30,Math.min(24+width*.0065,36));
      assert.ok(near(m.b.width,expectedSize,.11)&&near(m.b.height,expectedSize,.11),
        JSON.stringify({width,lang,engine,actual:m.b,expectedSize}));
      assert.ok(near(m.icon.centerX,m.b.centerX,.5)&&near(m.icon.centerY,m.b.centerY,.5),
        JSON.stringify({width,lang,engine,icon:m.icon,button:m.b}));
      assert.ok(m.pseudo==='none',JSON.stringify({width,lang,pseudo:m.pseudo}));
      assert.ok(Object.values(m.hits).every((hit,i)=>(i<4?!hit:hit)),
        JSON.stringify({width,lang,engine,hits:m.hits}));
      assert.ok(m.pointerCoarse===touch,JSON.stringify({width,lang,engine,pointerCoarse:m.pointerCoarse,touch}));
      assert.ok(m.overflow<=1,JSON.stringify({width,lang,engine,overflow:m.overflow}));
      const inset=Math.max(6,Math.min(width*.0055,8));
      assert.ok(near(m.b.y,m.code.y+inset,1.2)&&near(m.b.right,m.code.right-inset,1.2),
        JSON.stringify({width,lang,engine,visualAlignment:{button:m.b,code:m.code}}));
      if(width>=861)assert.ok(m.art.y>=m.nav.bottom+4,JSON.stringify({width,lang,engine,nav:m.nav,art:m.art}));

      // The browser hover boundary must coincide with every visible edge, including
      // a half-width desktop window: absolutely no hidden clickable area.
      if(!touch){
        const points=[
          {x:m.b.centerX,y:m.b.y-2,want:false},
          {x:m.b.centerX,y:m.b.y+2,want:true},
          {x:m.b.centerX,y:m.b.bottom-2,want:true},
          {x:m.b.centerX,y:m.b.bottom+2,want:false},
          {x:m.b.x-2,y:m.b.centerY,want:false},
          {x:m.b.x+2,y:m.b.centerY,want:true},
          {x:m.b.right-2,y:m.b.centerY,want:true},
          {x:m.b.right+2,y:m.b.centerY,want:false}
        ];
        for(const p of points){
          await page.mouse.move(p.x,p.y);
          const hovered=await button.evaluate(el=>el.matches(':hover'));
          assert.equal(hovered,p.want,JSON.stringify({width,lang,engine,p,hovered}));
        }
      }
      console.log('Exact copy target OK',engine,width,lang,
        `${m.b.width.toFixed(1)}×${m.b.height.toFixed(1)}`,'touch',touch);
      await page.close();
    }
  }

  // End-to-end copy success/failure, language-independent English tooltip,
  // and reset should preserve geometry without layout shifts.
  for (const width of [375,800,1440]) {
    for (const lang of ['ru','en']) {
      const touch=width===375;
      const page=await browser.newPage({viewport:{width,height:900},hasTouch:touch,isMobile:touch});
      await page.addInitScript(()=>{
        Object.defineProperty(navigator,'clipboard',{
          configurable:true,
          value:{writeText: async value => {
            window.__lastCopiedText=value;
            if(window.__forceCopyFailure)throw new Error('test rejection');
          }}
        });
      });
      await page.goto(`${base}/${lang}/`);
      const button=page.locator('.code-copy');
      await button.scrollIntoViewIfNeeded();
      const before=await button.boundingBox();
      await button.click();
      await page.waitForFunction(()=>document.querySelector('.code-copy').classList.contains('is-copied'));
      const success=await page.evaluate(()=>({
        copiedText:window.__lastCopiedText,
        tooltip:document.querySelector('.code-copy__tooltip').textContent,
        status:document.querySelector('[data-copy-status]').textContent
      }));
      assert.equal(success.tooltip,'Copied!');
      assert.ok(success.copiedText?.includes('package main'),JSON.stringify(success));
      assert.ok(success.status.length>0);
      await page.waitForTimeout(1900);
      assert.equal(await button.evaluate(el=>el.classList.contains('is-copied')),false);
      const after=await button.boundingBox();
      assert.ok(near(before.x,after.x,.2)&&near(before.y,after.y,.2)&&
        near(before.width,after.width,.2)&&near(before.height,after.height,.2),
        JSON.stringify({width,lang,engine,layoutShift:{before,after}}));
      await page.evaluate(()=>{window.__forceCopyFailure=true});
      await button.click();
      await page.waitForFunction(()=>document.querySelector('[data-copy-status]').textContent.length>0);
      assert.equal(await button.evaluate(el=>el.classList.contains('is-copied')),false);
      console.log('Clipboard feedback OK',engine,width,lang);
      await page.close();
    }
  }
  console.log('Copy redesign: exact pointer geometry and clipboard regressions passed.');
} finally {await browser.close();}

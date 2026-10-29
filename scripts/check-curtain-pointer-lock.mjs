import assert from 'node:assert/strict';

const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const browser = await pw[engine].launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? {executablePath: process.env.BROWSER_EXECUTABLE} : {}),
  ...(engine === 'chromium' ? {args: ['--no-sandbox', '--disable-dev-shm-usage']} : {})
});
const origin = process.env.BASE_URL || 'http://127.0.0.1:4173';
const widths = [375, 560, 768, 1024, 1512, 1920];
const tolerance = 1.05;

try {
  for (const width of widths) {
    for (const lang of ['ru', 'en']) {
      const page = await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
      const errors = [];
      page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(origin + '/' + lang + '/', {waitUntil:'load'});
      const targetLang = lang === 'ru' ? 'en' : 'ru';
      const control = page.locator('[data-lang-target="' + targetLang + '"]');
      const box = await control.boundingBox();
      assert.ok(box && box.width > 0);
      const dragX = box.x + box.width/2;
      const dragY = box.y + box.height/2;
      await page.mouse.move(dragX, dragY);
      await page.mouse.down();
      await page.waitForFunction(
        ()=>document.querySelector('.language-layer--curtain .page')!==null,
        null, {timeout:14000});
      const measures = [];
      const measure = async (expected,label)=>{
        const value = await page.evaluate(()=>{
          const r=document.querySelector('.curtain-divider').getBoundingClientRect();
          const g=document.querySelector('.language-ghost').getBoundingClientRect();
          return {center:r.left+r.width/2,
            ghostCenter:g.left+g.width/2, ghostHalfWidth:g.width/2,
            shown:document.querySelector('.curtain-divider').classList.contains('is-visible')};
        });
        const error=Math.abs(expected-value.center);
        measures.push({label,x:expected,error});
        assert.ok(error<=tolerance,JSON.stringify({engine,width,lang,label,expected,value,error}));
        // The floating language chip intentionally stays fully visible near
        // viewport edges; the seam itself must NOT inherit this constraint.
        const expectedGhost=Math.max(value.ghostHalfWidth,
          Math.min(width-value.ghostHalfWidth,expected));
        assert.ok(Math.abs(value.ghostCenter-expectedGhost)<=1.2,
          JSON.stringify({engine,width,lang,label,ghost:value.ghostCenter,expectedGhost}));
      };
      await measure(dragX,'initial-grip');
      const targets=lang==='ru'
        ? [width-95,width-250,width*.5,45,width-25,width*.25,20]
        : [95,250,width*.5,width-45,25,width*.75,width-20];
      for (let i=0;i<targets.length;i++) {
        const x=Math.max(1,Math.min(width-1,targets[i]));
        await page.mouse.move(x,dragY,{steps:1});
        await measure(x,'fast-jump-'+i);
      }
      // Observe immediately after the application's pointermove listener in the
      // same event dispatch. A delayed rAF/catch-up loop would fail this check,
      // even if it happened to catch up before a later Playwright evaluation.
      await page.evaluate(() => {
        window.pointerTrackingErrors = [];
        window.addEventListener('pointermove', event => {
          const r = document.querySelector('.curtain-divider').getBoundingClientRect();
          window.pointerTrackingErrors.push(Math.abs(r.left + r.width / 2 - event.clientX));
        });
      });
      for (let i=0; i<24; i++) {
        await page.mouse.move(width * [.02,.98,.2,.8][i%4], dragY, {steps:1});
      }
      const burstErrors = await page.evaluate(() => window.pointerTrackingErrors);
      assert.equal(burstErrors.length,24,`${engine}: missing rapid-reversal pointer events`);
      assert.ok(Math.max(...burstErrors)<=tolerance,
        JSON.stringify({engine,width,lang,burstErrors}));
      assert.equal(errors.length,0,JSON.stringify({engine,width,lang,errors}));
      await page.mouse.up();
      await page.waitForFunction(
        ()=>!document.querySelector('.curtain-divider')?.classList.contains('is-visible'),
        null,{timeout:10000}).catch(()=>{
          if (!page.isClosed() && new URL(page.url()).pathname==='/' + lang + '/')
            throw new Error('Stranded curtain divider');
        });
      const url=new URL(page.url());
      assert.ok(['/'+lang+'/','/'+targetLang+'/'].includes(url.pathname),
        JSON.stringify({url:url.href}));
      console.log('TRACKING_OK',JSON.stringify({
        engine,width,lang,maxError:+Math.max(...measures.map(x=>x.error)).toFixed(3),
        samples:measures.length,
        synchronousBurstSamples:burstErrors.length,
        synchronousBurstMaxError:+Math.max(...burstErrors).toFixed(3),
        end:url.pathname
      }));
      await page.close();
    }
  }
  console.log('V2 pointer lock and original curtain completion checks passed');
} finally { await browser.close(); }

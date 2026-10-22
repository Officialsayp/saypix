import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const widths = [320, 375, 430, 768, 1024, 1280, 1379, 1380, 1440, 1512, 1728, 1920];
const R = el => {
  const r = el.getBoundingClientRect();
  return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom };
};
try {
  for (const width of widths) {
    for (const lang of ['ru','en']) {
      const page = await browser.newPage({viewport:{width,height:900},hasTouch:width<768,isMobile:width<768});
      await page.goto(`${base}/${lang}/`);
      await page.locator('.code-copy').scrollIntoViewIfNeeded();
      const result = await page.evaluate(() => {
        const R = el => {
          const r=el.getBoundingClientRect();
          return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
        };
        const button=document.querySelector('.code-copy');
        const box=document.querySelector('.hero__visual-code');
        const current=R(button), inner=R(box);
        const size=parseFloat(getComputedStyle(button).getPropertyValue('--copy-size'));
        const inset=(44-size)/2;
        const face={x:current.x+inset,y:current.y+inset,width:size,height:size,right:current.right-inset,bottom:current.bottom-inset};
        const hitPoints=[];
        for(const dx of [1,8,22,36,43])for(const dy of [1,8,22,36,43]){
          const found=document.elementFromPoint(current.x+dx,current.y+dy);
          hitPoints.push({dx,dy,hit:found===button||button.contains(found)});
        }
        const visibleCenterErrorX=Math.abs((face.x+face.width/2)-(current.x+current.width/2));
        const visibleCenterErrorY=Math.abs((face.y+face.height/2)-(current.y+current.height/2));
        const computed=getComputedStyle(button,'::before');
        return {current,inner,face,hitPoints,size,
          centerError:[visibleCenterErrorX,visibleCenterErrorY],
          pseudoWidth:computed.width,pseudoHeight:computed.height,
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
        };
      });
      assert.ok(Math.abs(result.current.width-44)<=.02 && Math.abs(result.current.height-44)<=.02,JSON.stringify({width,lang,size:result.current}));
      assert.ok(result.centerError.every(n=>n<.05),JSON.stringify({width,lang,center:result.centerError}));
      assert.ok(result.hitPoints.every(p=>p.hit),JSON.stringify({width,lang,bad:result.hitPoints.filter(p=>!p.hit)}));
      assert.ok(result.overflow<=1,JSON.stringify({width,lang,overflow:result.overflow}));
      // Match the visible square to the pre-change position, down to subpixel precision.
      const expectedTop=result.inner.y+Math.max(6,Math.min(width*.0055,8));
      const expectedRight=result.inner.right-Math.max(6,Math.min(width*.0055,8));
      assert.ok(Math.abs(result.face.y-expectedTop)<=1.1 && Math.abs(result.face.right-expectedRight)<=1.1,
        JSON.stringify({width,lang,face:result.face,expectedTop,expectedRight}));
      // Wide desktop: compare against the old 520px card while preserving the bottom edge.
      const visual=await page.evaluate(() => {
        const element=document.querySelector('.hero__visual');
        const measure=()=>{
          const v=element.getBoundingClientRect();
          const nav=document.querySelector('.header__inner').getBoundingClientRect();
          return {top:v.top,bottom:v.bottom,height:v.height,navBottom:nav.bottom};
        };
        const now=measure();
        const style=document.createElement('style');
        style.textContent='.hero__visual{max-height:520px!important;margin-top:0!important}';
        document.head.appendChild(style);
        const before=measure();style.remove();
        return {now,before};
      });
      if(width>=1380){
        assert.ok(Math.abs((visual.now.top-visual.before.top)-14)<=1.1,
          JSON.stringify({width,lang,type:'top-shift',visual}));
        assert.ok(Math.abs(visual.now.bottom-visual.before.bottom)<=1.1,
          JSON.stringify({width,lang,type:'bottom-stability',visual}));
        assert.ok(visual.now.top>visual.now.navBottom+4,
          JSON.stringify({width,lang,type:'navigation-overlap',visual}));
      } else {
        assert.ok(Math.abs(visual.now.top-visual.before.top)<=.2,
          JSON.stringify({width,lang,type:'unchanged-narrow-layout',visual}));
      }
      console.log('Hero and copy target OK',width,lang,
        'headerGap',+(visual.now.top-visual.now.navBottom).toFixed(1),
        'copy',result.current.width+'px');
      await page.close();
    }
  }
  console.log('Hero upper edge, copy hitbox and layout regression passed.');
} finally {await browser.close();}

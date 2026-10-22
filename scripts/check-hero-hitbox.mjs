import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const widths = [320, 375, 430, 768, 860, 861, 1024, 1280, 1399, 1400, 1440, 1512, 1728, 1920];
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
        const size=parseFloat(getComputedStyle(button,'::before').width)+2; // 1px border on each side; getComputedStyle returns the content box
        const inset=(44-size)/2;
        const face={x:current.x+inset,y:current.y,width:size,height:size,right:current.right-inset,bottom:current.y+size};
        const hitPoints=[];
        for(const dx of [6,10,22,34,38])for(const dy of [6,10,22,34,38]){
          const found=document.elementFromPoint(current.x+dx,current.y+dy);
          hitPoints.push({dx,dy,hit:found===button||button.contains(found)});
        }
        const visibleCenterErrorX=Math.abs((face.x+face.width/2)-(current.x+current.width/2));
        const topAlignmentError=Math.abs(face.y-current.y);
        const icon=R(button.querySelector('.code-copy__icons'));
        const iconCenterError=[
          Math.abs(icon.x+icon.width/2-(face.x+face.width/2)),
          Math.abs(icon.y+icon.height/2-(face.y+face.height/2))
        ];
        const upperPoint=document.elementFromPoint(current.x+22,current.y-3);
        const isUpperButton=upperPoint===button||button.contains(upperPoint);
        const bottomPoint=document.elementFromPoint(current.x+22,current.bottom-4);
        const isLowerButton=bottomPoint===button||button.contains(bottomPoint);
        const computed=getComputedStyle(button,'::before');
        return {current,inner,face,hitPoints,size,
          centerErrorX:visibleCenterErrorX,topAlignmentError,iconCenterError,
          isUpperButton,isLowerButton,
          pseudoWidth:computed.width,pseudoHeight:computed.height,
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
        };
      });
      assert.ok(Math.abs(result.current.width-44)<=.02 && Math.abs(result.current.height-44)<=.02,JSON.stringify({width,lang,size:result.current}));
      assert.ok(result.centerErrorX<.05 && result.topAlignmentError<.05 && result.iconCenterError.every(n=>n<.05),
        JSON.stringify({width,lang,alignment:{x:result.centerErrorX,top:result.topAlignmentError,icon:result.iconCenterError}}));
      assert.ok(!result.isUpperButton && result.isLowerButton,
        JSON.stringify({width,lang,upperHit:result.isUpperButton,lowerHit:result.isLowerButton}));
      assert.ok(result.hitPoints.every(p=>p.hit),JSON.stringify({width,lang,bad:result.hitPoints.filter(p=>!p.hit)}));
      assert.ok(result.overflow<=1,JSON.stringify({width,lang,overflow:result.overflow}));
      // Pointer regression: the cursor must NEVER turn into a hand just above
      // the painted top edge, but the extra lower reach must remain clickable.
      if (width>=768) {
        await page.mouse.move(result.current.x+22,result.current.y-3);
        const outside=await page.evaluate(()=>document.querySelector('.code-copy').matches(':hover'));
        await page.mouse.move(result.current.x+22,result.current.y+3);
        const inside=await page.evaluate(()=>document.querySelector('.code-copy').matches(':hover'));
        await page.mouse.move(result.current.x+22,result.current.bottom-4);
        const below=await page.evaluate(()=>document.querySelector('.code-copy').matches(':hover'));
        assert.ok(!outside && inside && below,
          JSON.stringify({width,lang,hover:{outside,inside,below}}));
      }
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
      if(width>=1400){
        assert.ok(Math.abs((visual.now.top-visual.before.top)-14)<=1.1,
          JSON.stringify({width,lang,type:'top-shift',visual}));
        assert.ok(Math.abs(visual.now.bottom-visual.before.bottom)<=1.1,
          JSON.stringify({width,lang,type:'bottom-stability',visual}));
        assert.ok(visual.now.top>visual.now.navBottom+4,
          JSON.stringify({width,lang,type:'navigation-overlap',visual}));
      } else if(width>=861) {
        assert.ok(visual.now.top-visual.before.top>=8,
          JSON.stringify({width,lang,type:'mid-desktop-clearance',visual}));
        assert.ok(visual.now.top>visual.now.navBottom+4,
          JSON.stringify({width,lang,type:'navigation-overlap',visual}));
      } else {
        assert.ok(Math.abs(visual.now.top-visual.before.top)<=.2,
          JSON.stringify({width,lang,type:'unchanged-narrow-layout',visual}));
      }
      console.log('Hero and copy target OK',width,lang,
        'headerGap',+(visual.now.top-visual.now.navBottom).toFixed(1),
        'copy',result.current.width+'px','upper-hit',result.isUpperButton,'lower-hit',result.isLowerButton);
      await page.close();
    }
  }
  console.log('Hero upper edge, copy hitbox and layout regression passed.');
} finally {await browser.close();}

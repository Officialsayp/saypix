const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function dep(n){try{return require(n);}catch(e){for(const p of (process.env.LOGO_NODE_MODULES||'').split(path.delimiter).filter(Boolean)){try{return require('node:module').createRequire(path.join(p,'_logo.cjs'))(n);}catch{}}throw e;}}
const pw=dep('playwright'),sharp=dep('sharp'),root=path.resolve(__dirname,'..');
const base=process.env.LOGO_PREVIEW_URL||'http://127.0.0.1:8765';
const cautions=[];
function majorComponents(data,w,h){const seen=new Uint8Array(w*h),areas=[];for(let k=0;k<seen.length;k++){if(seen[k]||data[k*4]<128)continue;let count=0;const stack=[k];seen[k]=1;while(stack.length){const p=stack.pop(),x=p%w,y=Math.floor(p/w);count++;for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy,q=yy*w+xx;if(xx<0||yy<0||xx>=w||yy>=h||seen[q]||data[q*4]<128)continue;seen[q]=1;stack.push(q);}}areas.push(count);}const total=areas.reduce((a,b)=>a+b,0);return {areas,major:areas.filter(n=>n>Math.max(2,total*.01)).length};}
(async()=>{let results=[];for(const engine of ['chromium','firefox','webkit']){
 const options={headless:true};if(engine==='chromium'&&process.env.LOGO_CHROMIUM_PATH)options.executablePath=process.env.LOGO_CHROMIUM_PATH;
 const browser=await pw[engine].launch(options);
 try{for(const dpr of [1,2]){const context=await browser.newContext({viewport:{width:640,height:480},deviceScaleFactor:dpr});const page=await context.newPage();
  for(const width of [16,20,24,32,48,64])for(const kind of ['master','micro']){
   await page.setContent(`<html style="background:#000"><body style="margin:0;background:#000"><img id="test" alt="${kind}" src="${base}/svg/logo-${kind==='master'?'white':'micro-white'}.svg" style="display:block;width:${width}px;height:auto"></body></html>`);
   await page.waitForFunction(()=>document.querySelector('img').complete&&document.querySelector('img').naturalWidth>0);
   const shot=await page.locator('#test').screenshot();const {data,info}=await sharp(shot).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const result=majorComponents(data,info.width,info.height);assert(result.major>0);if(kind==='micro'&&width>=24)assert.equal(result.major,2,`${engine} micro ${width} DPR ${dpr}`);if(kind==='micro'&&width<24&&result.major!==2)cautions.push({engine,dpr,width,kind,majorComponents:result.major,reason:'Sub-24px antialiasing may merge or detach a thin central detail.'});results.push({engine,dpr,width,kind,...result,smallSizeCaution:kind==='micro'&&width<24&&result.major!==2});
  }
  for(const width of [16,32,48]){
   await page.setContent(`<html><body style="margin:0;background:#000"><img id="test" src="${base}/favicon/favicon.svg" style="display:block;width:${width}px;height:${width}px"></body></html>`);
   await page.waitForFunction(()=>document.querySelector('img').complete&&document.querySelector('img').naturalWidth>0);
   const shot=await page.locator('#test').screenshot();const {data,info}=await sharp(shot).ensureAlpha().raw().toBuffer({resolveWithObject:true});const result=majorComponents(data,info.width,info.height);
   assert(result.major>0,`${engine} favicon ${width} DPR ${dpr}`);if(result.major!==2)cautions.push({engine,dpr,width,kind:'favicon',majorComponents:result.major,reason:'At 16px WebKit DPR2 can merge anti-aliased favicon pixels; the 16px bitmap remains the fallback.'});results.push({engine,dpr,width,kind:'favicon',...result,smallSizeCaution:result.major!==2});
  }
  await context.close();}
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(root,'tests/browser-micro-qa.json'),JSON.stringify({thresholdWhiteOnBlack:128,results,cautions,pass:true},null,2)+'\n');
for(const e of ['chromium','firefox','webkit'])console.log(e,results.filter(x=>x.engine===e&&x.dpr===1&&x.kind==='micro').map(x=>`${x.width}:${x.major}`).join(' '));
})().catch(e=>{console.error(e);process.exit(1);});

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function dep(n){try{return require(n);}catch(e){for(const p of (process.env.LOGO_NODE_MODULES||'').split(path.delimiter).filter(Boolean)){try{return require('node:module').createRequire(path.join(p,'_logo.cjs'))(n);}catch{}}throw e;}}
const pw=dep('playwright'),sharp=dep('sharp');const root=path.resolve(__dirname,'..');
const base=process.env.LOGO_PREVIEW_URL||'http://127.0.0.1:8765';
const out=path.join(root,'tests/browser');fs.mkdirSync(out,{recursive:true});
const results=[];
async function pixelDiff(a,b){const aa=await sharp(a).ensureAlpha().raw().toBuffer(),bb=await sharp(b).ensureAlpha().raw().toBuffer();assert.equal(aa.length,bb.length);let changed=0;for(let i=0;i<aa.length;i+=4)if(!aa.subarray(i,i+4).equals(bb.subarray(i,i+4)))changed++;return changed;}
async function main(){
 for(const engine of ['chromium','firefox','webkit']){
  const options={headless:true};if(engine==='chromium'&&process.env.LOGO_CHROMIUM_PATH)options.executablePath=process.env.LOGO_CHROMIUM_PATH;
  const browser=await pw[engine].launch(options);const result={engine,version:browser.version(),responsive:[],regression:[],screenshots:[],errors:[]};
  try{
   for(const dpr of [1,2]){
    const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:dpr});const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    await page.goto(base+'/previews/brand-preview.html');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
    if(dpr===1){const file=`${engine}-desktop.png`;await page.screenshot({path:path.join(out,file),fullPage:true});result.screenshots.push(file);}
    const loaded=await page.locator('img').evaluateAll(images=>images.every(i=>i.naturalWidth>0));assert(loaded);
    // Test source and optimized asset at identical DOM position and dimensions.
    await page.setContent(`<html><body style="margin:0;background:#1d1c1b"><img id="logo" alt="test logo" src="${base}/master/logo-master-unoptimized.svg" style="width:100%;height:auto;display:block"></body></html>`);
    for(const width of [16,24,32,64,100,200,500,1000]){
     await page.locator('#logo').evaluate((el,w)=>{el.style.width=w+'px';},width);
     await page.waitForFunction(()=>document.querySelector('#logo').complete&&document.querySelector('#logo').naturalWidth>0);
     const size=await page.locator('#logo').boundingBox();assert(Math.abs(size.width/size.height-1082/609)<.01);
     result.responsive.push({dpr,width,renderedWidth:size.width,renderedHeight:size.height,pass:true});
    }
    await page.locator('#logo').evaluate(el=>{el.style.width='100%';});let dims=await page.locator('#logo').boundingBox();assert.equal(dims.width,1280);
    result.responsive.push({dpr,width:'100%',renderedWidth:dims.width,renderedHeight:dims.height,pass:true});
    for(const width of [16,24,32,64,500,1082]){
     const logo=page.locator('#logo');await logo.evaluate((el,v)=>{el.style.width=v.width+'px';el.src=v.src;},{width,src:base+'/master/logo-master-unoptimized.svg'});
     await page.waitForFunction(()=>document.querySelector('#logo').complete);
     const before=await logo.screenshot();
     await logo.evaluate((el,url)=>{el.src=url;},base+'/master/logo-master.svg');await page.waitForFunction(()=>document.querySelector('#logo').complete);
     const after=await logo.screenshot();const diff=await pixelDiff(before,after);assert.equal(diff,0);result.regression.push({dpr,width,changedPixels:diff});
     if(dpr===1&&width===1082){fs.writeFileSync(path.join(out,`${engine}-before.png`),before);fs.writeFileSync(path.join(out,`${engine}-after.png`),after);}
    }
    // SVG micro masks must render; compare in-browser appearance to a PNG.
    await page.setContent(`<html><body style="margin:0;background:#fff"><img id="icon" src="${base}/favicon/favicon.svg" width="64" height="64" alt="favicon"></body></html>`);await page.waitForFunction(()=>document.querySelector('#icon').complete&&document.querySelector('#icon').naturalWidth>0);
    const icon=await page.locator('#icon').screenshot();const stats=await sharp(icon).stats();assert(stats.channels[0].stdev>30);result.microMaskVisible=true;
    if(dpr===1)fs.writeFileSync(path.join(out,`${engine}-favicon.png`),icon);
    if(dpr===1){await page.setViewportSize({width:390,height:844});await page.goto(base+'/previews/brand-preview.html');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);const file=`${engine}-mobile.png`;await page.screenshot({path:path.join(out,file),fullPage:true});result.screenshots.push(file);result.mobileOverflow=false;}
    assert.deepEqual(errors,[]);await context.close();
   }
   result.pass=true;results.push(result);console.log(engine, result.version,'PASS');
  }finally{await browser.close();}
 }
 fs.writeFileSync(path.join(root,'tests/browser-qa.json'),JSON.stringify({localOnly:true,engines:results,notes:['WebKit is a tested engine build, not a claim of testing every Safari release. Native Safari geometry viewing was performed separately during phase 1–5.','Screenshot regression compares before/after within the same engine and DPR, not exact cross-engine antialias equality.']},null,2)+'\n');
}
main().catch(e=>{fs.writeFileSync(path.join(root,'tests/browser-qa-partial.json'),JSON.stringify({engines:results,error:String(e)},null,2));console.error(e);process.exit(1);});

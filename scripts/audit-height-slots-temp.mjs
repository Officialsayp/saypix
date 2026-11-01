// Temporary read-only diagnostic for text-height slots and true content axes.
// Runs only in CI; remove the script and diagnostic step before review.
import { chromium } from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE, args:['--no-sandbox','--disable-dev-shm-usage']});
const widths=[320,340,360,375,390,393,400,414,430,450,480,520,559,560,561,768,860,861,900,1024,1199,1200,1440];
const selectors=[
  '.project-card h3',
  '.project-card__content > p',
  '.project-card__highlights li',
  '.project-card__status',
  '.project-card__link',
  '[id^="stack-"] .stack-group h3'
].join(',');
try {
 for (const width of widths) {
   const cases=[];
   for(const lang of ['ru','en']) {
     const page=await browser.newPage({viewport:{width,height:844},javaScriptEnabled:false});
     try {
       await page.goto('http://127.0.0.1:4173/'+lang+'/');
       const metrics=await page.evaluate((selector)=>{
         const el=s=>document.querySelector(s),r=s=>el(s).getBoundingClientRect();
         const elements=[...document.querySelectorAll(selector)];
         const data=elements.map(node=>{
           const before=node.getBoundingClientRect(),c=getComputedStyle(node);
           const old={height:before.height,minHeight:c.minHeight,lineHeight:c.lineHeight,text:node.textContent.trim().slice(0,85)};
           node.style.setProperty('min-height','0','important');
           const now=node.getBoundingClientRect();
           return {old,...{natural:now.height,excess:+(old.height-now.height).toFixed(2)}};
         });
         const a=el('[id^="stack-"] .section__head h2'),group=el('[id^="stack-"] .stack-group h3'), chip=el('[id^="stack-"] .stack-group .chip');
         const proj=el('[id^="projects-"] .section__head h2'),title=el('[id^="projects-"] .project-card h3');
         const left=e=>+e.getBoundingClientRect().left.toFixed(2);
         const card=[...document.querySelectorAll('[id^="projects-"] .project-card')];
         const h=e=>+e.getBoundingClientRect().height.toFixed(2);
         return {items:data,axis:{stackH2:left(a),groupH3:left(group),chip:left(chip),projectsH2:left(proj),projectH3:left(title)},cardHeights:card.map(h),groupGap:+(r('[id^="stack-"] .stack-group .chips').top-r('[id^="stack-"] .stack-group h3').bottom).toFixed(1),
           rootOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
       },selectors);
       cases.push({lang,...metrics});
     }finally{await page.close();}
   }
   console.log('HEIGHT_AUDIT '+JSON.stringify({width,cases}));
 }
} finally {await browser.close();}

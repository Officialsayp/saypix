import { strict as assert } from 'node:assert';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const browser = await playwright[engine].launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  ...(engine === 'chromium' ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {})
});
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const widths = [320, 340, 360, 375, 380, 390, 414, 430, 480, 560, 561, 585, 700, 740, 768, 800, 840, 860, 861, 900, 960, 1024, 1100, 1199, 1200, 1280, 1399, 1400, 1440, 1512, 1728, 1920];
const anomalies = [];
const diagnostics = [];
let pages = 0;
const near = (a,b,t=1) => Math.abs(a-b)<=t;
function warn(code,width,lang,detail,level='warning') { anomalies.push({code,width,lang,level,...detail}); }
function pairOverlap(a,b,t=1) {
  if(!a||!b)return false;
  return Math.min(a.r,b.r)-Math.max(a.x,b.x)>t && Math.min(a.b,b.b)-Math.max(a.y,b.y)>t;
}
function summary(code,items) {
  const samples=items.slice(0,5).map(x=>({width:x.width,lang:x.lang,delta:x.delta,note:x.note}));
  return {code,level:items[0].level,count:items.length,maximumDelta:Math.max(...items.map(x=>Math.abs(x.delta||0))).toFixed(2),samples};
}
async function snapshot(page) {
 return page.evaluate(() => {
  const main=document.querySelector('.language-layer--primary main');
  if(!main)throw Error('No primary page main');
  const one=(selector,root=document)=>root.querySelector(selector);
  const all=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left,y:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,scrollW:e.scrollWidth,clientW:e.clientWidth};};
  const root=one('.language-layer--primary');
  const sections=all('main > section',root);
  const getSec=type=>one('[id^="'+type+'-"]',root);
  const about=getSec('about'),stack=getSec('stack'),projects=getSec('projects'),contacts=getSec('contacts');
  const secList=[about,stack,projects,contacts];
  const hero=getSec('top');
  const sc=e=>({section:rect(e),container:rect(one('.container',e)),head:rect(one('.section__head',e)),
    kicker:rect(one('.kicker',e)),h2:rect(one('h2',e)),body:rect(one('.section__body',e))});
  const stackGroups=all('.stack-group',stack);
  const projs=all('.project-card',projects);
  const langs=all('.language-edge');
  const projectBox=e=>({row:rect(e),num:rect(one('.project-card__num',e)),content:rect(one('.project-card__content',e)),
    title:rect(one('h3',e)),description:rect(one('p',e)),highlights:rect(one('.project-card__highlights',e)),
    tags:rect(one('.project-card__tags',e)),meta:rect(one('.project-card__meta',e)),links:all('.project-card__link',e).map(rect)});
  return {
    viewport:{width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyWidth:document.body.scrollWidth},
    sectionRects:sections.map(e=>({id:e.id,box:rect(e)})),
    common:secList.map(sc),
    header:{nav:rect(one('.header__inner')),links:all('.header__inner .nav a').map(rect),
      languages:langs.map(e=>({language:e.dataset.langTarget,box:rect(e)})),hint:rect(one('.drag-hint'))},
    hero:{box:rect(hero),grid:rect(one('.hero__grid',hero)),content:rect(one('.hero__content',hero)),eyebrow:rect(one('.eyebrow',hero)),
      h1:rect(one('h1',hero)),lead:rect(one('.hero__lead',hero)),actions:rect(one('.hero__actions',hero)),
      buttons:all('.hero__actions .button',hero).map(rect),art:rect(one('.hero__visual',hero)),
      code:rect(one('.hero__visual-code',hero)),codeContent:rect(one('.hero__visual-code-content',hero)),copy:rect(one('.code-copy',hero))},
    about:{...sc(about),paragraphs:all('.section__body p',about).map(rect)},
    stack:{...sc(stack),list:rect(one('.stack-list',stack)),groups:stackGroups.map(e=>({
      box:rect(e),content:rect(one('.stack-group__content',e)),title:rect(one('h3',e)),
      chipsBox:rect(one('.chips',e)),chips:all('.chip',e).map(rect),border:getComputedStyle(e).borderTopWidth
    }))},
    projects:{...sc(projects),list:rect(one('.project-list',projects)),cards:projs.map(projectBox)},
    contacts:{...sc(contacts),links:rect(one('.contacts__links',contacts)),buttons:all('.contacts__links .contact-link',contacts).map(rect)},
  };
 });
}
function audit(s,width,lang) {
 const tol=1.1, sec=s.common, vp=s.viewport;
 if(vp.docWidth-vp.clientWidth>1||vp.bodyWidth-vp.clientWidth>1)
  warn('PAGE_HORIZONTAL_OVERFLOW',width,lang,{delta:Math.max(vp.docWidth-vp.clientWidth,vp.bodyWidth-vp.clientWidth),note:'scrollable document overflow'},'critical');
 const standard=sec[0].container;
 for(const x of sec) {
  for(const edge of ['x','r','w'])if(!near(x.container[edge],standard[edge],tol))
    warn('SECTION_CONTAINER_AXIS',width,lang,{delta:x.container[edge]-standard[edge],note:edge},'critical');
  if(!near(x.kicker.x,x.container.x,tol))warn('KICKER_CONTAINER_AXIS',width,lang,{delta:x.kicker.x-x.container.x,note:''},'critical');
  if(!near(x.head.x,x.container.x,tol))warn('SECTION_HEADER_CONTAINER',width,lang,{delta:x.head.x-x.container.x,note:''},'critical');
  if(!near(x.h2.x,sec[0].h2.x,tol))warn('SECTION_HEADING_AXIS',width,lang,{delta:x.h2.x-sec[0].h2.x,note:''},'critical');
 }
 const aboutD=s.about.body.x-s.about.h2.x;
 if(Math.abs(aboutD)>2)warn('ABOUT_BODY_VS_H2_AXIS',width,lang,{delta:aboutD,note:'About text starts to the right of its H2'});
 const contactD=s.contacts.links.x-s.contacts.h2.x;
 if(Math.abs(contactD)>2)warn('CONTACT_LINKS_VS_H2_AXIS',width,lang,{delta:contactD,note:'Contacts row starts to the right of its H2'});
 if(!near(s.about.body.x,s.contacts.links.x,tol))
  warn('ABOUT_CONTACTS_CONTENT_AXIS',width,lang,{delta:s.contacts.links.x-s.about.body.x,note:''},'critical');
 for(const row of s.stack.groups) {
  for(const [label,rx] of [['heading',row.title.x],['chips-wrap',row.chipsBox.x],['chips-first',row.chips[0].x],['container',row.content.x]]) {
    const d=rx-s.projects.cards[0].content.x;
    if(Math.abs(d)>1.1)warn('STACK_PROJECT_AXIS',width,lang,{delta:d,note:label},'critical');
  }
  if(!near(row.box.x,s.projects.cards[0].row.x,tol)||!near(row.box.r,s.projects.cards[0].row.r,tol))
    warn('STACK_DIVIDER_WIDTH',width,lang,{delta:row.box.x-s.projects.cards[0].row.x,note:''},'critical');
  for(let i=0;i<row.chips.length;i++){
    const c=row.chips[i];if(c.x<row.chipsBox.x-1||c.r>row.chipsBox.r+1)
      warn('CHIP_EXCEEDS_OWN_ROW',width,lang,{delta:Math.max(row.chipsBox.x-c.x,c.r-row.chipsBox.r),note:'chip '+i},'critical');
    for(let j=0;j<i;j++)if(pairOverlap(c,row.chips[j]))
      warn('CHIP_OVERLAP',width,lang,{delta:0,note:'chips '+i+','+j},'critical');
  }
 }
 if(s.stack.groups[0].border!=='0px'||s.stack.groups[1].border!=='1px')
   warn('STACK_BORDER',width,lang,{delta:0,note:JSON.stringify(s.stack.groups.map(x=>x.border))},'critical');
 for(let i=0;i<s.projects.cards.length;i++){
   const card=s.projects.cards[i];
   if(!near(card.content.x,s.projects.cards[0].content.x,tol))
     warn('PROJECT_TITLE_AXIS',width,lang,{delta:card.content.x-s.projects.cards[0].content.x,note:'card '+i},'critical');
   if(card.meta.r>card.row.r+1)warn('PROJECT_META_OUT_OF_ROW',width,lang,{delta:card.meta.r-card.row.r,note:'card '+i},'critical');
   if(pairOverlap(card.content,card.meta))
      warn('PROJECT_CONTENT_META_OVERLAP',width,lang,{delta:0,note:'card '+i},'critical');
   if(card.content.r>card.row.r+1)warn('PROJECT_CONTENT_OVERFLOW',width,lang,{delta:card.content.r-card.row.r,note:'card '+i},'critical');
 }
 for(let i=1;i<s.projects.cards.length;i++) {
   if(s.projects.cards[i-1].row.b>s.projects.cards[i].row.y+1)
      warn('PROJECT_ROWS_OVERLAP',width,lang,{delta:s.projects.cards[i-1].row.b-s.projects.cards[i].row.y,note:''},'critical');
 }
 for(let i=1;i<s.sectionRects.length;i++) {
  const d=s.sectionRects[i].box.y-s.sectionRects[i-1].box.b;
  if(Math.abs(d)>1.1)warn('SECTION_VERTICAL_GAP_OR_OVERLAP',width,lang,{delta:d,note:s.sectionRects[i].id},'critical');
 }
 if((s.hero.eyebrow && !near(s.hero.content.x,s.hero.eyebrow.x,tol))||!near(s.hero.content.x,s.hero.h1.x,tol)
    ||!near(s.hero.content.x,s.hero.lead.x,tol)||!near(s.hero.content.x,s.hero.actions.x,tol))
  warn('HERO_TEXT_AXIS',width,lang,{delta:s.hero.h1.x-s.hero.content.x,note:''},'critical');
 if(pairOverlap(s.hero.content,s.hero.art))
  warn('HERO_TEXT_ART_OVERLAP',width,lang,{delta:0,note:''},'critical');
 for(const btn of s.hero.buttons)if(btn.x<s.hero.actions.x-1||btn.r>s.hero.actions.r+1)
    warn('HERO_BUTTON_OUTSIDE_ACTIONS',width,lang,{delta:btn.r-s.hero.actions.r,note:''},'critical');
 if(s.hero.code&&s.hero.copy&&(s.hero.copy.x<s.hero.code.x-1||s.hero.copy.r>s.hero.code.r+1||s.hero.copy.y<s.hero.code.y-1||s.hero.copy.b>s.hero.code.b+1))
    warn('COPY_TARGET_OUTSIDE_CODE',width,lang,{delta:0,note:''},'critical');
 if(s.hero.codeContent&&s.hero.codeContent.scrollW-s.hero.codeContent.clientW>2)
    warn('CODE_TEXT_INTRINSIC_OVERFLOW',width,lang,{delta:s.hero.codeContent.scrollW-s.hero.codeContent.clientW,note:'possible clipping inside code box'});
 for(const l of s.header.languages)if(pairOverlap(l.box,s.header.nav))
    warn('LANGUAGE_BUTTON_NAV_OVERLAP',width,lang,{delta:0,note:l.language},'critical');
 for(let i=0;i<s.header.links.length;i++)for(let j=0;j<i;j++)
  if(pairOverlap(s.header.links[i],s.header.links[j]))
    warn('NAV_LINK_OVERLAP',width,lang,{delta:0,note:i+','+j},'critical');
 for(let i=0;i<s.contacts.buttons.length;i++)for(let j=0;j<i;j++)
  if(pairOverlap(s.contacts.buttons[i],s.contacts.buttons[j]))
    warn('CONTACT_BUTTON_OVERLAP',width,lang,{delta:0,note:i+','+j},'critical');
 for (const [label,b] of [
 ['header',s.header.nav],['about title',s.about.h2],['stack-title',s.stack.groups[0].title],
 ['contacts',s.contacts.links],['hero-art',s.hero.art],['hero-copy',s.hero.copy]
 ]) {
   if(b.x < -1 || b.r > width+1)
     warn('ELEMENT_OUTSIDE_VIEWPORT',width,lang,{delta:Math.max(-b.x,b.r-width),note:label},'critical');
 }
 const diff=()=>({
   width,lang,aboutHeadingX:Number(s.about.h2.x.toFixed(2)),
   aboutBodyX:Number(s.about.body.x.toFixed(2)),
   contactsX:Number(s.contacts.links.x.toFixed(2)),
   projectContentX:Number(s.projects.cards[0].content.x.toFixed(2)),
   stackTitleX:Number(s.stack.groups[0].title.x.toFixed(2)),
   stackChipX:Number(s.stack.groups[0].chips[0].x.toFixed(2)),
   pageOverflow:vp.docWidth-vp.clientWidth,heroGap:s.hero.art.x-s.hero.content.r
 });
 diagnostics.push(diff());
}
try{
 for(const width of widths) {
   const snaps=[];
   for(const lang of ['ru','en']){
     const mobile=width<=560;
     const page=await browser.newPage({viewport:{width,height:width<=430?667:width<=860?844:900},
       isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1,javaScriptEnabled:true});
     await page.goto(base+'/'+lang+'/',{waitUntil:'load'});
     const s=await snapshot(page);
     audit(s,width,lang);
     snaps.push(s);
     pages++;
     await page.close();
   }
   for(let i=0;i<snaps[0].sectionRects.length;i++) {
     const ru=snaps[0].sectionRects[i].box,en=snaps[1].sectionRects[i].box;
     for(const attr of ['y','b','h','x','w']) {
       if(!near(ru[attr],en[attr],1.1))
          warn('RU_EN_SECTION_GEOMETRY',width,'both',{delta:ru[attr]-en[attr],note:'section '+i+' '+attr},'critical');
     }
   }
   if([320,375,560,561,860,861,1024,1440,1920].includes(width))
    console.log('GEOMETRY_SAMPLE '+JSON.stringify(diagnostics.slice(-2)));
 }
 const groups=Map.groupBy?Map.groupBy(anomalies,e=>e.code):anomalies.reduce((m,x)=>(m.set(x.code,[...(m.get(x.code)||[]),x]),m),new Map());
 console.log('AUDIT_META '+JSON.stringify({engine,pages,widthCount:widths.length,languages:2,checkedViewports:widths,
   critical:anomalies.filter(x=>x.level==='critical').length,warnings:anomalies.filter(x=>x.level!=='critical').length}));
 for(const [code,items] of groups)console.log('AUDIT_FINDING '+JSON.stringify(summary(code,items)));
 console.log('AUDIT_COMPLETE '+engine);
}finally{await browser.close();}

import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

const widths = [320, 360, 375, 390, 414, 430, 480, 560, 561, 768, 860, 861, 1024, 1199, 1200, 1440, 1920];
const selectors = [
  'main section', '.hero__lead', '.hero__visual', '.section h2', '.section__body',
  '.section__body > p', '.project-card', '.project-card h3', '.project-card p',
  '.project-card__highlights li', '.project-card__tags', '.project-card__meta',
  '.project-card__link', '.project-list', '.chips', '.contacts__links',
];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const output = [];
await fs.mkdir('audit-results', { recursive: true });
try {
  for (const width of widths) {
    const pair = [];
    for (const lang of ['ru', 'en']) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        deviceScaleFactor: 1,
        javaScriptEnabled: false,
      });
      await page.goto('http://127.0.0.1:4173/' + lang + '/', {waitUntil:'load'});
      if ([375,430,768,1024,1440].includes(width)) {
        await page.screenshot({path:'audit-results/baseline-' + lang + '-' + width + '.png', fullPage:true});
      }
      const audit = await page.evaluate((selectors) => {
        const nodes = selectors.flatMap(sel => Array.from(document.querySelectorAll(sel)).map((node, i) => ({node, key: sel + '#' + i})));
        const read = ({node, key}) => {
          const r = node.getBoundingClientRect();
          const s = getComputedStyle(node);
          return {key, top: +r.top.toFixed(2), height: +r.height.toFixed(2),
            minHeight: s.minHeight, lineHeight: s.lineHeight, fontSize: s.fontSize};
        };
        const documentHeight = document.documentElement.scrollHeight;
        const baseline = nodes.map(read);
        for (const {node} of nodes) node.style.minHeight = '0px';
        const natural = nodes.map(read);
        return {
          documentHeight, unconstrainedHeight:document.documentElement.scrollHeight,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          baseline, natural: natural.map(x => ({key:x.key,height:x.height})),
        };
      }, selectors);
      if ([375,430,768,1024,1440].includes(width)) {
        await page.screenshot({path:'audit-results/unconstrained-' + lang + '-' + width + '.png', fullPage:true});
      }
      pair.push({lang,...audit});
      await page.close();
    }
    const a=pair[0], b=pair[1];
    const diffs = a.baseline.map((x,i)=>({key:x.key,topDelta:+Math.abs(x.top-b.baseline[i].top).toFixed(2),heightDelta:+Math.abs(x.height-b.baseline[i].height).toFixed(2)}));
    const bad = diffs.filter(x=>x.topDelta>1 || x.heightDelta>1);
    const nonNatural = a.baseline.map((r,i)=>({
      key:r.key,
      reserveRu:+Math.max(0,r.height-a.natural[i].height).toFixed(1),
      reserveEn:+Math.max(0,b.baseline[i].height-b.natural[i].height).toFixed(1),
      naturalRu:a.natural[i].height,
      naturalEn:b.natural[i].height,
      currentRu:r.height,
      currentEn:b.baseline[i].height,
    })).filter(x=>x.reserveRu>1 || x.reserveEn>1).sort((x,y)=>Math.max(y.reserveRu,y.reserveEn)-Math.max(x.reserveRu,x.reserveEn));
    const record={width,heightRu:a.documentHeight,heightEn:b.documentHeight,
       unconstrainedHeightRu:a.unconstrainedHeight,unconstrainedHeightEn:b.unconstrainedHeight,
       maxDelta:+Math.max(0,...diffs.map(x=>Math.max(x.topDelta,x.heightDelta))).toFixed(2),
       driftedNodes:bad.length,offenders:bad.slice(0,10),
       largestReserves:nonNatural.slice(0,12),horizontalOverflow:[a.overflowX,b.overflowX]};
    output.push(record);
    console.log('AUDIT_JSON ' + JSON.stringify(record));
  }
} finally {await browser.close();}
await fs.writeFile('audit-results/layout-baseline.json',JSON.stringify({commit:process.env.GITHUB_SHA,output},null,2));

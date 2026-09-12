const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
function dependency(name) {
  try { return require(name); }
  catch (error) {
    for (const folder of (process.env.LOGO_NODE_MODULES || '').split(path.delimiter).filter(Boolean)) {
      try { return require('node:module').createRequire(path.join(folder, '_logo.cjs'))(name); } catch {}
    }
    throw error;
  }
}
const sharp = dependency('sharp');
const { optimize } = dependency('svgo');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const locked = fs.readFileSync(path.join(root, 'master/logo-master-v1.svg'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'master/master-lock.json')));
if (hash(locked) !== lock.sha256) throw new Error('MASTER HASH MISMATCH. Stop; do not rebuild.');
const source = locked.toString();
const body = [...source.matchAll(/<path d="([^"]+)"\s*\/>/g)].map(m => `<path d="${m[1]}"/>`).join('');
if ((body.match(/<path/g) || []).length !== 2) throw new Error('Expected two locked paths.');
const vb = '0 0 1082 609';
const colors = { silver:'#c4c4c4', charcoal:'#1d1c1b', white:'#ffffff', black:'#000000' };
const recipes = [];
const renderSources = {};
function save(file, data, info={}) {
  const dest=path.join(root,file); fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);
  recipes.push({file,bytes:Buffer.byteLength(data),sha256:hash(data),...info});
}
function wrap(content, viewBox=vb) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>\n`; }
function symbol(color) { return wrap(`<g fill="${color}">${body}</g>`); }

// A separate optical-size derivative. The locked source paths remain verbatim.
// Three short knockout strokes widen only existing negative-space channels.
// A luminance mask is necessary here to keep both derivative SVG transparency
// and exact source path data; it does not introduce a raster or filter.
const cuts = [
  'M 330 245 C 413 303 478 264 580 175 L 660 105',
  'M 360 350 C 414 334 452 339 486 336 C 526 333 570 324 614 310 C 632 304 648 297 663 289',
  'M 520 450 C 588 390 651 337 748 376'
];
const microCutWidth=28;
const faviconCutWidth=40;
function microContent(color, prefix='micro', cutWidth=microCutWidth) {
  const id=`${prefix}-knockout`;
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1082" height="609"><rect width="1082" height="609" fill="white"/><g fill="none" stroke="black" stroke-width="${cutWidth}" stroke-linecap="round">${cuts.map(d=>`<path d="${d}"/>`).join('')}</g></mask></defs><g fill="${color}" mask="url(#${id})">${body}</g>`;
}
function composition({color=colors.silver,bg=colors.charcoal,kind='square',inkFraction=.78,micro=false,size=1024}) {
  const s=size*inkFraction/962, tx=size/2-541*s, ty=size/2-304.5*s;
  let background=kind==='circle'?`<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${bg}"/>`:
    `<rect width="${size}" height="${size}" rx="${kind==='rounded-square'?size*.18:0}" fill="${bg}"/>`;
  return wrap(background+`<g transform="translate(${tx} ${ty}) scale(${s})">${micro?microContent(color,'icon',faviconCutWidth):`<g fill="${color}">${body}</g>`}</g>`,`0 0 ${size} ${size}`);
}
async function png(file, svg, width, height, geometry='master') {
  renderSources[hash(svg)] = svg;
  const resize=height===undefined ? {width} : {width,height,fit:'fill'};
  const data=await sharp(Buffer.from(svg)).resize(resize).toColourspace('srgb').png({compressionLevel:9}).toBuffer();
  const meta=await sharp(data).metadata();
  save(file,data,{type:'png',width:meta.width,height:meta.height,geometry,sourceSvgSha256:hash(svg)});
}
function rgb(hex) { return hex.slice(1).match(/../g).map(v=>parseInt(v,16)); }
function hsl([r,g,b]) {
  [r,g,b]=[r,g,b].map(v=>v/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=60*(max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4);if(h<0)h+=360;}
  return [h,s*100,l*100].map(v=>+v.toFixed(3));
}
function lum(hex) { const a=rgb(hex).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722; }
function contrast(a,b){const [hi,lo]=[lum(a),lum(b)].sort((a,b)=>b-a);return (hi+.05)/(lo+.05);}

async function main() {
  save('master/logo-master-unoptimized.svg',locked,{geometry:'master'});
  // Deliberately omit convertPathData, mergePaths, transforms and precision
  // reduction: optimization may only change serialization, never coordinates.
  const optimized=optimize(source,{multipass:false,plugins:['removeDoctype','removeXMLProcInst','removeComments','removeMetadata','removeEditorsNSData','cleanupAttrs','removeEmptyAttrs','sortAttrs']}).data+'\n';
  save('master/logo-master.svg',optimized,{geometry:'master'});
  for(const [name,color] of Object.entries(colors)) save(`svg/logo-${name}.svg`,symbol(color),{geometry:'master'});
  for(const [name,color,bg] of [['brand',colors.silver,colors.charcoal],['dark',colors.white,colors.charcoal],['light',colors.charcoal,colors.white]]){
    const svg=wrap(`<rect width="1082" height="609" fill="${bg}"/><g fill="${color}">${body}</g>`);
    save(`svg/logo-${name}.svg`,svg,{geometry:'master'});
    for(const n of [512,1024]) await png(`png/backgrounds/logo-${name}-${n}.png`,svg,n,undefined);
  }
  save('svg/logo-micro.svg',wrap(microContent(colors.silver)),{geometry:'micro'});
  save('svg/logo-micro-white.svg',wrap(microContent(colors.white)),{geometry:'micro'});
  for(const [name,color] of Object.entries(colors)) for(const n of [512,1024,2048]) await png(`png/transparent/logo-${name}-${n}.png`,symbol(color),n,undefined);
  for(const kind of ['square','circle','rounded-square']){
    const svg=composition({kind});save(`avatars/${kind}/avatar.svg`,svg,{geometry:'master',inkFraction:.78});
    for(const n of [128,256,512,1024]) await png(`avatars/${kind}/avatar-${n}.png`,svg,n,n);
  }
  for(const [platform,n] of [['github',500],['linkedin-page',400],['youtube',800]]) await png(`avatars/square/${platform}-${n}.png`,composition({kind:'square'}),n,n);
  const favicon=composition({kind:'rounded-square',color:colors.white,inkFraction:.88,micro:true,size:64});
  save('favicon/favicon.svg',favicon,{geometry:'micro'});
  const frames=[];
  for(const n of [16,32,48]){
    await png(`favicon/favicon-${n}x${n}.png`,favicon,n,n,'micro');frames.push(fs.readFileSync(path.join(root,`favicon/favicon-${n}x${n}.png`)));
  }
  const ico=Buffer.alloc(6+16*frames.length);ico.writeUInt16LE(1,2);ico.writeUInt16LE(frames.length,4);let offset=ico.length;
  frames.forEach((f,i)=>{const n=[16,32,48][i],o=6+16*i;ico[o]=n;ico[o+1]=n;ico.writeUInt16LE(1,o+4);ico.writeUInt16LE(32,o+6);ico.writeUInt32LE(f.length,o+8);ico.writeUInt32LE(offset,o+12);offset+=f.length;});
  save('favicon/favicon.ico',Buffer.concat([ico,...frames]),{geometry:'micro'});
  await png('favicon/apple-touch-icon.png',composition({color:colors.white}),180,180);
  for(const n of [192,512]){
    await png(`favicon/pwa-${n}.png`,composition({color:colors.white}),n,n);
    await png(`favicon/pwa-maskable-${n}.png`,composition({color:colors.white,inkFraction:.70}),n,n);
  }
  const manifest={name:'Max Zolotoy',short_name:'Zolotoy',id:'/',start_url:'/',display:'standalone',background_color:colors.charcoal,theme_color:colors.charcoal,icons:[192,512].flatMap(n=>[{src:`pwa-${n}.png`,sizes:`${n}x${n}`,type:'image/png',purpose:'any'},{src:`pwa-maskable-${n}.png`,sizes:`${n}x${n}`,type:'image/png',purpose:'maskable'}])};
  save('favicon/site.webmanifest',JSON.stringify(manifest,null,2)+'\n',{type:'manifest'});
  const s=480/962;const social=wrap(`<rect width="1200" height="630" fill="${colors.charcoal}"/><g fill="${colors.silver}" transform="translate(${600-541*s} ${315-304.5*s}) scale(${s})">${body}</g>`,'0 0 1200 630');
  save('social/opengraph.svg',social,{geometry:'master',inkWidth:480});await png('social/opengraph-1200x630.png',social,1200,630);
  const ladder=[16,20,24,32,40,48,64,96,128,180,256,512,1024,2048];
  for(const n of ladder) await png(`tests/scale/master-${n}.png`,symbol(colors.silver),n,undefined);
  for(const n of [16,20,24,32,40,48,64,96,128]) await png(`tests/scale/micro-${n}.png`,wrap(microContent(colors.silver)),n,undefined,'micro');
  const tokens=Object.fromEntries(Object.entries(colors).map(([k,v])=>[k,{hex:v,rgb:rgb(v),hsl:hsl(rgb(v))}]));
  const combinations=[['silver','charcoal'],['white','charcoal'],['charcoal','white'],['black','white'],['white','black'],['silver','white'],['silver','black']].map(([foreground,background])=>({foreground,background,ratio:+contrast(colors[foreground],colors[background]).toFixed(3),use:contrast(colors[foreground],colors[background])>=7?'preferred':contrast(colors[foreground],colors[background])>=3?'acceptable':'avoid'}));
  save('brand-colors.json',JSON.stringify({source:'Flat silver preserved from the approved master; charcoal approximates reference median RGB 29/28/27. Digital sRGB.',colors:tokens,combinations,physicalDisplayTesting:'Not performed on separate calibrated OLED/IPS devices.'},null,2)+'\n');
  save('brand-tokens.css',`:root {\n${Object.entries(colors).map(([k,v])=>`  --brand-${k}: ${v};\n  --brand-${k}-rgb: ${rgb(v).join(' ')};\n  --brand-${k}-hsl: ${hsl(rgb(v)).map((n,i)=>i?n+'%':n).join(' ')};`).join('\n')}\n}\n`);
  if(hash(fs.readFileSync(path.join(root,'master/logo-master-v1.svg')))!==lock.sha256) throw new Error('Master changed during build.');
  fs.writeFileSync(path.join(root,'tests/asset-manifest.json'),JSON.stringify({masterSha256:lock.sha256,micro:{method:'three vector knockout channels, original source paths retained',strokeWidth:microCutWidth,faviconStrokeWidth:faviconCutWidth,cuts},assets:recipes},null,2)+'\n');
  fs.writeFileSync(path.join(root,'tests/render-recipes.json'),JSON.stringify(renderSources,null,2)+'\n');
  console.log(`Built ${recipes.length} files; locked master unchanged.`);
}
main().catch(error=>{console.error(error);process.exit(1);});

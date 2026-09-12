const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function dependency(n){try{return require(n);}catch(e){for(const p of (process.env.LOGO_NODE_MODULES||'').split(path.delimiter).filter(Boolean)){try{return require('node:module').createRequire(path.join(p,'_logo.cjs'))(n);}catch{}}throw e;}}
const sharp=dependency('sharp');const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>fs.readFileSync(path.join(root,f));const manifest=JSON.parse(read('tests/asset-manifest.json'));const sources=JSON.parse(read('tests/render-recipes.json'));
function components(data,w,h){const seen=new Uint8Array(w*h),sizes=[];for(let k=0;k<seen.length;k++){if(seen[k]||data[k*4+3]<128)continue;const stack=[k];seen[k]=1;let area=0;while(stack.length){let p=stack.pop();area++;const x=p%w,y=Math.floor(p/w);for(const [dx,dy] of [[-1,0],[1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,q=yy*w+xx;if(xx<0||yy<0||xx>=w||yy>=h||seen[q]||data[q*4+3]<128)continue;seen[q]=1;stack.push(q);}}sizes.push(area);}return sizes.sort((a,b)=>b-a);}
async function rgba(input,width){let p=sharp(input);if(width)p=p.resize({width});return p.ensureAlpha().raw().toBuffer({resolveWithObject:true});}
async function main(){
 assert.equal(sha(read('master/logo-master-v1.svg')),manifest.masterSha256);
 assert.deepEqual(read('master/logo-master-v1.svg'),read('master/logo-master-unoptimized.svg'));
 const report={masterLocked:true,masterSha256:manifest.masterSha256,assets:[],optimization:[],smallSize:[],crop:{},notes:[]};
 for(const asset of manifest.assets){const data=read(asset.file);assert.equal(sha(data),asset.sha256,asset.file+' hash');
  if(asset.type==='png'){
   const meta=await sharp(data).metadata();assert.equal(meta.width,asset.width);assert.equal(meta.height,asset.height);assert.equal(meta.format,'png');
   const svg=sources[asset.sourceSvgSha256];assert.equal(sha(svg),asset.sourceSvgSha256);
   const vb=svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);const expected=Math.round(asset.width*vb[3]/vb[2]);
   assert.equal(asset.height,expected,asset.file+' aspect ratio');
   const {data:actual}=await rgba(data);const {data:expectedPixels}=await rgba(Buffer.from(svg),asset.width);
   assert.deepEqual(actual,expectedPixels,asset.file+' renderer equivalence');
   report.assets.push({file:asset.file,width:meta.width,height:meta.height,bytes:data.length,exactRenderMatch:true});
  }
 }
 const sizes=[16,20,24,32,40,48,64,96,128,180,256,512,1024,2048];
 for(const n of sizes){const a=await rgba(read('master/logo-master-unoptimized.svg'),n),b=await rgba(read('master/logo-master.svg'),n);assert.deepEqual(a.data,b.data);report.optimization.push({width:n,changedPixels:0});}
 for(const n of sizes){const row={width:n};for(const kind of ['master','micro']){const f=`tests/scale/${kind}-${n}.png`;if(!fs.existsSync(path.join(root,f)))continue;const {data,info}=await rgba(read(f));const areas=components(data,info.width,info.height);const total=areas.reduce((a,b)=>a+b,0);row[kind]={height:info.height,majorComponents:areas.filter(a=>a>Math.max(2,total*.01)).length,componentAreas:areas,thresholdAlpha:128};}report.smallSize.push(row);}
 for(const n of [16,20,24,32])assert.equal(report.smallSize.find(x=>x.width===n).micro.majorComponents,2,'micro separation '+n);
 // Compare visible silver ink after circle/rounded-square crops with square.
 const square=await rgba(read('avatars/square/avatar-1024.png'));
 for(const kind of ['circle','rounded-square']){const other=await rgba(read(`avatars/${kind}/avatar-1024.png`));let lost=0;for(let k=0;k<1024*1024;k++){const i=k*4;if(square.data[i]>100&&square.data[i+1]>100&&square.data[i+2]>100){if(other.data[i]!==square.data[i]||other.data[i+3]!==square.data[i+3])lost++;}}assert.equal(lost,0);report.crop[kind]={lostInkPixels:lost};}
 // A conservative analytic bounding-box test for the PWA circle-safe zone.
 const r=Math.hypot(.70/2,.70*489/962/2);assert(r<.4);report.crop.maskable={conservativeInkCornerRadius:r,safeRadius:.4,pass:true};
 const og=await rgba(read('social/opengraph-1200x630.png'));let excluded=0;for(let y=0;y<630;y++)for(let x=0;x<1200;x++){const i=(y*1200+x)*4;if(og.data[i]>100&&(x<285||x>=915))excluded++;}assert.equal(excluded,0);report.crop.socialSquare={lostInkPixels:excluded};
 const ico=read('favicon/favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);for(let i=0;i<3;i++){const at=6+16*i,n=[16,32,48][i];assert.equal(ico[at],n);const len=ico.readUInt32LE(at+8),offset=ico.readUInt32LE(at+12);assert.deepEqual(ico.subarray(offset,offset+len),read(`favicon/favicon-${n}x${n}.png`));}report.ico={frames:[16,32,48],exactFrameMatch:true};
 for(const [file,max] of [['avatars/square/github-500.png',1_000_000],['avatars/square/linkedin-page-400.png',3_000_000],['avatars/square/youtube-800.png',15_000_000]])assert(read(file).length<max);
 report.notes.push('Connected-component test uses alpha >= 128 and ignores fragments <= 2 pixels or <= 1% of ink. It does not claim perfect legibility on every DPR/renderer.');
 report.notes.push('Platform crops are local simulations; no platform uploads, external crawler tests or website deployment performed.');
 assert.equal(sha(read('master/logo-master-v1.svg')),manifest.masterSha256);
 fs.writeFileSync(path.join(root,'tests/asset-qa.json'),JSON.stringify(report,null,2)+'\n');
 console.log(`PASS: ${report.assets.length} PNGs, 14 optimization comparisons, micro separation, ICO frames, crop safety, locked SHA.`);
}
main().catch(e=>{console.error(e);process.exit(1);});

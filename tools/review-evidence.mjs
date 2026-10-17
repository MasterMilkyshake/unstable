// Run both dev servers, then: node tools/review-evidence.mjs [output directory]
// Chrome is used when CHROME_PATH is supplied; otherwise install Playwright Chromium.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
const out = process.argv[2] || 'docs/integration-evidence';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
const errors = [], metrics = [], shots = [];
// Camera positions are final world coordinates: authored regions are moved by
// data/worldPlacement.js regionOffset (Meridian and Thornwood +400,-120; the Hush -300,+740;
// Frosthollow -300,+500; Ashen Spire -420,-2080; the Verdance -50,+240), so a view authored
// against a region's data must be placed before it is listed here. Each view is checked
// against the ground it is taken over and the ground it looks at (see `stray` below).
const views = [
  { id:'wash', pos:[-4,13.2,-346], look:[0,13,-320] },
  { id:'wash-arches', pos:[-4,13.2,-346], look:[-470,22,-440] },
  { id:'saltreach', pos:[-40,24,-100], look:[0,18,0] },
  { id:'plains', pos:[-80,14,-245], look:[-50,10,-180] },
  { id:'keystone', pos:[36,154,-92], look:[8,136,48] },
  { id:'meridian', pos:[1070,55,-570], look:[1190,40,-690] },
  { id:'meridian-ward', pos:[1030,8,-586], look:[1066,4,-616] },
  { id:'meridian-harbour', pos:[820,95,-250], look:[960,0,-410] },
  { id:'shimmerfen', pos:[-628,12,-358], look:[-658,10,-388] },
  { id:'mothers-mire', pos:[-572,14,-262], look:[-600,2,-290] },
  { id:'arches-foot', pos:[-563,64,-626], look:[-555,50,-562] },
  { id:'hush-shelf', pos:[-1168,25,1152], look:[-1183,18,1137] },
  { id:'chair-fields', pos:[-1152,23,1026], look:[-1180,11,1002] },
  { id:'thornwood', pos:[1490,28,-80], look:[1448,40,-28] },
  { id:'frosthollow', pos:[-908,28,1512], look:[-952,68,1568] },
  { id:'ashen-spire', pos:[228,16,-1312], look:[340,64,-1200] },
  { id:'verdance', pos:[118,28,1335], look:[82,36,1308] },
  { id:'rift-arrival', pos:[6000,9,5823], look:[6000,35,5988], rift:true },
  { id:'rift-ceiling', pos:[5990,22,5860], look:[6000,108,5970], rift:true },
  { id:'ascent', pos:[6045,95,5910], look:[6000,75,5988], rift:true },
  { id:'vista-sunset', pos:[-28,108,-110], look:[8,134,48], time:.745 },
  { id:'vista-abbey', pos:[-90,22,-290], look:[-160,26,-320], time:.36 },
];
try {
  for (const [version,url] of [['before',process.env.BASELINE_URL||'http://127.0.0.1:5174'],['after',process.env.REVIEW_URL||'http://127.0.0.1:5173']]) {
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push({version,type:'page',message:e.message}));
    page.on('console',m=>{if(m.type()==='error')errors.push({version,type:'console',message:m.text()});});
    await page.goto(url);await page.waitForFunction(()=>window.__unstable,null,{timeout:120000});
    await page.evaluate(()=>{
      const g=__unstable;g.input.requestLock=()=>{};g.settings.master=0;g.applySettings();
      g.__originalSky=g.world.sky.update.bind(g.world.sky);
      g.world.sky.update=(dt,...args)=>{g.world.sky.time=g.__reviewTime||.42;g.__originalSky(dt,...args);};
      // Record complete scene draws (postprocessing resets renderer.info each pass).
      const render=g.renderer.render.bind(g.renderer);
      g.renderer.render=(scene,camera)=>{render(scene,camera);if(scene===g.scene)g.__sceneDraws=g.renderer.info.render.calls;};
    });
    for(const v of views){
      await page.evaluate(v=>{
        const g=__unstable;const ch=g.createCharacter({name:'Wayfarer',race:'ashkin',look:{height:1}});
        const x=v.rift?6000:-4,z=v.rift?5830:-346;
        ch.pos={x,z,y:g.world.terrain.heightAt(x,z)};ch.inRift=!!v.rift;g.startGame(ch,false);
        g.debugCam={pos:v.pos,look:v.look};g.__reviewTime=v.time||.42;
        // a view under the sea or inside the ground was authored before placement
        const h=g.world.terrain.heightAt(v.pos[0],v.pos[2]);
        if(v.pos[1]<h+0.5||(!v.rift&&h<-2&&v.pos[1]<4))g.__stray=`${v.id}: camera ${v.pos[1]} m over ground ${h.toFixed(1)} m`;
        // or one aimed at open water, nothing built under the point it looks at
        const lh=g.world.terrain.heightAt(v.look[0],v.look[2]);
        const built=g.world.colliders.topAt?g.world.colliders.topAt(v.look[0],v.look[2]):Infinity;
        if(!v.rift&&lh<-2&&!(built>-1))g.__stray=`${v.id}: looks at open water (ground ${lh.toFixed(1)} m)`;
        document.querySelector('#hud').style.display='none';document.querySelector('#world-ui').style.display='none';
      },v);
      await page.waitForTimeout(550);
      const stray=await page.evaluate(()=>{const s=__unstable.__stray;__unstable.__stray=null;return s;});
      if(stray)errors.push({version,type:'view',message:stray});
      const filename=`${version}-${v.id}.jpg`;
      await page.screenshot({path:`${out}/${filename}`,type:'jpeg',quality:87});
      shots.push({version,...v,file:filename});
      if(['wash','saltreach','rift-arrival','ascent'].includes(v.id))for(const quality of ['high','low']){
        await page.evaluate(q=>{const g=__unstable;g.settings.quality=q;g.applySettings();},quality);
        await page.waitForTimeout(250);
        const m=await page.evaluate(()=>new Promise(resolve=>{
          const times=[],draws=[];let last=performance.now();
          function frame(now){times.push(now-last);last=now;draws.push(__unstable.__sceneDraws);if(times.length<90)requestAnimationFrame(frame);else {times.sort((a,b)=>a-b);draws.sort((a,b)=>a-b);resolve({medianMs:times[45],p95Ms:times[85],sceneDraws:draws[45]});}}
          requestAnimationFrame(frame);
        }));metrics.push({version,area:v.id,quality,...m});
      }
      await page.evaluate(()=>{const g=__unstable;g.settings.quality='high';g.applySettings();});
      console.log(version,v.id);
    }
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${out}/capture.json`,JSON.stringify({hardware:os.cpus()[0]?.model,platform:os.platform(),viewport:'1280x720 @ 1x',browser:browser.version(),metrics,errors,shots},null,2)+'\n');
if(errors.length)process.exitCode=1;

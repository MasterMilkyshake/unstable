import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'docs/city-evidence'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage({viewport:{width:1440,height:900}}); const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto(process.env.CITY_REVIEW_URL || 'http://127.0.0.1:5173'); await page.waitForFunction(()=>window.__unstable,null,{timeout:120000});
await page.evaluate(()=>{const g=__unstable;g.input.requestLock=()=>{};g.settings.master=0;g.applySettings();const sky=g.world.sky.update.bind(g.world.sky);g.world.sky.update=(dt,...args)=>{g.world.sky.time=.42;sky(dt,...args);};});
const rooms = await page.evaluate(() => __unstable.world.riftInteriors.map(r => ({ x:r.x, z:r.z, yaw:r.rot, floor:r.floor, kind:r.kind })));
const roomViews = rooms.slice(0, 4).map((r, i) => ({id:`rift-interior-${i}`, rift:true, spawn:[r.x,r.z],
  pos:[r.x + Math.sin(r.yaw) * 3.3, r.floor + 1.65, r.z + Math.cos(r.yaw) * 3.3],
  look:[r.x, r.floor + 1.3, r.z]}));
for (const v of [
{id:'saltreach-terraces',pos:[-112,88,-108],look:[0,12,25]},
{id:'saltreach-street',pos:[-5,8,-44],look:[4,18,48]},
{id:'saltreach-east-gate',pos:[102,14,8],look:[76,17,8]},
{id:'saltreach-north-gate',pos:[0,24,122],look:[0,28,92]},
{id:'thornwood-shelves',pos:[1420,115,250],look:[1470,25,70]},
{id:'frosthollow-shelves',pos:[-1130,140,1620],look:[-1020,32,1450]},
{id:'verdance-shelves',pos:[-210,110,1530],look:[-10,20,1420]},
{id:'saltreach-upper',pos:[-50,48,14],look:[22,26,66]},
{id:'saltreach-garden-shelf',pos:[-12,35,40],look:[-48,28,67]},
{id:'saltreach-sage-rock',pos:[8,28,16],look:[47,29,48]},
{id:'rift-city',pos:[6076,67,5911],look:[5990,25,6005],rift:true},
{id:'rift-citadel',pos:[5905,85,5887],look:[5990,59,5988],rift:true,spawn:[6000,5960]},
{id:'rift-citadel-bailey',pos:[6087,81,5921],look:[6000,26,5990],rift:true,spawn:[6000,5960]},
{id:'rift-citadel-court',pos:[6000,13,5958],look:[5992,34,5983],rift:true,spawn:[6000,5958]},
{id:'rift-gate',pos:[6000,11,5873],look:[6000,28,5988],rift:true},
{id:'rift-ward',pos:[6029,20,5960],look:[6070,26,6006],rift:true},
{id:'rift-rooftops',pos:[5899,42,6050],look:[6025,30,5980],rift:true},
{id:'rift-street',pos:[6000,7.8,5912],look:[6000,6.8,5923],rift:true,spawn:[6000,5912]},
...roomViews,
{id:'rift-inner-gate',pos:[6000,10,5927],look:[6000,24,5950],rift:true},
].filter(v => !process.env.CITY_REVIEW_FILTER || v.id.startsWith(process.env.CITY_REVIEW_FILTER))){
await page.evaluate(v=>{const g=__unstable;const ch=g.createCharacter({name:'Survey',race:'ashkin',look:{height:1}});const x=v.spawn?.[0]??(v.rift?6000:-4),z=v.spawn?.[1]??(v.rift?5830:-346);ch.pos={x,z,y:g.world.terrain.heightAt(x,z)};ch.inRift=!!v.rift;g.startGame(ch,false);g.player.model.root.traverse(o=>{if(o.isMesh)o.visible=false;});g.debugCam={pos:v.pos,look:v.look};document.querySelector('#hud').style.display='none';document.querySelector('#world-ui').style.display='none';},v);
await page.waitForTimeout(800);await page.screenshot({path:`${out}/${v.id}.jpg`,type:'jpeg',quality:88});console.log(v.id);
}
await writeFile(`${out}/errors.json`,JSON.stringify(errors,null,2));console.log({errors});
} finally { await browser.close(); }

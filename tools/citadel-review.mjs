import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'docs/citadel-evidence'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage({viewport:{width:1440,height:900}}); const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto(process.env.CITY_REVIEW_URL || 'http://127.0.0.1:5173'); await page.waitForFunction(()=>window.__unstable,null,{timeout:120000});
await page.evaluate(()=>{const g=__unstable;g.input.requestLock=()=>{};g.settings.master=0;g.applySettings();const sky=g.world.sky.update.bind(g.world.sky);g.world.sky.update=(dt,...args)=>{g.world.sky.time=.42;sky(dt,...args);};});
for (const v of [
{id:'saltreach-skyline',pos:[-112,88,-108],look:[0,28,30]},
{id:'upper-wall-level',pos:[15,32,-3],look:[78,26,26]},
{id:'citadel-approach',pos:[-12,33,49],look:[0,47,70]},
{id:'inner-ward-gate',pos:[8,24,17],look:[18,26,38]},
{id:'observatory',pos:[12,37,20],look:[40,46,49]},
{id:'meridian-keep',pos:[1113,70,-751],look:[1170,32,-690]},
]) {
await page.evaluate(v=>{const g=__unstable;const ch=g.createCharacter({name:'Survey',race:'ashkin',look:{height:1}});const x=v.spawn?.[0]??(v.rift?6000:-4),z=v.spawn?.[1]??(v.rift?5830:-346);ch.pos={x,z,y:g.world.terrain.heightAt(x,z)};ch.inRift=!!v.rift;g.startGame(ch,false);g.debugCam={pos:v.pos,look:v.look};document.querySelector('#hud').style.display='none';document.querySelector('#world-ui').style.display='none';},v);
await page.waitForTimeout(800);await page.screenshot({path:`${out}/${v.id}.jpg`,type:'jpeg',quality:88});console.log(v.id);
}
await writeFile(`${out}/errors.json`,JSON.stringify(errors,null,2));console.log({errors});
} finally { await browser.close(); }

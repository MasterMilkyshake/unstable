import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'docs/meridian-evidence'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage({viewport:{width:1440,height:900}}); const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto(process.env.CITY_REVIEW_URL || 'http://127.0.0.1:5173'); await page.waitForFunction(()=>window.__unstable,null,{timeout:120000});
await page.evaluate(()=>{const g=__unstable;g.input.requestLock=()=>{};g.settings.master=0;g.applySettings();const sky=g.world.sky.update.bind(g.world.sky);g.world.sky.update=(dt,...args)=>{g.world.sky.time=.42;sky(dt,...args);};});
for (const v of [
{id:'meridian-cliff-castle',pos:[1081,107,-806],look:[1171,50,-704]},
{id:'meridian-mountain-link',pos:[1174,143,-541],look:[1274,43,-749]},
{id:'meridian-lower-wall',pos:[1001,53,-669],look:[1102,24,-689]},
{id:'meridian-signal-trail',pos:[1324,76,-681],look:[1340,35,-745]},
{id:'meridian-signal-bridge',pos:[1273,70,-706],look:[1321,35,-780]},
{id:'meridian-bridge-crossing',pos:[1291,49,-780],look:[1351,47,-780]},
{id:'meridian-castle-court',pos:[1210,92,-699],look:[1190,63,-748]},
{id:'meridian-lower-works',pos:[1084,37,-718],look:[1130,37,-676]},
{id:'meridian-lift',pos:[1097,29,-664],look:[1126,39,-676]},
{id:'saltreach-level-curtain',pos:[15,42,-3],look:[78,32,26]},
{id:'saltreach-castle',pos:[-44,63,100],look:[0,42,75]},
{id:'saltreach-millbrook-road',pos:[-74,48,180],look:[-4,16,124]},
]) {
await page.evaluate(v=>{const g=__unstable;const ch=g.createCharacter({name:'Survey',race:'ashkin',look:{height:1}});const x=v.spawn?.[0]??(v.rift?6000:-4),z=v.spawn?.[1]??(v.rift?5830:-346);ch.pos={x,z,y:g.world.terrain.heightAt(x,z)};ch.inRift=!!v.rift;g.startGame(ch,false);g.debugCam={pos:v.pos,look:v.look};document.querySelector('#hud').style.display='none';document.querySelector('#world-ui').style.display='none';},v);
await page.waitForTimeout(800);await page.screenshot({path:`${out}/${v.id}.jpg`,type:'jpeg',quality:88});console.log(v.id);
}
await page.evaluate(() => {
  const g = __unstable, lift = g.world.meridianLift;
  const ch = g.createCharacter({name:'Lift Survey',race:'ashkin',look:{height:1}});
  ch.pos = {x:lift.x,y:lift.y0,z:lift.z}; g.startGame(ch,false);
  g.debugCam = {pos:[lift.x-24,lift.y0+16,lift.z-17],look:[lift.x,lift.y0+13,lift.z]};
});
await page.waitForTimeout(500);
await page.evaluate(() => __unstable.world.meridianLift.ride.use(__unstable));
await page.waitForFunction(() => __unstable.world.meridianLift.y > 29, null, {timeout:30000});
await page.screenshot({path:`${out}/meridian-lift-riding.jpg`,type:'jpeg',quality:88});
await page.waitForFunction(() => { const l=__unstable.world.meridianLift; return l.y === l.y1; }, null, {timeout:30000});
const upper = await page.evaluate(() => ({playerY:__unstable.player.pos.y,liftY:__unstable.world.meridianLift.y,grounded:__unstable.player.grounded}));
if (Math.abs(upper.playerY-upper.liftY)>0.2 || !upper.grounded) throw new Error(`Lift ascent failed: ${JSON.stringify(upper)}`);
await page.evaluate(() => __unstable.world.meridianLift.ride.use(__unstable));
await page.waitForFunction(() => { const l=__unstable.world.meridianLift; return l.y === l.y0; }, null, {timeout:30000});
const lower = await page.evaluate(() => ({playerY:__unstable.player.pos.y,liftY:__unstable.world.meridianLift.y,grounded:__unstable.player.grounded}));
if (Math.abs(lower.playerY-lower.liftY)>0.2 || !lower.grounded) throw new Error(`Lift descent failed: ${JSON.stringify(lower)}`);
await writeFile(`${out}/lift-check.json`,JSON.stringify({upper,lower},null,2));
await writeFile(`${out}/errors.json`,JSON.stringify(errors,null,2));console.log({errors});
} finally { await browser.close(); }

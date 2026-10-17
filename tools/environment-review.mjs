// Environment review captures for the Milestone 2 scorecard (docs/agent/WORLD_DESIGN_PLAN.md):
// first-person and raised views of an area at noon and at midnight, the in-game map, and for
// each view what the player standing there would hear and have within reach.
//
//   node tools/environment-review.mjs <out dir> [area or view-id prefix ...]
//
// Areas: wash (the Wash to Saltreach), hightoll (the castle and its rock from round about), lines (the coast's carrier lines and
// their stations), thorn (Thornwood: Rook's Landing, the Red Trail,
// Brigand Hold, Owlroost, the Watchfire), rift (the arrival shelf, the Ascent's lift and the
// Landing That Never Came), and fen, meridian, ashen, frost, hush, verdance, islets. REVIEW_URL overrides http://localhost:5173; CHROME_PATH picks Chrome;
// REVIEW_SETTINGS (JSON) sets game settings first, e.g. '{"bounceLight":true}'.
//
// A camera height is a number (world y), '+n' (n metres above the ground under that point:
// terrain or a walkable surface within 4 m of it) or {a: n} (the Ascent's floor + n). Each view
// is shot once per entry of `times`. Per shot it records:
//   - dark: the share of 32 px tiles whose mean luma is under 0.03 (near black; unreadable)
//     and under 0.06, and the mean luma of the frame;
//   - audio: the theme and ambient bed the player standing at `at` gets (game.js feeds the
//     scene to AudioSys.setScene every frame; this reads back what it chose), and the ambient
//     bed's gain once the context runs;
//   - reach: enemy spawners, chests, lore, NPCs, beds and campfires within 120 m of `at`.
// Enemies are hidden from the frame (the place is under review, not who wanders through it).
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const out = process.argv[2] || 'docs/environment-evidence';
const only = process.argv.slice(3);
const url = process.env.REVIEW_URL || 'http://localhost:5173';
const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.CHROME_PATH || (existsSync(mac) ? mac : undefined);

const NOON = 0.5, NIGHT = 0.0;
// REVIEW_SETTINGS='{"bounceLight":true}' captures with settings of the game's own changed
const settings = JSON.parse(process.env.REVIEW_SETTINGS || '{}');
const BOTH = ['noon', 'night'];
const a = (n) => ({ a: n });

export const VIEWS = [
  // ---------------------------------------------------------------- the Wash to Saltreach
  { id: 'wash-spawn-hightoll', area: 'wash', at: [-4, -346], pos: [-4, '+1.7', -346], look: [-278, 40, -128], times: BOTH },
  { id: 'wash-spawn-arches', area: 'wash', at: [-4, -346], pos: [-4, '+1.7', -346], look: [-470, 22, -440], times: BOTH },
  { id: 'wash-spawn-north', area: 'wash', at: [-4, -346], pos: [-4, '+1.7', -346], look: [0, 40, 0], times: BOTH },
  { id: 'wash-camp', area: 'wash', at: [12, -334], pos: [14, '+1.7', -336], look: [-2, '+1', -320], times: BOTH },
  { id: 'wash-wreck', area: 'wash', at: [60, -352], pos: [60, '+1.7', -352], look: [160, 4, -360], times: BOTH },
  { id: 'wash-abbey', area: 'wash', at: [-110, -334], pos: [-110, '+1.7', -334], look: [-160, 10, -320], times: BOTH },
  { id: 'wash-barrow', area: 'wash', at: [-170, -262], pos: [-168, '+1.7', -262], look: [-190, '+2', -238], times: ['noon'] },
  { id: 'wash-walk-north', area: 'wash', at: [0, -260], pos: [0, '+1.7', -262], look: [0, '+4', -150], times: BOTH },
  { id: 'wash-walk-docks', area: 'wash', at: [-26, -196], pos: [-26, '+1.7', -196], look: [-4, '+6', -110], times: BOTH },
  { id: 'salt-harbor-ward', area: 'wash', at: [4, -104], pos: [4, '+1.7', -106], look: [0, '+8', -20], times: BOTH },
  { id: 'salt-lantern-tree', area: 'wash', at: [0, -12], pos: [0, '+1.7', -12], look: [0, 16, 4], times: BOTH },
  { id: 'wash-raised', area: 'wash', at: [-4, -346], pos: [60, 70, -420], look: [-60, 10, -260], times: BOTH },
  { id: 'wash-aerial', area: 'wash', at: [0, -200], pos: [160, 230, -470], look: [-40, 0, -160], times: ['noon'] },
  { id: 'wash-map', area: 'wash', at: [-4, -346], map: true },
  // ---------------------------------------------------------------- Hightoll from round about
  // (the user's ask: crags behind the castle, the Elden Ring look; world/hightoll.js buildSurrounds)
  { id: 'hightoll-wash', area: 'hightoll', at: [-4, -346], pos: [-4, '+1.7', -346], look: [-278, 70, -129], times: BOTH },
  { id: 'hightoll-vista', area: 'hightoll', at: [-4, -346], pos: [-4, 15.6, -346], look: [-276, 84, -132], times: ['noon'] },
  { id: 'hightoll-harbor', area: 'hightoll', at: [4, -104], pos: [4, '+1.7', -104], look: [-278, 75, -129], times: ['noon'] },
  { id: 'hightoll-meadow', area: 'hightoll', at: [-141, -171], pos: [-141, '+1.7', -171], look: [-278, 70, -129], times: ['noon'] },
  { id: 'hightoll-fen', area: 'hightoll', at: [-309, -300], pos: [-309, '+1.7', -300], look: [-278, 70, -129], times: ['noon'] },
  { id: 'hightoll-arches', area: 'hightoll', at: [-390, -276], pos: [-390, 62, -276], look: [-278, 75, -129], times: ['noon'] },
  { id: 'hightoll-reed-road', area: 'hightoll', at: [-363, -36], pos: [-363, '+1.7', -36], look: [-278, 70, -129], times: ['noon'] },
  { id: 'hightoll-descent', area: 'hightoll', at: [-259, -85], pos: [-259, 62.4, -85], look: [-196, 10, -2], times: ['noon'] },
  { id: 'hightoll-chapel', area: 'hightoll', at: [-128, -124], pos: [-128, '+1.7', -124], look: [-200, 30, -140], times: ['noon'] },
  { id: 'hightoll-air', area: 'hightoll', at: [-229, -305], pos: [-229, 170, -305], look: [-278, 80, -129], times: ['noon'] },
  // ---------------------------------------------------------------- Thornwood
  { id: 'thorn-dock', area: 'thorn', at: [1182, 160], dock: 'dock_thorn', look: [1330, 20, 132], times: BOTH },
  { id: 'thorn-landing', area: 'thorn', at: [1196, 150], pos: [1196, '+1.7', 152], look: [1300, '+8', 132], times: BOTH },
  { id: 'thorn-trail', area: 'thorn', at: [1236, 136], pos: [1236, '+1.7', 136], look: [1310, '+5', 132], times: BOTH },
  { id: 'thorn-hold-gate', area: 'thorn', at: [1300, 132], pos: [1300, '+1.7', 133], look: [1345, '+4', 126], times: BOTH },
  { id: 'thorn-hold-yard', area: 'thorn', at: [1348, 134], pos: [1348, '+1.7', 136], look: [1400, '+4', 158], times: BOTH },
  { id: 'thorn-hold-mess', area: 'thorn', at: [1362, 136], pos: [1360, '+1.7', 128], look: [1376, '+1.5', 144], times: BOTH },
  { id: 'thorn-hold-north', area: 'thorn', at: [1350, 160], pos: [1352, '+1.7', 150], look: [1350, '+2', 172], times: ['noon'] },
  { id: 'thorn-warlord', area: 'thorn', at: [1386, 150], pos: [1384, '+1.7', 148], look: [1412, '+2', 160], times: BOTH },
  { id: 'thorn-forest', area: 'thorn', at: [1440, 60], pos: [1440, '+1.7', 60], look: [1480, '+3', 120], times: BOTH },
  { id: 'thorn-owlroost', area: 'thorn', at: [1252, -8], pos: [1252, '+1.7', -8], look: [1232, '+3', -30], times: BOTH },
  { id: 'thorn-widowneedles', area: 'thorn', at: [1232, -94], pos: [1232, '+1.7', -94], look: [1215, 12, -122], times: ['noon'] },
  { id: 'thorn-watchfire', area: 'thorn', at: [1470, 228], pos: [1470, '+1.7', 228], look: [1502, '+6', 250], times: BOTH },
  { id: 'thorn-tollarch', area: 'thorn', at: [1500, -232], pos: [1500, '+1.7', -232], look: [1518, 8, -260], times: ['noon'] },
  { id: 'thorn-raised', area: 'thorn', at: [1236, 136], pos: [1150, 60, 200], look: [1360, 10, 130], times: BOTH },
  { id: 'thorn-aerial', area: 'thorn', at: [1300, 60], pos: [1120, 230, -180], look: [1360, 0, 110], times: ['noon'] },
  { id: 'thorn-map', area: 'thorn', at: [1236, 136], map: true },
  // ---------------------------------------------------------------- the coast's carrier lines (P1, P2, P3)
  { id: 'lines-wash-tower', area: 'lines', at: [-12, -350], pos: [-14, '+1.7', -352], look: [7, '+6', -334], times: BOTH },
  { id: 'lines-wash-from-tower', area: 'lines', at: [7, -334], pos: [6, 23.6, -333], look: [-171, 18, -246], times: ['noon'] },
  { id: 'lines-wash-prospect', area: 'lines', at: [-176, -240], pos: [-178, '+1.7', -242], look: [7, 18, -334], times: ['noon'] },
  { id: 'lines-hold-pier', area: 'lines', at: [1182, 160], dock: 'dock_thorn', look: [1322, 22, 140], times: BOTH },
  { id: 'lines-hold-trail', area: 'lines', at: [1236, 136], pos: [1236, '+1.7', 136], look: [1322, '+10', 140], times: ['noon'] },
  { id: 'lines-hold-lookout', area: 'lines', at: [1338, 152], pos: [1338, '+1.7', 154], look: [1322.5, '+7', 140], times: BOTH },
  { id: 'lines-hold-from-lookout', area: 'lines', at: [1322.5, 140], pos: [1322.5, 22.8, 140], look: [1490, 28, 251], times: ['noon'] },
  { id: 'lines-hold-aerial', area: 'lines', at: [1340, 140], pos: [1300, 75, 120], look: [1335, 10, 140], times: ['noon'] },
  { id: 'lines-watchfire-stage', area: 'lines', at: [1500, 246], pos: [1502, '+1.7', 244], look: [1490, '+2', 251], times: BOTH },
  // ---------------------------------------------------------------- the ledge-built world's lines (data/ledges.js)
  { id: 'ledges-barrow-foot', area: 'ledges', at: [-182, -292], pos: [-179, '+1.7', -294], look: [-182, 12, -272], times: BOTH },
  { id: 'ledges-seamspire-foot', area: 'ledges', at: [-232, -276], pos: [-232, '+1.7', -276], look: [-246, 22, -276], times: ['noon'] },
  { id: 'ledges-thorn-foot', area: 'ledges', at: [1391, 59], pos: [1391, '+1.7', 59], look: [1400, 18, 68], times: ['noon'] },
  { id: 'ledges-basalt-foot', area: 'ledges', at: [684, -1062], pos: [684, '+1.7', -1062], look: [696, 15, -1062], times: ['noon'] },
  { id: 'ledges-vigil-foot', area: 'ledges', at: [-995, 1455], pos: [-995, '+1.7', 1455], look: [-995, 22, 1468], times: ['noon'] },
  { id: 'stack-sea', area: 'ledges', at: [1900, 60], pos: [1905, 3.5, 70], look: [1845, 10, 30], times: BOTH },
  { id: 'stack-close', area: 'ledges', at: [1832, 30], pos: [1826, 4, 22], look: [1845, 9, 31], times: ['noon'] },
  { id: 'stack-cliff', area: 'ledges', at: [1770, 40], pos: [1772, 104, 44], look: [1845, 12, 30], times: ['noon'] },
  { id: 'ledges-barrow-far', area: 'ledges', at: [-140, -320], pos: [-130, '+1.7', -325], look: [-182, 10, -272], times: ['noon'] },
  // ---------------------------------------------------------------- the other regions (world-life's task 5)
  { id: 'fen-moss', area: 'fen', at: [-448, -250], pos: [-448, '+1.7', -250], look: [-600, '+4', -330], times: BOTH },
  { id: 'fen-reedbank', area: 'fen', at: [-480, -266], pos: [-470, '+1.7', -262], look: [-560, '+3', -320], times: ['noon'] },
  { id: 'fen-raised', area: 'fen', at: [-600, -330], pos: [-450, 60, -180], look: [-600, 0, -340], times: ['noon'] },
  { id: 'mer-docks', area: 'meridian', at: [930, -400], pos: [930, '+1.7', -400], look: [1190, 30, -676], times: BOTH },
  { id: 'mer-ward', area: 'meridian', at: [1076, -604], pos: [1076, '+1.7', -604], look: [1190, 20, -676], times: ['noon'] },
  { id: 'mer-works', area: 'meridian', at: [1097, -694], pos: [1097, '+1.7', -694], look: [1190, '+10', -676], times: ['noon'] },
  { id: 'mer-raised', area: 'meridian', at: [1190, -680], pos: [980, 120, -480], look: [1190, 0, -680], times: ['noon'] },
  { id: 'ash-cinderstead', area: 'ashen', at: [261, -1326], pos: [261, '+1.7', -1326], look: [340, 40, -1200], times: BOTH },
  { id: 'ash-camp', area: 'ashen', at: [222, -1318], pos: [222, '+1.7', -1318], look: [340, 30, -1200], times: ['noon'] },
  { id: 'ash-raised', area: 'ashen', at: [340, -1200], pos: [150, 140, -1400], look: [340, 20, -1200], times: ['noon'] },
  { id: 'frost-village', area: 'frost', at: [-909, 1312], pos: [-909, '+1.7', 1312], look: [-1040, 20, 1470], times: BOTH },
  { id: 'frost-hunters', area: 'frost', at: [-878, 1270], pos: [-878, '+1.7', 1270], look: [-909, '+3', 1312], times: ['noon'] },
  { id: 'frost-hollow', area: 'frost', at: [-1040, 1470], pos: [-1040, '+1.7', 1470], look: [-1100, 25, 1530], times: ['noon'] },
  { id: 'frost-raised', area: 'frost', at: [-1000, 1400], pos: [-800, 120, 1200], look: [-1040, 10, 1470], times: ['noon'] },
  { id: 'hush-landing', area: 'hush', at: [-1034, 1102], pos: [-1034, '+1.7', 1102], look: [-1260, 20, 1126], times: BOTH },
  { id: 'hush-sounding', area: 'hush', at: [-1260, 1126], pos: [-1250, '+1.7', 1120], look: [-1385, '+2', 1165], times: ['noon'] },
  { id: 'hush-chairs', area: 'hush', at: [-1180, 1002], pos: [-1180, '+1.7', 1002], look: [-1260, 15, 1126], times: ['noon'] },
  { id: 'hush-raised', area: 'hush', at: [-1330, 1080], pos: [-1100, 140, 950], look: [-1330, 0, 1080], times: ['noon'] },
  { id: 'verd-landing', area: 'verdance', at: [-45, 1149], pos: [-45, '+1.7', 1149], look: [-20, 20, 1320], times: BOTH },
  { id: 'verd-mossbound', area: 'verdance', at: [45, 1230], pos: [45, '+1.7', 1230], look: [-20, '+3', 1300], times: ['noon'] },
  { id: 'verd-kingsfall', area: 'verdance', at: [-20, 1320], pos: [-20, '+1.7', 1320], look: [-30, '+8', 1400], times: ['noon'] },
  { id: 'verd-raised', area: 'verdance', at: [-30, 1240], pos: [100, 140, 1100], look: [-30, 0, 1300], times: ['noon'] },
  { id: 'isle-anchor', area: 'islets', at: [14, 690], pos: [14, '+1.7', 686], look: [0, 20, 720], times: BOTH },
  { id: 'isle-gallows', area: 'islets', at: [420, -330], pos: [440, '+1.7', -340], look: [412, 20, -338], times: ['noon'] },
  { id: 'isle-ebb', area: 'islets', at: [-320, -620], pos: [-300, '+1.7', -630], look: [-322, 25, -622], times: ['noon'] },
  { id: 'isle-gulls', area: 'islets', at: [160, -360], pos: [150, '+1.7', -345], look: [175, '+2', -370], times: ['noon'] },
  // ---------------------------------------------------------------- the Rift
  { id: 'rift-arrival', area: 'rift', at: [6000, 5832], pos: [6000, '+1.7', 5832], look: [6000, 35, 5988], times: BOTH },
  { id: 'rift-walk-shelf', area: 'rift', at: [6000, 5870], pos: [6000, '+1.7', 5868], look: [6000, '+2', 5930], times: BOTH },
  { id: 'rift-south-gate', area: 'rift', at: [6000, 5903], pos: [6000, '+1.7', 5903], look: [6000, 16, 5951], times: BOTH },
  { id: 'rift-street', area: 'rift', at: [6000, 5955], pos: [6000, '+1.7', 5955], look: [6000, '+4', 6000], times: BOTH },
  { id: 'rift-base-gate', area: 'rift', at: [6000, 5945], pos: [6000, a(3), 5940], look: [6000, a(8), 5975], times: BOTH },
  { id: 'rift-lift-base', area: 'rift', at: [6014, 6022], pos: [6014, a(1.7), 6022], look: [6008, a(6), 6006.2], times: BOTH },
  { id: 'rift-landing-t3', area: 'rift', at: [6000, 5997], pos: [6000, a(49.7), 5995], look: [6000, a(44), 6060], times: ['noon'] },
  { id: 'rift-summit', area: 'rift', at: [6006, 5980], pos: [6012, a(118), 5976], look: [6000, a(112), 5988], times: BOTH },
  { id: 'rift-east-road', area: 'rift', at: [5872, 5990], pos: [5872, '+1.7', 5992], look: [5874, '+2', 6058], times: BOTH },
  { id: 'rift-postern', area: 'rift', at: [5873, 6080], pos: [5873, '+1.7', 6080], look: [5876, '+2', 6130], times: BOTH },
  { id: 'rift-landing-ramp', area: 'rift', at: [5890, 6118], pos: [5890, '+1.8', 6118], look: [5900, 8, 6152], times: BOTH },
  { id: 'rift-landing-court', area: 'rift', at: [5922, 6136], pos: [5922, '+2.2', 6136], look: [5880, 6, 6168], times: BOTH },
  { id: 'rift-landing-boat', area: 'rift', at: [5884, 6158], pos: [5884, '+2', 6158], look: [5896, 3, 6177], times: ['noon'] },
  { id: 'rift-aerial', area: 'rift', at: [6000, 5900], pos: [6000, 92, 5790], look: [6000, 0, 6050], times: ['noon'] },
  { id: 'rift-landing-aerial', area: 'rift', at: [5900, 6100], pos: [5960, 70, 6040], look: [5890, 0, 6160], times: ['noon'] },
  { id: 'rift-map', area: 'rift', at: [6000, 5832], map: true },
];

const views = only.length ? VIEWS.filter((v) => only.some((p) => v.area === p || v.id.startsWith(p))) : VIEWS;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true, executablePath,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const errors = [], shots = [];

// near-black and dark tile shares of a JPEG, decoded in the page
async function darkness(page, buf) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const T = 32;
    let tiles = 0, black = 0, dark = 0, sum = 0, n = 0;
    for (let ty = 0; ty + T <= c.height; ty += T) for (let tx = 0; tx + T <= c.width; tx += T) {
      let s = 0, k = 0;
      for (let y = ty; y < ty + T; y += 2) for (let xx = tx; xx < tx + T; xx += 2) {
        const i = (y * c.width + xx) * 4;
        s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; k++;
      }
      const m = s / k;
      tiles++; sum += s; n += k;
      if (m < 0.03) black++;
      if (m < 0.06) dark++;
    }
    return { black: +(black / tiles).toFixed(3), dark: +(dark / tiles).toFixed(3), luma: +(sum / n).toFixed(3) };
  }, buf.toString('base64'));
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push({ type: 'page', message: e.message }));
  page.on('console', (m) => { if (m.type() === 'error') errors.push({ type: 'console', message: m.text() }); });
  // one boot per area: the Rift's sky, fog and sanity are set up by starting there, as
  // tools/rift-review.mjs does, not by flipping a flag on a surface game
  async function boot(area) {
    await page.goto(url);
    await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
    await page.evaluate(async ([rift, settings]) => {
      const g = __unstable;
      g.input.requestLock = () => {};
      g.settings.quality = 'high';
      Object.assign(g.settings, settings);
      g.applySettings();
      g.__reviewTime = 0.5;
      g.world.sky.update = ((orig) => (dt, ...rest) => { g.world.sky.time = g.__reviewTime; orig(dt, ...rest); })(g.world.sky.update.bind(g.world.sky));
      const ch = g.createCharacter({ name: 'Surveyor', race: 'ashkin', look: { height: 1 } });
      if (rift) {
        ch.pos = { x: 6000, z: 5830, y: g.world.terrain.heightAt(6000, 5830) };
        ch.inRift = true;
      }
      g.startGame(ch, false);
      g.audio.init();
      const { ACTIONS } = await import('/src/game/hooks.js');
      ACTIONS.setWeather?.('clear');
      document.querySelector('#hud').style.display = 'none';
      document.querySelector('#world-ui').style.display = 'none';
      const { G } = await import('/src/core/globals.js');
      g.__G = G;
      setInterval(() => {
        for (const act of G.actors || []) if (act !== g.player && act.model && act.model.root) act.model.root.visible = false;
      }, 50);
    }, [area === 'rift', settings]);
  }
  // the theme and ambient bed AudioSys chose for the scene game.js fed it this frame
  const listen = () => {
    const A = __unstable.audio, s = A.scene;
    const theme = A._themeId();
    const key = theme.startsWith('boss:') ? (s.inRift ? 'rift' : s.island || 'sea') : theme.split(':')[0];
    return { theme, ambient: key, island: s.island, region: s.region, biome: s.biome, night: s.night, bedGain: A.ambient ? +A.ambient.gain.gain.value.toFixed(3) : null, ctx: A.ctx?.state };
  };
  let last = null, area = null;
  for (const v of views) {
    const rift = v.area === 'rift';
    if (v.area !== area) { area = v.area; await boot(area); last = null; }
    const moved = !last || Math.hypot(v.at[0] - last[0], v.at[1] - last[1]) > 60;
    last = v.at;
    const info = await page.evaluate(async ([v, rift]) => {
      const g = __unstable, w = g.world, T = w.terrain;
      const ground = (x, z) => { const t = T.heightAt(x, z); return Math.max(t, w.colliders.groundAt(x, z, t + 4)); };
      const ascent = w.rift?.spire?.ground ?? T.heightAt(6000, 5988);
      const yOf = (x, y, z) => (typeof y === 'number' ? y : typeof y === 'string' ? ground(x, z) + parseFloat(y) : ascent + y.a);
      const p = g.player;
      p.pos.set(v.at[0], ground(v.at[0], v.at[1]) + 0.05, v.at[1]);
      p.vel?.set?.(0, 0, 0);
      p.invulnerable = true;
      p.iframes = 1e6;
      if (p.maxSanity) g.ch.sanity = p.maxSanity;
      if (g.ui.modal) g.ui.closeModal(false);
      if (v.map) { g.debugCam = null; return { map: true }; }
      let pos = v.pos;
      if (v.dock) {
        // the pier's end, where a rented boat puts in, looking inland
        const d = w.docks[v.dock];
        pos = [d.end.x, d.end.y + 1.7, d.end.z];
      }
      const cp = [pos[0], yOf(pos[0], pos[1], pos[2]), pos[2]];
      g.debugCam = { pos: cp, look: [v.look[0], yOf(v.look[0], v.look[1], v.look[2]), v.look[2]] };
      if (p.model?.root) p.model.root.visible = false;
      return { cam: cp.map((n) => Math.round(n * 10) / 10) };
    }, [v, rift]);
    if (rift !== await page.evaluate(() => !!__unstable.inRift)) throw new Error(`${v.id}: inRift does not match the area`);
    await page.waitForTimeout(moved ? 3500 : 600);
    // what is within reach, and what the player standing here hears
    const here = await page.evaluate(async (v) => {
      const g = __unstable, w = g.world, [x, z] = v.at, R = 120;
      const near = (px, pz) => Math.hypot(px - x, pz - z) < R;
      const reach = { spawners: 0, foes: [], chests: 0, lore: 0, npcs: 0, beds: 0, campfires: 0, other: [] };
      for (const s of g.spawners) if (near(s.def.x, s.def.z)) { reach.spawners++; reach.foes.push(`${s.def.type}×${s.def.count}`); }
      for (const it of w.interactables) {
        const px = it.pos?.x ?? it.x, pz = it.pos?.z ?? it.z;
        if (!near(px, pz)) continue;
        const k = it.kind || it.type;
        if (k === 'chest') reach.chests++;
        else if (k === 'lore') reach.lore++;
        else if (k === 'bed' || k === 'rest_point') reach.beds++;
        else if (k === 'campfire') reach.campfires++;
        else if (k === 'npc' || k === 'talk') reach.npcs++;
        else if (!/forage|fish|well|seat|door/.test(k || '')) reach.other.push(k);
      }
      for (const n of g.npcs || []) if (near(n.pos.x, n.pos.z)) reach.npcs++;
      reach.other = [...new Set(reach.other)];
      return { place: g.areaName, reach };
    }, v);
    here.audio = await page.evaluate(listen);
    if (v.map) {
      await page.evaluate(() => __unstable.ui.openMap());
      await page.waitForTimeout(900);
      const file = `${v.id}.png`;
      await page.locator('#map-canvas').screenshot({ path: `${out}/${file}` });
      await page.evaluate(() => __unstable.ui.closeModal(false));
      shots.push({ id: v.id, area: v.area, file, ...here });
      console.log(v.id, here.place);
      continue;
    }
    for (const t of v.times) {
      await page.evaluate((t) => { __unstable.__reviewTime = t; }, t === 'noon' ? NOON : NIGHT);
      await page.waitForTimeout(1000);
      here.audio = await page.evaluate(listen);
      const file = `${v.id}-${t}.jpg`;
      const buf = await page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 82 });
      const dark = await darkness(page, buf);
      shots.push({ id: v.id, area: v.area, time: t, file, cam: info.cam, dark, ...here, audio: here.audio });
      console.log(v.id, t, here.place, `black ${dark.black} dark ${dark.dark} luma ${dark.luma}`, here.audio.theme, here.audio.ambient);
    }
  }
  await context.close();
} finally {
  await browser.close();
}
await writeFile(`${out}/capture.json`, JSON.stringify({ url, errors, shots }, null, 2) + '\n');
console.log('console errors', errors.length, JSON.stringify(errors.slice(0, 8)));
if (errors.length) process.exitCode = 1;

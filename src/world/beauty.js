// World-scale beauty orchestrator: atmosphere, giant landmarks, ruins and
// framed overlooks. Called from World.build with the vegetation exclusion
// list so trees stay off the monuments.
import { registerVistaData, VISTA_SHOTS } from '../data/vistas.js';
import { Atmosphere } from './atmosphere.js';
import { buildMonuments, updateMonuments } from './monuments.js';
import { buildRuinscapes } from './ruinscapes.js';

export function buildBeauty(world, exclusions) {
  registerVistaData();
  const marks = buildMonuments(world, exclusions);
  buildRuinscapes(world, exclusions);
  const atmosphere = new Atmosphere(world);
  const beauty = {
    atmosphere,
    marks,
    preview: null,
    attachComposer(composer, bloom) {
      atmosphere.attachComposer(composer, bloom);
      return this;
    },
    setQuality(quality, viewDistance) {
      atmosphere.setQuality(quality, viewDistance);
    },
    update(dt, camera, inRift, center) {
      if (this.preview) {
        world.sky.time = this.preview.time;
      }
      atmosphere.update(dt, camera, inRift, center);
      updateMonuments(marks, camera, atmosphere.low);
    },
    applyPreview(cam) {
      const s = this.preview;
      if (!s) return false;
      cam.position.set(s.x, s.y, s.z);
      cam.lookAt(s.lx, s.ly, s.lz);
      return true;
    },
    shot(name) {
      const s = VISTA_SHOTS[name];
      if (!s) return null;
      this.preview = s;
      world.sky.time = s.time;
      return s;
    },
  };
  world.beauty = beauty;
  return beauty;
}

export function tryVistaPreview(game) {
  let q;
  try {
    q = new URLSearchParams(location.search);
  } catch (_) {
    return;
  }
  const name = q.get('vista');
  if (!name || !game.world.beauty) return;
  const s = game.world.beauty.shot(name);
  if (!s) return;
  game.settings.quality = 'high';
  game.settings.viewDistance = Math.max(game.settings.viewDistance || 1, 1.25);
  game.applySettings();
  game.camera.far = 5600;
  game.camera.updateProjectionMatrix();
  if (q.get('time')) {
    const t = parseFloat(q.get('time'));
    if (Number.isFinite(t)) {
      game.world.sky.time = t;
      s.time = t;
    }
  }
  const hideUi = () => {
    const mm = document.getElementById('main-menu');
    if (mm) mm.style.display = 'none';
    const hud = document.getElementById('hud');
    if (hud) hud.classList.add('hidden');
  };
  hideUi();
  setTimeout(hideUi, 80);
  setTimeout(hideUi, 400);
}

export { VISTA_SHOTS };

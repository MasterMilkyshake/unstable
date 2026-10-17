// Fully procedural audio: synthesized SFX and a generative adaptive score.
// Everything is synthesized at runtime — no sample files.
import { G } from './globals.js';
import { rand, choice, clamp, damp } from './util.js';

// Distinct island themes. `night` overlays the day bed (root/scale/cutoff/tempo).
const THEMES = {
  menu: { root: 110, scale: [0, 3, 5, 7, 10], tempo: 2.6, cutoff: 900, drone: 0.05, bright: 0.5, fifths: 0.25 },
  sea: {
    root: 123.47, scale: [0, 2, 4, 7, 9], tempo: 3.1, cutoff: 1100, drone: 0.03, bright: 0.65, fifths: 0.2,
    droneTypes: ['sine', 'triangle', 'sine'],
    night: { root: 98, scale: [0, 2, 3, 7, 10], cutoff: 700, tempo: 3.6, drone: 0.04, bright: 0.35 },
  },
  the_wash: {
    root: 146.83, scale: [0, 2, 4, 7, 9, 11], tempo: 2.45, cutoff: 1650, drone: 0.034, bright: 0.78, fifths: 0.4,
    droneTypes: ['sine', 'triangle', 'sine'],
    night: { root: 130.81, scale: [0, 2, 3, 7, 10], cutoff: 880, tempo: 3.05, drone: 0.045, bright: 0.45 },
  },
  saltreach: {
    root: 174.61, scale: [0, 2, 5, 7, 9], tempo: 2.05, cutoff: 1850, drone: 0.04, bright: 0.82, fifths: 0.35,
    droneTypes: ['triangle', 'sine', 'triangle'],
    night: { root: 146.83, scale: [0, 3, 5, 7, 10], cutoff: 1050, tempo: 2.7, drone: 0.048, bright: 0.5 },
  },
  thornwood: {
    root: 123.47, scale: [0, 2, 3, 7, 8], tempo: 1.95, cutoff: 1150, drone: 0.05, bright: 0.55, fifths: 0.22,
    droneTypes: ['sawtooth', 'triangle', 'sine'],
    night: { root: 110, scale: [0, 1, 3, 7, 8], cutoff: 780, tempo: 2.5, drone: 0.06, bright: 0.35 },
  },
  shimmerfen: {
    root: 155.56, scale: [0, 1, 5, 7, 10], tempo: 2.55, cutoff: 920, drone: 0.052, bright: 0.4, fifths: 0.18,
    droneTypes: ['sine', 'sine', 'triangle'],
    night: { root: 138.59, scale: [0, 1, 3, 6, 10], cutoff: 640, tempo: 3.1, drone: 0.06, bright: 0.25 },
  },
  frosthollow: {
    root: 196, scale: [0, 2, 3, 7, 10], tempo: 2.85, cutoff: 2300, drone: 0.028, bright: 0.95, fifths: 0.45,
    droneTypes: ['sine', 'triangle', 'sine'],
    night: { root: 164.81, scale: [0, 1, 3, 7, 11], cutoff: 1500, tempo: 3.3, drone: 0.036, bright: 0.7 },
  },
  ashen_spire: {
    root: 98, scale: [0, 1, 5, 7, 8], tempo: 2.35, cutoff: 760, drone: 0.07, bright: 0.28, fifths: 0.12,
    droneTypes: ['sawtooth', 'sawtooth', 'triangle'],
    night: { root: 82.41, scale: [0, 1, 4, 6, 8], cutoff: 520, tempo: 2.8, drone: 0.08, bright: 0.18 },
  },
  verdance: {
    root: 138.59, scale: [0, 2, 3, 5, 7, 10], tempo: 1.85, cutoff: 1450, drone: 0.045, bright: 0.7, fifths: 0.3,
    droneTypes: ['triangle', 'sawtooth', 'sine'],
    night: { root: 123.47, scale: [0, 3, 5, 7, 10], cutoff: 900, tempo: 2.4, drone: 0.05, bright: 0.4 },
  },
  // Meridian: the Enclave's fort city, a measured minor over a held drone, brass in its edges
  meridian: {
    root: 116.54, scale: [0, 2, 3, 5, 7, 8], tempo: 2.25, cutoff: 1500, drone: 0.05, bright: 0.6, fifths: 0.45,
    droneTypes: ['sawtooth', 'triangle', 'sine'],
    night: { root: 103.83, scale: [0, 2, 3, 7, 8], cutoff: 950, tempo: 2.8, drone: 0.055, bright: 0.38 },
  },
  // the Hush: the Ministry's moor, sparse and listening, a bell's partials in its fifths
  the_hush: {
    root: 130.81, scale: [0, 1, 5, 7, 10], tempo: 3.4, cutoff: 1300, drone: 0.04, bright: 0.45, fifths: 0.55,
    droneTypes: ['sine', 'sine', 'triangle'], droneRatios: [1, 1.498, 2.76],
    night: { root: 116.54, scale: [0, 1, 5, 6, 10], cutoff: 820, tempo: 3.9, drone: 0.05, bright: 0.3 },
  },
  rift: {
    root: 82.41, scale: [0, 1, 6, 7, 11], tempo: 3.15, cutoff: 600, drone: 0.085, bright: 0.22, fifths: 0.08,
    droneTypes: ['sawtooth', 'sine', 'triangle'], perc: 0.18,
  },
};

const BOSS_THEMES = {
  warlord: {
    root: 110, scale: [0, 1, 4, 5, 7, 8, 10], tempo: 0.4, cutoff: 2100, drone: 0.09, bright: 0.85, fifths: 0.35,
    droneTypes: ['sawtooth', 'sawtooth', 'square'], perc: 0.55, notePeak: 0.1,
  },
  frost_warden: {
    root: 164.81, scale: [0, 1, 3, 7, 11], tempo: 0.52, cutoff: 2600, drone: 0.055, bright: 0.95, fifths: 0.5,
    droneTypes: ['sine', 'triangle', 'sine'], perc: 0.2, notePeak: 0.09,
  },
  cinder_colossus: {
    root: 73.42, scale: [0, 1, 5, 7, 8], tempo: 0.58, cutoff: 900, drone: 0.11, bright: 0.35, fifths: 0.12,
    droneTypes: ['sawtooth', 'sawtooth', 'triangle'], perc: 0.45, notePeak: 0.08,
  },
  // Hightoll's castellan: a slow processional in a low mode, under a bell's hum
  castellan: {
    root: 98, scale: [0, 2, 3, 7, 8], tempo: 0.44, cutoff: 1500, drone: 0.1, bright: 0.55, fifths: 0.45,
    droneTypes: ['triangle', 'sawtooth', 'sine'], perc: 0.5, notePeak: 0.09,
  },
  hollow_duke: {
    root: 73.42, scale: [0, 1, 6, 7, 11], tempo: 0.46, cutoff: 1400, drone: 0.1, bright: 0.4, fifths: 0.08,
    droneTypes: ['sawtooth', 'sine', 'triangle'], perc: 0.4, notePeak: 0.09,
  },
  // Sera Vane: quick and bright, a duel's dance in a raised mode
  duelist: {
    root: 146.83, scale: [0, 2, 4, 6, 7, 9, 11], tempo: 0.32, cutoff: 2600, drone: 0.05, bright: 0.95, fifths: 0.3,
    droneTypes: ['triangle', 'sine', 'triangle'], perc: 0.35, notePeak: 0.08,
  },
  // Old Mother Reed: a crooked lullaby over the fen's reeds
  witch_queen: {
    root: 138.59, scale: [0, 1, 4, 5, 8, 10], tempo: 0.62, cutoff: 1100, drone: 0.07, bright: 0.35, fifths: 0.1,
    droneTypes: ['sine', 'sawtooth', 'sine'], droneRatios: [1, 1.414, 2.01], perc: 0.25, notePeak: 0.08,
  },
  // Bonegnaw: under the ground, all weight and grind
  thresher: {
    root: 55, scale: [0, 1, 3, 6, 7], tempo: 0.5, cutoff: 700, drone: 0.13, bright: 0.2, fifths: 0.05,
    droneTypes: ['sawtooth', 'square', 'sawtooth'], perc: 0.6, notePeak: 0.09,
  },
  // Primadon: drums of the canopy, a king's slow pride
  primadon: {
    root: 92.5, scale: [0, 3, 5, 7, 10], tempo: 0.42, cutoff: 1300, drone: 0.09, bright: 0.6, fifths: 0.4,
    droneTypes: ['triangle', 'sawtooth', 'triangle'], perc: 0.7, notePeak: 0.09,
  },
  // the Lanternless: a ferryman's hymn, wide and cold, the last crossing
  lanternless: {
    root: 65.41, scale: [0, 2, 3, 7, 8, 11], tempo: 0.7, cutoff: 1800, drone: 0.11, bright: 0.5, fifths: 0.55,
    droneTypes: ['sine', 'triangle', 'sawtooth'], droneRatios: [1, 1.498, 1.888], perc: 0.3, notePeak: 0.1,
  },
  // the Enclave's wardens: a march in their own minor, drum-led
  warden: {
    root: 116.54, scale: [0, 2, 3, 5, 7, 8, 10], tempo: 0.38, cutoff: 1900, drone: 0.08, bright: 0.7, fifths: 0.45,
    droneTypes: ['sawtooth', 'triangle', 'square'], perc: 0.65, notePeak: 0.09,
  },
  // a lair's or a dungeon's master: the same tension, without a name of its own
  lair: {
    root: 103.83, scale: [0, 1, 3, 7, 8], tempo: 0.48, cutoff: 1500, drone: 0.08, bright: 0.5, fifths: 0.2,
    droneTypes: ['sawtooth', 'triangle', 'sine'], perc: 0.45, notePeak: 0.085,
  },
};
// great foes who share a theme
const BOSS_ALIAS = { vice_warden: 'warden', grand_warden: 'warden' };
const bossTheme = (id) => BOSS_THEMES[id] || BOSS_THEMES[BOSS_ALIAS[id]] || BOSS_THEMES.lair;

const BIOME_THEME = {
  beach: 'the_wash', meadow: 'saltreach', forest: 'thornwood', marsh: 'shimmerfen',
  snow: 'frosthollow', volcanic: 'ashen_spire', ashfield: 'ashen_spire', emberwood: 'ashen_spire', jungle: 'verdance', rift: 'rift',
};

const AMBIENTS = {
  sea: { f: 260, q: 0.55, vol: 0.11, lfoRate: 0.08, lfoDepth: 70, f2: 900, vol2: 0.02 },
  the_wash: { f: 340, q: 0.65, vol: 0.1, lfoRate: 0.1, lfoDepth: 90, f2: 1100, vol2: 0.02 },
  saltreach: { f: 880, q: 0.4, vol: 0.035, lfoRate: 0.07, lfoDepth: 40, f2: 2400, vol2: 0.018 },
  thornwood: { f: 480, q: 0.85, vol: 0.07, lfoRate: 0.14, lfoDepth: 55, f2: 1600, vol2: 0.025 },
  shimmerfen: { f: 2600, q: 3.6, vol: 0.045, lfoRate: 6.5, lfoDepth: 380, f2: 1700, vol2: 0.04 },
  frosthollow: { f: 1900, q: 0.45, vol: 0.075, lfoRate: 0.18, lfoDepth: 420, f2: 4200, vol2: 0.02 },
  ashen_spire: { f: 170, q: 1.15, vol: 0.09, lfoRate: 0.09, lfoDepth: 35, f2: 2100, vol2: 0.035 },
  verdance: { f: 700, q: 0.7, vol: 0.06, lfoRate: 0.2, lfoDepth: 80, f2: 2800, vol2: 0.03 },
  meridian: { f: 760, q: 0.5, vol: 0.04, lfoRate: 0.08, lfoDepth: 45, f2: 2200, vol2: 0.018 },
  the_hush: { f: 1500, q: 0.6, vol: 0.06, lfoRate: 0.12, lfoDepth: 300, f2: 3600, vol2: 0.015 },
  rift: { f: 640, q: 5.5, vol: 0.045, lfoRate: 0.28, lfoDepth: 420, f2: 1800, vol2: 0.03, sanity: 1 },
  menu: { f: 400, q: 0.5, vol: 0.02, lfoRate: 0.05, lfoDepth: 20, f2: 800, vol2: 0 },
};

const HIT_CLS = {
  fist: { thud: 88, click: 0, noise: 1300, metal: 0 },
  dagger: { thud: 150, click: 2900, noise: 3400, metal: 0.2 },
  rapier: { thud: 165, click: 3300, noise: 3700, metal: 0.22 },
  katana: { thud: 128, click: 2500, noise: 2900, metal: 0.24 },
  sword: { thud: 118, click: 1850, noise: 2200, metal: 0.17 },
  spear: { thud: 108, click: 1650, noise: 2000, metal: 0.13 },
  greatsword: { thud: 78, click: 920, noise: 1450, metal: 0.2 },
  greataxe: { thud: 72, click: 820, noise: 1250, metal: 0.16 },
  hammer: { thud: 52, click: 380, noise: 780, metal: 0.05 },
  scythe: { thud: 96, click: 1400, noise: 2400, metal: 0.15 },
  club: { thud: 64, click: 500, noise: 900, metal: 0.04 },
  lance: { thud: 100, click: 1300, noise: 1800, metal: 0.12 },
};
// How a guard rings when a class strikes it: blades clang, clubs and fists thud.
const GUARD_CLS = { fist: 0.25, club: 0.35, hammer: 0.4, greataxe: 0.8, greatsword: 0.85, scythe: 0.8, lance: 0.75, spear: 0.8, sword: 1, katana: 1.1, rapier: 1.2, dagger: 1.15 };

class MusicBed {
  constructor(ctx, dest, voices = 3) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1200;
    this.filter.Q.value = 0.7;
    this.filter.connect(this.gain);
    this.gain.connect(dest);
    this.drones = [];
    for (let i = 0; i < voices; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(this.filter);
      o.start();
      this.drones.push({ o, g });
    }
    this.theme = null;
  }

  apply(theme, t, tau, voices) {
    this.theme = theme;
    const ratios = theme.droneRatios || [1, 1.498, 2.003];
    const types = theme.droneTypes || ['sawtooth', 'sawtooth', 'triangle'];
    this.drones.forEach((d, i) => {
      try { d.o.type = types[i] || 'sine'; } catch (_) { /* wavetype may throw mid-cycle */ }
      d.o.frequency.setTargetAtTime((theme.root / 2) * ratios[i], t, tau);
      const on = i < voices;
      const level = on ? theme.drone * (i === 2 ? 0.55 : 1) : 0;
      d.g.gain.setTargetAtTime(level, t, tau);
    });
    this.filter.frequency.setTargetAtTime(theme.cutoff, t, tau);
  }

  fade(level, t, tau) {
    this.gain.gain.setTargetAtTime(level, t, tau);
  }
}

class CombatLayer {
  constructor(ctx, dest) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(dest);

    this.pulse = ctx.createOscillator();
    this.pulse.type = 'sine';
    this.pulse.frequency.value = 55;
    this.pulseG = ctx.createGain();
    this.pulseG.gain.value = 0.045;
    this.pulse.connect(this.pulseG);
    this.pulseG.connect(this.gain);
    this.pulse.start();

    this.growl = ctx.createOscillator();
    this.growl.type = 'sawtooth';
    this.growl.frequency.value = 55;
    this.growlF = ctx.createBiquadFilter();
    this.growlF.type = 'lowpass';
    this.growlF.frequency.value = 380;
    this.growlG = ctx.createGain();
    this.growlG.gain.value = 0;
    this.growl.connect(this.growlF);
    this.growlF.connect(this.growlG);
    this.growlG.connect(this.gain);
    this.growl.start();

    this.heat = 0;
    this.timer = 0;
  }

  setHeat(h, t, low) {
    this.heat = h;
    this.gain.gain.setTargetAtTime(h, t, 0.7);
    this.growlG.gain.setTargetAtTime(!low && h > 0.28 ? 0.028 * h : 0, t, 0.8);
    const root = 55 + h * 12;
    this.pulse.frequency.setTargetAtTime(root, t, 0.6);
    this.growl.frequency.setTargetAtTime(root, t, 0.6);
  }
}

class AmbientBed {
  constructor(ctx, dest, noise) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(dest);

    this.src = ctx.createBufferSource();
    this.src.buffer = noise;
    this.src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = 400;
    this.filter.Q.value = 0.7;
    this.src.connect(this.filter);
    this.filter.connect(this.gain);
    this.src.start();

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.1;
    this.lfoG = ctx.createGain();
    this.lfoG.gain.value = 0;
    this.lfo.connect(this.lfoG);
    this.lfoG.connect(this.filter.frequency);
    this.lfo.start();

    this.g2 = ctx.createGain();
    this.g2.gain.value = 0;
    this.g2.connect(dest);
    this.src2 = ctx.createBufferSource();
    this.src2.buffer = noise;
    this.src2.loop = true;
    this.f2 = ctx.createBiquadFilter();
    this.f2.type = 'bandpass';
    this.f2.frequency.value = 1800;
    this.f2.Q.value = 1.2;
    this.src2.connect(this.f2);
    this.f2.connect(this.g2);
    this.src2.start();
  }

  apply(preset, t, sanity, heat, low) {
    const san = clamp(sanity ?? 1, 0, 1);
    const extra = preset.sanity ? (1 - san) * 0.14 : 0;
    const duck = 1 - heat * 0.45;
    this.gain.gain.setTargetAtTime(preset.vol * duck + extra, t, 1.1);
    this.filter.frequency.setTargetAtTime(preset.f, t, 1.1);
    this.filter.Q.setTargetAtTime(preset.q, t, 1.1);
    this.lfo.frequency.setTargetAtTime(low ? 0.05 : preset.lfoRate, t, 0.8);
    this.lfoG.gain.setTargetAtTime(low ? 0 : preset.lfoDepth, t, 0.8);
    this.g2.gain.setTargetAtTime(low ? 0 : (preset.vol2 || 0) * duck, t, 1.1);
    this.f2.frequency.setTargetAtTime(preset.f2 || 1200, t, 1.1);
  }
}

// The place's own sounds, over the region's bed (game/soundscape.js tells where you stand):
// surf on the shore and at sea, wind with height, a town's murmur by day, the forest's crickets
// by night, a hearth by a fire, and calls now and then (birds, gulls, frogs, a dog, a hammer,
// a far bell). Indoors, all of it and the rain go through a muffle.
const PLACE_LAYERS = {
  surf: { type: 'lowpass', f: 520, q: 0.5, lfo: 0.11, lfoTo: 'gain', depth: 0.6, max: 0.12 },
  wind: { type: 'bandpass', f: 420, q: 0.55, lfo: 0.07, lfoTo: 'freq', depth: 180, max: 0.1 },
  town: { type: 'bandpass', f: 620, q: 1.3, lfo: 2.7, lfoTo: 'gain', depth: 0.45, max: 0.035 },
  hearth: { type: 'bandpass', f: 1700, q: 0.8, lfo: 0.9, lfoTo: 'gain', depth: 0.5, max: 0.03 },
};
class PlaceBed {
  constructor(ctx, dest, noise) {
    this.ctx = ctx;
    this.layers = {};
    for (const [k, L] of Object.entries(PLACE_LAYERS)) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.loopStart = Math.random();
      const f = ctx.createBiquadFilter();
      f.type = L.type;
      f.frequency.value = L.f;
      f.Q.value = L.q;
      const swell = ctx.createGain();
      swell.gain.value = 1;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f);
      f.connect(swell);
      swell.connect(g);
      g.connect(dest);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = L.lfo;
      const lg = ctx.createGain();
      lg.gain.value = L.depth;
      lfo.connect(lg);
      lg.connect(L.lfoTo === 'gain' ? swell.gain : f.frequency);
      src.start(0, Math.random() * 1.5);
      lfo.start();
      this.layers[k] = { g, max: L.max };
    }
    // crickets: a high tone chopped by a fast pulse
    const c = ctx.createOscillator();
    c.frequency.value = 4400;
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const pulse = ctx.createOscillator();
    pulse.type = 'square';
    pulse.frequency.value = 17;
    const pg = ctx.createGain();
    pg.gain.value = 0.5;
    pulse.connect(pg);
    pg.connect(chop.gain);
    const cg = ctx.createGain();
    cg.gain.value = 0;
    c.connect(chop);
    chop.connect(cg);
    cg.connect(dest);
    c.start();
    pulse.start();
    this.layers.crickets = { g: cg, max: 0.008 };
  }

  apply(place, t, night, low) {
    const P = place || {};
    const set = (k, v) => this.layers[k].g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * this.layers[k].max, t, 1.2);
    set('surf', P.shore || 0);
    set('wind', low ? (P.height || 0) * 0.6 : P.height || 0);
    set('town', (P.town || 0) * (night ? 0.3 : 1));
    set('hearth', P.fire || 0);
    set('crickets', low ? 0 : night && (P.green || 0) > 0 ? P.green * (1 - (P.town || 0) * 0.6) : 0);
  }
}

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.mood = 'menu';
    this.mode = 'menu';
    this.vol = { master: 0.8, sfx: 0.9, music: 0.5 };
    this.lastPlay = {};
    this.musicTimer = 0;
    this.low = false;
    this.heat = 0;
    this.heatTarget = 0;
    this.scene = { sanity: 1, night: false, combatHeat: 0 };
    this.place = {};
    this.placeT = { call: 3, town: 4, night: 20 };
    this.themeId = 'menu';
    this.pendingId = 'menu';
    this.pendingT = 0;
    this.active = 0;
    this.whisperT = 4;
    this.crackleT = 2;
    this._ambT = 0;
    this._alive = [];
  }

  static weaponCls(att) {
    if (!att) return null;
    if (att.weaponDef && att.weaponDef.cls) return att.weaponDef.cls;
    if (typeof att.weaponItemDef === 'function') {
      const d = att.weaponItemDef();
      return d && d.cls;
    }
    return null;
  }

  static resolveTheme(id) {
    if (!id) return { ...THEMES.sea, id: 'sea' };
    if (id.startsWith('boss:')) return { ...bossTheme(id.slice(5)), id };
    const [base, variant] = id.split(':');
    const t = THEMES[base] || THEMES.sea;
    if (variant === 'night' && t.night) return { ...t, ...t.night, id };
    return { ...t, id };
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(this.low ? 1.3 : 2.4, 2.5);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = this.low ? 0.14 : 0.25;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.music);
    this.musicRev = ctx.createGain();
    this.musicRev.gain.value = this.low ? 0.28 : 0.55;
    this.musicIn.connect(this.musicRev);
    this.musicRev.connect(this.reverb);

    this.beds = [new MusicBed(ctx, this.musicIn, 3), new MusicBed(ctx, this.musicIn, 3)];
    this.combat = new CombatLayer(ctx, this.musicIn);
    // what is heard of the world outside goes through a muffle, closed indoors
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 18000;
    this.muffle.connect(this.sfx);
    this.ambient = new AmbientBed(ctx, this.muffle, this.noise);
    this.placeBed = new PlaceBed(ctx, this.muffle, this.noise);

    this.ready = true;
    this.applyVolumes();
    const first = AudioSys.resolveTheme(this.themeId);
    this.beds[0].apply(first, ctx.currentTime, 0.4, this.low ? 2 : 3);
    this.beds[0].fade(1, ctx.currentTime, 0.6);
    this._applyAmbient();
  }

  // Continuous weather ambience: rain hiss and low wind, each 0..1.
  setWeather(rain = 0, wind = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    if (!this.weatherBed) {
      const mk = (type, freq, q) => {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(f);
        f.connect(g);
        g.connect(this.muffle);
        src.start();
        return g;
      };
      this.weatherBed = { rain: mk('highpass', 2400, 0.4), rainBody: mk('bandpass', 900, 0.6), wind: mk('lowpass', 380, 0.8) };
    }
    const t = ctx.currentTime;
    const b = this.weatherBed;
    b.rain.gain.setTargetAtTime(rain * 0.09, t, 0.8);
    b.rainBody.gain.setTargetAtTime(rain * 0.05, t, 0.8);
    b.wind.gain.setTargetAtTime(wind * 0.16, t, 1.2);
  }

  applyVolumes() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music, t, 0.05);
  }

  setVolumes(v) {
    Object.assign(this.vol, v);
    this.applyVolumes();
  }

  setQuality(q) {
    this.low = q === 'low';
    if (!this.ready) return;
    this.reverbSend.gain.setTargetAtTime(this.low ? 0.14 : 0.25, this.ctx.currentTime, 0.2);
    this.musicRev.gain.setTargetAtTime(this.low ? 0.28 : 0.55, this.ctx.currentTime, 0.2);
    const theme = AudioSys.resolveTheme(this.themeId);
    this.beds[this.active].apply(theme, this.ctx.currentTime, 0.4, this.low ? 2 : 3);
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _track(node, until) {
    this._alive.push({ node, until });
  }

  _sweepDead() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    let w = 0;
    for (let i = 0; i < this._alive.length; i++) {
      const e = this._alive[i];
      if (now >= e.until) {
        try { e.node.disconnect(); } catch (_) { /* already gone */ }
      } else {
        this._alive[w++] = e;
      }
    }
    this._alive.length = w;
  }

  // Legacy mood API — menu / screens still call this. Combat no longer replaces the biome bed.
  setMood(mood, force = false) {
    if (mood === 'menu') {
      this.mode = 'menu';
      this.mood = 'menu';
      this.heatTarget = 0;
      this._wantTheme('menu', true);
      return;
    }
    this.mode = 'play';
    this.mood = mood;
    if (mood === 'combat') this.heatTarget = Math.max(this.heatTarget, 0.55);
    if (mood === 'boss') this.heatTarget = 1;
    if (force) this._wantTheme(this._themeId(), true);
  }

  // Where the player stands, for the place's own sounds (game/soundscape.js): each 0..1.
  // { shore, height, town, fire, green, marsh, indoor }
  setPlace(place) {
    this.place = place || {};
  }

  setScene(s) {
    this.mode = 'play';
    Object.assign(this.scene, s);
    if (s.combatHeat != null) this.heatTarget = s.combatHeat;
    this._wantTheme(this._themeId(), false);
  }

  _themeId() {
    if (this.mode === 'menu') return 'menu';
    const s = this.scene;
    if (s.boss) return 'boss:' + s.boss;
    if (s.inRift) return 'rift';
    let base = null;
    // a region sharing a coast keeps its own music (the Ashen Spire on Thornwood's continent)
    if (s.region && THEMES[s.region]) base = s.region;
    else if (s.island && THEMES[s.island]) base = s.island;
    else if (s.biome && BIOME_THEME[s.biome]) base = BIOME_THEME[s.biome];
    else base = 'sea';
    if (base === 'rift') return base;
    return base + (s.night ? ':night' : ':day');
  }

  _wantTheme(id, immediate) {
    if (id === this.pendingId && !immediate) return;
    this.pendingId = id;
    this.pendingT = immediate || id === 'menu' || id.startsWith('boss:') ? 0 : 0.32;
    if (immediate) this._crossfade(id);
  }

  _crossfade(id) {
    if (!this.ready) {
      this.themeId = id;
      return;
    }
    if (id === this.themeId) return;
    const theme = AudioSys.resolveTheme(id);
    const next = 1 - this.active;
    const t = this.ctx.currentTime;
    const tau = id.startsWith('boss:') ? 0.7 : id === 'menu' ? 0.5 : 1.15;
    this.beds[next].apply(theme, t, tau * 0.7, this.low ? 2 : 3);
    this.beds[next].fade(1, t, tau);
    this.beds[this.active].fade(0, t, tau);
    this.active = next;
    this.themeId = id;
    this.mood = id.startsWith('boss:') ? 'boss' : id.split(':')[0];
    this.musicTimer = 0;
    this._applyAmbient();
  }

  _applyAmbient() {
    if (!this.ready) return;
    const key = this.themeId.startsWith('boss:') ? (this.scene.inRift ? 'rift' : this.scene.island || 'sea') : this.themeId.split(':')[0];
    const preset = AMBIENTS[key] || AMBIENTS.sea;
    this.ambient.apply(preset, this.ctx.currentTime, this.scene.sanity, this.heat, this.low);
  }

  _applyPlace() {
    const P = this.mode === 'play' && !this.scene.inRift ? this.place : {};
    const t = this.ctx.currentTime;
    this.placeBed.apply(P, t, this.scene.night, this.low);
    this.muffle.frequency.setTargetAtTime(P.indoor ? 650 : 18000, t, 0.35);
  }

  // A sound of the place, not placed in the world: through the muffle, a little reverb.
  _placeOut(vol) {
    const g = this.ctx.createGain();
    g.gain.value = vol;
    g.connect(this.muffle);
    g.connect(this.reverbSend);
    this._track(g, this.ctx.currentTime + 3);
    return g;
  }

  // Now and then, a call that belongs to the place.
  _placeCalls(dt) {
    const P = this.place, T = this.placeT, night = this.scene.night, t = this.ctx.currentTime;
    if (this.low || this.heat > 0.4) return;
    T.call -= dt;
    if (T.call <= 0) {
      T.call = rand(3, 8);
      if (!night && (P.green || 0) > 0.4 && Math.random() < P.green) {
        // a bird: two or three quick rising whistles
        const out = this._placeOut(0.05), f = rand(2600, 3600), n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) this._tone(out, t + i * 0.09, 0.07, { f0: f, f1: f * 1.25, a: 0.01, peak: 0.6 });
      } else if (!night && (P.shore || 0) > 0.4) {
        // a gull, falling
        const out = this._placeOut(0.04);
        for (let i = 0; i < 2; i++) this._tone(out, t + i * 0.32, 0.28, { type: 'triangle', f0: 1250, f1: 820, a: 0.02, peak: 0.6 });
      } else if ((P.marsh || 0) > 0.4) {
        // frogs, a few croaks
        const out = this._placeOut(0.05);
        for (let i = 0; i < 3; i++) this._tone(out, t + i * 0.16, 0.1, { type: 'square', f0: 150, f1: 115, a: 0.01, peak: 0.25 });
      }
    }
    if ((P.town || 0) > 0.5) {
      T.town -= dt;
      if (T.town <= 0 && !night) {
        // work in the town: a hammer on iron somewhere along the street
        T.town = rand(2.5, 6);
        const out = this._placeOut(0.025);
        for (let i = 0; i < 2; i++) this._tone(out, t + i * 0.36, 0.12, { type: 'triangle', f0: 2100, f1: 1900, peak: 0.6 });
      }
      T.night -= dt;
      if (T.night <= 0 && night) {
        T.night = rand(18, 40);
        const out = this._placeOut(0.04);
        if (Math.random() < 0.6) {
          // a dog, two barks
          for (let i = 0; i < 2; i++) {
            this._tone(out, t + i * 0.24, 0.12, { type: 'sawtooth', f0: 430, f1: 300, a: 0.01, peak: 0.5 });
            this._noise(out, t + i * 0.24, 0.1, { f0: 900, q: 2, peak: 0.3 });
          }
        } else [1, 2.0, 2.76].forEach((r, i) => this._tone(out, t, 3.2, { f0: 196 * r, peak: 0.4 / (i + 1) }));
      }
    }
  }

  update(dt) {
    if (!this.ready) return;
    this._sweepDead();

    if (this.pendingId !== this.themeId) {
      this.pendingT -= dt;
      if (this.pendingT <= 0) this._crossfade(this.pendingId);
    }

    const rise = this.heatTarget > this.heat;
    this.heat = damp(this.heat, this.heatTarget, rise ? 3.8 : 0.55, dt);
    this.combat.setHeat(this.heat, this.ctx.currentTime, this.low);
    this._ambT -= dt;
    if (this._ambT <= 0) {
      this._ambT = 0.4;
      this._applyAmbient();
      this._applyPlace();
    }
    if (this.mode === 'play' && !this.scene.inRift) this._placeCalls(dt);

    const theme = this.beds[this.active].theme || AudioSys.resolveTheme(this.themeId);
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = theme.tempo * rand(0.62, 1.35);
      const deg = choice(theme.scale);
      const oct = theme.tempo < 1 ? choice([1, 2, 2]) : choice([1, 2, 2, 4]);
      const f = theme.root * oct * Math.pow(2, deg / 12);
      this._note(f, theme);
      if (!this.low && Math.random() < (theme.fifths || 0.25)) this._note(f * 1.498, theme, 0.12);
    }

    if (!this.low && this.heat > 0.2) {
      this.combat.timer -= dt;
      if (this.combat.timer <= 0) {
        this.combat.timer = 0.46 - this.heat * 0.16;
        this._perc(this.combat.gain, this.ctx.currentTime, this.heat);
      }
    }

    if (!this.low && (this.themeId.startsWith('ashen') || this.themeId.startsWith('boss:cinder'))) {
      this.crackleT -= dt;
      if (this.crackleT <= 0) {
        this.crackleT = rand(1.6, 3.4);
        this.play('ember', { vol: 0.12, gap: 0.8 });
      }
    }

    const san = this.scene.sanity ?? 1;
    if (this.scene.inRift && san < 0.55) {
      this.whisperT -= dt;
      if (this.whisperT <= 0) {
        this.whisperT = 2.2 + san * 7;
        this.play('whisper', { vol: 0.2 + (1 - san) * 0.45, gap: 1.2 });
      }
    }
  }

  _note(freq, m, delay = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const bed = this.beds[this.active];
    const o = ctx.createOscillator();
    o.type = Math.random() < m.bright ? 'triangle' : 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    const isFast = m.tempo < 1;
    const atk = isFast ? 0.012 : 0.38;
    const dec = isFast ? 0.48 : 3.4;
    const peak = m.notePeak || (isFast ? 0.085 : 0.058);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
    o.connect(g);
    g.connect(bed.filter);
    o.start(t);
    o.stop(t + atk + dec + 0.1);
    this._track(g, t + atk + dec + 0.2);
    if (m.perc && !this.low && Math.random() < m.perc) this._perc(bed.gain, t, 0.55);
  }

  _perc(dest, t, heat) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(180 + heat * 420, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16 * heat, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 1.4, 0.12);
    this._track(g, t + 0.2);
    this._track(f, t + 0.2);
  }

  // ---- SFX helpers ----
  _out(vol, pos, life = 3.2) {
    const ctx = this.ctx;
    let v = vol;
    if (pos && G.camera) {
      const lp = G.player ? G.player.pos : G.camera.position;
      const d = Math.hypot(pos.x - lp.x, pos.y - lp.y, pos.z - lp.z);
      if (d > 70) return null;
      v *= 1 / (1 + (d / 14) * (d / 14));
    }
    const g = ctx.createGain();
    g.gain.value = v;
    g.connect(this.sfx);
    g.connect(this.reverbSend);
    this._track(g, ctx.currentTime + life);
    return g;
  }

  _noise(out, t, dur, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, a = 0.005, peak = 1 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const off = Math.random() * 1.5;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, off, dur + 0.05);
    this._track(g, t + dur + 0.15);
    this._track(f, t + dur + 0.15);
  }

  _tone(out, t, dur, { type = 'sine', f0 = 440, f1 = f0, a = 0.005, peak = 0.5 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
    this._track(g, t + dur + 0.15);
  }

  _weaponHit(out, t, cls, heavy, p) {
    const H = HIT_CLS[cls] || HIT_CLS.sword;
    const mul = heavy ? 1.38 : 1;
    this._tone(out, t, heavy ? 0.3 : 0.14, { f0: H.thud * p, f1: H.thud * 0.38 * p, peak: 0.58 * mul });
    this._noise(out, t, heavy ? 0.24 : 0.11, { type: 'lowpass', f0: H.noise * p, f1: 260, peak: 0.68 * mul });
    if (H.metal) {
      this._tone(out, t, 0.18, { type: 'triangle', f0: H.click * p, f1: H.click * 0.48, peak: H.metal * mul });
      if (heavy) this._tone(out, t, 0.36, { f0: H.click * 0.45 * p, peak: H.metal * 0.45 });
    }
    if (cls === 'hammer' || cls === 'greatsword' || cls === 'greataxe') {
      this._noise(out, t, 0.32, { type: 'lowpass', f0: 220, f1: 55, peak: 0.42 * mul });
    }
    if (cls === 'fist') {
      this._noise(out, t, 0.08, { type: 'bandpass', f0: 900 * p, q: 1.6, peak: 0.4 * mul });
    }
  }

  play(name, opts = {}) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const minGap = opts.gap ?? 0.03;
    if (this.lastPlay[name] && now - this.lastPlay[name] < minGap) return;
    this.lastPlay[name] = now;
    const out = this._out(opts.vol ?? 1, opts.pos, name === 'toll' ? 7 : 4);
    if (!out) return;
    const p = opts.pitch ?? 1;
    const t = now;
    const low = this.low;
    switch (name) {
      case 'swing':
        this._noise(out, t, 0.18, { f0: 700 * p, f1: 2600 * p, q: 1.4, a: 0.03, peak: 0.45 });
        break;
      case 'swingHeavy':
        this._noise(out, t, 0.32, { f0: 300 * p, f1: 1200 * p, q: 1.2, a: 0.06, peak: 0.6 });
        this._tone(out, t, 0.16, { f0: 90 * p, f1: 50, peak: 0.18 });
        break;
      case 'hit':
      case 'hitHeavy':
        this._weaponHit(out, t, opts.cls || 'sword', name === 'hitHeavy' || !!opts.heavy, p);
        break;
      // parry, block and guard break ring by the class of the weapon that struck the guard
      // (opts.cls): a blade clangs high, a maul or a club lands as a dull crack
      case 'parry': {
        const g = GUARD_CLS[opts.cls] ?? 1;
        const rings = low ? [1, 2.23] : [1, 1.51, 2.23, 3.1];
        rings.forEach((r, i) => this._tone(out, t, 0.72 - i * 0.12, { type: 'sine', f0: 1450 * r * p * (0.55 + 0.45 * g), peak: (0.24 / (i + 1)) * (0.5 + 0.5 * g) }));
        this._noise(out, t, 0.09, { type: 'highpass', f0: 3000, peak: 0.7 });
        this._tone(out, t, 0.1, { f0: 190 * p, f1: 70, peak: 0.38 + (1 - g) * 0.3 });
        this._tone(out, t + 0.018, 0.28, { type: 'triangle', f0: 2200 * p * g, f1: 1400 * g, peak: 0.16 * g });
        break;
      }
      case 'block': {
        const H = HIT_CLS[opts.cls] || HIT_CLS.sword;
        const g = GUARD_CLS[opts.cls] ?? 1;
        this._tone(out, t, 0.12 + (1 - g) * 0.1, { f0: (180 + 80 * g) * p, f1: 70 + 20 * g, peak: 0.5 + (1 - g) * 0.25 });
        this._noise(out, t, 0.1, { f0: (500 + 400 * g) * p, q: 2, peak: 0.45 });
        if (H.metal) this._tone(out, t, 0.16, { type: 'triangle', f0: H.click * 0.8 * p, f1: H.click * 0.5, peak: H.metal * 0.8 });
        break;
      }
      case 'guardbreak': {
        const g = GUARD_CLS[opts.cls] ?? 1;
        this._noise(out, t, 0.9, { type: 'lowpass', f0: 5000, f1: 300, peak: 0.9 });
        [1, 1.33, 1.78].forEach((r) => this._tone(out, t, 0.6, { type: 'square', f0: 330 * r * (0.7 + 0.3 * g), f1: 160 * r, peak: 0.08 }));
        this._tone(out, t, 0.5, { f0: 90, f1: 40, peak: 0.8 + (1 - g) * 0.2 });
        if (!low) this._noise(out, t, 0.22, { type: 'highpass', f0: 5000 * (0.6 + 0.4 * g), f1: 1800, peak: 0.45 });
        break;
      }
      // Telegraph cues that read without colour: a red (unparryable) blow shrieks up to a high
      // ping, an orange (unblockable) one tolls low twice. Each has its own shape too (vfx.warnMark).
      case 'warnRed':
        this._tone(out, t, 0.22, { type: 'sawtooth', f0: 900 * p, f1: 2400 * p, a: 0.02, peak: 0.12 });
        this._tone(out, t + 0.16, 0.35, { type: 'sine', f0: 3100 * p, peak: 0.22 });
        this._tone(out, t + 0.16, 0.3, { type: 'triangle', f0: 4650 * p, peak: 0.08 });
        break;
      case 'warnOrange':
        this._tone(out, t, 0.55, { type: 'sine', f0: 140 * p, f1: 120 * p, peak: 0.5 });
        this._tone(out, t, 0.5, { type: 'triangle', f0: 280 * p, peak: 0.12 });
        this._tone(out, t + 0.2, 0.6, { type: 'sine', f0: 105 * p, f1: 92 * p, peak: 0.45 });
        break;
      case 'dodge':
        this._noise(out, t, 0.25, { type: 'lowpass', f0: 600, f1: 2000, a: 0.05, peak: 0.35 });
        break;
      case 'step':
        this._foot(out, t, opts.surface || 'dirt', p);
        break;
      case 'jump':
        this._noise(out, t, 0.12, { type: 'lowpass', f0: 800, f1: 300, peak: 0.2 });
        break;
      case 'land':
        this._noise(out, t, 0.15, { type: 'lowpass', f0: 700, f1: 120, peak: 0.45 });
        this._tone(out, t, 0.12, { f0: 90, f1: 45, peak: 0.3 });
        break;
      case 'splash':
        this._noise(out, t, 0.6, { type: 'lowpass', f0: 3000, f1: 300, a: 0.01, peak: 0.5 });
        break;
      case 'swim':
        this._noise(out, t, 0.35, { type: 'bandpass', f0: 700, f1: 400, q: 0.8, a: 0.08, peak: 0.12 });
        break;
      case 'ember':
        this._noise(out, t, 0.6, { type: 'bandpass', f0: 1800, f1: 600, q: 0.7, peak: 0.6 });
        this._tone(out, t, 0.5, { type: 'sawtooth', f0: 90, f1: 60, peak: 0.12 });
        if (!low) for (let i = 0; i < 6; i++) this._noise(out, t + Math.random() * 0.4, 0.03, { type: 'highpass', f0: 4000, peak: 0.3 });
        break;
      case 'rime':
        for (let i = 0; i < (low ? 3 : 5); i++) this._tone(out, t + i * 0.04, 0.5, { f0: rand(2000, 4200) * p, peak: 0.08 });
        this._noise(out, t, 0.4, { type: 'highpass', f0: 6000, f1: 3000, peak: 0.35 });
        break;
      case 'storm':
        this._noise(out, t, 0.35, { type: 'highpass', f0: 1500, f1: 400, peak: 0.9 });
        this._tone(out, t, 0.3, { type: 'sawtooth', f0: 2400 * p, f1: 120, peak: 0.2 });
        this._tone(out, t + 0.05, 0.6, { f0: 60, f1: 30, peak: 0.6 });
        break;
      case 'gale':
        this._noise(out, t, 0.6, { type: 'bandpass', f0: 400, f1: 2400, q: 3, a: 0.1, peak: 0.6 });
        break;
      case 'umbra':
        this._tone(out, t, 0.9, { type: 'sine', f0: 140 * p, f1: 55, peak: 0.6 });
        this._noise(out, t, 0.8, { type: 'lowpass', f0: 500, f1: 100, a: 0.2, peak: 0.4 });
        break;
      case 'steel':
        [1, 2.76, 5.4].forEach((r, i) => this._tone(out, t, 0.8, { f0: 520 * r * p, peak: 0.18 / (i + 1) }));
        this._noise(out, t, 0.1, { type: 'highpass', f0: 2500, peak: 0.5 });
        break;
      case 'blood':
        this._noise(out, t, 0.35, { type: 'lowpass', f0: 700, f1: 200, q: 6, peak: 0.6 });
        this._tone(out, t, 0.3, { f0: 220, f1: 70, peak: 0.25 });
        break;
      case 'cast':
        this._tone(out, t, 0.4, { type: 'triangle', f0: 400 * p, f1: 1200 * p, peak: 0.15 });
        if (opts.el && opts.el !== 'phys') {
          const hint = { ember: 180, rime: 2400, storm: 1600, gale: 700, umbra: 90, steel: 880, blood: 140 }[opts.el];
          if (hint) this._tone(out, t, 0.28, { type: 'sine', f0: hint * p, f1: hint * 1.6 * p, peak: 0.08 });
        }
        break;
      case 'charge':
        this._tone(out, t, 0.15, { type: 'sine', f0: 300 * p, f1: 340 * p, peak: 0.06 });
        break;
      case 'levelup':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
          this._tone(out, t + i * 0.09, 1.2, { type: 'triangle', f0: f, peak: 0.18 })
        );
        break;
      case 'talent':
        [392, 523.25, 659.25, 784, 1046.5].forEach((f, i) =>
          this._tone(out, t + i * 0.07, 0.95, { type: 'triangle', f0: f, peak: 0.14 })
        );
        this._tone(out, t + 0.3, 1.1, { f0: 523.25, peak: 0.08 });
        break;
      case 'ui':
        this._tone(out, t, 0.07, { type: 'sine', f0: 900 * p, f1: 680 * p, peak: 0.13 });
        this._tone(out, t, 0.05, { type: 'triangle', f0: 1800 * p, f1: 1400 * p, peak: 0.04 });
        break;
      case 'uiOpen':
        this._tone(out, t, 0.2, { type: 'triangle', f0: 280, f1: 620, peak: 0.13 });
        this._tone(out, t + 0.04, 0.16, { type: 'sine', f0: 420, f1: 760, peak: 0.06 });
        break;
      case 'uiBack':
        this._tone(out, t, 0.1, { type: 'sine', f0: 520, f1: 300, peak: 0.1 });
        break;
      case 'coin':
        this._tone(out, t, 0.12, { f0: 1800, peak: 0.15 });
        this._tone(out, t + 0.07, 0.25, { f0: 2400, peak: 0.15 });
        break;
      case 'eat':
        for (let i = 0; i < 3; i++) this._noise(out, t + i * 0.18, 0.08, { f0: 1200, q: 2, peak: 0.3 });
        break;
      case 'drink':
        for (let i = 0; i < 3; i++) this._tone(out, t + i * 0.2, 0.1, { f0: 300, f1: 180, peak: 0.25 });
        break;
      case 'death':
        this._tone(out, t, 2.5, { f0: 110, f1: 30, peak: 0.8 });
        this._noise(out, t, 2.0, { type: 'lowpass', f0: 800, f1: 60, a: 0.2, peak: 0.5 });
        this._tone(out, t + 0.15, 2.2, { f0: 164.8, f1: 40, peak: 0.18 });
        break;
      case 'heal':
        [0, 4, 7, 12].forEach((s, i) => this._tone(out, t + i * 0.06, 0.6, { type: 'sine', f0: 600 * Math.pow(2, s / 12), peak: 0.1 }));
        break;
      case 'knock':
        this._tone(out, t, 0.34, { f0: 72, f1: 34, peak: 0.78 });
        this._noise(out, t, 0.28, { type: 'lowpass', f0: 900, f1: 90, peak: 0.55 });
        this._noise(out, t, 0.18, { type: 'highpass', f0: 1400, f1: 400, peak: 0.22 });
        break;
      case 'grip':
        this._tone(out, t, 0.42, { f0: 68, f1: 28, peak: 0.88 });
        this._noise(out, t, 0.36, { type: 'lowpass', f0: 680, f1: 70, peak: 0.72 });
        this._noise(out, t + 0.07, 0.2, { type: 'bandpass', f0: 1100, q: 2, peak: 0.42 });
        break;
      case 'roar':
        this._tone(out, t, 1.4, { type: 'sawtooth', f0: 90 * p, f1: 55 * p, a: 0.1, peak: 0.35 });
        this._tone(out, t, 1.4, { type: 'sawtooth', f0: 93 * p, f1: 52 * p, a: 0.1, peak: 0.3 });
        this._noise(out, t, 1.2, { type: 'bandpass', f0: 400 * p, f1: 200, q: 1, a: 0.1, peak: 0.6 });
        break;
      case 'screech':
        this._tone(out, t, 0.6, { type: 'sawtooth', f0: 1400 * p, f1: 700 * p, a: 0.02, peak: 0.12 });
        this._noise(out, t, 0.5, { f0: 2500 * p, q: 4, peak: 0.3 });
        break;
      case 'bell':
        [1, 2.0, 2.76, 4.1].forEach((r, i) => this._tone(out, t, 3.5, { f0: 220 * r * p, peak: 0.2 / (i + 1) }));
        break;
      case 'toll':
        // a great bell: hum, prime, minor third, fifth and nominal, the hum outlasting the rest
        [[0.5, 6, 0.28], [1, 4.5, 0.22], [1.19, 3.6, 0.12], [1.5, 3.2, 0.09], [2, 2.6, 0.08], [2.66, 1.6, 0.05]].forEach(([r, d, pk]) => this._tone(out, t, d, { f0: 110 * r * p, peak: pk }));
        this._noise(out, t, 0.08, { f0: 900 * p, q: 1.5, peak: 0.25 });
        break;
      case 'portal':
        this._tone(out, t, 1.7, { type: 'sine', f0: 160, f1: 740, a: 0.28, peak: 0.28 });
        this._tone(out, t, 1.5, { type: 'sine', f0: 80, f1: 40, a: 0.4, peak: 0.35 });
        this._noise(out, t, 1.5, { type: 'bandpass', f0: 280, f1: 2100, q: 4, a: 0.4, peak: 0.42 });
        break;
      case 'heartbeat':
        this._tone(out, t, 0.12, { f0: 60, f1: 40, peak: 0.6 });
        this._tone(out, t + 0.22, 0.12, { f0: 55, f1: 38, peak: 0.45 });
        break;
      case 'whisper':
        this._noise(out, t, 1.2, { type: 'bandpass', f0: rand(1500, 3000), f1: rand(800, 2500), q: 8, a: 0.3, peak: 0.3 });
        break;
      case 'chest':
        this._tone(out, t, 0.2, { type: 'square', f0: 200, f1: 150, peak: 0.08 });
        [784, 988, 1175].forEach((f, i) => this._tone(out, t + 0.2 + i * 0.08, 0.6, { type: 'triangle', f0: f, peak: 0.12 }));
        break;
      case 'quest':
        [392, 523.25, 659.25].forEach((f, i) => this._tone(out, t + i * 0.12, 0.9, { type: 'triangle', f0: f, peak: 0.15 }));
        break;
      case 'thunder':
        this._noise(out, t, 0.25, { type: 'highpass', f0: 2000, f1: 600, peak: 0.5 });
        this._noise(out, t + 0.05, 3.2, { type: 'lowpass', f0: 420, f1: 50, a: 0.15, peak: 1.0 });
        this._tone(out, t + 0.05, 2.6, { type: 'sine', f0: 48, f1: 26, a: 0.2, peak: 0.6 });
        for (let i = 0; i < 4; i++) this._noise(out, t + 0.3 + Math.random() * 1.6, 0.6, { type: 'lowpass', f0: 300, f1: 70, peak: 0.45 });
        break;
      case 'hiss':
        this._noise(out, t, 0.55, { type: 'highpass', f0: 3800 * p, f1: 5200 * p, a: 0.04, peak: 0.45 });
        this._noise(out, t, 0.4, { type: 'bandpass', f0: 6000 * p, q: 3, a: 0.06, peak: 0.2 });
        break;
      case 'rumble':
        this._tone(out, t, 1.6, { type: 'sawtooth', f0: 42 * p, f1: 30 * p, a: 0.3, peak: 0.45 });
        this._noise(out, t, 1.5, { type: 'lowpass', f0: 260, f1: 90, a: 0.3, peak: 0.8 });
        for (let i = 0; i < 5; i++) this._noise(out, t + 0.2 + Math.random() * 1.0, 0.12, { type: 'lowpass', f0: 600, f1: 150, peak: 0.35 });
        break;
      case 'grunt':
        this._tone(out, t, 0.35, { type: 'sawtooth', f0: 120 * p, f1: 80 * p, a: 0.03, peak: 0.3 });
        this._noise(out, t, 0.3, { type: 'bandpass', f0: 500 * p, f1: 300, q: 2, peak: 0.4 });
        break;
      case 'crowd': {
        // a swelling cheer: many detuned voices of filtered noise
        for (let i = 0; i < 7; i++) this._noise(out, t + Math.random() * 0.3, 1.8 + Math.random() * 0.6, { type: 'bandpass', f0: rand(500, 1300) * p, f1: rand(400, 900), q: 1.5, a: 0.4, peak: 0.12 });
        break;
      }
      case 'star':
        this._tone(out, t, 2.2, { type: 'sine', f0: 2400 * p, f1: 300, a: 0.2, peak: 0.12 });
        this._noise(out, t, 2.4, { type: 'bandpass', f0: 4000, f1: 400, q: 2, a: 0.6, peak: 0.35 });
        break;
      case 'reel':
        this._tone(out, t, 0.05, { type: 'square', f0: 1600 * p, peak: 0.05 });
        this._tone(out, t + 0.05, 0.05, { type: 'square', f0: 1900 * p, peak: 0.05 });
        break;
      case 'feat':
        [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => this._tone(out, t + i * 0.07, 1.4, { type: 'sine', f0: f * p, peak: 0.14 }));
        this._tone(out, t + 0.3, 1.8, { type: 'triangle', f0: 1975.5 * p, peak: 0.06 });
        break;
      default:
        this._worldSound(name, out, t, p, low);
        break;
    }
  }

  // The world's own calls (game/worldLife.js): a column's drum, a convoy's horn, a hail at a
  // checkpoint or from a cutter, the hunters' horn.
  _worldSound(name, out, t, p, low) {
    switch (name) {
      case 'lifeDrum':
        // a march: four beats, the first the heaviest, a rattle of snare on the off-beats
        for (let i = 0; i < 4; i++) {
          const at = t + i * 0.42;
          this._tone(out, at, 0.32, { f0: 82 * p, f1: 48 * p, peak: i ? 0.42 : 0.6 });
          this._noise(out, at, 0.16, { type: 'lowpass', f0: 420, f1: 120, peak: 0.35 });
          if (!low && i % 2) this._noise(out, at + 0.21, 0.09, { type: 'highpass', f0: 2400, peak: 0.16 });
        }
        break;
      case 'lifeHorn':
        // a carter's horn: a long low note and a rising second, brassy through a soft lowpass
        for (const [at, f0, f1, dur] of [[0, 196, 200, 0.9], [0.95, 196, 262, 1.1]]) {
          this._tone(out, t + at, dur, { type: 'sawtooth', f0: f0 * p, f1: f1 * p, a: 0.12, peak: 0.16 });
          this._tone(out, t + at, dur, { type: 'triangle', f0: f0 * 2 * p, f1: f1 * 2 * p, a: 0.12, peak: 0.06 });
        }
        break;
      case 'lifeHail':
        // a bosun's whistle and a shout's breath behind it
        this._tone(out, t, 0.5, { type: 'sine', f0: 1800 * p, f1: 2500 * p, a: 0.04, peak: 0.16 });
        this._tone(out, t + 0.55, 0.7, { type: 'sine', f0: 2500 * p, f1: 1700 * p, a: 0.03, peak: 0.14 });
        this._noise(out, t + 0.2, 0.6, { type: 'bandpass', f0: 700 * p, f1: 500, q: 2.5, a: 0.08, peak: 0.22 });
        break;
      case 'lifeHunt':
        // the hunters' horn: three short low blasts, far off
        for (let i = 0; i < 3; i++) this._tone(out, t + i * 0.55, i === 2 ? 0.9 : 0.4, { type: 'sawtooth', f0: 147 * p, f1: i === 2 ? 131 * p : 147 * p, a: 0.06, peak: 0.13 });
        break;
      default:
        break;
    }
  }

  _foot(out, t, surface, p) {
    switch (surface) {
      case 'sand':
        this._noise(out, t, 0.09, { type: 'lowpass', f0: 420 * p, f1: 160, peak: 0.16 });
        break;
      case 'snow':
        this._noise(out, t, 0.08, { type: 'highpass', f0: 2400 * p, f1: 900, peak: 0.14 });
        this._noise(out, t, 0.07, { type: 'bandpass', f0: 1400 * p, q: 2.2, peak: 0.1 });
        break;
      case 'ash':
        this._noise(out, t, 0.1, { type: 'lowpass', f0: 380 * p, f1: 120, peak: 0.15 });
        this._noise(out, t, 0.05, { type: 'highpass', f0: 3200, peak: 0.08 });
        break;
      case 'wet':
        this._noise(out, t, 0.12, { type: 'lowpass', f0: 1100 * p, f1: 280, peak: 0.16 });
        this._tone(out, t, 0.06, { f0: 180 * p, f1: 90, peak: 0.05 });
        break;
      case 'stone':
        this._noise(out, t, 0.05, { type: 'lowpass', f0: 900 * p, f1: 280, peak: 0.13 });
        this._tone(out, t, 0.04, { f0: 220 * p, f1: 140, peak: 0.06 });
        break;
      case 'grass':
        this._noise(out, t, 0.07, { type: 'bandpass', f0: 1600 * p, q: 1.4, peak: 0.1 });
        this._noise(out, t, 0.05, { type: 'lowpass', f0: 400 * p, f1: 180, peak: 0.08 });
        break;
      case 'rift':
        this._noise(out, t, 0.09, { type: 'bandpass', f0: 700 * p, q: 3, peak: 0.12 });
        this._tone(out, t, 0.08, { f0: 90 * p, f1: 50, peak: 0.07 });
        break;
      case 'water':
        this._noise(out, t, 0.14, { type: 'lowpass', f0: 1400 * p, f1: 300, peak: 0.14 });
        break;
      default:
        this._noise(out, t, 0.06, { type: 'lowpass', f0: 500 * p, f1: 200, peak: 0.12 });
        break;
    }
  }
}

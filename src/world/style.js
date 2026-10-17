// The visual language of Unstable. Every built thing draws its colours, surfaces and
// proportions from here, so a harbour wall, a Rift keep and a skyline monument read as
// one world in different weather.
//
//   Palettes   one family per region; the Rift's are the surface palettes
//              drowned (hue pulled toward violet / red, values lowered).
//   Surfaces   flat-shaded, rough, never mirror-metal (there is no environment map, so
//              metalness above ~0.35 renders black). Glow is reserved for light sources:
//              windows, lanterns, crystals and wounds, capped so bloom stays tasteful.
//   Scale      a 1.8 m person. Masonry courses are 0.6 m, storeys 3.6 m, steps 0.3 x 0.6,
//              parapets 1.1 m. Monuments are 3-8 storeys of the same courses, never a
//              single scaled-up block.
//   Grounding  everything stands on a footing that reaches below the lowest terrain under
//              it; debris lies at the foot of whatever it fell from.
import * as THREE from 'three';

export const SCALE = {
  person: 1.8,
  course: 0.6,
  storey: 3.6,
  step: { rise: 0.3, run: 0.6 },
  parapet: 1.1,
  merlon: { w: 1.1, h: 1.0, gap: 0.9 },
  door: { w: 1.6, h: 2.6 },
  window: { w: 0.9, h: 1.6 },
  wall: 1.2,
  buttressEvery: 6,
  footing: 1.5,
};

// Settlement styles (timber, plaster, slate). Field names are shared by every builder.
const SETTLEMENT = {
  salt: { plaster: '#e2ddcd', plaster2: '#d6d0bd', timber: '#3a2f28', roof: '#3d4f59', roof2: '#33444e', ridge: '#27353d', stone: '#c3c1b6', stone2: '#a19f95', glass: '#f4d49a', lantern: '#f2a24e', accent: '#a8423a', cloth: '#5d7a86' },
  redwake: { plaster: '#a29179', plaster2: '#938268', timber: '#33261f', roof: '#5b3b31', roof2: '#4d3129', ridge: '#35231d', stone: '#7b756a', stone2: '#615c53', glass: '#f0be7e', lantern: '#e9843a', accent: '#9a2a24', cloth: '#8b3934' },
  reed: { plaster: '#b9b18c', plaster2: '#aaa27e', timber: '#463d2e', roof: '#677846', roof2: '#5a6a3c', ridge: '#46562f', stone: '#6f7b6a', stone2: '#5a6656', glass: '#d6efbf', lantern: '#9ad8a8', accent: '#5a7a4a', cloth: '#6b8062', stilts: true },
  frost: { plaster: '#d9ddd9', plaster2: '#c9cfcc', timber: '#3d3934', roof: '#e9eef2', roof2: '#dbe3e8', ridge: '#b4c0c8', stone: '#8b959d', stone2: '#6f7981', glass: '#d6efff', lantern: '#a6d6ef', accent: '#4a6a8a', cloth: '#859cab' },
  cinder: { plaster: '#5b4f49', plaster2: '#4f453f', timber: '#4a2620', roof: '#46503a', roof2: '#3c4532', ridge: '#2a2622', stone: '#3f3937', stone2: '#2f2a28', glass: '#ffb070', lantern: '#ff8a3a', accent: '#b03a22', cloth: '#984b32' },
  root: { plaster: '#a9a181', plaster2: '#9b9374', timber: '#4a3e2a', roof: '#4f6b3f', roof2: '#435d35', ridge: '#39512d', stone: '#7f8771', stone2: '#636b57', glass: '#e7efb0', lantern: '#d8e090', accent: '#7a8a3a', cloth: '#71845b' },
  enclave: { plaster: '#8d8f91', plaster2: '#7f8183', timber: '#29292d', roof: '#34373d', roof2: '#2b2e33', ridge: '#212328', stone: '#707276', stone2: '#56585d', glass: '#ead9a6', lantern: '#e8c890', accent: '#8e1f24', cloth: '#8e1f24' },
  hush: { plaster: '#b4b9c0', plaster2: '#a5aab2', timber: '#2b2e35', roof: '#46505e', roof2: '#3c4552', ridge: '#2e3540', stone: '#6c737e', stone2: '#555c67', glass: '#d2d9ff', lantern: '#c8d0ff', accent: '#647089', cloth: '#4a5468' },
};

// Older masonry: the builders who came before the towns. Pale, weathered and mossed,
// with bronze gone to verdigris. Used for monuments, ruins, aqueducts and overlooks.
const ANCIENT = {
  ancient: { stone: '#c9c0a8', stone2: '#ada38b', edge: '#ddd5bf', dark: '#5d564b', joint: '#857c69', roof: '#4f5d5e', metal: '#6f8f7f', moss: '#66763f', earth: '#6b5a42', glow: '#f2c983', crystal: '#8fe3d0', cloth: '#7b5646' },
  ancient_fen: { stone: '#9ba08a', stone2: '#7f856f', edge: '#b7bba3', dark: '#3f463c', joint: '#646a56', roof: '#3e5148', metal: '#5f8a76', moss: '#56703a', earth: '#4f4a36', glow: '#9fe6c0', crystal: '#7fe0c0', cloth: '#5d6a4a' },
  ancient_frost: { stone: '#a9b4ba', stone2: '#8a97a0', edge: '#d3dde2', dark: '#3e4a55', joint: '#6f7c86', roof: '#e4ecf0', metal: '#7c97a3', moss: '#7d8f8a', earth: '#5d6266', glow: '#bfe8ff', crystal: '#b8ecff', cloth: '#5d7286' },
  ancient_ash: { stone: '#4a4340', stone2: '#3a3432', edge: '#6e625a', dark: '#211d1c', joint: '#2c2725', roof: '#2a2627', metal: '#8a6a4a', moss: '#4a5634', earth: '#3a2e28', glow: '#ff9a4a', crystal: '#ffb070', cloth: '#7a3a28' },
  ancient_verd: { stone: '#a7a88f', stone2: '#8b8d74', edge: '#c3c3a6', dark: '#3f4434', joint: '#6b6d57', roof: '#47613c', metal: '#6b8f6a', moss: '#4f7a36', earth: '#5a4a32', glow: '#d8f0a0', crystal: '#a8f0b0', cloth: '#5d7a3e' },
  ancient_thorn: { stone: '#a59c8a', stone2: '#8a8170', edge: '#c1b8a3', dark: '#463e35', joint: '#6e6556', roof: '#4b3d36', metal: '#7a8270', moss: '#5a6a38', earth: '#5a4632', glow: '#f0c070', crystal: '#e8d8a0', cloth: '#7a3a30' },
};

// Below. The same masonry, drowned: values down, hue toward violet. Warm amber windows
// are the complement that keeps the Rift from reading as one flat purple.
const BELOW = {
  rift: { stone: '#625a70', stone2: '#4d4659', edge: '#857a98', dark: '#2b2535', joint: '#3d3549', roof: '#3a3f58', metal: '#7b7168', moss: '#3f8f80', earth: '#3a3044', glow: '#ffc979', crystal: '#a07cff', cloth: '#4a2f5e', plaster: '#9a8f9c', timber: '#3b3040', wood: '#5a483d', wood2: '#4e3e36', water: '#7aa6ff' },
};

export const PALETTES = { ...SETTLEMENT, ...ANCIENT, ...BELOW,
  rift_city: { ...BELOW.rift, stone: '#697e7b', stone2: '#607370', edge: '#91a4a0',
    dark: '#182a2b', joint: '#425754', roof: '#3c5958', metal: '#466763', cloth: '#344e50', glow: '#c8e6cf' },
};

// Palette names used by the civic kit (architecture.js) map onto the same families so
// fortifications are built from the stone the houses stand on.
const KIT_SOURCE = { harbor: 'salt', enclave: 'enclave', redwake: 'redwake', ruin: 'ancient', reed: 'reed', frost: 'frost', cinder: 'cinder', root: 'root', drowned: 'rift' };
function kitPalette(name) {
  const p = PALETTES[KIT_SOURCE[name]];
  if (p.plaster && p.timber && !ANCIENT[KIT_SOURCE[name]] && !BELOW[KIT_SOURCE[name]]) {
    return { stone: shade(p.stone2, -0.08), edge: p.stone, dark: p.timber, metal: shade(p.stone2, -0.25), roof: p.roof, cloth: p.cloth, glow: p.glass };
  }
  return { stone: p.stone2, edge: p.edge, dark: p.dark, metal: p.metal, roof: p.roof, cloth: p.cloth, glow: p.glow };
}
export const KIT_PALETTES = Object.fromEntries(Object.keys(KIT_SOURCE).map((k) => [k, kitPalette(k)]));

// Which family a point in the world builds with.
const ISLAND_FAMILY = { saltreach: 'ancient', thornwood: 'ancient_thorn', shimmerfen: 'ancient_fen', frosthollow: 'ancient_frost', ashen_spire: 'ancient_ash', verdance: 'ancient_verd', the_hush: 'ancient_frost', meridian: 'ancient' };
export function familyFor(islandId, x = 0) {
  if (x > 3000) return 'rift';
  return ISLAND_FAMILY[islandId] || 'ancient';
}

export const MATERIAL_RULES = {
  roughness: 0.88,
  maxEmissive: 1.6,
  maxMetalness: 0.35,
  // Vertical value falloff baked into every kit element: tops catch the sky, feet sit in
  // their own contact shadow.
  gradient: 0.16,
  // Deterministic per-block value jitter so courses of one stone never look printed.
  jitter: 0.05,
};

export function shade(hex, amount) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amount)));
  return '#' + c.getHexString();
}

const cache = new Map();
// The one material factory. Keeps the old mat() options; enforces the surface rules.
export function surface(color, o = {}) {
  const key = color + '|' + JSON.stringify(o);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: o.smooth ? false : true,
      roughness: o.roughness ?? MATERIAL_RULES.roughness,
      metalness: Math.min(o.metalness ?? 0, MATERIAL_RULES.maxMetalness),
      emissive: o.emissive ?? '#000000',
      emissiveIntensity: Math.min(o.ei ?? 1, MATERIAL_RULES.maxEmissive),
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: o.depthWrite ?? true,
    });
    cache.set(key, m);
  }
  return m;
}

// Shared batched materials for kit-built geometry (vertex colours). One draw per cell
// per layer once world/merge.js folds them together.
export const KIT_MATERIALS = {
  solid: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.3 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  crystal: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.3, metalness: 0, emissive: '#ffffff', emissiveIntensity: 0.55 }),
};
KIT_MATERIALS.crystal.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;',
  );
};
KIT_MATERIALS.crystal.customProgramCacheKey = () => 'kit-crystal';
for (const [k, m] of Object.entries(KIT_MATERIALS)) m.name = 'kit_' + k;

// Lights: warm sources on the surface and in the Rift share one colour language.
export const LIGHT_COLORS = {
  hearth: '#ffb567',
  lantern: '#ffc98a',
  window: '#ffd59a',
  wound: '#bfe9ff',
  riftWindow: '#ffc979',
  riftCrystal: '#a07cff',
  riftSea: '#8fb4ff',
};

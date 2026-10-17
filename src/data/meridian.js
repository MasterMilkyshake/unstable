// Authored in regional coordinates; world placement translates the entire bastion.
export const MERIDIAN_HEIGHT = 46;
export const MERIDIAN_LOWER_HEIGHT = 16;
export const MERIDIAN_SHELVES = [
  { name: 'Meridian supply terrace', x: 692, z: -574, rx: 38, rz: 41, h: MERIDIAN_LOWER_HEIGHT, roadCuts: true,
    outline: [[655, -611], [693, -614], [722, -602], [728, -572], [726, -546],
      [707, -536], [677, -540], [657, -561]] },
  { name: 'Meridian Bastion Rock', x: 792, z: -576, rx: 70, rz: 94, h: MERIDIAN_HEIGHT, roadCuts: true,
    outline: [[733, -650], [748, -658], [770, -654], [784, -668], [812, -660],
      [828, -647], [846, -634], [852, -605], [858, -584], [853, -565],
      [856, -540], [848, -522], [847, -499], [822, -487], [788, -492],
      [764, -487], [742, -496], [730, -514], [732, -540], [730, -565],
      [733, -598], [727, -627]] },
];
export const MERIDIAN_LIFT = { x: 724, z: -556, y0: MERIDIAN_LOWER_HEIGHT, y1: MERIDIAN_HEIGHT };
export const MERIDIAN_BRIDGE = { x: 921, z: -660, width: 46, depth: 6, deck: 46.2 };
export const MERIDIAN_STRUCTURES = [
  { type: 'warehouse', name: 'Meridian Ordnance Store', x: 685, z: -588, rot: Math.PI / 2, w: 18, d: 10, style: 'enclave' },
  { type: 'warehouse', name: 'Crown Supply House', x: 710, z: -593, rot: 0, w: 15, d: 10, style: 'enclave' },
  { type: 'house', name: "Hoistmaster's House", x: 678, z: -550, rot: Math.PI / 2, w: 10, d: 8, style: 'enclave', low: true, noAnnex: true },
  { type: 'crates', x: 705, z: -578 }, { type: 'crates', x: 711, z: -569 },
  { type: 'crane', style: 'enclave', x: 699, z: -607, rot: Math.PI / 2 },
  { type: 'banner_pole', style: 'enclave', x: 716, z: -549, h: 9 },
];

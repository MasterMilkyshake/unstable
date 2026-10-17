// Animation library for the procedural humanoid rig.
// Joint rotations are Euler [x, y, z] (order XYZ). Character faces +Z, its
// right side is -X. Arms hang along -Y: rot.x < 0 swings an arm forward,
// rot.z < 0 raises the right arm sideways (> 0 for the left arm).
// Scalars: bodyY (hip height offset), bodyPitch/bodyYaw/bodyRoll (whole body).

export const JOINTS = ['spine', 'chest', 'head', 'lShoulder', 'lElbow', 'lHand', 'rShoulder', 'rElbow', 'rHand', 'lHip', 'lKnee', 'rHip', 'rKnee'];
export const SCALARS = ['bodyY', 'bodyPitch', 'bodyYaw', 'bodyRoll'];

export function mirror(pose) {
  const out = {};
  for (const k in pose) {
    const v = pose[k];
    let nk = k;
    if (k[0] === 'l' && k[1] === k[1].toUpperCase()) nk = 'r' + k.slice(1);
    else if (k[0] === 'r' && k[1] === k[1].toUpperCase()) nk = 'l' + k.slice(1);
    if (Array.isArray(v)) out[nk] = [v[0], -v[1], -v[2]];
    else if (k === 'bodyYaw' || k === 'bodyRoll') out[nk] = -v;
    else out[nk] = v;
  }
  return out;
}

// ---------------------------------------------------------------- stances
export const STANCES = {
  none: {
    lShoulder: [0.05, 0, 0.1], rShoulder: [0.05, 0, -0.1], lElbow: [-0.15, 0, 0], rElbow: [-0.15, 0, 0],
  },
  oneHand: {
    rShoulder: [-0.35, 0, -0.14], rElbow: [-0.8, 0, 0], rHand: [0.6, 0, 0],
    lShoulder: [0.1, 0, 0.18], lElbow: [-0.3, 0, 0],
  },
  twoHand: {
    rShoulder: [-0.45, 0.35, -0.12], rElbow: [-0.9, 0, 0], rHand: [0.55, 0, 0],
    lShoulder: [-0.65, -0.55, 0.22], lElbow: [-1.1, 0, 0], spine: [0.05, -0.15, 0],
  },
  spear: {
    rShoulder: [-0.2, 0.05, -0.15], rElbow: [-1.2, 0, 0], rHand: [1.0, 0, 0],
    lShoulder: [-0.95, -0.45, 0.2], lElbow: [-0.55, 0, 0], spine: [0.05, -0.2, 0],
  },
  fist: {
    rShoulder: [-0.75, 0.25, -0.28], rElbow: [-1.95, 0, 0], lShoulder: [-0.85, -0.25, 0.28], lElbow: [-1.95, 0, 0],
    spine: [0.08, -0.1, 0],
  },
};

export const STANCE_FOR_CLASS = {
  fist: 'fist', dagger: 'oneHand', sword: 'oneHand', rapier: 'oneHand', katana: 'oneHand',
  spear: 'spear', greatsword: 'twoHand', greataxe: 'twoHand', hammer: 'twoHand',
  scythe: 'twoHand', club: 'oneHand', lance: 'spear',
};

// ---------------------------------------------------------------- static poses
export const POSES = {
  block_weapon: {
    rShoulder: [-1.05, 0.55, -0.35], rElbow: [-1.05, 0, 0], rHand: [1.15, 0, 0.9],
    lShoulder: [-1.0, -0.5, 0.35], lElbow: [-1.2, 0, 0], spine: [0.08, 0, 0], head: [0.05, 0, 0],
  },
  block_fist: {
    rShoulder: [-1.25, 0.3, -0.3], rElbow: [-2.2, 0, 0], lShoulder: [-1.25, -0.3, 0.3], lElbow: [-2.2, 0, 0],
    spine: [0.18, 0, 0], head: [0.15, 0, 0],
  },
  block_heavy: {
    rShoulder: [-1.1, 0.7, -0.3], rElbow: [-0.9, 0, 0], rHand: [1.3, 0, 1.2],
    lShoulder: [-1.1, -0.6, 0.3], lElbow: [-1.0, 0, 0], spine: [0.1, 0, 0],
  },
  charge: {
    rShoulder: [-0.5, 0, -0.75], lShoulder: [-0.5, 0, 0.75], rElbow: [-0.9, 0, 0], lElbow: [-0.9, 0, 0],
    spine: [0.1, 0, 0], head: [-0.15, 0, 0], bodyY: -0.08,
  },
  stunned: {
    spine: [-0.35, 0.2, 0.12], head: [-0.4, 0.1, 0], rShoulder: [0.3, 0, -0.7], lShoulder: [0.2, 0, 0.8],
    rElbow: [-0.3, 0, 0], lElbow: [-0.4, 0, 0], bodyY: -0.06,
  },
  knocked: {
    bodyPitch: -1.45, bodyY: -0.72, spine: [0.1, 0, 0], head: [0.4, 0.4, 0],
    rShoulder: [-0.3, 0, -1.1], lShoulder: [-0.3, 0, 1.2], rElbow: [-0.3, 0, 0], lElbow: [-0.5, 0, 0],
    lHip: [-0.1, 0, 0.15], rHip: [-0.3, 0, -0.1], lKnee: [0.4, 0, 0], rKnee: [0.8, 0, 0],
  },
  dead: {
    bodyPitch: -1.55, bodyY: -0.8, head: [0.2, 0.6, 0], rShoulder: [-0.1, 0, -1.4], lShoulder: [-0.1, 0, 1.4],
    lHip: [0, 0, 0.2], rHip: [0, 0, -0.2], lKnee: [0.1, 0, 0], rKnee: [0.1, 0, 0],
  },
  slide: {
    bodyY: -0.55, spine: [-0.55, 0, 0], head: [0.4, 0, 0], lHip: [-1.35, 0, 0.1], rHip: [-1.05, 0, -0.1],
    lKnee: [0.25, 0, 0], rKnee: [0.6, 0, 0], rShoulder: [0.5, 0, -0.5], lShoulder: [0.4, 0, 0.6],
  },
  fall: {
    rShoulder: [-0.4, 0, -1.0], lShoulder: [-0.4, 0, 1.0], rElbow: [-0.4, 0, 0], lElbow: [-0.4, 0, 0],
    lHip: [-0.5, 0, 0], rHip: [0.2, 0, 0], lKnee: [0.9, 0, 0], rKnee: [0.5, 0, 0],
  },
  jump: {
    rShoulder: [-0.9, 0, -0.5], lShoulder: [0.4, 0, 0.5], lHip: [-0.9, 0, 0], rHip: [0.1, 0, 0], lKnee: [1.3, 0, 0], rKnee: [0.6, 0, 0],
  },
  // the leap off a ledge: both arms reaching up for the edge above, the legs drawn up
  leap: {
    rShoulder: [-2.75, 0, -0.3], lShoulder: [-2.75, 0, 0.3], rElbow: [-0.3, 0, 0], lElbow: [-0.3, 0, 0], spine: [-0.15, 0, 0], head: [-0.3, 0, 0],
    lHip: [-1.05, 0, 0], rHip: [-0.55, 0, 0], lKnee: [1.45, 0, 0], rKnee: [1.0, 0, 0],
  },
  sit: {
    bodyY: -0.52, lHip: [-1.5, 0, 0.2], rHip: [-1.5, 0, -0.2], lKnee: [1.6, 0, 0], rKnee: [1.6, 0, 0],
    rShoulder: [-0.6, 0, -0.1], lShoulder: [-0.6, 0, 0.1], rElbow: [-0.6, 0, 0], lElbow: [-0.6, 0, 0], spine: [0.15, 0, 0],
  },
  eat: { rShoulder: [-1.2, 0.5, -0.3], rElbow: [-2.2, 0, 0], head: [0.1, 0, 0] },
  carry_box: { rShoulder: [-0.9, 0, -0.2], lShoulder: [-0.9, 0, 0.2], rElbow: [-0.6, 0, 0], lElbow: [-0.6, 0, 0] },
};

// ---------------------------------------------------------------- 3-phase attacks
// Each has wind (end of windup), optional mid (middle of active) and strike (end of active).
const slashR = {
  wind: { rShoulder: [0, -0.7, -1.25], rElbow: [-0.7, 0, 0], rHand: [1.25, 0, 0], spine: [0.05, -0.55, 0], lShoulder: [0, 0, 0.5] },
  mid: { rShoulder: [0, 1.5, -1.42], rElbow: [-0.15, 0, 0], rHand: [1.45, 0, 0], spine: [0.1, 0.05, 0] },
  strike: { rShoulder: [0, 2.45, -1.2], rElbow: [-0.35, 0, 0], rHand: [1.35, 0, 0], spine: [0.1, 0.5, 0], lShoulder: [0.3, 0, 0.6] },
};
const slashL = {
  wind: { rShoulder: [0, 2.4, -1.15], rElbow: [-0.9, 0, 0], rHand: [1.25, 0, 0], spine: [0.05, 0.55, 0] },
  mid: { rShoulder: [0, 1.5, -1.42], rElbow: [-0.15, 0, 0], rHand: [1.45, 0, 0], spine: [0.1, 0, 0] },
  strike: { rShoulder: [0, -0.45, -1.3], rElbow: [-0.3, 0, 0], rHand: [1.35, 0, 0], spine: [0.1, -0.5, 0], lShoulder: [0.2, 0, 0.5] },
};
const slashDown = {
  wind: { rShoulder: [-2.85, 0, -0.25], rElbow: [-0.7, 0, 0], rHand: [0.9, 0, 0], spine: [-0.2, -0.15, 0], lShoulder: [-0.4, 0, 0.5] },
  mid: { rShoulder: [-1.6, 0, -0.18], rElbow: [-0.1, 0, 0], rHand: [1.35, 0, 0], spine: [0.15, 0, 0] },
  strike: { rShoulder: [-0.45, 0, -0.12], rElbow: [-0.1, 0, 0], rHand: [1.45, 0, 0], spine: [0.45, 0.05, 0], bodyY: -0.1, lShoulder: [0.3, 0, 0.4] },
};
const slashUp = {
  wind: { rShoulder: [0.35, -0.2, -0.35], rElbow: [-0.2, 0, 0], rHand: [1.4, 0, 0], spine: [0.35, -0.3, 0], bodyY: -0.12 },
  mid: { rShoulder: [-1.4, 0.1, -0.3], rElbow: [-0.1, 0, 0], rHand: [1.3, 0, 0], spine: [0.1, 0, 0] },
  strike: { rShoulder: [-2.6, 0.2, -0.35], rElbow: [-0.3, 0, 0], rHand: [1.1, 0, 0], spine: [-0.2, 0.15, 0] },
};
const thrust = {
  wind: { rShoulder: [0.5, 0, -0.35], rElbow: [-1.7, 0, 0], rHand: [1.2, 0, 0], spine: [0, -0.35, 0], lShoulder: [-0.6, 0, 0.3] },
  strike: { rShoulder: [-1.45, 0.05, -0.08], rElbow: [-0.05, 0, 0], rHand: [1.5, 0, 0], spine: [0.2, 0.3, 0], lShoulder: [0.4, 0, 0.4], lHip: [-0.4, 0, 0], lKnee: [0.4, 0, 0] },
};
const jabR = {
  wind: { rShoulder: [-0.5, 0.2, -0.3], rElbow: [-2.0, 0, 0], spine: [0, -0.25, 0] },
  strike: { rShoulder: [-1.5, 0.15, -0.08], rElbow: [-0.08, 0, 0], spine: [0.1, 0.35, 0], lShoulder: [-0.9, -0.2, 0.3], lElbow: [-2.0, 0, 0] },
};
const hookR = {
  wind: { rShoulder: [0, -0.35, -1.35], rElbow: [-1.6, 0, 0], spine: [0, -0.5, 0] },
  mid: { rShoulder: [0, 0.6, -1.4], rElbow: [-1.5, 0, 0], spine: [0.05, 0.1, 0] },
  strike: { rShoulder: [0, 1.15, -1.35], rElbow: [-1.4, 0, 0], spine: [0.1, 0.55, 0], lShoulder: [-0.9, -0.2, 0.3], lElbow: [-2.0, 0, 0] },
};
const kickR = {
  wind: { rHip: [0.35, 0, 0], rKnee: [1.7, 0, 0], spine: [-0.15, 0, 0], rShoulder: [-0.6, 0, -0.5], lShoulder: [-0.6, 0, 0.5], rElbow: [-1.6, 0, 0], lElbow: [-1.6, 0, 0] },
  strike: { rHip: [-1.55, 0, -0.1], rKnee: [0.1, 0, 0], lKnee: [0.25, 0, 0], spine: [-0.35, 0, 0], rShoulder: [-0.3, 0, -0.7], lShoulder: [-0.3, 0, 0.7], rElbow: [-1.4, 0, 0], lElbow: [-1.4, 0, 0] },
};
const heavyR = {
  wind: { rShoulder: [0, -0.95, -1.2], lShoulder: [0, 2.19, 1.2], rElbow: [-0.5, 0, 0], lElbow: [-0.5, 0, 0], rHand: [1.3, 0, 0], spine: [0.05, -0.75, 0], bodyY: -0.08 },
  mid: { rShoulder: [0, 1.55, -1.38], lShoulder: [0, 4.69, 1.38], rElbow: [-0.1, 0, 0], lElbow: [-0.1, 0, 0], rHand: [1.45, 0, 0], spine: [0.15, 0, 0] },
  strike: { rShoulder: [0, 2.6, -1.2], lShoulder: [0, 5.74, 1.2], rElbow: [-0.4, 0, 0], lElbow: [-0.4, 0, 0], rHand: [1.35, 0, 0], spine: [0.15, 0.7, 0], bodyY: -0.08 },
};
const heavyL = {
  wind: { rShoulder: [0, 2.55, -1.15], lShoulder: [0, 5.69, 1.15], rElbow: [-0.6, 0, 0], lElbow: [-0.6, 0, 0], rHand: [1.3, 0, 0], spine: [0.05, 0.7, 0], bodyY: -0.08 },
  mid: { rShoulder: [0, 1.55, -1.38], lShoulder: [0, 4.69, 1.38], rElbow: [-0.1, 0, 0], lElbow: [-0.1, 0, 0], rHand: [1.45, 0, 0], spine: [0.15, 0, 0] },
  strike: { rShoulder: [0, -0.9, -1.25], lShoulder: [0, 2.24, 1.25], rElbow: [-0.4, 0, 0], lElbow: [-0.4, 0, 0], rHand: [1.35, 0, 0], spine: [0.15, -0.7, 0], bodyY: -0.08 },
};
const heavyDown = {
  wind: { rShoulder: [-2.95, 0, -0.32], lShoulder: [-2.95, 0, 0.32], rElbow: [-0.5, 0, 0], lElbow: [-0.5, 0, 0], rHand: [0.8, 0, 0], spine: [-0.3, 0, 0] },
  mid: { rShoulder: [-1.6, 0, -0.2], lShoulder: [-1.6, 0, 0.2], rElbow: [-0.1, 0, 0], lElbow: [-0.1, 0, 0], rHand: [1.3, 0, 0], spine: [0.2, 0, 0] },
  strike: { rShoulder: [-0.5, 0, -0.15], lShoulder: [-0.5, 0, 0.15], rElbow: [-0.1, 0, 0], lElbow: [-0.1, 0, 0], rHand: [1.45, 0, 0], spine: [0.55, 0, 0], bodyY: -0.2, lHip: [-0.5, 0, 0], lKnee: [0.6, 0, 0], rHip: [0.3, 0, 0], rKnee: [0.4, 0, 0] },
};
const uppercut = {
  wind: { rShoulder: [0.45, 0, -0.3], rElbow: [-1.9, 0, 0], spine: [0.45, -0.35, 0], bodyY: -0.25, lHip: [-0.5, 0, 0], rHip: [-0.4, 0, 0], lKnee: [0.8, 0, 0], rKnee: [0.8, 0, 0] },
  strike: { rShoulder: [-2.7, 0.1, -0.2], rElbow: [-0.6, 0, 0], spine: [-0.25, 0.25, 0], bodyY: 0.08, lShoulder: [0.3, 0, 0.5] },
};
const lunge = {
  wind: { rShoulder: [0.6, 0, -0.3], rElbow: [-1.6, 0, 0], rHand: [1.0, 0, 0], spine: [0.1, -0.5, 0], bodyY: -0.25, lHip: [-0.7, 0, 0], lKnee: [1.0, 0, 0], rHip: [0.2, 0, 0], rKnee: [0.6, 0, 0] },
  strike: { rShoulder: [-1.55, 0, -0.06], rElbow: [-0.02, 0, 0], rHand: [1.55, 0, 0], spine: [0.45, 0.3, 0], bodyY: -0.3, lHip: [-1.0, 0, 0], lKnee: [0.6, 0, 0], rHip: [0.7, 0, 0], rKnee: [0.1, 0, 0], lShoulder: [0.6, 0, 0.3] },
};
const iaido = {
  wind: { rShoulder: [-0.35, 1.9, -0.55], rElbow: [-1.3, 0, 0], rHand: [0.5, 0, 0], lShoulder: [-0.3, 0.5, 0.2], lElbow: [-1.2, 0, 0], spine: [0.25, 0.65, 0], bodyY: -0.32, lHip: [-0.6, 0, 0], lKnee: [0.9, 0, 0], rHip: [0.3, 0, 0], rKnee: [0.7, 0, 0] },
  mid: { rShoulder: [0, 1.0, -1.4], rElbow: [-0.1, 0, 0], rHand: [1.45, 0, 0], spine: [0.2, 0.1, 0], bodyY: -0.3 },
  strike: { rShoulder: [0, -0.7, -1.35], rElbow: [-0.1, 0, 0], rHand: [1.45, 0, 0], spine: [0.15, -0.65, 0], bodyY: -0.28, lShoulder: [0.3, 0, 0.7] },
};
const spinSlash = {
  wind: { rShoulder: [0, -0.9, -1.3], rElbow: [-0.6, 0, 0], rHand: [1.3, 0, 0], spine: [0.1, -0.6, 0], bodyY: -0.2, bodyYaw: 0.4 },
  mid: { rShoulder: [0, 0, -1.48], rElbow: [0, 0, 0], rHand: [1.5, 0, 0], spine: [0.1, 0, 0], bodyY: -0.15, bodyYaw: -2.9 },
  strike: { rShoulder: [0, 0, -1.48], rElbow: [0, 0, 0], rHand: [1.5, 0, 0], spine: [0.1, 0, 0], bodyY: -0.1, bodyYaw: -6.28 },
};
const whirlwind = {
  wind: { rShoulder: [0, -0.4, -1.3], lShoulder: [0, 2.74, 1.3], rElbow: [-0.3, 0, 0], lElbow: [-0.3, 0, 0], rHand: [1.4, 0, 0], spine: [0.1, -0.5, 0], bodyY: -0.15, bodyYaw: 0.5 },
  mid: { rShoulder: [0, 0, -1.45], lShoulder: [0, 3.14, 1.45], rElbow: [0, 0, 0], lElbow: [0, 0, 0], rHand: [1.5, 0, 0], spine: [0.1, 0, 0], bodyY: -0.1, bodyYaw: -6.28 },
  strike: { rShoulder: [0, 0, -1.45], lShoulder: [0, 3.14, 1.45], rElbow: [0, 0, 0], lElbow: [0, 0, 0], rHand: [1.5, 0, 0], spine: [0.1, 0, 0], bodyY: -0.1, bodyYaw: -12.57 },
};
const heavySlam = {
  wind: { rShoulder: [-3.05, 0, -0.3], lShoulder: [-3.05, 0, 0.3], rElbow: [-0.6, 0, 0], lElbow: [-0.6, 0, 0], rHand: [0.7, 0, 0], spine: [-0.35, 0, 0], bodyY: 0.05 },
  mid: { rShoulder: [-1.5, 0, -0.2], lShoulder: [-1.5, 0, 0.2], rHand: [1.3, 0, 0], spine: [0.3, 0, 0] },
  strike: { rShoulder: [-0.25, 0, -0.12], lShoulder: [-0.25, 0, 0.12], rElbow: [0, 0, 0], lElbow: [0, 0, 0], rHand: [1.5, 0, 0], spine: [0.75, 0, 0], bodyY: -0.38, lHip: [-0.8, 0, 0], lKnee: [1.0, 0, 0], rHip: [0.2, 0, 0], rKnee: [0.9, 0, 0] },
};
const castPush = {
  wind: { rShoulder: [0.3, 0, -0.35], rElbow: [-1.6, 0, 0], lShoulder: [0.3, 0, 0.35], lElbow: [-1.6, 0, 0], spine: [0, -0.3, 0] },
  strike: { rShoulder: [-1.5, 0.15, -0.1], rElbow: [-0.05, 0, 0], lShoulder: [-1.4, -0.25, 0.15], lElbow: [-0.2, 0, 0], spine: [0.15, 0.25, 0] },
};
const castRaise = {
  wind: { rShoulder: [-0.3, 0, -0.5], lShoulder: [-0.3, 0, 0.5], rElbow: [-1.2, 0, 0], lElbow: [-1.2, 0, 0], spine: [0.25, 0, 0], bodyY: -0.12 },
  strike: { rShoulder: [-2.85, 0, -0.45], lShoulder: [-2.85, 0, 0.45], rElbow: [-0.1, 0, 0], lElbow: [-0.1, 0, 0], spine: [-0.2, 0, 0], head: [-0.3, 0, 0] },
};
const castSlam = {
  wind: { rShoulder: [-2.9, 0, -0.4], lShoulder: [-2.9, 0, 0.4], rElbow: [-0.5, 0, 0], lElbow: [-0.5, 0, 0], spine: [-0.2, 0, 0], bodyY: 0.05 },
  strike: { rShoulder: [-0.4, 0, -0.5], lShoulder: [-0.4, 0, 0.5], rElbow: [-0.1, 0, 0], lElbow: [-0.1, 0, 0], spine: [0.7, 0, 0], bodyY: -0.42, lHip: [-0.9, 0, 0], lKnee: [1.2, 0, 0], rHip: [0.1, 0, 0], rKnee: [1.1, 0, 0] },
};
const castGrab = {
  wind: { rShoulder: [0.3, 0, -0.4], rElbow: [-1.4, 0, 0], spine: [0.1, -0.35, 0], bodyY: -0.1 },
  strike: { rShoulder: [-1.55, 0.25, -0.25], rElbow: [-0.1, 0, 0], lShoulder: [-1.3, -0.3, 0.3], lElbow: [-0.3, 0, 0], spine: [0.35, 0.2, 0], bodyY: -0.15 },
};
const castClap = {
  wind: { rShoulder: [0, -0.3, -1.5], lShoulder: [0, 0.3, 1.5], rElbow: [-0.2, 0, 0], lElbow: [-0.2, 0, 0], spine: [-0.1, 0, 0] },
  strike: { rShoulder: [0, 1.48, -1.45], lShoulder: [0, -1.48, 1.45], rElbow: [-0.1, 0, 0], lElbow: [-0.1, 0, 0], spine: [0.15, 0, 0] },
};
const castThrow = {
  wind: { rShoulder: [-2.6, -0.2, -0.5], rElbow: [-1.3, 0, 0], spine: [-0.15, -0.45, 0], lShoulder: [-1.2, 0, 0.3] },
  strike: { rShoulder: [-0.9, 0.3, -0.2], rElbow: [-0.05, 0, 0], spine: [0.3, 0.35, 0], lShoulder: [0.3, 0, 0.4] },
};
const bash = {
  wind: { spine: [0.35, 0.9, 0], lShoulder: [-0.3, 0, 0.3], lElbow: [-1.8, 0, 0], rShoulder: [0.2, 0, -0.3], rElbow: [-1.0, 0, 0], bodyY: -0.15 },
  strike: { spine: [0.45, 0.9, 0], lShoulder: [-0.5, 0, 0.6], lElbow: [-1.9, 0, 0], rShoulder: [0.3, 0, -0.4], rElbow: [-1.0, 0, 0], bodyY: -0.2, lHip: [-0.7, 0, 0], rHip: [0.5, 0, 0], lKnee: [0.6, 0, 0] },
};
const heelDrop = {
  wind: { rHip: [-2.5, 0, -0.1], rKnee: [0.1, 0, 0], spine: [-0.35, 0, 0], bodyY: 0.15, rShoulder: [-0.4, 0, -0.9], lShoulder: [-0.4, 0, 0.9] },
  strike: { rHip: [-0.4, 0, 0], rKnee: [0.2, 0, 0], spine: [0.45, 0, 0], bodyY: -0.15, rShoulder: [0.2, 0, -0.6], lShoulder: [0.2, 0, 0.6] },
};
const grip = {
  wind: { rShoulder: [-2.9, 0, -0.3], lShoulder: [-2.9, 0, 0.3], rElbow: [-0.6, 0, 0], lElbow: [-0.6, 0, 0], rHand: [0.9, 0, 0], spine: [-0.2, 0, 0] },
  strike: { rShoulder: [-0.2, 0, -0.1], lShoulder: [-0.2, 0, 0.1], rHand: [1.5, 0, 0], spine: [0.8, 0, 0], bodyY: -0.45, lHip: [-1.0, 0, 0], lKnee: [1.4, 0, 0], rHip: [0.2, 0, 0], rKnee: [1.4, 0, 0] },
};
const parry = {
  wind: { rShoulder: [-1.25, 0.9, -0.4], rElbow: [-0.8, 0, 0], rHand: [1.1, 0, 1.1], spine: [0.05, 0.3, 0] },
  strike: { rShoulder: [-1.1, 0.2, -0.45], rElbow: [-0.9, 0, 0], rHand: [1.2, 0, 1.0], spine: [0.05, -0.2, 0] },
};
const bite = {
  wind: { spine: [-0.3, 0, 0], head: [-0.3, 0, 0] },
  strike: { spine: [0.4, 0, 0], head: [0.3, 0, 0] },
};

// Reactions to what a blow did (Actor.reactAnim). Only the keys they move are touched, so a
// guard held in the block pose keeps its arms while the body rocks back.
const blockRecoil = {
  wind: { spine: [-0.32, 0, 0], head: [-0.22, 0, 0], bodyY: -0.06 },
  strike: { spine: [-0.12, 0, 0], head: [-0.06, 0, 0] },
};
const deflected = {
  wind: { rShoulder: [-2.65, 0.65, -0.65], rElbow: [-0.35, 0, 0], rHand: [0.4, 0, 0], spine: [-0.38, 0.32, 0], head: [-0.25, 0, 0], bodyY: -0.04 },
  strike: { rShoulder: [-2.25, 0.85, -0.85], rElbow: [-0.5, 0, 0], spine: [-0.26, 0.42, 0], head: [-0.15, 0, 0] },
};
const guardBroken = {
  wind: { rShoulder: [-0.25, 0, -1.35], lShoulder: [-0.25, 0, 1.35], rElbow: [-0.3, 0, 0], lElbow: [-0.3, 0, 0], spine: [-0.5, 0, 0], head: [-0.35, 0, 0], bodyY: -0.14, lKnee: [0.5, 0, 0], rKnee: [0.4, 0, 0] },
  strike: { rShoulder: [0.1, 0, -1.0], lShoulder: [0.1, 0, 1.0], rElbow: [-0.5, 0, 0], lElbow: [-0.5, 0, 0], spine: [-0.32, 0, 0], head: [-0.2, 0, 0], bodyY: -0.1, lKnee: [0.35, 0, 0], rKnee: [0.3, 0, 0] },
};

// Air-string cuts: the arm work of a slash with the legs tucked under (the chase after an uppercut).
const TUCK = { lHip: [-1.15, 0, 0.12], rHip: [-0.75, 0, -0.12], lKnee: [1.55, 0, 0], rKnee: [1.25, 0, 0] };
const tucked = (atk) => ({ wind: { ...atk.wind, ...TUCK }, mid: atk.mid && { ...atk.mid, ...TUCK }, strike: { ...atk.strike, ...TUCK } });
const airSlam = {
  wind: { ...heavySlam.wind, ...TUCK, bodyPitch: -0.35 },
  mid: { ...heavySlam.mid, bodyPitch: 0.2 },
  strike: { ...heavySlam.strike, bodyPitch: 0.35, bodyY: -0.2 },
};

export const ATTACKS = {
  slashR, slashL, slashDown, slashUp, thrust, sweepR: slashR, stabR: thrust,
  jabR, jabL: { wind: mirror(jabR.wind), strike: mirror(jabR.strike) },
  hookR, kickR, heavyR, heavyL, heavyDown, uppercut, lunge, impale: lunge, iaido, spinSlash, whirlwind,
  heavySlam, runSlash: slashR, aerialSlam: slashDown,
  castPush, castRaise, castSlam, castGrab, castClap, castThrow, castSlash: slashR,
  bash, heelDrop, grip, parry, bite,
  airSlashR: tucked(slashR), airSlashL: tucked(slashL), airSlam, blockRecoil, deflected, guardBroken,
  flurry: {
    wind: thrust.wind,
    keysActive: [thrust.strike, thrust.wind, slashR.strike, thrust.wind, thrust.strike, slashL.wind, thrust.strike],
    strike: thrust.strike,
  },
};

import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Math.hypot(a, b) to the bit, computed as V8 computes it but without the array V8 allocates
// for the arguments of every call: the frame loop calls it thousands of times a frame.
export function hypot(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  if (a === Infinity || b === Infinity) return Infinity;
  if (a !== a || b !== b) return NaN;
  const max = a > b ? a : b;
  if (max === 0) return 0;
  const na = a / max;
  const nb = b / max;
  return Math.sqrt(na * na + nb * nb) * max;
}
// Frame-rate independent exponential smoothing.
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;

export function weightedChoice(items, weightFn = (i) => i.weight ?? 1) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightFn(it));
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, weightFn(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function angleWrap(a) {
  if (!Number.isFinite(a)) return 0;
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
export const angleDiff = (a, b) => angleWrap(b - a);
export function dampAngle(a, b, lambda, dt) {
  return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));
}
export function yawTo(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}
export const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fmt(n) {
  return Math.round(n).toLocaleString();
}

let _uid = 1;
export const uid = () => _uid++;

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const forwardFromYaw = (yaw, out = new THREE.Vector3()) =>
  out.set(Math.sin(yaw), 0, Math.cos(yaw));

export function colorLerp(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

export function titleCase(s) {
  return s.replace(/(^|\s|-)\w/g, (m) => m.toUpperCase());
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

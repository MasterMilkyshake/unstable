import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Warmup } from '../src/game/warmup.js';

// A simulated machine: the warm-up's clock advances only inside the renderer, by what the batch
// would cost to upload and draw, so the batches it chooses can be checked without a GPU.
const realNow = performance.now;
let clock = 0;
performance.now = () => clock;
after(() => {
  performance.now = realNow;
});

const MB = 1048576;
const LAYER = 31;

function machine({ fences = true, msPerMB = 0.3, msPerObject = 0.012, msPerRender = 1 } = {}) {
  const scene = new THREE.Scene();
  const gpu = { behind: false, made: 0, deleted: 0 };
  const gl = fences
    ? {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117, SYNC_STATUS: 0x9112, SIGNALED: 0x9119, UNSIGNALED: 0x9118,
      fenceSync: () => ++gpu.made,
      getSyncParameter: () => (gpu.behind ? 0x9118 : 0x9119),
      deleteSync: () => gpu.deleted++,
    }
    : {};
  const uploaded = new Set();
  const batches = [];
  const renderer = {
    getContext: () => gl,
    getRenderTarget: () => null,
    setRenderTarget() {},
    compile: () => new Set(),
    properties: { get: () => ({}) },
    extensions: { get: () => null },
    render(sc) {
      let n = 0;
      let bytes = 0;
      sc.traverse((o) => {
        if (!o.isMesh || !o.layers.isEnabled(LAYER)) return;
        n++;
        if (!uploaded.has(o.geometry)) {
          uploaded.add(o.geometry);
          bytes += o.geometry.attributes.position.array.byteLength;
        }
      });
      const t = msPerRender + n * msPerObject + (bytes / MB) * msPerMB;
      clock += t;
      batches.push({ n, bytes, t });
    },
  };
  const game = { renderer, scene, camera: new THREE.PerspectiveCamera(), settings: { quality: 'high' }, state: 'menu' };
  return { game, scene, gpu, batches };
}

// a mesh whose geometry would upload `bytes` (no real arrays: only their sizes are read)
function mesh(geo, x = 0) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  m.position.x = x;
  return m;
}
function geometry(bytes, x = 0) {
  const g = new THREE.BufferGeometry();
  g.attributes = { position: { array: { byteLength: bytes } } };
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(x, 0, 0), 1);
  return g;
}

// thousands of small props sharing a few geometries, some 2 MB pieces, and three 30 MB town cells
function town(scene) {
  const shared = Array.from({ length: 30 }, (_, i) => geometry(1024, i));
  for (let i = 0; i < 3000; i++) scene.add(mesh(shared[i % 30], i % 500));
  for (let i = 0; i < 40; i++) scene.add(mesh(geometry(2 * MB, i * 10), i * 10));
  for (let i = 0; i < 3; i++) scene.add(mesh(geometry(30 * MB, i * 100), i * 100));
}

function frames(w, n, at = new THREE.Vector3()) {
  for (let i = 0; i < n; i++) {
    w.step(at, 1 / 60);
    w.endFrame();
  }
}

test('a warm-up batch stays within the frame budget; only an object too big for any budget goes over, alone', () => {
  const { game, scene, batches } = machine();
  town(scene);
  const w = new Warmup(game);
  w.start();
  let f = 0;
  while (w.pending && f < 400) {
    frames(w, 1);
    f++;
  }
  assert.equal(w.pending, false, 'the warm-up finished');
  assert.ok(f < 120, `finished in ${f} frames`);
  const over = batches.filter((b) => b.n > 1 && b.t > 12 * 1.25);
  assert.deepEqual(over, [], 'no batch of several objects went over the 12 ms menu budget');
  for (const b of batches) if (b.bytes >= 30 * MB) assert.equal(b.n, 1, 'a 30 MB cell is uploaded on its own');
  assert.equal(batches.reduce((s, b) => s + b.n, 0), 3043, 'every object drawn once');
});

test('in play the warm-up keeps to its 2 ms budget', () => {
  const { game, scene, batches } = machine();
  town(scene);
  game.state = 'playing';
  const w = new Warmup(game);
  w.start();
  frames(w, 3000);
  assert.equal(w.pending, false);
  const over = batches.filter((b) => b.n > 1 && b.t > 2 * 1.5 + 1);
  assert.deepEqual(over, [], 'no batch of several objects took much over 2 ms (1 ms of it the render pass itself)');
});

test('the warm-up holds back while the GPU is behind, but not for ever', () => {
  const { game, scene, gpu, batches } = machine();
  town(scene);
  const w = new Warmup(game);
  w.start();
  gpu.behind = true;
  frames(w, 40);
  // the first frame only asks; after that a batch at most every 8 frames
  assert.ok(batches.length >= 3 && batches.length <= 5, `${batches.length} batches in 40 frames while the GPU was behind`);
  gpu.behind = false;
  const before = batches.length;
  frames(w, 5);
  assert.equal(batches.length - before, 5, 'a batch every frame once the GPU keeps up');
});

test('without fences (WebGL 1) the warm-up works every frame', () => {
  const { game, scene, batches } = machine({ fences: false });
  town(scene);
  const w = new Warmup(game);
  w.start();
  frames(w, 5);
  assert.equal(batches.length, 5);
});

test('no fence is left behind once the warm-up is done', () => {
  const { game, scene, gpu } = machine();
  town(scene);
  const w = new Warmup(game);
  w.start();
  frames(w, 400);
  assert.equal(w.pending, false);
  assert.ok(gpu.made > 0);
  assert.equal(gpu.deleted, gpu.made);
});

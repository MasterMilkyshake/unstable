// Nothing should be compiled or sent to the GPU the first time it comes into view: a shader
// program takes tens of milliseconds to link and a merged town cell is tens of megabytes of
// vertices, and either one stalls the frame it lands in. So every material in the scene is
// compiled in the background (KHR_parallel_shader_compile) as soon as the world exists, and
// then its geometry is uploaded a little each frame, nearest first, by drawing it into a target
// no one sees: briskly behind the main menu, gently once play has started.
import * as THREE from 'three';

const LAYER = 31; // seen only by the warm-up camera
// Milliseconds a frame may spend uploading: enough behind the menu to finish in a few seconds
// while it still turns smoothly, little enough in play not to be felt.
const MENU_MS = 12;
const PLAY_MS = 2;
// Waiting longer than this many frames for the GPU to catch up, the warm-up goes ahead anyway: a
// GPU that is always a little behind must not keep it from ever finishing.
const MAX_BEHIND = 8;
// The rates are learned, but never taken as faster than this: one fast batch must not let the next
// take a whole town's geometry (a 62 MB batch took 21 ms on an idle machine, more under load).
const MIN_MS_PER_BYTE = 0.5 / 1048576;
const MIN_MS_PER_OBJECT = 0.005;
const RESORT_DIST = 150; // re-sort nearest-first once the player has moved this far
const _c = new THREE.Vector3();

// The shadow pass draws every caster with one shared depth material, and three.js rebuilds
// that material's program each time it passes from an instanced caster to a plain one, dozens
// of times a frame. Instanced casters get depth materials of their own, the very ones three.js
// would draw them with, so the shared one never changes kind.
const DEPTH = {};
const depthMaterial = (kind) => (DEPTH[kind] ||= new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
function giveDepthMaterial(o) {
  if (!o.isInstancedMesh || o.customDepthMaterial) return;
  const m = o.material;
  if (!m || Array.isArray(m)) return;
  // three.js makes these a depth material of their own anyway
  if ((m.clipShadows && m.clippingPlanes?.length) || (m.displacementMap && m.displacementScale !== 0) || ((m.alphaMap || m.map) && m.alphaTest > 0)) return;
  o.customDepthMaterial = depthMaterial(o.instanceColor ? 'colored' : 'plain');
}
const _size = new THREE.Vector2();

function bytesOf(attrs) {
  let n = 0;
  for (const k in attrs) n += attrs[k].array ? attrs[k].array.byteLength : 0;
  return n;
}

export class Warmup {
  constructor(game) {
    this.game = game;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.camera = new THREE.PerspectiveCamera();
    this.camera.layers.set(LAYER);
    this.queue = [];
    this.geos = new WeakSet();
    this.queued = new WeakSet();
    this.compiling = []; // materials whose shaders are still compiling
    this.compileSince = 0;
    this.scanT = 0;
    this.sortedAt = null;
    this.msPerByte = 6 / 1048576; // a first guess at the upload rate, then measured
    this.msPerObject = 0.02; // three.js's own work to draw one object, also measured
    this.fence = null;
    this.behind = 0;
  }

  // The shaders depend on where the scene is drawn: post-processing draws it off-screen
  // (linear, no tone mapping), low quality straight to the canvas.
  get offscreen() {
    return this.game.settings.quality !== 'low';
  }

  // Compile every material in the scene for the current output and queue every drawable.
  start() {
    this.game.scene.traverse((o) => {
      if (o.isLight) o.layers.enable(LAYER);
    });
    this._compile(this.game.scene);
    this.scan(false);
  }

  // Queue (and compile) whatever has joined the scene since: the player, the weather.
  scan(compile = true) {
    const fresh = [];
    this.game.scene.traverse((o) => {
      if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.geometry && !this.queued.has(o)) fresh.push(o);
    });
    if (!fresh.length) return;
    for (const o of fresh) {
      this.queued.add(o);
      giveDepthMaterial(o);
    }
    this.queue.push(...fresh);
    this.sortedAt = null;
    // compile() walks the objects it is given and lights them with the scene's lights
    if (compile) this._compile({ traverse: (fn) => fresh.forEach(fn), traverseVisible() {} });
  }

  // Start the shaders compiling (in the driver's own threads, with KHR_parallel_shader_compile)
  // and remember the materials, to wait for them before drawing any.
  _compile(objects) {
    const { renderer, scene, camera } = this.game;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.offscreen ? this.target : null);
    const materials = renderer.compile(objects, camera, scene);
    renderer.setRenderTarget(prev);
    for (const m of materials) this.compiling.push(m);
    this.compileSince = performance.now();
  }

  // Whether any shader is still compiling or not yet used. three.js checks a program the first
  // time it draws with it (its info logs and uniforms), and each check waits on the GPU, a few
  // milliseconds and sometimes eighteen. Sixteen of them in the warm-up's first batch made a
  // 100 ms frame just after the world appeared. So a program is used here, as soon as its shader
  // is compiled, a few at a time within `ms`, and no batch is drawn until all are. One whose
  // material has since been disposed (or that never got a program) no longer counts, and none is
  // waited for past a few seconds.
  _compilePending(ms) {
    if (!this.compiling.length) return false;
    const { renderer } = this.game;
    const props = renderer.properties;
    const parallel = !!renderer.extensions.get('KHR_parallel_shader_compile');
    const t0 = performance.now();
    this.compiling = this.compiling.filter((m) => {
      // every program of the material: a transparent double-sided one has two, its back faces
      // drawn first with a program of their own
      const programs = props.get(m).programs;
      if (!programs || !programs.size) return false;
      for (const program of programs.values()) {
        if (parallel && !program.isReady()) return true;
        if (performance.now() - t0 > ms) return true; // used in a later frame
        program.getUniforms(); // the first use: free for a program already used
      }
      return false;
    });
    if (performance.now() - this.compileSince > 5000) this.compiling.length = 0;
    return this.compiling.length > 0;
  }

  get pending() {
    return this.queue.length > 0 || this.compiling.length > 0;
  }

  // Order the queue far to near, so the nearest is popped first.
  _sort(at) {
    const key = new Map();
    for (const o of this.queue) {
      const geo = o.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      _c.copy(geo.boundingSphere.center).applyMatrix4(o.matrixWorld);
      key.set(o, _c.distanceToSquared(at));
    }
    this.queue.sort((a, b) => key.get(b) - key.get(a));
    this.sortedAt = at.clone();
  }

  // Bytes the object would upload: its geometry, unless an earlier object shared it, and its instances.
  _bytes(o) {
    let n = 0;
    const geo = o.geometry;
    if (!this.geos.has(geo)) n += bytesOf(geo.attributes) + (geo.index ? geo.index.array.byteLength : 0);
    if (o.isInstancedMesh) n += o.instanceMatrix.array.byteLength + (o.instanceColor ? o.instanceColor.array.byteLength : 0);
    return n;
  }

  // Whether the GPU is still behind with the last frame. While it is, a synchronous call (a
  // program's first use) or an upload bigger than the transfer buffer waits for it to catch up,
  // and the frame with it: just after the world appeared, single calls waited 20 ms and frames took
  // 67 ms. The fence placed after the last frame was drawn tells, without waiting, whether the GPU
  // has done it all.
  _gpuBehind() {
    const gl = this.game.renderer.getContext();
    if (!gl.fenceSync) return false; // WebGL 1: no fences, no waiting
    if (!this.fence) return true; // the warm-up was idle: wait for one frame's answer
    if (gl.getSyncParameter(this.fence, gl.SYNC_STATUS) !== gl.SIGNALED && ++this.behind < MAX_BEHIND) return true;
    gl.deleteSync(this.fence);
    this.fence = null;
    return false;
  }

  // Called each frame before the scene is drawn.
  step(at, dt) {
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 2;
      this.scan();
    }
    if (!this.pending) {
      // an answer left from before the warm-up went idle would say nothing about the GPU now
      if (this.fence) this.game.renderer.getContext().deleteSync(this.fence);
      this.fence = null;
    } else if (!this._gpuBehind()) this._work(at);
  }

  // Called each frame after the scene is drawn: ask the GPU to tell when it has done the frame.
  endFrame() {
    const gl = this.game.renderer.getContext();
    if (!gl.fenceSync || this.fence || !this.pending) return;
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    this.behind = 0;
  }

  // Use the programs that have compiled, then draw the next batch, both within the frame's budget.
  _work(at) {
    // never draw a material whose shader is still compiling or not yet used: that would wait for it
    const ms = this.game.state === 'playing' ? PLAY_MS : MENU_MS;
    if (this._compilePending(ms / 2) || !this.queue.length) return;
    const { renderer, scene } = this.game;
    if (!this.sortedAt || this.sortedAt.distanceTo(at) > RESORT_DIST) this._sort(at);
    // A batch stays within the budget, counting the data to upload and three.js's work per object
    // (thousands of small objects whose geometry was already counted once made a 40 ms batch);
    // only an object too big for any budget goes over, alone.
    const batch = [];
    let bytes = 0;
    let cost = 0;
    while (this.queue.length) {
      const o = this.queue[this.queue.length - 1];
      // gone from the scene since it was queued
      let root = o;
      while (root.parent) root = root.parent;
      if (root !== scene) {
        this.queue.pop();
        continue;
      }
      const b = this._bytes(o);
      const c = b * this.msPerByte + this.msPerObject;
      if (batch.length && cost + c > ms) break;
      this.queue.pop();
      this.geos.add(o.geometry);
      bytes += b;
      cost += c;
      batch.push(o);
    }
    if (!batch.length) return;
    // Show the batch, and only the batch, to the warm-up camera: visible, unculled, on its layer.
    const undo = [];
    for (const o of batch) {
      undo.push([o, o.visible, o.frustumCulled]);
      o.visible = true;
      o.frustumCulled = false;
      o.layers.enable(LAYER);
      for (let a = o.parent; a && a !== scene; a = a.parent) {
        if (!a.visible) {
          undo.push([a, false, a.frustumCulled]);
          a.visible = true;
        }
      }
    }
    const prev = renderer.getRenderTarget();
    if (this.offscreen) renderer.setRenderTarget(this.target);
    else {
      // straight to the canvas, one pixel of it, which the frame drawn next covers
      renderer.setRenderTarget(null);
      renderer.setScissorTest(true);
      renderer.setScissor(0, 0, 1, 1);
      renderer.setViewport(0, 0, 1, 1);
    }
    const t0 = performance.now();
    renderer.render(scene, this.camera);
    // learn from batches big enough to measure: each rate moves halfway towards what the batch
    // took, in proportion to its share of the estimate
    const t = performance.now() - t0;
    if (cost > 1) {
      const err = t / cost - 1;
      const share = (bytes * this.msPerByte) / cost;
      this.msPerByte = Math.max(MIN_MS_PER_BYTE, this.msPerByte * (1 + 0.5 * err * share));
      this.msPerObject = Math.max(MIN_MS_PER_OBJECT, this.msPerObject * (1 + 0.5 * err * (1 - share)));
    }
    if (!this.offscreen) {
      renderer.setScissorTest(false);
      renderer.getSize(_size);
      renderer.setViewport(0, 0, _size.x, _size.y);
    }
    renderer.setRenderTarget(prev);
    for (const [o, visible, culled] of undo) {
      o.visible = visible;
      o.frustumCulled = culled;
      o.layers.disable(LAYER);
    }
  }
}

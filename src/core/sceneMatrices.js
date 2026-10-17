// Most of the scene graph is scenery that never moves, yet three.js recomposes every object's
// local matrix and remultiplies every world matrix on every frame. Here a local matrix is
// recomposed only when the object's position, rotation or scale has changed, and a world
// matrix only when that local matrix or a parent's world matrix has. The result is the same
// matrices: game code moves objects only through position, rotation, quaternion and scale,
// never by writing .matrix or .matrixWorld.
import { Object3D, Scene } from 'three';

const proto = Object3D.prototype;

proto.updateMatrix = function updateMatrix() {
  const p = this.position;
  const q = this.quaternion;
  const s = this.scale;
  let c = this._trs;
  if (c === undefined) c = this._trs = new Float64Array(10).fill(NaN); // never equal: the first call composes
  if (c[0] === p.x && c[1] === p.y && c[2] === p.z && c[3] === q._x && c[4] === q._y && c[5] === q._z && c[6] === q._w && c[7] === s.x && c[8] === s.y && c[9] === s.z) return;
  c[0] = p.x; c[1] = p.y; c[2] = p.z;
  c[3] = q._x; c[4] = q._y; c[5] = q._z; c[6] = q._w;
  c[7] = s.x; c[8] = s.y; c[9] = s.z;
  this.matrix.compose(p, q, s);
  this.matrixWorldNeedsUpdate = true;
};

// The renderer updates the scene's matrices once a frame (scene.updateMatrixWorld()), and never
// draws a hidden object or anything under it, in the camera's pass or the shadow pass. That
// walk skips hidden subtrees: one skipped while its parent moved is marked to be updated in
// the frame it is shown again, and one that moved itself recomposes then (above). Any explicit
// updateMatrixWorld(true), and every walk below an object other than the scene, still updates
// everything.
const fullUpdate = proto.updateMatrixWorld;
function updateShown(o, force) {
  if (o.matrixAutoUpdate) o.updateMatrix();
  if (o.matrixWorldNeedsUpdate || force) {
    if (o.matrixWorldAutoUpdate === true) {
      if (o.parent === null) o.matrixWorld.copy(o.matrix);
      else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
    }
    o.matrixWorldNeedsUpdate = false;
    force = true;
  }
  const children = o.children;
  for (let i = 0, l = children.length; i < l; i++) {
    const c = children[i];
    if (c.visible === false) {
      if (force) c.matrixWorldNeedsUpdate = true;
      continue;
    }
    if (c.updateMatrixWorld !== fullUpdate) c.updateMatrixWorld(force); // cameras keep their own
    else updateShown(c, force);
  }
}
Scene.prototype.updateMatrixWorld = function updateMatrixWorld(force) {
  if (force) fullUpdate.call(this, force);
  else updateShown(this, false);
};

// A child moved to another parent keeps its local transform but not its world one.
const add = proto.add;
proto.add = function addChild(...objects) {
  for (const o of objects) if (o && o.isObject3D) o.matrixWorldNeedsUpdate = true;
  return add.apply(this, objects);
};

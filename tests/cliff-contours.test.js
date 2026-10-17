import test from 'node:test';
import assert from 'node:assert/strict';
import { splitContour, contourCell, triangleHeight } from '../src/world/cliffContours.js';

const area = p => Math.abs(p.reduce((sum, a, i) => {
  const b = p[(i + 1) % p.length]; return sum + a[0] * b[1] - b[0] * a[1];
}, 0)) / 2;

test('contour cuts preserve cell coverage and agree when an edge is reversed', () => {
  const triangle = [[0, 0], [0, 6], [6, 0]], field = (x, z) => x + z * 0.3;
  const a = splitContour(triangle, field, 2.7);
  const b = splitContour([...triangle].reverse(), field, 2.7);
  assert.equal(a.length, 2);
  assert.ok(Math.abs(a.reduce((sum, p) => sum + area(p), 0) - 18) < 1e-6);
  const crossings = pieces => pieces.flat().filter(p => Math.abs(field(...p) - 2.7) < 1e-6).sort((a, b) => a[0] - b[0]);
  const ac = crossings(a), bc = crossings(b);
  assert.equal(ac.length, bc.length);
  ac.forEach((p, i) => assert.ok(Math.hypot(p[0] - bc[i][0], p[1] - bc[i][1]) < 1e-6));
});

test('a diagonal cliff has continuous planar faces instead of alternating grid spikes', () => {
  const field = (x, z) => 0.8 + (x + z * 0.35) / 20;
  const polygons = contourCell(0, 0, 6, 6, [], null, [field]);
  const height = (x, z) => Math.max(0, Math.min(1, (field(x, z) - 0.92) / 0.08)) * 30;
  assert.ok(polygons);
  assert.ok(Math.abs(polygons.reduce((sum, p) => sum + area(p), 0) - 36) < 1e-5);
  const triangles = [];
  for (const p of polygons) for (let i = 1; i < p.length - 1; i++) {
    triangles.push([p[0], p[i], p[i + 1]].map(([x, z]) => [x, height(x, z), z]));
  }
  for (let x = 0.1; x < 6; x += 0.23) for (let z = 0.1; z < 6; z += 0.27) {
    const sample = triangleHeight(triangles, x, z);
    assert.notEqual(sample, null, 'no holes between the plateau and cliff');
    assert.ok(Math.abs(sample - height(x, z)) < 0.0001, `no artificial rib at ${x}, ${z}`);
  }
});

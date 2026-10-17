import * as THREE from 'three';

// The rendered path, worn ground and vegetation clearance share these samples.
export function samplePath(road, step = 1.3) {
  const curve = new THREE.CatmullRomCurve3(road.points.map(([x, z, height = 0]) => new THREE.Vector3(x, height, z)), false, 'centripetal');
  const length = curve.getLength();
  const count = Math.max(2, Math.ceil(length / step));
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count, p = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    const width = road.width * (0.9 + 0.1 * Math.sin(t * 19 + road.points[0][0]) + 0.045 * Math.sin(t * 47));
    return { x: p.x, z: p.z, height: p.y, nx: -tangent.z, nz: tangent.x, width, distance: t * length };
  });
}

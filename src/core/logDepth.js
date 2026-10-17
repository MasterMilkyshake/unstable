// Logarithmic depth for the game's own shaders.
//
// The renderer runs with a logarithmic depth buffer (game.js): depth precision is then nearly
// the same fraction of distance near and far, so faces a centimetre apart no longer fight
// (flicker) on a wall a kilometre off. Three's built-in materials handle it themselves; a
// ShaderMaterial must write the same depth or it would be tested against the rest on a
// different scale. This wraps each shader's main() so it does, only when the renderer has
// switched logarithmic depth on (USE_LOGDEPTHBUF, which three defines in every program then).
// installLogDepth() hooks every ShaderMaterial that has no onBeforeCompile of its own;
// RawShaderMaterial gets no USE_LOGDEPTHBUF, so the added code stays out of it.
import * as THREE from 'three';

const MAIN = /void\s+main\s*\(\s*(void)?\s*\)/;

export function logDepthShader(mat) {
  if (!mat || !MAIN.test(mat.vertexShader || '') || !MAIN.test(mat.fragmentShader || '') || mat.vertexShader.includes('logDepthMain')) return mat;
  mat.vertexShader = mat.vertexShader.replace(MAIN, 'void logDepthMain()') + `
#ifdef USE_LOGDEPTHBUF
varying float vLogDepth;
#endif
void main() {
  logDepthMain();
#ifdef USE_LOGDEPTHBUF
  vLogDepth = 1.0 + gl_Position.w;
#endif
}
`;
  mat.fragmentShader = mat.fragmentShader.replace(MAIN, 'void logDepthMain()') + `
#ifdef USE_LOGDEPTHBUF
uniform float logDepthBufFC;
varying float vLogDepth;
#endif
void main() {
  logDepthMain();
#ifdef USE_LOGDEPTHBUF
  gl_FragDepth = log2(vLogDepth) * logDepthBufFC * 0.5;
#endif
}
`;
  return mat;
}

export function installLogDepth() {
  THREE.ShaderMaterial.prototype.onBeforeCompile = function (shader) { logDepthShader(shader); };
}

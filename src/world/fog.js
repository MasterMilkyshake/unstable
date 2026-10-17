// Scene-wide atmosphere in the shared fog chunks, so every fogged material gets it for free:
//   distance fog (THREE.Fog near/far, as before),
//   analytic exponential height fog integrated along the view ray (valleys and the sea fill
//   with haze, peaks and towers stand out of it), and
//   sun in-scatter (the haze brightens and warms toward the sun, which is what makes distant
//   silhouettes read as layers at golden hour).
// The uniform values are plain objects shared by reference: UniformsUtils.clone copies
// non-THREE values by reference, so one write here reaches every program.
import * as THREE from 'three';

export const fogHeight = { x: 0, y: 0.05, z: 0, w: 0 }; // base y, falloff /m, density /m, max opacity
export const fogSun = { x: 0, y: 1, z: 0, w: 0 }; // direction to the sun, in-scatter strength
export const fogSunColor = { r: 0, g: 0, b: 0 };

const EXTRA = {
  fogHeight: { value: fogHeight },
  fogSun: { value: fogSun },
  fogSunColor: { value: fogSunColor },
};
Object.assign(THREE.UniformsLib.fog, EXTRA);
for (const lib of Object.values(THREE.ShaderLib)) {
  if (lib.uniforms && lib.uniforms.fogColor) Object.assign(lib.uniforms, EXTRA);
}

THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogWorld;
#endif`;

THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogWorld = transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz );
#endif`;

THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
	uniform vec3 fogColor;
	uniform vec4 fogHeight;
	uniform vec4 fogSun;
	uniform vec3 fogSunColor;
	varying float vFogDepth;
	varying vec3 vFogWorld;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`;

THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	vec3 fogRay = vFogWorld - cameraPosition;
	float fogLen = length( fogRay );
	vec3 fogDir = fogRay / max( fogLen, 1e-4 );
	if ( fogHeight.z > 0.0 ) {
		float fo = max( fogHeight.y, 1e-4 );
		float h0 = max( cameraPosition.y - fogHeight.x, 0.0 );
		float h1 = max( vFogWorld.y - fogHeight.x, 0.0 );
		float dh = h1 - h0;
		float od = abs( dh ) > 0.05 ? ( exp( - fo * h0 ) - exp( - fo * h1 ) ) / ( fo * dh ) : exp( - fo * h0 );
		float hf = ( 1.0 - exp( - fogHeight.z * fogLen * od ) ) * fogHeight.w;
		fogFactor = 1.0 - ( 1.0 - fogFactor ) * ( 1.0 - hf );
	}
	vec3 fogCol = fogColor + fogSunColor * pow( max( dot( fogDir, fogSun.xyz ), 0.0 ), 12.0 ) * fogSun.w;
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
#endif`;

const _c = new THREE.Color();
// One call per frame from whoever owns the look (surface sky or the Rift).
export function setAtmosphere({ base = 0, falloff = 0.05, density = 0, opacity = 1, sunDir = null, sunColor = null, scatter = 0 }) {
  fogHeight.x = base;
  fogHeight.y = falloff;
  fogHeight.z = density;
  fogHeight.w = opacity;
  if (sunDir) {
    fogSun.x = sunDir.x;
    fogSun.y = sunDir.y;
    fogSun.z = sunDir.z;
  }
  fogSun.w = scatter;
  if (sunColor) {
    _c.copy(sunColor);
    fogSunColor.r = _c.r;
    fogSunColor.g = _c.g;
    fogSunColor.b = _c.b;
  }
}

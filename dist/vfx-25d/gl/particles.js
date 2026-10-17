// Particulas em profundidade: poeira mineral, esporos e faiscas de exsudato.
//
// Tudo vive num volume que acompanha a camera (posicao com `mod` no shader),
// entao nao ha nada para atualizar na CPU alem de dois uniforms. Cada
// particula recebe a mesma luz do resto da cena, so que avaliada no vertice:
// poeira so aparece de verdade quando atravessa um feixe ou passa perto de uma
// fonte — e isso que da a leitura de "ar" dentro do solo.

import * as THREE from '../vendor/three.bundle.min.js';
import { LIGHTING_GLSL } from './shading.js';

const VERT = /* glsl */`
#define LIGHT_IN_VERTEX
${LIGHTING_GLSL}
attribute vec4 aSeed;   // xyz posicao no volume (0..1), w aleatorio
uniform vec3 uBox;      // tamanho do volume
uniform vec3 uCenter;   // centro do volume (segue a camera)
uniform float uZMin;
uniform float uSize;
uniform vec3 uTint;
uniform float uDrift;
uniform float uSelf;
uniform float uPixelScale;
varying vec3 vCol;
varying float vFade;
void main() {
  vec3 drift = vec3(sin(uTime * .21 + aSeed.w * 40.0) * 18.0,
                    uDrift * uTime * (0.4 + aSeed.w),
                    0.0);
  vec3 p = aSeed.xyz * uBox + drift;
  vec3 origin = uCenter - uBox * .5;
  p = origin + mod(p - origin, uBox);
  p.z = uZMin + aSeed.z * uBox.z;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vec2 suv = clamp(gl_Position.xy / gl_Position.w * .5 + .5, 0.0, 1.0);
  vec3 rim;
  vec3 light = accumulateLightAt(p, vec3(0.0, 0.0, 1.0), 1.0, 0.0, suv, rim);
  vec3 c = uTint * (light * 1.4 + uSelf);
  vCol = applyFog(c, p.z) * (0.55 + 0.45 * sin(uTime * (1.0 + aSeed.w * 2.0) + aSeed.w * 30.0));
  float s = uSize * (0.5 + aSeed.w) * uPixelScale / max(1.0, -mv.z);
  gl_PointSize = clamp(s, 1.0, 26.0);
  vFade = smoothstep(1.0, 3.0, gl_PointSize);
}`;

const FRAG = /* glsl */`
varying vec3 vCol;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - .5;
  float r = dot(d, d) * 4.0;
  float a = exp(-r * 3.2) * vFade;
  if (a < .01) discard;
  gl_FragColor = vec4(vCol * a, a);
}`;

export function createParticleField({ shared, count, zMin, depth, size, tint, drift = 0, self = 0, seed = 1 }) {
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) seeds[i] = rand();
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uBox: { value: new THREE.Vector3(2400, 1500, depth) },
      uCenter: { value: new THREE.Vector3() },
      uZMin: { value: zMin },
      uSize: { value: size },
      uTint: { value: new THREE.Color(tint).convertSRGBToLinear() },
      uDrift: { value: drift },
      uSelf: { value: self },
      uPixelScale: { value: 1000 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const points = new THREE.Points(geom, material);
  points.frustumCulled = false;
  return {
    points,
    update(camera, viewportHeight) {
      material.uniforms.uCenter.value.set(camera.position.x, camera.position.y, 0);
      // tamanho em pixels na distancia 1: altura da tela / (2 tan(fov/2))
      material.uniforms.uPixelScale.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
  };
}

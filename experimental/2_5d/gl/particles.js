// Particulas em profundidade: poeira mineral, esporos e faiscas de exsudato.
//
// Tudo vive num volume que acompanha a camera (posicao com `mod` no shader),
// entao nao ha nada para atualizar na CPU alem de dois uniforms. Cada
// particula recebe a mesma luz do resto da cena, so que avaliada no vertice:
// poeira so aparece de verdade quando atravessa um feixe ou passa perto de uma
// fonte — e isso que da a leitura de "ar" dentro do solo.

import * as THREE from '../vendor/three.bundle.min.js';
import { LIGHTING_GLSL } from './shading.js';
import { BEAM_CORE_GLSL } from './beam-core.js';
import { SHAFT_PROFILE_GLSL } from './shaft-profile.js';

const VERT = /* glsl */`
#define LIGHT_IN_VERTEX
${LIGHTING_GLSL}
${BEAM_CORE_GLSL}
${SHAFT_PROFILE_GLSL}
attribute vec4 aSeed;   // xyz posicao no volume (0..1), w aleatorio
uniform vec3 uBox;      // tamanho do volume
uniform vec3 uCenter;   // centro do volume (segue a camera)
uniform float uZMin;
uniform float uSize;
uniform vec3 uTint;
uniform float uDrift;
uniform float uSelf;
uniform float uPixelScale;
uniform float uBeam;     // 1 = so aparece dentro dos feixes (poeira no raio de luz)
uniform vec4 uBeamCore[2]; // w = peso do feixe; perfil geometrico compartilhado
varying vec3 vCol;
varying float vFade;
varying float vDensity;
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
  vec2 suv = gl_Position.xy / gl_Position.w * .5 + .5;
  vec3 rim;
  vec3 light = accumulateLightAt(p, vec3(0.0, 0.0, 1.0), 1.0, 0.0, suv, rim);
  vec3 c = uTint * (light * 1.4 + uSelf);
  float core = 0.0;
  vec3 beam = vec3(0.0);
  // Mesmo angulo e mesmas cristas luminosas do volume, no plano projetado.
  // O pedestal/halo amplo e excluido: apenas o contraste central das fissuras.
  vec2 beamPoint = planeWorld(suv).xy;
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    vec4 lp = uLightPos[i];
    vec4 lc = uLightCol[i];
    if (lp.w >= 0.0 || lc.w < .5 || lc.w > 2.5) continue;
    int slot = int(lc.w + .5) - 1;
    float inCore = shaftParticleCore(lp.xy - beamPoint, uTime) * uBeamCore[slot].w;
    float visibility = shadowFor(lc.w, suv);
    inCore *= visibility * uLightingOn;
    vec3 L = lp.xyz - p;
    float q = clamp(length(L) / -lp.w, 0.0, 1.0);
    float att = 1.0 - q * q; att *= att;
    beam += lc.rgb * att * inCore;
    core = max(core, inCore);
  }
  vDensity = 1.0;
  if (uBeam > .5) {
    // Densidade e emissao sao coisas diferentes. Fora da faixa central sobra
    // apenas uma poeira rara/estatica; nenhuma luz local nem brilho proprio.
    vec3 dust = uTint * uAmbient * .045;
    c = dust + uTint * (beam * 2.2 + uSelf * core);
    vDensity = mix(.12 * step(.82, aSeed.w), 1.0, core);
  }
  // A nevoa atenua o ponto; misturar a COR da nevoa aqui faria pontos apagados
  // emitirem azul e cintilarem fora do raio (ate quando c fosse zero).
  float fogTransmission = exp(-uFogDensity * max(0.0, -p.z));
  vCol = c * fogTransmission * mix(1.0, beamTwinkle(uTime, aSeed.w), core);
  // Calmaria: dentro do halo a poeira vira polen dourado, rosa e branco que
  // pisca devagar, em todo o halo (nao so no feixe). Fora dele cw = 0 e nada
  // muda: a poeira continua so no miolo dos feixes.
  float cw = calmAt(p);
  float calmSize = 1.0;
  if (cw > 0.0) {
    float pick = fract(aSeed.w * 7.31);
    vec3 warm = pick < .4 ? vec3(1.0, .82, .45) : pick < .75 ? vec3(1.0, .58, .74) : vec3(1.0, .96, .9);
    float tw = .55 + .45 * sin(uTime * (1.2 + aSeed.w * 1.6) + aSeed.w * 61.0);
    vCol = mix(vCol, warm * (.7 + .6 * tw), cw);
    vDensity = mix(vDensity, .5 + .5 * tw, cw);
    calmSize = 1.0 + .6 * cw;
  }
  float s = uSize * (0.5 + aSeed.w) * calmSize * uPixelScale / max(1.0, -mv.z);
  gl_PointSize = clamp(s, 1.0, 26.0);
  vFade = smoothstep(1.0, 3.0, gl_PointSize);
}`;

const FRAG = /* glsl */`
varying vec3 vCol;
varying float vFade;
varying float vDensity;
void main() {
  vec2 d = gl_PointCoord - .5;
  float r = dot(d, d) * 4.0;
  float a = exp(-r * 3.2) * vFade * vDensity;
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
      uBeam: { value: 0 },
      uBeamCore: shared.uBeamCore || { value: [new THREE.Vector4(), new THREE.Vector4()] },
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
    setBeamOnly(on) { material.uniforms.uBeam.value = on ? 1 : 0; },
    update(camera, viewportHeight) {
      material.uniforms.uCenter.value.set(camera.position.x, camera.position.y, 0);
      // tamanho em pixels na distancia 1: altura da tela / (2 tan(fov/2))
      material.uniforms.uPixelScale.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
  };
}

// Renderizador 2,5D do Miguelito (WebGL2 / Three.js).
//
// Nao substitui a simulacao nem os desenhos existentes: recebe as MESMAS
// chamadas de desenho do jogo, separadas em tres camadas 2D, e as recompõe na
// GPU com luz dinamica, sombras, profundidade, particulas e pos-processamento.
//
//   fundo   — renderer.drawBackground() (paralaxe e pano de fundo do jogo)
//   terreno — platformVisuals.drawWorld() (geometria organica, celulas, solo)
//   efeitos — entidades, organismos, estruturas, rotulos (todos os render(ctx))
//
// Os sprites do Miguelito e dos microrganismos sao desviados das camadas pela
// ponte de contexto e viram quads iluminados com normal map gerado da propria
// arte. Raizes e hifas de fundo crescem na GPU. A fisica, a geracao procedural
// e as regras biologicas nao sabem que este arquivo existe.

import * as THREE from '../vendor/three.bundle.min.js';
import { createBridgeContext, paintEquipmentOverlay } from './ctx-bridge.js';
import { writeSpritePlanePositions } from './sprite-plane.js';
import { generateSpriteNormalMap, loadAuthoredNormal } from './sprite-normals.js';
import { LIGHTING_GLSL, MAX_LIGHTS, createSharedUniforms } from './shading.js';
import { createGrowthLayer, hashString } from './growth.js';
import { createParticleField } from './particles.js';
import { SHAFT_PROFILE_GLSL, shaftSourceY, visibleShafts } from './shaft-profile.js';
import { createNativeLayer, createTextureCache, installCanvasVersions } from './native-layer.js';
import { createBiofilmLayer } from './biofilm-material.js';

const FOV = 32;
// Padrao = valores calibrados pelo Marco no painel (17/10/2026), mais o
// gradiente de luz dentro do solo (novo).
export const DEFAULT_TUNING = {
  exposure: 1.1, ambient: 1.4, lights: 1.95, spriteLight: .55, rim: 1.9, soil: 1, bloom: 1.15, emission: 1, shafts: 2.1, fog: .6,
};
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- shaders

const SCREEN_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Camada 2D relida pela luz. O relevo vem do proprio desenho: alfa borrado
// (mipmap) vira volume, luminancia vira detalhe. Nada foi modelado.
const LAYER_FRAG = /* glsl */`
${LIGHTING_GLSL}
uniform sampler2D uMap;
uniform vec2 uTexel;
uniform float uLodVolume;
uniform float uLodBlur;
uniform float uVolume;
uniform float uDetail;
uniform float uGain;
uniform float uLit;
uniform float uWrap;
uniform float uSpec;
uniform float uDepth;      // z virtual (fundo < 0)
uniform float uAO;
uniform float uBrightness;
uniform float uRim;
uniform float uGlow;
uniform float uSky;        // terreno: quanto escurece com a terra acima do pixel
uniform float uPremult;    // 1 = camada veio da GPU (cor pre-multiplicada)
varying vec2 vUv;

float heightAt(vec2 p) {
  float a = textureLod(uMap, p, uLodVolume).a;
  vec3 c = textureLod(uMap, p, 0.6).rgb;
  float l = dot(c, vec3(.2126, .7152, .0722));
  return sqrt(a) * uVolume + l * uDetail;
}

void main() {
  vec4 c = textureLod(uMap, vUv, uLodBlur);
  if (c.a < .004) discard;
  if (uPremult > .5) c.rgb /= max(c.a, 1e-3);
  vec3 albedo = c.rgb;
  vec2 e = uTexel * exp2(uLodVolume) * .9;
  float hx = heightAt(vUv + vec2(e.x, 0.0)) - heightAt(vUv - vec2(e.x, 0.0));
  float hy = heightAt(vUv + vec2(0.0, e.y)) - heightAt(vUv - vec2(0.0, e.y));
  vec3 N = normalize(vec3(-hx * uGain, -hy * uGain, 1.0));
  vec3 wp = planeWorld(vUv);
  wp.z = uDepth;
  vec3 rim;
  vec3 light = accumulateLight(wp, N, uWrap, uSpec, rim);
  // oclusao de cavidade: o miolo do volume recebe menos luz ambiente que a borda
  float dome = textureLod(uMap, vUv, uLodVolume + 1.0).a;
  float ao = mix(1.0, mix(.55, 1.0, 1.0 - dome * dome), uAO);
  // Profundidade dentro do bloco: terra acima do pixel (amostras para cima na
  // propria camada). A borda de cima fica clara e o miolo/baixo escurece, como
  // a luz da cena Unity entrando pela superficie do torrao.
  if (uSky > 0.0) {
    float above = 0.0;
    for (int k = 1; k <= 6; k++) {
      above += textureLod(uMap, vUv + vec2(0.0, .018 * float(k)), 2.0).a;
    }
    float cover = above / 6.0;
    float sky = mix(1.0, .28, smoothstep(.15, 1.0, cover) * uSky);
    ao *= sky;
    light *= mix(1.0, sky, .8);
    rim *= sky;
  }
  vec3 lit = albedo * (uAmbient * ao + light) + rim * albedo * uRim;
  // O que e translucido (halo de inoculacao, aura, nevoa desenhada pelo jogo)
  // recebe so a luz da cena, como no 2D original, onde a escuridao cobria os
  // halos. Antes 40% dele passava sem luz nenhuma e o halo verde dominava a tela.
  float litAmount = mix(1.0, uLit, smoothstep(.5, .9, c.a));
  vec3 col = mix(albedo * uBrightness, lit, litAmount * uLightingOn);
  // o que o jogo desenhou como brilho (exsudato, halo, aura) continua emitindo
  float lum = dot(albedo, vec3(.2126, .7152, .0722));
  float sat = max(albedo.r, max(albedo.g, albedo.b)) - min(albedo.r, min(albedo.g, albedo.b));
  // So emite o que e PEQUENO e mais claro que a vizinhanca (particula, nucleo
  // de exsudato, faisca do checkpoint). Halos grandes e translucidos, raizes
  // destacadas e topo de plataforma nao emitem: eram eles que, somados ao
  // bloom, lavavam os sprites em volta.
  vec4 around = textureLod(uMap, vUv, 4.5);
  float aroundLum = dot(around.rgb, vec3(.2126, .7152, .0722));
  float pointLike = smoothstep(.12, .45, lum * c.a - aroundLum);
  float solid = smoothstep(.5, .9, c.a);
  col += albedo * uGlow * smoothstep(.45, .85, lum) * smoothstep(.15, .45, sat) * pointLike * solid;
  if (uDepth < 0.0) col = applyFog(col, uDepth);
  // Halos translucidos desenhados pelo jogo (nuvem de exsudato, difusao da
  // colonia) terminam num circulo/elipse: sem a escuridao do 2D por cima, essa
  // borda aparecia recortada. A cauda do alfa cai mais devagar ate zero.
  float tail = mix(smoothstep(0.0, .3, c.a), 1.0, smoothstep(.5, .9, c.a));
  gl_FragColor = vec4(col, c.a * tail);
}`;

const SPRITE_VERT = /* glsl */`
attribute vec2 aU;      // eixo u da imagem no mundo
attribute vec2 aV;      // eixo v (para baixo na imagem) no mundo
attribute float aAlpha;
varying vec2 vUv;
varying vec2 vU;
varying vec2 vV;
varying float vAlpha;
varying vec3 vWorld;
void main() {
  vUv = uv; vU = aU; vV = aV; vAlpha = aAlpha;
  vWorld = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

const SPRITE_FRAG = /* glsl */`
${LIGHTING_GLSL}
uniform sampler2D uMap;
uniform sampler2D uNormal;
uniform float uHasNormal;
uniform float uFloor;     // piso de leitura: a arte nunca some no escuro
uniform float uRimGain;
uniform float uLightScale;
varying vec2 vUv;
varying vec2 vU;
varying vec2 vV;
varying float vAlpha;
varying vec3 vWorld;
void main() {
  vec4 c = texture(uMap, vUv);           // textura pre-multiplicada: sem franja clara na borda
  float a = c.a * vAlpha;
  if (a < .01) discard;
  c.rgb /= max(c.a, 1e-4);
  vec3 n = uHasNormal > .5 ? texture(uNormal, vUv).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
  vec3 N = normalize(n.x * vec3(vU, 0.0) + n.y * vec3(vV, 0.0) + vec3(0.0, 0.0, n.z));
  vec3 rim;
  vec3 light = accumulateLight(vWorld + vec3(0.0, 0.0, 6.0), N, .55, .12, rim);
  // a arte e o ponto de partida: luz modula, nao substitui
  vec3 lit = c.rgb * (uFloor + uAmbient + light * .6 * uLightScale) + rim * c.rgb * uRimGain;
  vec3 col = mix(c.rgb, lit, uLightingOn);
  gl_FragColor = vec4(col * a, a);
}`;

const OCC_SCREEN_FRAG = /* glsl */`
uniform sampler2D uMap;
uniform float uCutV;   // acima desta linha (teto de solo) nao bloqueia luz
varying vec2 vUv;
void main() {
  float o = smoothstep(.15, .7, texture(uMap, vUv).a) * (1.0 - smoothstep(uCutV - .03, uCutV, vUv.y));
  gl_FragColor = vec4(o, 0.0, 0.0, 1.0);
}`;

const OCC_SPRITE_FRAG = /* glsl */`
uniform sampler2D uMap;
varying vec2 vUv;
varying float vAlpha;
void main() {
  float a = texture(uMap, vUv).a * vAlpha;
  if (a < .3) discard;
  gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
}`;

// Visibilidade de 4 luzes, marchando na mascara de oclusao em direcao a cada uma.
const VIS_FRAG = /* glsl */`
uniform sampler2D uOcc;
uniform vec4 uSlot[4];    // xy: luz em uv da tela, z: alcance em uv, w: 0 off / 1 terreno / 2 terreno+sprites
uniform float uAspect;
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 3.1) * 43758.5453); }
uniform float uCast;       // 1 = sombra projetada ligada; 0 = so a luz dentro do solo
uniform float uSoil;       // quanto a luz se apaga ao atravessar o solo
float march(vec4 s) {
  if (s.w < .5) return 1.0;
  vec2 d = s.xy - vUv;
  vec2 da = d * vec2(uAspect, 1.0);
  float len = length(da);
  if (len < .004) return 1.0;
  float reach = min(len, s.z);
  vec2 dir = da / len / vec2(uAspect, 1.0);   // passo unitario em altura de tela
  float jitter = hash(vUv);

  // 1. Luz dentro do bloco de solo: quanto mais terra entre o pixel e a borda
  // virada para a luz, mais escuro. Gradiente continuo (sem a faixa dura que a
  // sombra do proprio bloco fazia), e independe da opcao "Sombras".
  float start = .004;
  float soil = 1.0;
  if (textureLod(uOcc, vUv, 0.0).r > .5) {
    const int IS = 14;
    const float ST = .012;
    float depth = 0.0;
    for (int k = 0; k < IS; k++) {
      float f = ST * (float(k) + jitter);
      if (f > reach) break;
      vec2 p = vUv + dir * f;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) break;
      if (textureLod(uOcc, p, 1.0).r < .35) break;
      depth = f;
    }
    if (depth >= ST * float(IS - 1)) depth = .3;   // miolo de bloco grande
    soil = exp(-depth * uSoil);
    start = depth + ST;
  }
  if (uCast < .5) return mix(.12, 1.0, soil);

  // 2. Sombra projetada pelo que estiver entre a borda e a luz
  const int STEPS = 22;
  float t = 1.0;
  for (int k = 0; k < STEPS; k++) {
    float f = start + (reach - start) * (float(k) + jitter) / float(STEPS);
    vec2 p = vUv + dir * f;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) break;
    vec2 o = textureLod(uOcc, p, 1.0).rg;
    float a = o.r + (s.w > 1.5 ? o.g : 0.0);
    t *= 1.0 - clamp(a, 0.0, 1.0) * .2;
  }
  return mix(.12, 1.0, soil) * mix(.08, 1.0, t);
}
void main() {
  gl_FragColor = vec4(march(uSlot[0]), march(uSlot[1]), march(uSlot[2]), march(uSlot[3]));
}`;

// Feixes volumetricos (dispersao em tela, a partir das luzes da superficie).
// Meia resolucao, 40 passos com jitter de ruido de gradiente intercalado e
// depois desfoque separavel: sem o serrilhado/bloco da primeira versao.
const VOL_FRAG = /* glsl */`
uniform sampler2D uOcc;
uniform vec4 uShaft[2];   // xy: fonte no mundo GL, z: intensidade, w: ativo
uniform vec4 uCam;
uniform vec3 uShaftColor;
uniform float uTime;
varying vec2 vUv;
${SHAFT_PROFILE_GLSL}
float ign(vec2 px) { return fract(52.9829189 * fract(dot(px, vec2(.06711056, .00583715)))); }
vec3 rays(vec4 s) {
  if (s.w < .5) return vec3(0.0);
  vec2 world = shaftWorldPoint(vUv);
  vec2 worldDelta = s.xy - world;
  if (worldDelta.y <= 0.0) return vec3(0.0);
  vec2 d = shaftReferenceDelta(worldDelta);
  const int N = 40;
  vec2 stepv = worldDelta / float(N) * .95;
  vec2 p = world + stepv * ign(floor(world * .5) + fract(uTime * 7.0) * 37.0);
  float decay = 1.0, acc = 0.0, wsum = 0.0;
  for (int k = 0; k < N; k++) {
    vec2 uv = shaftUv(p);
    // Outside the captured world we have no occlusion information. Replicating
    // the screen edge creates a false shaft/occluder that changes with zoom.
    vec2 o = vec2(0.0);
    if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
      o = textureLod(uOcc, uv, 1.0).rg;
    }
    float open = 1.0 - clamp(o.r + o.g * .8, 0.0, 1.0);
    acc += open * decay;
    wsum += decay;
    decay *= .97;
    p += stepv;
  }
  acc /= wsum;
  float dist = length(d * vec2(1.6, 1.0));
  float fall = exp(-dist * 1.6);
  float cone = shaftCone(worldDelta);
  // fissuras: variacao angular larga e lenta (nada de listras finas)
  float streak = shaftStreak(worldDelta, uTime);
  return uShaftColor * acc * acc * s.z * fall * cone * (.08 + 1.5 * streak);
}
void main() { gl_FragColor = vec4(rays(uShaft[0]) + rays(uShaft[1]), 1.0); }`;

const BLUR_FRAG = /* glsl */`
uniform sampler2D uSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture(uSrc, vUv).rgb * .2270270;
  c += texture(uSrc, vUv + uDir * 1.3846154).rgb * .3162162;
  c += texture(uSrc, vUv - uDir * 1.3846154).rgb * .3162162;
  c += texture(uSrc, vUv + uDir * 3.2307692).rgb * .0702703;
  c += texture(uSrc, vUv - uDir * 3.2307692).rgb * .0702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const VOL_COMPOSITE_FRAG = /* glsl */`
uniform sampler2D uVol;
uniform float uStrength;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture(uVol, vUv).rgb * uStrength, 1.0); }`;

const FINAL_FRAG = /* glsl */`
uniform sampler2D uScene;
uniform vec2 uShake;
uniform float uTime;
uniform float uExposure;
uniform float uGrade;
varying vec2 vUv;
// Ombro que preserva matiz e saturacao: abaixo de .72 a cor da arte passa
// intacta; so o que passa disso e comprimido, pelo canal mais alto. O ACES
// anterior lavava os sprites (dessatura e achata os medios).
vec3 shoulder(vec3 c) {
  float m = max(max(c.r, c.g), c.b);
  const float knee = .72;
  if (m <= knee) return c;
  float mm = knee + (1.0 - knee) * (1.0 - exp(-(m - knee) / (1.0 - knee)));
  return c * (mm / m);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + fract(uTime) * 91.7) * 43758.5453); }
void main() {
  vec2 uv = vUv + uShake;
  vec2 cc = uv - .5;
  float r2 = dot(cc, cc);
  // aberracao cromatica leve so nas bordas
  float ca = .0007 * r2 * 4.0 * uGrade;
  vec3 col;
  col.r = texture(uScene, uv + cc * ca).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - cc * ca).b;
  col *= uExposure;
  vec3 mapped = shoulder(col);
  // grade: sombras puxadas para verde-azulado, luzes levemente quentes
  float l = dot(mapped, vec3(.2126, .7152, .0722));
  vec3 shadowTint = vec3(.92, 1.02, 1.06);
  vec3 lightTint = vec3(1.04, 1.0, .95);
  mapped *= mix(mix(vec3(1.0), shadowTint, uGrade), mix(vec3(1.0), lightTint, uGrade), smoothstep(.15, .8, l));
  mapped = clamp(mix(vec3(l), mapped, 1.0 + .06 * uGrade), 0.0, 1.0);
  float vig = smoothstep(.85, .25, r2 * 1.6);
  mapped *= mix(1.0, mix(.62, 1.0, vig), uGrade);
  vec3 outc = pow(max(mapped, 0.0), vec3(1.0 / 2.2));
  // curva S leve no espaco de exibicao: devolve o contraste que o ombro
  // (mais fiel a cor da arte) nao aplica
  outc = mix(outc, outc * outc * (3.0 - 2.0 * outc), .28 * uGrade);
  outc += (hash(vUv * 731.0) - .5) * .018 * uGrade;
  gl_FragColor = vec4(outc, 1.0);
}`;

// ---------------------------------------------------------------- helpers

function screenMesh(material) {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return mesh;
}

function makeLayerCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function canvasTexture(canvas, { mips = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

const AGENT_COLORS = {
  rhizobium: [0.35, 1.0, 0.92],
  azospirillum: [0.42, 0.62, 1.0],
  myco: [0.82, 0.58, 1.0],
  bacillus: [0.7, 1.0, 0.45],
  pseudomonas: [0.3, 0.95, 0.85],
  trichoderma: [0.45, 1.0, 0.55],
  oportunista: [1.0, 0.35, 0.6],
  rhizoctonia: [1.0, 0.35, 0.5],
};

// ---------------------------------------------------------------- lote de sprites

function createSpriteBatch(image, shared, maxTexture) {
  const cap = 96;
  let source = image;
  // Folhas maiores que o limite da GPU sao reduzidas so para a textura.
  if (image.naturalWidth > maxTexture) {
    const s = maxTexture / image.naturalWidth;
    source = document.createElement('canvas');
    source.width = Math.floor(image.naturalWidth * s);
    source.height = Math.floor(image.naturalHeight * s);
    source.getContext('2d').drawImage(image, 0, 0, source.width, source.height);
  }
  const map = new THREE.Texture(source);
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.anisotropy = 4;
  map.premultiplyAlpha = true;
  map.needsUpdate = true;

  const pos = new Float32Array(cap * 4 * 3);
  const uv = new Float32Array(cap * 4 * 2);
  const aU = new Float32Array(cap * 4 * 2);
  const aV = new Float32Array(cap * 4 * 2);
  const aAlpha = new Float32Array(cap * 4);
  const idx = new Uint16Array(cap * 6);
  for (let i = 0; i < cap; i++) {
    const v = i * 4;
    idx.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], i * 6);
  }
  const geom = new THREE.BufferGeometry();
  const attrs = {
    position: new THREE.BufferAttribute(pos, 3),
    uv: new THREE.BufferAttribute(uv, 2),
    aU: new THREE.BufferAttribute(aU, 2),
    aV: new THREE.BufferAttribute(aV, 2),
    aAlpha: new THREE.BufferAttribute(aAlpha, 1),
  };
  for (const [k, a] of Object.entries(attrs)) { a.setUsage(THREE.DynamicDrawUsage); geom.setAttribute(k, a); }
  geom.setIndex(new THREE.BufferAttribute(idx, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uMap: { value: map },
      uNormal: { value: null },
      uHasNormal: { value: 0 },
      uFloor: { value: .26 },
      uRimGain: { value: .3 },
      uLightScale: { value: 1 },
    },
    vertexShader: SPRITE_VERT,
    fragmentShader: SPRITE_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const occMaterial = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map } },
    vertexShader: SPRITE_VERT,
    fragmentShader: OCC_SPRITE_FRAG,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const mesh = new THREE.Mesh(geom, material);
  const occMesh = new THREE.Mesh(geom, occMaterial);
  mesh.frustumCulled = occMesh.frustumCulled = false;
  mesh.renderOrder = 50;

  let count = 0;
  // normal map: pintado a mao (<folha>_n.png) se existir, senao gerado
  (async () => {
    // normal map pintado a mao so e procurado quando pedido (?normais=arquivo):
    // sem isso cada folha geraria um 404 no console.
    const wantsAuthored = /[?&]normais=arquivo/.test(location.search);
    const authored = wantsAuthored ? await loadAuthoredNormal(image.src) : null;
    const run = () => {
      const nm = authored || generateSpriteNormalMap(image);
      const nt = new THREE.Texture(nm);
      nt.colorSpace = THREE.NoColorSpace;
      nt.generateMipmaps = true;
      nt.minFilter = THREE.LinearMipmapLinearFilter;
      nt.needsUpdate = true;
      material.uniforms.uNormal.value = nt;
      material.uniforms.uHasNormal.value = 1;
    };
    (window.requestIdleCallback || setTimeout)(run, { timeout: 600 });
  })();

  return {
    mesh, occMesh,
    begin() { count = 0; },
    add(s, toWorld) {
      if (count >= cap) return;
      const W = image.naturalWidth, H = image.naturalHeight;
      const v = count * 4;
      const { p0, pu, pv } = writeSpritePlanePositions(pos, v * 3, s, toWorld);
      const u0 = s.src.x / W, u1 = (s.src.x + s.src.w) / W;
      const v0 = 1 - s.src.y / H, v1 = 1 - (s.src.y + s.src.h) / H;
      uv.set([u0, v0, u1, v0, u0, v1, u1, v1], v * 2);
      let ux = pu.x - p0.x, uy = pu.y - p0.y;
      let vx = pv.x - p0.x, vy = pv.y - p0.y;
      const lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
      ux /= lu; uy /= lu; vx /= lv; vy /= lv;
      for (let k = 0; k < 4; k++) {
        aU.set([ux, uy], (v + k) * 2);
        aV.set([vx, vy], (v + k) * 2);
        aAlpha[v + k] = s.alpha;
      }
      count++;
    },
    end() {
      for (const a of Object.values(attrs)) a.needsUpdate = true;
      geom.setDrawRange(0, count * 6);
      mesh.visible = occMesh.visible = count > 0;
    },
  };
}

// Emissores: pontos de brilho em HDR (acima de 1) por cima de objetos que o
// jogo desenha como "brilhantes" mas em cor media — o Fe3+ laranja, por
// exemplo. A cor do jogo nao passa do limiar do bloom; o exsudato passa porque
// alem do desenho claro ele tem luz propria. Mesmo recurso da cena Unity
// (sprite de brilho com cor HDR para o bloom pegar).
const EMIT_VERT = /* glsl */`
attribute vec4 aGlow;     // rgb ja multiplicado pela intensidade, w = diametro no mundo
uniform float uPxPerUnit;
varying vec3 vCol;
void main() {
  vCol = aGlow.rgb;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aGlow.w * uPxPerUnit, 2.0, 512.0);
}`;
const EMIT_FRAG = /* glsl */`
varying vec3 vCol;
void main() {
  vec2 d = gl_PointCoord - .5;
  float r = dot(d, d) * 4.0;
  float core = exp(-r * 9.0);
  float halo = exp(-r * 2.6) * .35;
  float a = (core + halo) * smoothstep(1.0, .8, r);
  if (a < .004) discard;
  gl_FragColor = vec4(vCol * a, 1.0);   // AdditiveBlending usa SrcAlpha
}`;

function createEmitters(max = 160) {
  const pos = new Float32Array(max * 3);
  const glow = new Float32Array(max * 4);
  const geom = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3);
  const aGlow = new THREE.BufferAttribute(glow, 4);
  geom.setAttribute('position', aPos);
  geom.setAttribute('aGlow', aGlow);
  const material = new THREE.ShaderMaterial({
    uniforms: { uPxPerUnit: { value: 1 } },
    vertexShader: EMIT_VERT, fragmentShader: EMIT_FRAG,
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geom, material);
  points.frustumCulled = false;
  points.renderOrder = 55;
  let n = 0;
  return {
    points,
    begin() { n = 0; },
    add(x, y, r, g, b, intensity, size) {
      if (n >= max) return;
      pos.set([x, y, .2], n * 3);
      glow.set([r * intensity, g * intensity, b * intensity, size], n * 4);
      n++;
    },
    end(pxPerUnit) {
      material.uniforms.uPxPerUnit.value = pxPerUnit;
      aPos.needsUpdate = aGlow.needsUpdate = true;
      geom.setDrawRange(0, n);
      points.visible = n > 0;
    },
  };
}

// ---------------------------------------------------------------- renderizador

const COLONY_GLOW = {
  bacillus: [.44, .9, .84], azospirillum: [.45, .91, .87], rhizobium: [.78, .65, 1.0],
  pseudomonas: [.55, .72, 1.0], myco: [.84, .69, 1.0],
};

export function createRenderer25D({ mainCanvas, state, getAgents = () => null, getColonies = () => null, quality = 'high' }) {
  const realCtx = mainCanvas.getContext('2d');
  // O canvas WebGL vai para a pagina, ATRAS do canvas do jogo, com o mesmo
  // enquadramento CSS. A primeira versao copiava o quadro da GPU para o canvas
  // 2D a cada quadro (drawImage): isso obriga a GPU a devolver a imagem para a
  // CPU e travava em ~12 fps mesmo com placa de video.
  const glCanvas = document.createElement('canvas');
  glCanvas.setAttribute('aria-hidden', 'true');
  Object.assign(glCanvas.style, {
    position: 'fixed', left: '0', top: '0', width: '100vw', height: '100dvh',
    objectFit: 'contain', zIndex: '0', pointerEvents: 'none', display: 'none',
  });
  document.body.prepend(glCanvas);
  const mainCanvasStyle = { background: mainCanvas.style.background, position: mainCanvas.style.position, zIndex: mainCanvas.style.zIndex };
  let visible = false;
  function setVisible(on) {
    if (on === visible) return;
    visible = on;
    glCanvas.style.display = on ? 'block' : 'none';
    if (on) Object.assign(mainCanvas.style, { background: 'transparent', position: 'relative', zIndex: '1' });
    else Object.assign(mainCanvas.style, mainCanvasStyle);
  }
  const renderer = new THREE.WebGLRenderer({
    canvas: glCanvas, antialias: false, alpha: false,
    powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  const maxTexture = Math.min(8192, renderer.capabilities.maxTextureSize);

  const shared = createSharedUniforms();
  // Particles share the volume's angular ridges, excluding its broad halo.
  // The contrast mask lives in the same world coordinates at every depth.
  shared.uBeamCore = { value: [new THREE.Vector4(), new THREE.Vector4()] };
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 10, 8000);
  const scene = new THREE.Scene();
  const occScene = new THREE.Scene();
  const biofilmLayer = createBiofilmLayer({ scene, shared });
  const fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let W = 0, H = 0;
  // Resolucao da GPU (o canvas e esticado pelo CSS). O custo do 2,5D e por
  // pixel; o painel permite reduzir para testar.
  let GW = 0, GH = 0;
  const glInfo = renderer.getContext();
  const dbgInfo = glInfo.getExtension('WEBGL_debug_renderer_info');
  const gpuName = dbgInfo ? glInfo.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : 'desconhecida';
  const integratedGpu = /intel|uhd|iris|arc\(tm\) graphics|microsoft basic|swiftshader|llvmpipe/i.test(gpuName);
  // Resolucao cheia por padrao. So muda se for escolhida no painel (?painel=1).
  let renderScale = 1;
  try { const v = Number(localStorage.getItem('miguelito:25d:scale')); if (v >= .4 && v <= 1) renderScale = v; } catch (_) {}
  let builtScale = renderScale;
  let layers = null;
  let rt = null;
  let bloom = null;
  const settings = {
    lighting: true, shadows: true, volumetric: true, bloom: true, growth: true,
    particles: true, grade: true, sprites: true,
    particlesBeam: (() => { try { return localStorage.getItem('miguelito:25d:particles-core') !== '0'; } catch (_) { return true; } })(),
    // Modo nativo: fundo e terreno desenhados pela GPU (imagens do jogo viram
    // texturas que sobem uma vez); so o vetor passa pelo Canvas 2D.
    native: /[?&]nativo=1/.test(location.search) || (() => { try { return localStorage.getItem('miguelito:25d:native') === '1'; } catch (_) { return false; } })(),
  };
  const textures = createTextureCache(renderer);
  let nativeBg = null, nativeTerrain = null;
  // camadas nativas so existem quando o modo e ligado (memoria de video)
  function ensureNative() {
    if (nativeTerrain) return;
    installCanvasVersions();
    nativeBg = createNativeLayer({ renderer, textures, width: layers.bg.canvas.width, height: layers.bg.canvas.height, scale: layers.bg.scale, maxSegments: 4 });
    nativeTerrain = createNativeLayer({ renderer, textures, width: W, height: H, scale: 1, maxSegments: 4, onSprite: s => layers.captured.push(s), textTarget: () => realCtx });
  }
  // Controles finos (painel). Padrao entre a 1a versao (luz viva, estourava)
  // e a 2a (cor fiel, mas apagada).
  const tuning = {
    ...DEFAULT_TUNING,
  };
  try { Object.assign(tuning, JSON.parse(localStorage.getItem('miguelito:25d:tuning') || '{}')); } catch (_) {}

  // ---- camadas 2D do jogo -----------------------------------------------
  function buildLayers() {
    const make = (name, opts, scale = 1) => {
      const canvas = makeLayerCanvas(Math.round(W * scale), Math.round(H * scale));
      const ctx = canvas.getContext('2d');
      const tex = canvasTexture(canvas, opts);
      return { name, canvas, ctx, tex, scale };
    };
    // o fundo e desfocado e enevoado de qualquer forma: meia resolucao basta
    // e corta 3/4 do envio desta camada para a GPU
    const bg = make('bg', {}, .5);
    const terrain = make('terrain');
    const fx = make('fx');
    const equipment = make('equipment');
    const captured = [];
    // o canvas do jogo tem o mesmo tamanho das camadas (escala 1)
    const textTarget = () => (textOverlay ? realCtx : null);
    const terrainBridge = createBridgeContext(terrain.ctx, s => captured.push(s), { textTarget });
    const fxBridge = createBridgeContext(fx.ctx, s => captured.push(s), { textTarget });
    nativeBg?.dispose(); nativeTerrain?.dispose();
    nativeBg = nativeTerrain = null;
    // Camada de brilho: o que o jogo desenha como fonte de luz (a raiz-objetivo
    // e sua aura). Nao passa pela iluminacao: sob a luz da cena a aura virava
    // um tubo solido e a raiz parecia mais grossa.
    const glow = make('glow');
    fxBridge.ctx.__glPlayerEquipment = paint => paintEquipmentOverlay(fx.ctx, equipment.ctx, paint);
    fxBridge.ctx.__glBiofilm = packet => biofilmLayer.capture(fxBridge.ctx, packet);
    return { bg, terrain, fx, glow, equipment, captured, terrainBridge, fxBridge };
  }

  function layerMaterial(tex, o) {
    return new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uMap: { value: tex },
        uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
        uLodVolume: { value: o.lodVolume ?? 3.0 },
        uLodBlur: { value: o.lodBlur ?? 0 },
        uVolume: { value: o.volume ?? 1 },
        uDetail: { value: o.detail ?? .3 },
        uGain: { value: o.gain ?? 6 },
        uLit: { value: o.lit ?? 1 },
        uWrap: { value: o.wrap ?? .2 },
        uSpec: { value: o.spec ?? .2 },
        uDepth: { value: o.depth ?? 0 },
        uAO: { value: o.ao ?? 0 },
        uBrightness: { value: o.brightness ?? 1 },
        uRim: { value: o.rim ?? .6 },
        uGlow: { value: o.glow ?? 0 },
        uSky: { value: o.sky ?? 0 },
        uPremult: { value: 0 },
      },
      vertexShader: SCREEN_VERT,
      fragmentShader: LAYER_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }

  const meshes = {};
  const growth = [];
  let particles = [];
  const batches = new Map();
  const goalOrbitQueue = [];
  const goalOrbitColors = new Map(['#d6afff', '#8ff2c1'].map(hex => [hex, new THREE.Color(hex)]));
  function captureGoalOrbit(particle) {
    // Capture the actual Canvas transform, including goal-system's camera
    // offset. No second orbit/camera model is introduced in the renderer.
    const m = this.getTransform();
    const x = m.a * particle.x + m.c * particle.y + m.e;
    const y = m.b * particle.x + m.d * particle.y + m.f;
    if (x < -80 || y < -80 || x > W + 80 || y > H + 80) return;
    goalOrbitQueue.push({ ...particle, x, y, radius: particle.radius * Math.hypot(m.a, m.b) });
  }
  let growthSeed = null;
  let shaftXs = [];
  let camAnchor = null;
  const textOverlay = true;

  function rebuildTargets() {
    rt?.scene.dispose(); rt?.occ.dispose(); rt?.vis.dispose(); rt?.vol.dispose(); rt?.volB.dispose();
    rt?.bgNative?.dispose(); rt?.terrainNative?.dispose();
    const hdr = { type: THREE.HalfFloatType, depthBuffer: false };
    rt = {
      scene: new THREE.WebGLRenderTarget(GW, GH, hdr),
      occ: new THREE.WebGLRenderTarget(GW >> 1, GH >> 1, {
        depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
      }),
      vis: new THREE.WebGLRenderTarget(GW >> 1, GH >> 1, { depthBuffer: false }),
      vol: new THREE.WebGLRenderTarget(GW >> 1, GH >> 1, { depthBuffer: false, type: THREE.HalfFloatType }),
      volB: new THREE.WebGLRenderTarget(GW >> 1, GH >> 1, { depthBuffer: false, type: THREE.HalfFloatType }),
    };
    // camadas desenhadas pela GPU no modo nativo (mipmaps: o relevo da luz vem do alfa borrado)
    const layerRT = (w, h) => new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    if (settings.native) {
      rt.bgNative = layerRT(Math.round(W * .5), Math.round(H * .5));
      rt.terrainNative = layerRT(W, H);
    }
    shared.uVis.value = rt.vis.texture;
    shared.uResolution.value.set(GW, GH);
    bloom?.dispose?.();
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(GW, GH), .5, .4, 1.0);
  }

  function rebuild() {
    W = mainCanvas.width; H = mainCanvas.height;
    builtScale = renderScale;
    GW = Math.max(2, Math.round(W * renderScale)); GH = Math.max(2, Math.round(H * renderScale));
    renderer.setSize(GW, GH, false);
    camera.aspect = W / H;
    for (const m of Object.values(meshes)) { scene.remove(m); occScene.remove(m); }
    layers = buildLayers();
    meshes.bg = screenMesh(layerMaterial(layers.bg.tex, {
      depth: -420, lit: .45, volume: .25, detail: .5, gain: 3, lodBlur: .3, lodVolume: 2.5, wrap: .8, brightness: .36, rim: .2,
    }));
    meshes.bg.material.uniforms.uTexel.value.set(1 / layers.bg.canvas.width, 1 / layers.bg.canvas.height);
    meshes.terrain = screenMesh(layerMaterial(layers.terrain.tex, {
      depth: 0, lit: 1, volume: 1, detail: .35, gain: 7, lodVolume: 2.6, wrap: .25, spec: .35, ao: .9, rim: .9, sky: 1,
    }));
    meshes.fx = screenMesh(layerMaterial(layers.fx.tex, {
      depth: 0, lit: .6, volume: .35, detail: .2, gain: 3, lodVolume: 2.0, wrap: .7, spec: .3, rim: .5, glow: .7,
    }));
    meshes.equipment = screenMesh(layerMaterial(layers.equipment.tex, {
      depth: 0, lit: .6, volume: .35, detail: .2, gain: 3, lodVolume: 2.0, wrap: .7, spec: .3, rim: .5, glow: .7,
    }));
    meshes.equipment.renderOrder = 52;
    scene.add(meshes.equipment);
    meshes.glow = screenMesh(new THREE.ShaderMaterial({
      uniforms: { uMap: { value: layers.glow.tex } },
      vertexShader: SCREEN_VERT,
      fragmentShader: `uniform sampler2D uMap; varying vec2 vUv;
        void main() { vec4 c = texture2D(uMap, vUv); if (c.a < .003) discard; gl_FragColor = c; }`,
      transparent: true, depthTest: false, depthWrite: false,
    }));
    meshes.glow.renderOrder = 42;
    scene.add(meshes.glow);
    meshes.vol = screenMesh(new THREE.ShaderMaterial({
      uniforms: { uVol: { value: null }, uStrength: { value: 1 } },
      vertexShader: SCREEN_VERT, fragmentShader: VOL_COMPOSITE_FRAG,
      depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.AdditiveBlending,
    }));
    meshes.bg.renderOrder = 0;
    meshes.terrain.renderOrder = 30;
    meshes.fx.renderOrder = 40;
    meshes.vol.renderOrder = 60;
    scene.add(meshes.bg, meshes.terrain, meshes.fx, meshes.vol);
    meshes.occTerrain = screenMesh(new THREE.ShaderMaterial({
      uniforms: { uMap: { value: layers.terrain.tex }, uCutV: { value: 2 } },
      vertexShader: SCREEN_VERT, fragmentShader: OCC_SCREEN_FRAG,
      depthTest: false, depthWrite: false,
    }));
    occScene.add(meshes.occTerrain);
    for (const b of batches.values()) occScene.add(b.occMesh);
    rebuildTargets();
  }

  const visPass = new THREE.FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: {
      uOcc: { value: null }, uSlot: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uAspect: { value: 16 / 9 }, uTime: { value: 0 }, uCast: { value: 1 }, uSoil: { value: 9 },
    },
    vertexShader: SCREEN_VERT, fragmentShader: VIS_FRAG,
  }));
  const volPass = new THREE.FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: {
      uOcc: { value: null }, uShaft: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uCam: shared.uCam,
      uShaftColor: { value: new THREE.Color(0.55, 0.85, 1.0) }, uTime: { value: 0 },
    },
    vertexShader: SCREEN_VERT, fragmentShader: VOL_FRAG,
  }));
  const blurPass = new THREE.FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { uSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: SCREEN_VERT, fragmentShader: BLUR_FRAG,
  }));
  const finalPass = new THREE.FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: {
      uScene: { value: null }, uShake: { value: new THREE.Vector2() }, uTime: { value: 0 },
      uExposure: { value: 1.0 }, uGrade: { value: 1 },
    },
    vertexShader: SCREEN_VERT, fragmentShader: FINAL_FRAG,
  }));

  // ---- particulas -------------------------------------------------------
  particles = [
    createParticleField({ shared, count: quality === 'low' ? 300 : 900, zMin: -650, depth: 640, size: 4, tint: '#ffe9c2', drift: -3, self: .006, seed: 7 }),
    createParticleField({ shared, count: quality === 'low' ? 60 : 160, zMin: -160, depth: 300, size: 5, tint: '#b9e6f0', drift: 6, self: .02, seed: 13 }),
    createParticleField({ shared, count: quality === 'low' ? 16 : 35, zMin: 60, depth: 240, size: 16, tint: '#c8b089', drift: -2, self: .0, seed: 29 }),
  ];
  particles[0].points.renderOrder = 10;
  particles[1].points.renderOrder = 45;
  particles[2].points.renderOrder = 80;
  for (const p of particles) scene.add(p.points);
  const emitters = createEmitters();
  scene.add(emitters.points);
  // Separate fixed budget: these fourteen goal indicators cannot displace
  // biological emitters or disappear when their shared batch is full.
  const goalEmitters = createEmitters(28);
  scene.add(goalEmitters.points);

  // ---- crescimento organico ---------------------------------------------
  function setupGrowth(level) {
    for (const g of growth) { scene.remove(g.mesh); g.dispose?.(); }
    growth.length = 0;
    const seed = hashString(String(level?.seed ?? level?.phaseTitle ?? 'rizosfera'));
    growthSeed = seed;
    const endX = Number(level?.endX) || 5000;
    const ys = (level?.platforms || []).map(p => p.y).filter(Number.isFinite);
    const topY = ys.length ? Math.min(...ys) : 200;
    const bottomY = ys.length ? Math.max(...ys) : 700;
    shaftXs = [];
    // feixes espacados mais que uma tela: no maximo dois visiveis ao mesmo tempo
    for (let x = 300 + (seed % 400); x < endX + 600; x += 1150 + ((seed >> (x % 7)) % 550)) shaftXs.push(x);

    // Mesmos planos, tons e fatores de paralaxe da cena Unity
    // (Rizosfera25DBootstrap.cs): fundo segue 35% da camera, intermediario 18%,
    // tom .2/.34 e dessaturacao .55/.35. Desenhados no plano do jogo, sem a
    // compressao da perspectiva.
    const far = createGrowthLayer({ shared, z: -340, seed: seed ^ 0x51, dim: .28, desat: .55, follow: .35, opacity: 1, maxSegments: 14000, lightGain: .5 });
    // intermediaria (a mais clara): menos raizes, mais curtas e com menos laterais
    const mid = createGrowthLayer({ shared, z: -130, seed: seed ^ 0x77, dim: .4, desat: .35, follow: .18, opacity: 1, maxSegments: 6000, lightGain: .78, maxGeneration: 1, branchSpacing: 2.2 });
    far.mesh.renderOrder = 5; mid.mesh.renderOrder = 12;
    // Sem hifas decorativas: a micorriza que aparece e a do proprio jogo
    // (simulacao). Hifas so de enfeite confundiam com a mecanica.
    growth.push(far, mid);
    for (const g of growth) scene.add(g.mesh);

    const r = far.random;
    for (let x = -200; x < endX + 1400; x += 300 + r() * 300) {
      far.spawn({ x, y: -(topY - 420), angle: -Math.PI / 2 + (r() - .5) * .35, width: 6 + r() * 5, speed: 34, maxLength: 1500 + r() * 500 });
    }
    const r2 = mid.random;
    for (let x = 0; x < endX + 800; x += 700 + r2() * 600) {
      mid.spawn({ x, y: -(topY - 380), angle: -Math.PI / 2 + (r2() - .5) * .4, width: 8 + r2() * 4, speed: 26, maxLength: 850 + r2() * 300 });
    }
    far.prewarm(40); mid.prewarm(26);
    camAnchor = null;
  }

  // ---- luzes ------------------------------------------------------------
  const lights = [];
  function pushLight(x, y, z, r, cr, cg, cb, i, slot = 0, key = 0, spot = false, id = null) {
    i *= tuning.lights;
    lights.push({ x, y, z, r, cr: cr * i, cg: cg * i, cb: cb * i, slot, key, spot, id });
  }
  // Luzes entram e saem devagar (~0,3 s): sem isso, quando a lista das mais
  // proximas mudava (camera andando, bacterias se mexendo) a luz aparecia ou
  // sumia num quadro so — o "pisca".
  const lightFade = new Map();
  let lastLightTime = null;
  const agentIds = new WeakMap();
  let agentIdSeq = 0;
  const agentId = a => { let k = agentIds.get(a); if (!k) { k = 'a' + (++agentIdSeq); agentIds.set(a, k); } return k; };
  let stickyExudate = null;
  function fadeLights(time) {
    const dt = lastLightTime === null ? 1 : Math.min(.25, Math.max(0, time - lastLightTime));
    lastLightTime = time;
    const k = 1 - Math.exp(-dt / .12);
    const seen = new Set();
    for (const L of lights) {
      if (!L.id) continue;
      seen.add(L.id);
      const f = lightFade.get(L.id) || { v: 0 };
      f.v += (1 - f.v) * k;
      f.base = { ...L, weight: L.weight ?? 1 };   // valores cheios deste quadro
      lightFade.set(L.id, f);
      L.cr *= f.v; L.cg *= f.v; L.cb *= f.v;
      L.weight = f.base.weight * f.v;
    }
    for (const [id, f] of lightFade) {
      if (seen.has(id)) continue;
      f.v -= f.v * k;
      if (f.v < .02) { lightFade.delete(id); continue; }
      // saindo: mesma luz do ultimo quadro, apagando, sem canal de sombra
      const B = f.base;
      lights.push({ ...B, slot: 0, cr: B.cr * f.v, cg: B.cg * f.v, cb: B.cb * f.v, weight: B.weight * f.v });
    }
  }


  const NIGHT_AMBIENT = shared.uAmbient.value.clone();
  const DAY_AMBIENT = new THREE.Color(.36, .38, .39);
  let daylight = 0;

  function collectLights(time, camCX, camCY, visW, visH) {
    lights.length = 0;
    emitters.begin();
    const level = state.level || {};
    const player = state.player;
    // Superficie (abertura da fase 1 e cinematica final): ceu aberto, luz do
    // dia vinda de cima. Transicao suave para nao "acender" de uma vez.
    const introStage = state.introFall?.stage;
    const atSurface = introStage === 'title' || introStage === 'surface' || document.body.classList.contains('phase-finale');
    daylight += ((atSurface ? 1 : 0) - daylight) * .08;
    shared.uAmbient.value.copy(NIGHT_AMBIENT).lerp(DAY_AMBIENT, daylight).multiplyScalar(tuning.ambient);
    shared.uFogDensity.value = .0026 * tuning.fog;
    if (daylight > .02) pushLight(camCX - visW * .3, camCY + visH * 1.4, 1400, 9000, 1, .95, .86, .72 * daylight, 0, 200);
    const ys = (level.platforms || []).map(p => p.y).filter(Number.isFinite);
    const topY = ys.length ? Math.min(...ys) : 200;
    // Feixes da superficie: alcance em unidades do mundo, independente do
    // zoom. Cada um mantem o MESMO
    // canal de sombra/volume enquanto existir (indice par/impar): antes o canal
    // ia para "o mais proximo", e quando dois trocavam de posicao o feixe piscava.
    const shafts = visibleShafts(shaftXs, camCX);
    // Fonte fixa acima do solo, inclusive quando o zoom revela mais do teto.
    // Desloca-la para fora do quadro mudava distancia, angulo e intensidade.
    const sourceY = shaftSourceY(topY);
    shafts.forEach(s => {
      const flick = .95 + .05 * Math.sin(time * .7 + s.x);
      // Culling decides which sources to draw; camera zoom never scales their
      // radiance. The same world point keeps the same source and brightness.
      const w = 1 - daylight;
      if (w <= .001) return;
      pushLight(s.x, sourceY, 320, 2300, .55, .82, 1.0, 1.9 * flick * w, (s.idx % 2) + 1, 100, true, 's' + s.idx);
      lights[lights.length - 1].weight = w;
    });
    if (player) {
      const px = player.x + player.w / 2, py = player.y + player.h * .35;
      pushLight(px + player.facing * 30, -(py - 14), 120, 440, 1.0, .82, .58, 1.0, 3, 90, false, 'p');
    }
    const ex = (level.exudates || [])
      .filter(e => !e.taken && Number.isFinite(e.x))
      .map(e => ({ e, d: Math.hypot(e.x - camCX, -e.y - camCY) }))
      .filter(o => o.d < visW)
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
    // o canal de sombra do exsudato so troca de dono se outro ficar bem mais perto
    const nearestEx = ex[0]?.e || null;
    const stickyEntry = ex.find(o => o.e === stickyExudate);
    if (!stickyEntry || (nearestEx && nearestEx !== stickyExudate && ex[0].d < stickyEntry.d * .7)) stickyExudate = nearestEx;
    ex.forEach(o => {
      const f = .85 + .15 * Math.sin(time * 3 + o.e.x * .01);
      pushLight(o.e.x, -o.e.y, 45, 260, .7, 1.0, .42, 1.0 * f, o.e === stickyExudate ? 4 : 0, 50, false, 'e' + Math.round(o.e.x) + ':' + Math.round(o.e.y));
    });
    // depositos de Fe3+: emitem (laranja), proporcional ao estoque
    const iron = (level.ironDeposits || [])
      .filter(d => d.stock > .08 && Number.isFinite(d.x) && Math.abs(d.x - camCX) < visW)
      .slice(0, 4);
    for (const d of iron) {
      const ratio = Math.min(1, d.stock / Math.max(.01, d.maxStock || 1));
      const pulse = .9 + .1 * Math.sin(time * 1.7 + (d.phase || 0));
      pushLight(d.x, -d.y, 30, 220, 1.0, .58, .26, (.9 + .8 * ratio) * pulse, 0, 45, false, 'i' + Math.round(d.x));
      // nucleo emissivo: so o bloom o espalha (desliga junto com o bloom)
      if (settings.bloom) emitters.add(d.x, -d.y, 1.0, .55, .22, (.4 + .5 * ratio) * pulse * Math.min(1.6, tuning.bloom), (d.radius || 14) * 2.4);
    }
    // Colonias: sem luz nem brilho permanente (o halo saiu). A inoculacao e
    // o vigor baixo aparecem como particulas transitorias (vfx-particles.js),
    // desenhadas na camada de brilho.
    // The surface EPS owns its wet highlights. The former radial checkpoint
    // dots and dashed HDR ring would draw an unrelated flower over the film.
    for (const c of level.checkpoints || []) {
      if (!Number.isFinite(c.x) || Math.abs(c.x - camCX) > visW) continue;
      pushLight(c.x + 10, -(c.y + 10), 50, 240, .35, .95, .9, c.active ? 1.2 : .45, 0, 30, false, 'c' + Math.round(c.x));
    }
    const goal = level.goal;
    if (goal && Number.isFinite(goal.x)) pushLight(goal.x + (goal.w || 0) / 2, -(goal.y || 0), 80, 500, 1, .85, .4, 1.6, 0, 40);
    const agents = getAgents() || [];
    const near = [];
    for (const a of agents) {
      if (!Number.isFinite(a.x) || !AGENT_COLORS[a.type]) continue;
      const d = Math.hypot(a.x - camCX, -a.y - camCY);
      if (d < visW * .7) near.push({ a, d });
    }
    near.sort((p, q) => p.d - q.d);
    // colonia vira uma luz so: nove bacterias juntas nao podem somar nove luzes
    const picked = [];
    for (const o of near) {
      if (picked.length >= 6) break;
      if (picked.some(q => Math.hypot(q.a.x - o.a.x, q.a.y - o.a.y) < 110)) continue;
      picked.push(o);
    }
    for (const { a } of picked) {
      const [r, g, b] = AGENT_COLORS[a.type];
      pushLight(a.x, -a.y, 40, 170, r, g, b, .3 + .12 * Math.sin(time * 2.4 + (a.phase || 0)), 0, 10, false, agentId(a));
    }
    fadeLights(time);
    lights.sort((a, b) => b.key - a.key);
    const n = Math.min(MAX_LIGHTS, lights.length);
    shared.uLightCount.value = n;
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const L = lights[i];
      if (!L || i >= n) continue;
      shared.uLightPos.value[i].set(L.x, L.y, L.z, L.r);
      shared.uLightPos.value[i].w = L.spot ? -L.r : L.r;
      shared.uLightCol.value[i].set(L.cr, L.cg, L.cb, settings.lighting ? L.slot : 0);
    }
    return lights.slice(0, n);
  }

  // ---- quadro -----------------------------------------------------------
  let lastLevel = null;
  let lastTime = performance.now();
  const stats = { ms: 0, sprites: 0, lights: 0, segments: 0, fps: 0, goalSparks: 0 };
  let fpsAcc = 0, fpsN = 0;

  function toWorldFactory(zoom, camX, camY) {
    return p => ({ x: camX + p.x / zoom, y: -(camY + p.y / zoom) });
  }

  /**
   * @param {(target:{bg,terrain,fx})=>void} drawLayers o jogo desenha aqui,
   *        usando os contextos entregues (fundo, terreno, efeitos).
   */
  function renderFrame(drawLayers) {
    const t0 = performance.now();
    if (!layers || mainCanvas.width !== W || mainCanvas.height !== H || builtScale !== renderScale) rebuild();
    if (state.level !== lastLevel || (state.level?.seed !== undefined && growthSeed === null)) {
      lastLevel = state.level;
      setupGrowth(state.level);
    }
    const time = Number(state.time) || 0;
    shared.uTime.value = time;

    // 0. o canvas do jogo, por cima, comeca limpo: recebe so o texto do mundo
    // (abaixo) e o que o jogo desenhar depois do mundo (cartao da cinematica)
    realCtx.save();
    realCtx.setTransform(1, 0, 0, 1, 0, 0);
    realCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    realCtx.restore();

    // 1. o jogo desenha nas tres camadas
    for (const L of settings.native ? [layers.fx, layers.glow, layers.equipment] : [layers.bg, layers.terrain, layers.fx, layers.glow, layers.equipment]) {
      L.ctx.setTransform(1, 0, 0, 1, 0, 0);
      L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
      if (L.scale !== 1) L.ctx.setTransform(L.scale, 0, 0, L.scale, 0, 0);
    }
    layers.captured.length = 0;
    biofilmLayer.begin();
    layers.terrainBridge.beginFrame();
    layers.fxBridge.beginFrame();
    goalOrbitQueue.length = 0;
    layers.glow.ctx.__glSoftFinalRootGlow = true;
    layers.glow.ctx.__glGoalOrbitParticle = captureGoalOrbit;
    layers.bg.ctx.__glDepthParticles = true;
    layers.terrainBridge.ctx.__glOrganicRoots = true;
    layers.terrainBridge.setCapture(settings.sprites);
    layers.fxBridge.setCapture(settings.sprites);
    const native = settings.native;
    if (native) {
      if (!rt.terrainNative) rebuildTargets();
      ensureNative();
      nativeBg.ctx.__glDepthParticles = true;
      nativeTerrain.ctx.__glOrganicRoots = true;
      nativeBg.begin(); nativeTerrain.begin();
      nativeTerrain.setCapture(settings.sprites);
      textures.resetStats();
      drawLayers({ bg: nativeBg.ctx, terrain: nativeTerrain.ctx, fx: layers.fxBridge.ctx, glow: layers.glow.ctx });
      layers.fx.tex.needsUpdate = true;
      layers.glow.tex.needsUpdate = true;
      layers.equipment.tex.needsUpdate = true;
      stats.nativeBg = nativeBg.render(rt.bgNative);
      stats.nativeTerrain = nativeTerrain.render(rt.terrainNative);
      stats.uploads = textures.uploads;
    } else {
      drawLayers({ bg: layers.bg.ctx, terrain: layers.terrainBridge.ctx, fx: layers.fxBridge.ctx, glow: layers.glow.ctx });
      for (const L of [layers.bg, layers.terrain, layers.fx, layers.glow, layers.equipment]) L.tex.needsUpdate = true;
    }
    const bgTex = native ? rt.bgNative.texture : layers.bg.tex;
    const terrainTex = native ? rt.terrainNative.texture : layers.terrain.tex;
    meshes.bg.material.uniforms.uMap.value = bgTex;
    meshes.bg.material.uniforms.uPremult.value = native ? 1 : 0;
    meshes.terrain.material.uniforms.uMap.value = terrainTex;
    meshes.terrain.material.uniforms.uPremult.value = native ? 1 : 0;
    meshes.occTerrain.material.uniforms.uMap.value = terrainTex;

    // 2. camera: o plano z=0 coincide exatamente com a vista 2D do jogo
    const zoom = Number(state.cameraZoom) || 1;
    const camX = Number(state.cameraX) || 0;
    const camY = Number(state.cameraY) || 0;
    const visW = W / zoom, visH = H / zoom;
    const dist = (visH / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const cx = camX + visW / 2, cy = -(camY + visH / 2);
    camera.position.set(cx, cy, dist);
    camera.near = Math.max(10, dist * .05); camera.far = dist + 4000;
    camera.lookAt(cx, cy, 0);
    camera.updateProjectionMatrix();
    shared.uCam.value.set(camX, camY, visW, visH);
    shared.uLightingOn.value = settings.lighting ? 1 : 0;
    shared.uShadowsOn.value = settings.shadows ? 1 : 0;

    // 3. sprites capturados -> lotes iluminados
    const toWorld = toWorldFactory(zoom, camX, camY);
    biofilmLayer.update(toWorld);
    for (const b of batches.values()) b.begin();
    for (const s of layers.captured) {
      let b = batches.get(s.image);
      if (!b) {
        b = createSpriteBatch(s.image, shared, maxTexture);
        batches.set(s.image, b);
        scene.add(b.mesh);
        occScene.add(b.occMesh);
      }
      b.add(s, toWorld);
    }
    for (const b of batches.values()) b.end();

    // 4. crescimento e particulas
    const dtReal = Math.min(.1, (t0 - lastTime) / 1000);
    lastTime = t0;
    let segs = 0;
    if (!camAnchor) camAnchor = { x: cx, y: cy };
    const camDX = cx - camAnchor.x, camDY = cy - camAnchor.y;
    for (const g of growth) {
      // 1 px de tela no plano z da camada
      g.setPixelSize(visH / GH);
      g.setCamDelta(camDX, camDY);
      g.mesh.visible = settings.growth;
      // a regiao visivel da camada esta deslocada pelo proprio fator de paralaxe
      const lx = cx - camDX * g.follow;
      if (settings.growth) g.step(dtReal, time, { x0: lx - visW * 1.2, x1: lx + visW * 1.2 });
      segs += g.segments;
    }
    for (const p of particles) { p.points.visible = settings.particles; p.setBeamOnly(settings.particlesBeam); p.update(camera, GH); }

    // 5. luzes
    const active = collectLights(time, cx, cy, visW, visH);
    // A tinted halo + tiny bright core
    // share each original orbit and use the same individual twinkle as dust.
    goalEmitters.begin();
    for (const p of goalOrbitQueue) {
      const wp = toWorld(p);
      const radius = p.radius / zoom;
      const tint = goalOrbitColors.get(p.color);
      const sparkle = p.twinkle;
      const peak = Math.max(0, Math.min(1, (sparkle - .9) / .32));
      const energy = p.alpha * sparkle * tuning.emission;
      goalEmitters.add(wp.x, wp.y, tint.r, tint.g, tint.b, energy * .34, radius * 6);
      goalEmitters.add(wp.x, wp.y, .62 + tint.r * .38, .62 + tint.g * .38, .62 + tint.b * .38,
        energy * (1.2 + peak * 2.5), radius * 1.5);
    }
    goalEmitters.end(GH / visH);
    stats.goalSparks = goalOrbitQueue.length;
    for (const core of shared.uBeamCore.value) core.set(0, 0, 0, 0);
    for (const L of active) {
      if (L.spot && (L.slot === 1 || L.slot === 2)) {
        shared.uBeamCore.value[L.slot - 1].set(L.x, L.y, 48, L.weight ?? 1);
      }
    }
    emitters.end(GH / visH);
    // Na superficie o fundo repete partes do primeiro plano (planta, ceu):
    // desfoque e nevoa ali viravam um halo azul em volta das folhas.
    meshes.bg.material.uniforms.uLodBlur.value = .3 * (1 - daylight);
    meshes.bg.material.uniforms.uDepth.value = -420 * (1 - daylight) - 1;
    meshes.terrain.material.uniforms.uRim.value = tuning.rim * (1 - .85 * daylight);
    meshes.terrain.material.uniforms.uSky.value = tuning.soil * (1 - .7 * daylight);
    // Na superficie o ceu esta na mesma camada que a planta: o relevo tirado da
    // luminancia inclinava as normais do ceu em volta de cada folha e fazia um
    // halo escuro ("sombra"). De dia o relevo vem so da forma, nao da cor.
    meshes.terrain.material.uniforms.uDetail.value = .35 * (1 - daylight);
    // Na superficie o ceu esta na mesma camada que a planta: o relevo tirado da
    // luminancia inclinava as normais do ceu em volta de cada folha e fazia um
    // halo escuro ("sombra"). De dia o relevo vem so da forma, nao da cor.
    meshes.terrain.material.uniforms.uDetail.value = .35 * (1 - daylight);
    const toUv = (x, y) => [ (x - camX) / visW, 1 - ((-y) - camY) / visH ];

    // O teto de solo aparece e some conforme a camera sobe: se ele fizesse
    // sombra, os feixes ligavam e desligavam no pulo. Fica fora da oclusao.
    {
      const ys = (state.level?.platforms || []).map(p => p.y).filter(Number.isFinite);
      const cutWorld = (ys.length ? Math.min(...ys) : -1e9) - 60;
      meshes.occTerrain.material.uniforms.uCutV.value = 1 - (cutWorld - camY) / visH;
    }
    // 6. oclusao (terreno + sprites) em meia resolucao
    renderer.setRenderTarget(rt.occ);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(occScene, camera);

    // 7. visibilidade por slot de sombra
    const slots = visPass.material.uniforms.uSlot.value;
    for (const s of slots) s.set(0, 0, 0, 0);
    for (const L of active) {
      if (!L.slot) continue;
      const [u, v] = toUv(L.x, L.y);
      const reach = (L.r / visH) * .9;
      // a lanterna do jogador nao e bloqueada pelo proprio Miguelito
      slots[L.slot - 1].set(u, v, reach, L.slot === 3 ? 1 : 2);
    }
    visPass.material.uniforms.uOcc.value = rt.occ.texture;
    visPass.material.uniforms.uAspect.value = W / H;
    visPass.material.uniforms.uTime.value = time;
    // na superficie (dia) nao ha sombra projetada dos feixes: ela virava uma
    // copia escura da planta deslocada no ceu ("visao dupla")
    visPass.material.uniforms.uCast.value = settings.shadows && daylight < .3 ? 1 : 0;
    meshes.fx.material.uniforms.uGlow.value = .9 * tuning.emission;
    visPass.material.uniforms.uSoil.value = 9 * tuning.soil;
    renderer.setRenderTarget(rt.vis);
    visPass.render(renderer);

    // 8. feixes volumetricos
    meshes.vol.visible = settings.volumetric && settings.lighting;
    if (meshes.vol.visible) {
      const shaftU = volPass.material.uniforms.uShaft.value;
      shaftU[0].set(0, 0, 0, 0); shaftU[1].set(0, 0, 0, 0);
      active.filter(L => L.slot === 1 || L.slot === 2).forEach(L => {
        shaftU[L.slot - 1].set(L.x, L.y, .75 * (L.weight ?? 1), 1);
      });
      volPass.material.uniforms.uOcc.value = rt.occ.texture;
      volPass.material.uniforms.uTime.value = time;
      renderer.setRenderTarget(rt.vol);
      volPass.render(renderer);
      // desfoque separavel em dois passes (meia resolucao)
      // Fixed world radius: blur must not spread farther across the soil when
      // zooming out either. The Gaussian weights still sum to one.
      const bw = 2.5 / visW, bh = 2.5 / visH;
      blurPass.material.uniforms.uSrc.value = rt.vol.texture;
      blurPass.material.uniforms.uDir.value.set(bw, 0);
      renderer.setRenderTarget(rt.volB);
      blurPass.render(renderer);
      blurPass.material.uniforms.uSrc.value = rt.volB.texture;
      blurPass.material.uniforms.uDir.value.set(0, bh);
      renderer.setRenderTarget(rt.vol);
      blurPass.render(renderer);
      meshes.vol.material.uniforms.uVol.value = rt.vol.texture;
      meshes.vol.material.uniforms.uStrength.value = tuning.shafts * (1 - daylight);
    }

    // 9. cena principal em HDR
    renderer.setRenderTarget(rt.scene);
    renderer.setClearColor(new THREE.Color(0.006, 0.02, 0.026), 1);
    renderer.clear();
    renderer.render(scene, camera);

    // 10. bloom + grade final
    if (settings.bloom) {
      bloom.strength = tuning.bloom * (1 - daylight);
      bloom.render(renderer, null, rt.scene, 0, false);
    }
    const shake = Number(state.shake) || 0;
    finalPass.material.uniforms.uShake.value.set(
      shake ? (Math.random() - .5) * shake * 24 / W : 0,
      shake ? (Math.random() - .5) * shake * 16 / H : 0,
    );
    finalPass.material.uniforms.uScene.value = rt.scene.texture;
    finalPass.material.uniforms.uTime.value = time;
    finalPass.material.uniforms.uGrade.value = settings.grade ? 1 : 0;
    finalPass.material.uniforms.uExposure.value = tuning.exposure;
    for (const b of batches.values()) b.mesh.material.uniforms.uLightScale.value = tuning.spriteLight;
    renderer.setRenderTarget(null);
    finalPass.render(renderer);

    // 11. o canvas do jogo fica transparente por cima: so recebe o que o jogo
    // desenha depois do mundo (cartao da cinematica). Nada volta da GPU.
    setVisible(true);

    stats.ms = performance.now() - t0;
    stats.sprites = layers.captured.length;
    stats.lights = active.length;
    stats.segments = segs;
    stats.biofilms = biofilmLayer.stats.visible;
    fpsAcc += dtReal; fpsN++;
    if (fpsAcc > .5) { stats.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  }


  return {
    renderFrame,
    settings,
    tuning,
    saveTuning() { try { localStorage.setItem('miguelito:25d:tuning', JSON.stringify(tuning)); } catch (_) {} },
    setVisible,
    gpuName,
    integratedGpu,
    get renderScale() { return renderScale; },
    setRenderScale(v) {
      renderScale = Math.min(1, Math.max(.4, Number(v) || 1));
      try { localStorage.setItem('miguelito:25d:scale', String(renderScale)); } catch (_) {}
    },
    stats,
    renderer,
    toggle(name) { if (name in settings) settings[name] = !settings[name]; return settings[name]; },
  };
}

// ---------------------------------------------------------------- painel de teste

const PANEL_ITEMS = [
  ['native', 'Fundo e terreno direto na GPU (teste)'],
  ['lighting', 'Luz dinâmica'],
  ['shadows', 'Sombras'],
  ['volumetric', 'Feixes volumétricos'],
  ['sprites', 'Sprites com normal map'],
  ['growth', 'Raízes de fundo crescendo'],
  ['particles', 'Partículas em profundidade'],
  ['particlesBeam', 'Brilho só no núcleo do feixe'],
  ['bloom', 'Bloom'],
  ['grade', 'Correção de cor e vinheta'],
];

const PANEL_SLIDERS = [
  ['exposure', 'Exposição', .5, 2.5, .05],
  ['ambient', 'Luz ambiente', 0, 3, .05],
  ['lights', 'Intensidade das luzes', 0, 4, .05],
  ['spriteLight', 'Luz nos sprites', 0, 2, .05],
  ['rim', 'Contorno do terreno', 0, 4, .05],
  ['soil', 'Luz entrando no solo', 0, 3, .05],
  ['bloom', 'Bloom (espalhamento)', 0, 2.5, .05],
  ['emission', 'Brilho próprio (partículas, núcleos)', 0, 2.5, .05],
  ['shafts', 'Feixes', 0, 4, .05],
  ['fog', 'Névoa de profundidade', 0, 3, .05],
];

/**
 * Painel para comparar efeito por efeito e calibrar. G alterna 2,5D / 2D
 * original, V mostra ou esconde. FPS medido pela pagina nos dois modos.
 */
export function mount25DPanel({ renderer25D, isActive, setActive }) {
  const panel = document.createElement('section');
  panel.id = 'panel-25d';
  panel.setAttribute('aria-label', 'Painel do renderizador 2,5D');
  panel.innerHTML = `
    <style>
      #panel-25d{position:fixed;right:12px;bottom:12px;z-index:60;font:600 12px/1.35 Inter,system-ui,sans-serif;
        color:#dff7f4;background:rgba(4,18,22,.86);border:1px solid rgba(108,231,223,.35);border-radius:12px;
        padding:10px 12px;width:268px;max-height:calc(100dvh - 24px);overflow:auto;backdrop-filter:blur(6px);
        box-shadow:0 8px 30px rgba(0,0,0,.45)}
      #panel-25d h2{margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6ce7df}
      #panel-25d .collapse{all:unset;cursor:pointer;display:flex;justify-content:space-between;width:100%}
      #panel-25d.closed .body{display:none}
      #panel-25d.closed h2{margin:0}
      #panel-25d label{display:flex;gap:8px;align-items:center;padding:2px 0;cursor:pointer}
      #panel-25d input[type=checkbox]{accent-color:#6ce7df}
      #panel-25d .mode{display:flex;gap:6px;margin:4px 0 8px}
      #panel-25d .mode button{flex:1;border:1px solid rgba(108,231,223,.45);background:transparent;color:#dff7f4;
        border-radius:8px;padding:6px;font:inherit;cursor:pointer}
      #panel-25d .mode button[aria-pressed=true]{background:#6ce7df;color:#062326}
      #panel-25d .phase{justify-content:space-between;margin-bottom:6px}
      #panel-25d select{font:inherit;background:#0b2a2f;color:#dff7f4;border:1px solid rgba(108,231,223,.45);border-radius:6px;padding:2px 4px}
      #panel-25d .sl{display:grid;grid-template-columns:1fr 38px;gap:2px 6px;align-items:center;margin:2px 0}
      #panel-25d .sl span{font-weight:500;color:#bfe3de}
      #panel-25d .sl output{text-align:right;font-variant-numeric:tabular-nums;color:#9fc9c4}
      #panel-25d .sl input{grid-column:1/3;width:100%;accent-color:#6ce7df}
      #panel-25d details{margin-top:6px}
      #panel-25d summary{cursor:pointer;color:#6ce7df}
      #panel-25d .row{display:flex;gap:6px;margin-top:6px}
      #panel-25d .row button{flex:1;border:1px solid rgba(108,231,223,.35);background:transparent;color:#dff7f4;border-radius:6px;padding:4px;font:inherit;cursor:pointer}
      #panel-25d .stats{margin-top:8px;color:#dff7f4;font-variant-numeric:tabular-nums}
      #panel-25d .gpu{color:#9fc9c4;font-weight:500;word-break:break-word}
      #panel-25d .warn{color:#ffd28a;font-weight:500}
      #panel-25d .hint{margin-top:4px;color:#7fa9a4;font-weight:500}
      #panel-25d[hidden]{display:none}
    </style>
    <h2><button type="button" class="collapse" aria-expanded="true">Rizosfera 2,5D <span>▾</span></button></h2>
    <div class="body">
      <div class="mode">
        <button type="button" data-mode="25d">2,5D</button>
        <button type="button" data-mode="2d">2D original</button>
      </div>
      <label class="phase">Fase
        <select data-phase>
          <option value="">—</option>
          <option value="1">1 · Primeiros passos</option>
          <option value="2">2 · Recrutar e estabelecer</option>
          <option value="3">3 · Rhizobium e FBN</option>
          <option value="4">4 · Azospirillum</option>
          <option value="5">5 · Micorriza</option>
          <option value="6">6 · Ferro e biocontrole</option>
          <option value="7">7 · Trichoderma × Rhizoctonia</option>
          <option value="8">8 · Fósforo</option>
          <option value="9">9 · Meloidogyne</option>
          <option value="10">10 · Ralstonia</option>
        </select>
      </label>
      <label class="phase">Resolução da GPU
        <select data-scale>
          <option value="1">100%</option>
          <option value="0.85">85%</option>
          <option value="0.75">75%</option>
          <option value="0.6">60%</option>
          <option value="0.5">50%</option>
        </select>
      </label>
      <div class="toggles"></div>
      <details class="cost"><summary>Teste de custo (2D original)</summary>
        <div class="hint">Desmarque uma parte e veja o FPS do 2D original subir: é quanto ela custa neste aparelho.</div>
        <div class="costs"></div>
      </details>
      <details><summary>Calibrar luz</summary>
        <div class="sliders"></div>
        <div class="row"><button type="button" data-copy>Copiar valores</button><button type="button" data-reset>Padrão</button></div>
      </details>
      <div class="stats"></div>
      <div class="gpu"></div>
      <div class="hint">G alterna 2,5D/2D · V esconde · aparece com ?painel=1</div>
    </div>`;
  for (const type of ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'wheel']) {
    panel.addEventListener(type, e => e.stopPropagation(), { passive: true });
  }

  const collapse = panel.querySelector('.collapse');
  const setClosed = closed => {
    panel.classList.toggle('closed', closed);
    collapse.setAttribute('aria-expanded', String(!closed));
    collapse.querySelector('span').textContent = closed ? '▸' : '▾';
    try { localStorage.setItem('miguelito:25d:panel-closed', closed ? '1' : '0'); } catch (_) {}
  };
  collapse.addEventListener('click', () => { setClosed(!panel.classList.contains('closed')); collapse.blur(); });
  let startClosed = false;
  try { startClosed = localStorage.getItem('miguelito:25d:panel-closed') === '1'; } catch (_) {}
  setClosed(startClosed);

  const toggles = panel.querySelector('.toggles');
  for (const [key, label] of PANEL_ITEMS) {
    const row = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = `panel25d-${key}`;
    box.checked = renderer25D.settings[key];
    box.addEventListener('change', () => {
      renderer25D.settings[key] = box.checked;
      if (key === 'native') { try { localStorage.setItem('miguelito:25d:native', box.checked ? '1' : '0'); } catch (_) {} }
      if (key === 'particlesBeam') { try { localStorage.setItem('miguelito:25d:particles-core', box.checked ? '1' : '0'); } catch (_) {} }
      box.blur();
    });
    row.append(box, document.createTextNode(label));
    toggles.append(row);
  }

  const COSTS = [['fundo', 'Fundo (imagem + paralaxe)'], ['terreno', 'Terreno (solo e raízes)'], ['luz', 'Luz 2D do original'], ['efeitos', 'Organismos e efeitos']];
  // partes do terreno (nomes dos trechos em rhizosphere-geometry.js)
  const TERRAIN_PARTS = [
    ['terreno/raizes corpo (cache)', 'Corpo das raízes'], ['terreno/pelos radiculares', 'Pelos radiculares'],
    ['terreno/massas (cache)', 'Massas de solo'], ['terreno/agregados', 'Agregados (blocos ligados às raízes)'],
    ['terreno/teto', 'Teto de solo'], ['terreno/chao', 'Chão da superfície'], ['terreno/plantas', 'Plantas'], ['terreno/ceu', 'Céu'],
  ];
  globalThis.__terrenoPular = globalThis.__terrenoPular || new Set();
  const costs = panel.querySelector('.costs');
  for (const [key, label] of COSTS) {
    const row = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !(window.miguelitoCusto2D?.[key]);
    box.addEventListener('change', () => {
      if (window.miguelitoCusto2D) window.miguelitoCusto2D[key] = !box.checked;
      if (!box.checked && isActive()) { setActive(false); syncMode(); }
      box.blur();
    });
    row.append(box, document.createTextNode(label));
    costs.append(row);
  }
  // como o terreno guarda e copia as imagens prontas (cache)
  globalThis.__terrenoCache = globalThis.__terrenoCache || { scale: 1, smoothing: 'low' };
  const cacheOpts = document.createElement('div');
  cacheOpts.className = 'hint';
  cacheOpts.textContent = 'Imagens prontas do terreno (marcar = como era antes):';
  costs.append(cacheOpts);
  for (const [label, read, write] of [
    ['Cache em 2× (desmarcado: 1×)', () => globalThis.__terrenoCache.scale === 2, on => { globalThis.__terrenoCache.scale = on ? 2 : 1; }],
    ['Suavização alta (desmarcado: normal)', () => globalThis.__terrenoCache.smoothing === 'high', on => { globalThis.__terrenoCache.smoothing = on ? 'high' : 'low'; }],
  ]) {
    const row = document.createElement('label');
    row.style.paddingLeft = '14px';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = read();
    box.addEventListener('change', () => { write(box.checked); box.blur(); });
    row.append(box, document.createTextNode(label));
    costs.append(row);
  }
  const partsTitle = document.createElement('div');
  partsTitle.className = 'hint';
  partsTitle.textContent = 'Partes do terreno:';
  costs.append(partsTitle);
  for (const [key, label] of TERRAIN_PARTS) {
    const row = document.createElement('label');
    row.style.paddingLeft = '14px';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !globalThis.__terrenoPular.has(key);
    box.addEventListener('change', () => {
      if (box.checked) globalThis.__terrenoPular.delete(key); else globalThis.__terrenoPular.add(key);
      box.blur();
    });
    row.append(box, document.createTextNode(label));
    costs.append(row);
  }

  const defaults = { ...renderer25D.tuning };
  const sliders = panel.querySelector('.sliders');
  const inputs = {};
  for (const [key, label, min, max, step] of PANEL_SLIDERS) {
    const wrap = document.createElement('div');
    wrap.className = 'sl';
    const name = document.createElement('span');
    name.textContent = label;
    const out = document.createElement('output');
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min, max, step, id: `panel25d-t-${key}` });
    input.value = renderer25D.tuning[key];
    out.textContent = Number(input.value).toFixed(2);
    input.addEventListener('input', () => {
      renderer25D.tuning[key] = Number(input.value);
      out.textContent = Number(input.value).toFixed(2);
      renderer25D.saveTuning();
    });
    inputs[key] = { input, out };
    wrap.append(name, out, input);
    sliders.append(wrap);
  }
  panel.querySelector('[data-reset]').addEventListener('click', e => {
    Object.assign(renderer25D.tuning, DEFAULT_TUNING);
    for (const [k, { input, out }] of Object.entries(inputs)) { input.value = DEFAULT_TUNING[k]; out.textContent = Number(DEFAULT_TUNING[k]).toFixed(2); }
    renderer25D.saveTuning();
    e.currentTarget.blur();
  });
  panel.querySelector('[data-copy]').addEventListener('click', async e => {
    const btn = e.currentTarget;
    const text = JSON.stringify(renderer25D.tuning);
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copiado'; }
    catch (_) { btn.textContent = text; }
    setTimeout(() => { btn.textContent = 'Copiar valores'; }, 2500);
    btn.blur();
  });
  void defaults;

  // Pular para uma fase: mesmo formato de campanha que o jogo guarda na sessao
  const phaseSelect = panel.querySelector('[data-phase]');
  try {
    const saved = JSON.parse(sessionStorage.getItem('miguelito:campaign:v2') || 'null');
    if (saved?.phase) phaseSelect.value = String(saved.phase);
  } catch (_) {}
  phaseSelect.addEventListener('change', () => {
    const phase = Number(phaseSelect.value);
    if (!phase) return;
    try {
      sessionStorage.setItem('miguelito:campaign:v2', JSON.stringify({
        seed: 'demo-25d', phase,
        unlocks: { doubleJump: true, dash: true, pulse: true, jetpack: true },
        totalScore: 0, history: [], narrationSeen: [],
      }));
    } catch (_) {}
    location.reload();
  });

  const scaleSelect = panel.querySelector('[data-scale]');
  scaleSelect.value = String(renderer25D.renderScale);
  if (scaleSelect.value === '') scaleSelect.value = '1';
  scaleSelect.addEventListener('change', () => { renderer25D.setRenderScale(Number(scaleSelect.value)); scaleSelect.blur(); });

  const modeButtons = [...panel.querySelectorAll('[data-mode]')];
  const syncMode = () => modeButtons.forEach(b => b.setAttribute('aria-pressed', String((b.dataset.mode === '25d') === isActive())));
  modeButtons.forEach(b => b.addEventListener('click', () => { setActive(b.dataset.mode === '25d'); syncMode(); b.blur(); }));
  syncMode();
  document.body.append(panel);

  window.addEventListener('keydown', e => {
    if (e.repeat || e.target?.closest?.('input,textarea,select')) return;
    if (e.code === 'KeyG') setTimeout(syncMode, 50);   // o jogo trata a tecla G
    if (e.code === 'KeyV') panel.hidden = !panel.hidden;
  });

  // FPS medido pela propria pagina (requestAnimationFrame), igual nos dois
  // modos: assim da para comparar o 2D original com o 2,5D na mesma maquina.
  let frames = 0, since = performance.now(), fps = 0;
  const tick = now => { frames++; if (now - since >= 500) { fps = Math.round(frames * 1000 / (now - since)); frames = 0; since = now; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const stats = panel.querySelector('.stats');
  stats.style.whiteSpace = 'pre-line';
  const gpu = panel.querySelector('.gpu');
  const integrated = /intel|uhd|iris|arc\(tm\) graphics|microsoft basic|swiftshader|llvmpipe/i.test(renderer25D.gpuName);
  gpu.innerHTML = `GPU do navegador: ${renderer25D.gpuName.replace(/^ANGLE \((.*)\)$/, '$1')}` +
    (integrated ? '<div class="warn">O navegador está usando a GPU integrada. No Windows: Configurações › Sistema › Tela › Gráficos › navegador → Alto desempenho.</div>' : '');
  setInterval(() => {
    const s = renderer25D.stats;
    stats.textContent = isActive()
      ? `${fps} fps (2,5D${renderer25D.settings.native ? ' nativo' : ''}) · CPU ${s.ms.toFixed(1)} ms · ${s.lights} luzes · ${s.sprites} sprites`
        + (renderer25D.settings.native && s.nativeTerrain ? ` · GPU: ${s.nativeBg.quads + s.nativeTerrain.quads} imagens, ${s.nativeBg.segmentsUsed + s.nativeTerrain.segmentsUsed} camadas de vetor, ${s.uploads} envios` : '')
      : `${fps} fps (2D original)`;
    // diagnostico do biofilme deslocado (temporario)
    const probe = globalThis.miguelitoBiofilmProbe?.();
    if (probe) stats.textContent += `\n${probe}`;
  }, 500);
  if (new URLSearchParams(location.search).get('painel') === '0') panel.hidden = true;
  return panel;
}

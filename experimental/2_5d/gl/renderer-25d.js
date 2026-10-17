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
import { createBridgeContext } from './ctx-bridge.js';
import { generateSpriteNormalMap, loadAuthoredNormal } from './sprite-normals.js';
import { LIGHTING_GLSL, MAX_LIGHTS, createSharedUniforms } from './shading.js';
import { createGrowthLayer, hashString } from './growth.js';
import { createParticleField } from './particles.js';

const FOV = 32;
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
  vec3 lit = albedo * (uAmbient * ao + light) + rim * albedo * uRim;
  vec3 col = mix(albedo * uBrightness, lit, uLit * uLightingOn);
  // o que o jogo desenhou como brilho (exsudato, halo, aura) continua emitindo
  float lum = dot(albedo, vec3(.2126, .7152, .0722));
  float sat = max(albedo.r, max(albedo.g, albedo.b)) - min(albedo.r, min(albedo.g, albedo.b));
  col += albedo * uGlow * smoothstep(.45, .85, lum) * smoothstep(.15, .45, sat);
  if (uDepth < 0.0) col = applyFog(col, uDepth);
  gl_FragColor = vec4(col, c.a);
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
  vec3 lit = c.rgb * (uFloor + uAmbient + light * .55) + rim * c.rgb * uRimGain;
  vec3 col = mix(c.rgb, lit, uLightingOn);
  gl_FragColor = vec4(col * a, a);
}`;

const OCC_SCREEN_FRAG = /* glsl */`
uniform sampler2D uMap;
varying vec2 vUv;
void main() { gl_FragColor = vec4(smoothstep(.15, .7, texture(uMap, vUv).a), 0.0, 0.0, 1.0); }`;

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
float march(vec4 s) {
  if (s.w < .5) return 1.0;
  vec2 d = s.xy - vUv;
  vec2 da = d * vec2(uAspect, 1.0);
  float len = length(da);
  if (len < .004) return 1.0;
  float reach = min(len, s.z);
  vec2 dir = d / len;
  const int STEPS = 22;
  float jitter = hash(vUv);
  float t = 1.0;
  float start = .006;
  for (int k = 0; k < STEPS; k++) {
    float f = start + (reach - start) * (float(k) + jitter) / float(STEPS);
    vec2 p = vUv + dir * f;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) break;
    vec2 o = textureLod(uOcc, p, 1.0).rg;
    float a = o.r + (s.w > 1.5 ? o.g : 0.0);
    t *= 1.0 - clamp(a, 0.0, 1.0) * .2;
  }
  return mix(.08, 1.0, t);
}
void main() {
  gl_FragColor = vec4(march(uSlot[0]), march(uSlot[1]), march(uSlot[2]), march(uSlot[3]));
}`;

// Feixes volumetricos (dispersao em tela, a partir das luzes da superficie).
const VOL_FRAG = /* glsl */`
uniform sampler2D uOcc;
uniform vec4 uShaft[2];   // xy: luz em uv, z: intensidade, w: ativo
uniform vec3 uShaftColor;
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float noise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
vec3 rays(vec4 s) {
  if (s.w < .5) return vec3(0.0);
  vec2 d = (s.xy - vUv);
  const int N = 28;
  vec2 stepv = d / float(N) * .92;
  vec2 p = vUv + stepv * hash(vUv);
  float decay = 1.0, acc = 0.0;
  for (int k = 0; k < N; k++) {
    vec2 o = textureLod(uOcc, clamp(p, 0.0, 1.0), 2.0).rg;
    float open = 1.0 - clamp(o.r + o.g * .8, 0.0, 1.0);
    acc += open * decay;
    decay *= .955;
    p += stepv;
  }
  acc /= float(N);
  // feixe: forte perto da fonte, some com a distancia; contraste vem das
  // sombras das plataformas cortando o raio
  float dist = length(d * vec2(1.6, 1.0));
  float fall = exp(-dist * 1.35);
  float cone = smoothstep(.75, .05, abs(d.x) * 1.4);
  // fissuras na superficie: o feixe chega em raios, que oscilam devagar
  float ang = atan(d.x, d.y);
  float streak = noise1(ang * 26.0 + uTime * .05) * .7 + noise1(ang * 61.0 - uTime * .08) * .3;
  streak = smoothstep(.35, .95, streak);
  return uShaftColor * pow(acc, 3.0) * s.z * fall * cone * (.25 + 1.6 * streak);
}
void main() { gl_FragColor = vec4(rays(uShaft[0]) + rays(uShaft[1]), 1.0); }`;

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
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0.0, 1.0);
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
  vec3 mapped = aces(col);
  // grade: sombras puxadas para verde-azulado, luzes levemente quentes
  float l = dot(mapped, vec3(.2126, .7152, .0722));
  vec3 shadowTint = vec3(.92, 1.02, 1.06);
  vec3 lightTint = vec3(1.04, 1.0, .95);
  mapped *= mix(mix(vec3(1.0), shadowTint, uGrade), mix(vec3(1.0), lightTint, uGrade), smoothstep(.15, .8, l));
  mapped = mix(vec3(l), mapped, 1.0 + .08 * uGrade);
  float vig = smoothstep(.85, .25, r2 * 1.6);
  mapped *= mix(1.0, mix(.62, 1.0, vig), uGrade);
  vec3 outc = pow(max(mapped, 0.0), vec3(1.0 / 2.2));
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
    const authored = await loadAuthoredNormal(image.src);
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
    add(s, toWorld, z) {
      if (count >= cap) return;
      const W = image.naturalWidth, H = image.naturalHeight;
      const p0 = toWorld(s.p0), pu = toWorld(s.pu), pv = toWorld(s.pv);
      const p1 = { x: pu.x + pv.x - p0.x, y: pu.y + pv.y - p0.y };
      const v = count * 4;
      pos.set([p0.x, p0.y, z, pu.x, pu.y, z, pv.x, pv.y, z, p1.x, p1.y, z], v * 3);
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

// ---------------------------------------------------------------- renderizador

export function createRenderer25D({ mainCanvas, state, getAgents = () => null, quality = 'high' }) {
  const realCtx = mainCanvas.getContext('2d');
  const glCanvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas: glCanvas, antialias: false, alpha: false,
    powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  const maxTexture = Math.min(8192, renderer.capabilities.maxTextureSize);

  const shared = createSharedUniforms();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 10, 8000);
  const scene = new THREE.Scene();
  const occScene = new THREE.Scene();
  const fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let W = 0, H = 0;
  let layers = null;
  let rt = null;
  let bloom = null;
  const settings = {
    lighting: true, shadows: true, volumetric: true, bloom: true, growth: true,
    particles: true, grade: true, sprites: true,
  };

  // ---- camadas 2D do jogo -----------------------------------------------
  function buildLayers() {
    const make = (name, opts) => {
      const canvas = makeLayerCanvas(W, H);
      const ctx = canvas.getContext('2d');
      const tex = canvasTexture(canvas, opts);
      return { name, canvas, ctx, tex };
    };
    const bg = make('bg');
    const terrain = make('terrain');
    const fx = make('fx');
    const captured = [];
    const terrainBridge = createBridgeContext(terrain.ctx, s => captured.push(s));
    const fxBridge = createBridgeContext(fx.ctx, s => captured.push(s));
    return { bg, terrain, fx, captured, terrainBridge, fxBridge };
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
  let growthSeed = null;
  let shaftXs = [];
  let lastExudateState = new Map();

  function rebuildTargets() {
    rt?.scene.dispose(); rt?.occ.dispose(); rt?.vis.dispose(); rt?.vol.dispose();
    const hdr = { type: THREE.HalfFloatType, depthBuffer: false };
    rt = {
      scene: new THREE.WebGLRenderTarget(W, H, hdr),
      occ: new THREE.WebGLRenderTarget(W >> 1, H >> 1, {
        depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
      }),
      vis: new THREE.WebGLRenderTarget(W >> 1, H >> 1, { depthBuffer: false }),
      vol: new THREE.WebGLRenderTarget(W >> 2, H >> 2, { depthBuffer: false, type: THREE.HalfFloatType }),
    };
    shared.uVis.value = rt.vis.texture;
    shared.uResolution.value.set(W, H);
    bloom?.dispose?.();
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), .55, .5, 1.05);
  }

  function rebuild() {
    W = mainCanvas.width; H = mainCanvas.height;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    for (const m of Object.values(meshes)) { scene.remove(m); occScene.remove(m); }
    layers = buildLayers();
    meshes.bg = screenMesh(layerMaterial(layers.bg.tex, {
      depth: -420, lit: .45, volume: .25, detail: .5, gain: 3, lodBlur: 1.1, lodVolume: 3.5, wrap: .8, brightness: .36, rim: .2,
    }));
    meshes.terrain = screenMesh(layerMaterial(layers.terrain.tex, {
      depth: 0, lit: 1, volume: 1, detail: .35, gain: 7, lodVolume: 2.6, wrap: .25, spec: .35, ao: .9, rim: .9,
    }));
    meshes.fx = screenMesh(layerMaterial(layers.fx.tex, {
      depth: 0, lit: .6, volume: .35, detail: .2, gain: 3, lodVolume: 2.0, wrap: .7, spec: .3, rim: .5, glow: 1.6,
    }));
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
      uniforms: { uMap: { value: layers.terrain.tex } },
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
      uAspect: { value: 16 / 9 }, uTime: { value: 0 },
    },
    vertexShader: SCREEN_VERT, fragmentShader: VIS_FRAG,
  }));
  const volPass = new THREE.FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: {
      uOcc: { value: null }, uShaft: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uShaftColor: { value: new THREE.Color(0.55, 0.85, 1.0) }, uTime: { value: 0 },
    },
    vertexShader: SCREEN_VERT, fragmentShader: VOL_FRAG,
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

  // ---- crescimento organico ---------------------------------------------
  function setupGrowth(level) {
    for (const g of growth) scene.remove(g.mesh);
    growth.length = 0;
    const seed = hashString(String(level?.seed ?? level?.phaseTitle ?? 'rizosfera'));
    growthSeed = seed;
    const endX = Number(level?.endX) || 5000;
    const ys = (level?.platforms || []).map(p => p.y).filter(Number.isFinite);
    const topY = ys.length ? Math.min(...ys) : 200;
    const bottomY = ys.length ? Math.max(...ys) : 700;
    shaftXs = [];
    for (let x = 300 + (seed % 400); x < endX + 600; x += 640 + ((seed >> (x % 7)) % 360)) shaftXs.push(x);

    const far = createGrowthLayer({ shared, z: -320, seed: seed ^ 0x51, dim: .3, opacity: .8, maxSegments: 14000 });
    const mid = createGrowthLayer({ shared, z: -120, seed: seed ^ 0x77, dim: .5, opacity: .9, maxSegments: 12000 });
    const hyph = createGrowthLayer({ shared, z: -20, seed: seed ^ 0x99, dim: .9, opacity: .7, maxSegments: 16000, thicken: 0 });
    far.mesh.renderOrder = 5; mid.mesh.renderOrder = 12; hyph.mesh.renderOrder = 25;
    growth.push(far, mid, hyph);
    for (const g of growth) scene.add(g.mesh);

    // raizes de fundo descem da superficie; sementes deterministicas por fase.
    // Ficam ATRAS do plano de jogo: dao profundidade sem disputar a leitura
    // das plataformas (raiz em primeiro plano tapava a rota).
    const r = far.random;
    for (let x = -200; x < endX + 400; x += 300 + r() * 300) {
      far.spawn({ x, y: -(topY - 420), angle: -Math.PI / 2 + (r() - .5) * .35, width: 6 + r() * 5, speed: 34, maxLength: 1500 + r() * 500 });
    }
    const r2 = mid.random;
    for (let x = 0; x < endX + 400; x += 520 + r2() * 520) {
      mid.spawn({ x, y: -(topY - 380), angle: -Math.PI / 2 + (r2() - .5) * .4, width: 8 + r2() * 4, speed: 30, maxLength: 1300 + r2() * 400 });
    }
    // hifas: rede micorrizica saindo de algumas plataformas de raiz
    const r4 = hyph.random;
    for (const p of (level?.platforms || [])) {
      if (p.recovery || r4() < .6) continue;
      const cx = p.x + p.w * (.2 + r4() * .6);
      const cy = -(p.y + p.h * .75);
      for (let k = 0; k < 2; k++) {
        hyph.spawn({ x: cx, y: cy, angle: -Math.PI / 2 + (r4() - .5) * 2.2, kind: 'hypha', width: 1.1, speed: 40, maxLength: 120 + r4() * 120 });
      }
    }
    far.prewarm(40); mid.prewarm(26); hyph.prewarm(4);
    lastExudateState = new Map();
  }

  // Coletar um exsudato e um evento biologico: a raiz responde com uma onda de
  // raizes laterais e pelos, e as hifas avancam em direcao ao ponto.
  function reactToGameplay(level, time) {
    const hyph = growth[2], mid = growth[1];
    if (!hyph) return;
    for (const ex of level?.exudates || []) {
      const was = lastExudateState.get(ex);
      lastExudateState.set(ex, ex.taken);
      if (was === false && ex.taken) {
        const r = hyph.random;
        for (let k = 0; k < 7; k++) {
          hyph.spawn({ x: ex.x, y: -ex.y, angle: r() * TAU, kind: 'hypha', width: 1.2, speed: 70, maxLength: 110 + r() * 140 });
        }
        mid.spawn({ x: ex.x + 30, y: -ex.y + 120, angle: -Math.PI / 2 + (r() - .5) * 1.4, width: 5, speed: 55, maxLength: 360, generation: 1 });
      }
    }
  }

  // ---- luzes ------------------------------------------------------------
  const lights = [];
  function pushLight(x, y, z, r, cr, cg, cb, i, slot = 0, key = 0) {
    lights.push({ x, y, z, r, cr: cr * i, cg: cg * i, cb: cb * i, slot, key });
  }

  function collectLights(time, camCX, camCY, visW, visH) {
    lights.length = 0;
    const level = state.level || {};
    const player = state.player;
    const ys = (level.platforms || []).map(p => p.y).filter(Number.isFinite);
    const topY = ys.length ? Math.min(...ys) : 200;
    // feixes da superficie (os dois mais proximos fazem sombra e luz volumetrica)
    const shafts = shaftXs
      .map(x => ({ x, d: Math.abs(x - camCX) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    shafts.forEach((s, i) => {
      const flick = .92 + .08 * Math.sin(time * .7 + s.x);
      pushLight(s.x, -(topY - 260), 320, 1600, .55, .82, 1.0, 1.9 * flick, i < 2 ? i + 1 : 0, 100);
    });
    if (player) {
      const px = player.x + player.w / 2, py = player.y + player.h * .35;
      pushLight(px + player.facing * 30, -(py - 14), 120, 440, 1.0, .82, .58, 1.0, 3, 90);
    }
    const ex = (level.exudates || [])
      .filter(e => !e.taken && Number.isFinite(e.x))
      .map(e => ({ e, d: Math.hypot(e.x - camCX, -e.y - camCY) }))
      .filter(o => o.d < visW)
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
    ex.forEach((o, i) => {
      const f = .85 + .15 * Math.sin(time * 3 + o.e.x * .01);
      pushLight(o.e.x, -o.e.y, 45, 260, .7, 1.0, .42, 1.7 * f, i === 0 ? 4 : 0, 50);
    });
    for (const c of level.checkpoints || []) {
      if (!Number.isFinite(c.x) || Math.abs(c.x - camCX) > visW) continue;
      pushLight(c.x + 10, -(c.y + 10), 50, 240, .35, .95, .9, c.active ? 1.2 : .45, 0, 30);
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
      pushLight(a.x, -a.y, 40, 170, r, g, b, .3 + .12 * Math.sin(time * 2.4 + (a.phase || 0)), 0, 10);
    }
    lights.sort((a, b) => b.key - a.key);
    const n = Math.min(MAX_LIGHTS, lights.length);
    shared.uLightCount.value = n;
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const L = lights[i];
      if (!L || i >= n) continue;
      shared.uLightPos.value[i].set(L.x, L.y, L.z, L.r);
      shared.uLightCol.value[i].set(L.cr, L.cg, L.cb, settings.shadows ? L.slot : 0);
    }
    return lights.slice(0, n);
  }

  // ---- quadro -----------------------------------------------------------
  let lastLevel = null;
  let lastTime = performance.now();
  const stats = { ms: 0, sprites: 0, lights: 0, segments: 0, fps: 0 };
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
    if (!layers || mainCanvas.width !== W || mainCanvas.height !== H) rebuild();
    if (state.level !== lastLevel || (state.level?.seed !== undefined && growthSeed === null)) {
      lastLevel = state.level;
      setupGrowth(state.level);
    }
    const time = Number(state.time) || 0;
    shared.uTime.value = time;

    // 1. o jogo desenha nas tres camadas
    for (const L of [layers.bg, layers.terrain, layers.fx]) {
      L.ctx.setTransform(1, 0, 0, 1, 0, 0);
      L.ctx.clearRect(0, 0, W, H);
    }
    layers.captured.length = 0;
    layers.terrainBridge.setCapture(settings.sprites);
    layers.fxBridge.setCapture(settings.sprites);
    drawLayers({ bg: layers.bg.ctx, terrain: layers.terrainBridge.ctx, fx: layers.fxBridge.ctx });
    for (const L of [layers.bg, layers.terrain, layers.fx]) L.tex.needsUpdate = true;

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
    for (const b of batches.values()) b.begin();
    for (const s of layers.captured) {
      let b = batches.get(s.image);
      if (!b) {
        b = createSpriteBatch(s.image, shared, maxTexture);
        batches.set(s.image, b);
        scene.add(b.mesh);
        occScene.add(b.occMesh);
      }
      b.add(s, toWorld, .5 + s.order * .001);
    }
    for (const b of batches.values()) b.end();

    // 4. crescimento e particulas
    reactToGameplay(state.level, time);
    const dtReal = Math.min(.1, (t0 - lastTime) / 1000);
    lastTime = t0;
    let segs = 0;
    const bounds = { x0: cx - visW * 1.2, x1: cx + visW * 1.2 };
    for (const g of growth) {
      g.mesh.visible = settings.growth;
      if (settings.growth) g.step(dtReal, time, bounds);
      segs += g.segments;
    }
    for (const p of particles) { p.points.visible = settings.particles; p.update(camera, H); }

    // 5. luzes
    const active = collectLights(time, cx, cy, visW, visH);
    const toUv = (x, y) => [ (x - camX) / visW, 1 - ((-y) - camY) / visH ];

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
    renderer.setRenderTarget(rt.vis);
    visPass.render(renderer);

    // 8. feixes volumetricos
    meshes.vol.visible = settings.volumetric && settings.lighting;
    if (meshes.vol.visible) {
      const shaftU = volPass.material.uniforms.uShaft.value;
      shaftU[0].set(0, 0, 0, 0); shaftU[1].set(0, 0, 0, 0);
      active.filter(L => L.slot === 1 || L.slot === 2).forEach(L => {
        const [u, v] = toUv(L.x, L.y);
        shaftU[L.slot - 1].set(u, v, .9, 1);
      });
      volPass.material.uniforms.uOcc.value = rt.occ.texture;
      volPass.material.uniforms.uTime.value = time;
      renderer.setRenderTarget(rt.vol);
      volPass.render(renderer);
      meshes.vol.material.uniforms.uVol.value = rt.vol.texture;
    }

    // 9. cena principal em HDR
    renderer.setRenderTarget(rt.scene);
    renderer.setClearColor(new THREE.Color(0.006, 0.02, 0.026), 1);
    renderer.clear();
    renderer.render(scene, camera);

    // 10. bloom + grade final
    if (settings.bloom) bloom.render(renderer, null, rt.scene, 0, false);
    const shake = Number(state.shake) || 0;
    finalPass.material.uniforms.uShake.value.set(
      shake ? (Math.random() - .5) * shake * 24 / W : 0,
      shake ? (Math.random() - .5) * shake * 16 / H : 0,
    );
    finalPass.material.uniforms.uScene.value = rt.scene.texture;
    finalPass.material.uniforms.uTime.value = time;
    finalPass.material.uniforms.uGrade.value = settings.grade ? 1 : 0;
    renderer.setRenderTarget(null);
    finalPass.render(renderer);

    // 11. devolve ao canvas do jogo (HUD, cartoes e cinematica continuam por cima)
    realCtx.save();
    realCtx.setTransform(1, 0, 0, 1, 0, 0);
    realCtx.globalAlpha = 1;
    realCtx.globalCompositeOperation = 'copy';
    realCtx.drawImage(glCanvas, 0, 0);
    realCtx.restore();

    stats.ms = performance.now() - t0;
    stats.sprites = layers.captured.length;
    stats.lights = active.length;
    stats.segments = segs;
    fpsAcc += dtReal; fpsN++;
    if (fpsAcc > .5) { stats.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  }

  return {
    renderFrame,
    settings,
    stats,
    renderer,
    toggle(name) { if (name in settings) settings[name] = !settings[name]; return settings[name]; },
  };
}

// ---------------------------------------------------------------- painel de teste

const PANEL_ITEMS = [
  ['lighting', 'Luz dinâmica'],
  ['shadows', 'Sombras'],
  ['volumetric', 'Feixes volumétricos'],
  ['sprites', 'Sprites com normal map'],
  ['growth', 'Raízes e hifas crescendo'],
  ['particles', 'Partículas em profundidade'],
  ['bloom', 'Bloom'],
  ['grade', 'Correção de cor e vinheta'],
];

/**
 * Painel para comparar efeito por efeito. G alterna 2,5D / 2D original,
 * V mostra ou esconde o painel. Nada aqui passa pelo input do jogo.
 */
export function mount25DPanel({ renderer25D, isActive, setActive }) {
  const panel = document.createElement('section');
  panel.id = 'panel-25d';
  panel.setAttribute('aria-label', 'Painel do renderizador 2,5D');
  panel.innerHTML = `
    <style>
      #panel-25d{position:fixed;left:12px;bottom:12px;z-index:60;font:600 12px/1.35 Inter,system-ui,sans-serif;
        color:#dff7f4;background:rgba(4,18,22,.82);border:1px solid rgba(108,231,223,.35);border-radius:12px;
        padding:10px 12px;min-width:220px;backdrop-filter:blur(6px);box-shadow:0 8px 30px rgba(0,0,0,.45)}
      #panel-25d h2{margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6ce7df}
      #panel-25d label{display:flex;gap:8px;align-items:center;padding:2px 0;cursor:pointer}
      #panel-25d input{accent-color:#6ce7df}
      #panel-25d .mode{display:flex;gap:6px;margin:4px 0 8px}
      #panel-25d .mode button{flex:1;border:1px solid rgba(108,231,223,.45);background:transparent;color:#dff7f4;
        border-radius:8px;padding:5px 6px;font:inherit;cursor:pointer}
      #panel-25d .mode button[aria-pressed=true]{background:#6ce7df;color:#062326}
      #panel-25d .stats{margin-top:6px;color:#9fc9c4;font-weight:500;font-variant-numeric:tabular-nums}
      #panel-25d .hint{margin-top:4px;color:#7fa9a4;font-weight:500}
      #panel-25d[hidden]{display:none}
    </style>
    <h2>Rizosfera 2,5D</h2>
    <div class="mode">
      <button type="button" data-mode="25d">2,5D</button>
      <button type="button" data-mode="2d">2D original</button>
    </div>
    <div class="toggles"></div>
    <div class="stats"></div>
    <div class="hint">G alterna 2,5D/2D · V esconde</div>`;
  for (const type of ['pointerdown', 'touchstart', 'mousedown', 'keydown']) {
    panel.addEventListener(type, e => e.stopPropagation(), { passive: true });
  }
  const toggles = panel.querySelector('.toggles');
  for (const [key, label] of PANEL_ITEMS) {
    const row = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = renderer25D.settings[key];
    box.addEventListener('change', () => { renderer25D.settings[key] = box.checked; box.blur(); });
    row.append(box, document.createTextNode(label));
    toggles.append(row);
  }
  const modeButtons = [...panel.querySelectorAll('[data-mode]')];
  const syncMode = () => modeButtons.forEach(b => b.setAttribute('aria-pressed', String((b.dataset.mode === '25d') === isActive())));
  modeButtons.forEach(b => b.addEventListener('click', () => { setActive(b.dataset.mode === '25d'); syncMode(); b.blur(); }));
  syncMode();
  document.body.append(panel);

  window.addEventListener('keydown', e => {
    if (e.repeat || e.target?.closest?.('input,textarea,select')) return;
    if (e.code === 'KeyG') { setActive(!isActive()); syncMode(); }
    if (e.code === 'KeyV') panel.hidden = !panel.hidden;
  });
  const stats = panel.querySelector('.stats');
  setInterval(() => {
    const s = renderer25D.stats;
    stats.textContent = isActive()
      ? `${s.fps} fps · GPU+CPU ${s.ms.toFixed(1)} ms · ${s.lights} luzes · ${s.sprites} sprites · ${s.segments} segmentos`
      : 'renderizador 2D original';
  }, 500);
  if (new URLSearchParams(location.search).get('painel') === '0') panel.hidden = true;
  return panel;
}

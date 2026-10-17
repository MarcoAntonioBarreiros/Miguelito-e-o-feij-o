// Crescimento organico de raizes e hifas na GPU.
//
// Cada rede e um conjunto de pontas que avancam no tempo, com gravitropismo
// (raiz), persistencia aleatoria (hifa), ramificacao lateral subapical e pelos
// radiculares perto da ponta. A geometria so cresce: cada segmento novo vira
// um quadrilatero com o instante de nascimento, e o shader faz a extensao
// suave, o espessamento secundario com o tempo e o volume tubular iluminado.
//
// Biologia usada como regra visual (nao como simulacao do jogo):
//  - raiz: ponta conica, coifa clara, zona de alongamento lisa, pelos
//    radiculares so na zona de maturacao, laterais mais horizontais
//    (plagiotropicas) e mais finas que a mae;
//  - hifa: filamento de diametro quase constante, ramificacao subapical, ponta
//    levemente luminosa (vesiculas do Spitzenkorper sugeridas pelo brilho).

import * as THREE from '../vendor/three.bundle.min.js';
import { LIGHTING_GLSL } from './shading.js';

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 1 | s);
    s ^= s + Math.imul(s ^ (s >>> 7), 61 | s);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const KIND = { root: 0, hair: 1, hypha: 2 };

const VERT = /* glsl */`
attribute vec2 aA;      // inicio do segmento (mundo GL)
attribute vec2 aB;      // fim
attribute vec4 aInfo;   // x: largura inicio, y: largura fim, z: nascimento, w: tipo
attribute vec2 aSide;   // x: -1/1 lado, y: 0 inicio / 1 fim
attribute float aAlong; // distancia acumulada ao longo do eixo (para as celulas)
uniform float uTime;
uniform float uZ;
uniform float uThicken;
varying vec2 vWorld;
varying float vAcross;
varying float vAlong;
varying vec2 vDir;
varying float vKind;
varying float vAge;
varying float vEnd;
void main() {
  float age = max(0.0, uTime - aInfo.z);
  float grow = smoothstep(0.0, 0.35, age);           // extensao do segmento
  vec2 dir = aB - aA;
  float len = max(length(dir), 1e-3);
  dir /= len;
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 p = mix(aA, aA + dir * len * grow, aSide.y);
  float w = mix(aInfo.x, aInfo.y, aSide.y);
  if (aInfo.w < .5) w *= 1.0 + uThicken * clamp(age / 40.0, 0.0, 1.0); // espessamento
  w *= mix(.35, 1.0, grow);
  p += nrm * aSide.x * w * .5;
  vWorld = p;
  vAcross = aSide.x;
  vAlong = aAlong + len * aSide.y * grow;
  vDir = dir;
  vKind = aInfo.w;
  vAge = age;
  vEnd = aSide.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, uZ, 1.0);
}`;

const FRAG = /* glsl */`
${LIGHTING_GLSL}
uniform vec3 uRootColor;
uniform vec3 uHyphaColor;
uniform float uZ;
uniform float uDim;
uniform float uOpacity;
varying vec2 vWorld;
varying float vAcross;
varying float vAlong;
varying vec2 vDir;
varying float vKind;
varying float vAge;
varying float vEnd;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float a = clamp(abs(vAcross), 0.0, 1.0);
  float cover = smoothstep(1.0, .78, a);
  if (cover <= .002) discard;
  vec3 side = vec3(-vDir.y, vDir.x, 0.0);
  // volume tubular: a normal gira ao redor do eixo
  vec3 N = normalize(side * vAcross + vec3(0.0, 0.0, sqrt(max(0.0, 1.0 - vAcross * vAcross))));
  vec3 albedo;
  float spec = .25;
  float emis = 0.0;
  if (vKind < .5) {
    // celulas do cortex: fileiras alongadas, parede suave (nao tijolo)
    float rr = (vAcross * .5 + .5) * 4.0;
    float row = floor(rr);
    float al = vAlong / 17.0 + row * .5;
    float cy = fract(al);
    float cx = fract(rr);
    float wall = smoothstep(0.0, .16, cx) * smoothstep(1.0, .84, cx)
               * smoothstep(0.0, .07, cy) * smoothstep(1.0, .93, cy);
    float n = hash(vec2(floor(al), row));
    albedo = uRootColor * (.9 + .14 * n) * mix(.80, 1.0, wall);
    // zona de crescimento: ponta mais clara e translucida
    float young = 1.0 - smoothstep(0.0, 3.0, vAge);
    albedo = mix(albedo, uRootColor * 1.3 + vec3(.05, .04, .02), young * .6);
    emis = young * .08;
  } else if (vKind < 1.5) {
    albedo = uRootColor * 1.25;
    spec = .1;
  } else {
    albedo = uHyphaColor;
    spec = .35;
    emis = .10 + .45 * (1.0 - smoothstep(0.0, 1.6, vAge)); // ponta ativa brilha
  }
  vec3 rim;
  vec3 wp = vec3(vWorld, uZ);
  vec3 light = accumulateLight(wp, N, .45, spec, rim);
  vec3 col = albedo * (uAmbient * 1.6 + light) + rim * albedo * .9 + albedo * emis;
  col *= uDim;
  // longe, a cor perde saturacao antes de sumir na nevoa (perspectiva aerea)
  float gray = dot(col, vec3(.2126, .7152, .0722));
  col = mix(col, vec3(gray), clamp(-uZ / 500.0, 0.0, .6));
  col = applyFog(col, uZ);
  gl_FragColor = vec4(col, cover * uOpacity);
}`;

export function createGrowthLayer({ shared, z, seed, maxSegments = 9000, dim = 1, opacity = 1, thicken = .6 }) {
  const cap = maxSegments;
  const geom = new THREE.BufferGeometry();
  const aA = new Float32Array(cap * 4 * 2);
  const aB = new Float32Array(cap * 4 * 2);
  const aInfo = new Float32Array(cap * 4 * 4);
  const aSide = new Float32Array(cap * 4 * 2);
  const aAlong = new Float32Array(cap * 4);
  const index = new Uint32Array(cap * 6);
  for (let i = 0; i < cap; i++) {
    const v = i * 4;
    index.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6);
    aSide.set([-1, 0, 1, 0, -1, 1, 1, 1], v * 2);
  }
  const attrs = {
    aA: new THREE.BufferAttribute(aA, 2),
    aB: new THREE.BufferAttribute(aB, 2),
    aInfo: new THREE.BufferAttribute(aInfo, 4),
    aSide: new THREE.BufferAttribute(aSide, 2),
    aAlong: new THREE.BufferAttribute(aAlong, 1),
  };
  for (const [k, v] of Object.entries(attrs)) { v.setUsage(THREE.DynamicDrawUsage); geom.setAttribute(k, v); }
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 4 * 3), 3));
  geom.setIndex(new THREE.BufferAttribute(index, 1));
  geom.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uZ: { value: z },
      uDim: { value: dim },
      uOpacity: { value: opacity },
      uThicken: { value: thicken },
      uRootColor: { value: new THREE.Color('#cfaa72').convertSRGBToLinear() },
      uHyphaColor: { value: new THREE.Color('#d9c8ee').convertSRGBToLinear() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, material);
  mesh.frustumCulled = false;

  let count = 0;
  let dirtyFrom = 0;
  const tips = [];
  const random = rng(seed);

  function addSegment(ax, ay, bx, by, w0, w1, born, kind, along) {
    if (count >= cap) return false;
    const v = count * 4;
    for (let k = 0; k < 4; k++) {
      aA.set([ax, ay], (v + k) * 2);
      aB.set([bx, by], (v + k) * 2);
      aInfo.set([w0, w1, born, kind], (v + k) * 4);
      aAlong[v + k] = along;
    }
    count++;
    return true;
  }

  /**
   * Nova ponta. Coordenadas no mundo GL (y para cima).
   * kind: 'root' | 'hypha'
   */
  function spawn({ x, y, angle, kind = 'root', width = 7, speed = 26, maxLength = 900, generation = 0, delay = 0 }) {
    tips.push({
      x, y, angle, kind, width, speed, maxLength, generation,
      length: 0, acc: 0, along: 0, delay,
      wander: 0, base: angle, lastBranch: 0,
      nextBranch: kind === 'root' ? 70 + random() * 90 : 26 + random() * 40,
    });
  }

  function step(dt, time, bounds) {
    const segLen = 6;
    for (let i = tips.length - 1; i >= 0; i--) {
      const t = tips[i];
      if (t.delay > 0) { t.delay -= dt; continue; }
      if (bounds && (t.x < bounds.x0 || t.x > bounds.x1)) continue;
      t.acc += t.speed * dt;
      while (t.acc >= segLen) {
        t.acc -= segLen;
        const isRoot = t.kind === 'root';
        // direcao: volta suave para a direcao-base + ruido; a base das
        // laterais inclina devagar para baixo (gravitropismo tardio). Sem
        // isto o ruido acumulava no rumo e as raizes davam voltas.
        t.wander = t.wander * .9 + (random() - .5) * (isRoot ? .22 : .7);
        if (isRoot && t.generation > 0) {
          const down = -Math.PI / 2;
          t.base += Math.atan2(Math.sin(down - t.base), Math.cos(down - t.base)) * .004;
        }
        let ang = t.angle + t.wander * (isRoot ? .12 : .3);
        ang += Math.atan2(Math.sin(t.base - ang), Math.cos(t.base - ang)) * (isRoot ? .1 : .04);
        t.angle = ang;
        const nx = t.x + Math.cos(ang) * segLen;
        const ny = t.y + Math.sin(ang) * segLen;
        const taper = Math.max(.25, 1 - t.length / t.maxLength);
        const w0 = t.width * Math.max(.25, 1 - (t.length) / t.maxLength);
        const w1 = t.width * taper;
        const kindCode = isRoot ? KIND.root : KIND.hypha;
        if (!addSegment(t.x, t.y, nx, ny, w0, w1, time, kindCode, t.along)) { tips.length = 0; return; }
        t.along += segLen;
        t.length += segLen;
        // pelos radiculares na zona de maturacao (um pouco atras da ponta)
        if (isRoot && t.length > 40 && random() < .55 && t.width < 9) {
          const back = 18 + random() * 22;
          const hx = t.x - Math.cos(ang) * back;
          const hy = t.y - Math.sin(ang) * back;
          const side = random() < .5 ? 1 : -1;
          const ha = ang + side * (1.2 + random() * .5);
          const hl = 6 + random() * 9;
          addSegment(hx, hy, hx + Math.cos(ha) * hl, hy + Math.sin(ha) * hl, .9, .5, time + .4 + random() * .6, KIND.hair, 0);
        }
        t.x = nx; t.y = ny;
        // ramificacao subapical
        if (t.length - t.lastBranch > t.nextBranch && t.generation < (isRoot ? 2 : 4)) {
          t.lastBranch = t.length;
          t.nextBranch = isRoot ? 80 + random() * 120 : 22 + random() * 46;
          const side = random() < .5 ? 1 : -1;
          const branchAngle = isRoot
            ? -Math.PI / 2 + side * (1.05 + random() * .35)   // laterais quase horizontais
            : ang + side * (.5 + random() * .7);
          spawn({
            x: t.x, y: t.y, angle: branchAngle, kind: t.kind,
            width: t.width * (isRoot ? .55 : .85),
            speed: t.speed * (isRoot ? .8 : .95),
            maxLength: t.maxLength * (isRoot ? .45 : .7),
            generation: t.generation + 1,
            delay: isRoot ? .8 + random() * 1.5 : .05 + random() * .3,
          });
        }
        if (t.length >= t.maxLength) { tips.splice(i, 1); break; }
      }
    }
  }

  function flush() {
    if (count === dirtyFrom) return;
    for (const attr of Object.values(attrs)) {
      if (attr === attrs.aSide) continue;
      attr.clearUpdateRanges?.();
      const item = attr.itemSize;
      attr.addUpdateRange?.(dirtyFrom * 4 * item, (count - dirtyFrom) * 4 * item);
      attr.needsUpdate = true;
    }
    geom.setDrawRange(0, count * 6);
    dirtyFrom = count;
  }

  return {
    mesh,
    spawn,
    step(dt, time, bounds) { step(dt, time, bounds); flush(); },
    /** Avanca o crescimento sem esperar (para nao comecar a fase vazia). */
    prewarm(seconds, time0 = -1000) {
      const dt = 1 / 15;
      for (let s = 0; s < seconds; s += dt) step(dt, time0 + s, null);
      flush();
    },
    get segments() { return count; },
    get tips() { return tips.length; },
    random,
  };
}

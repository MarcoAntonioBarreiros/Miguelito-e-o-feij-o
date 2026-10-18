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
uniform float uPx;       // tamanho de 1 pixel de tela em unidades do mundo
uniform vec2 uCamDelta;  // deslocamento da camera desde o inicio da fase
uniform float uFollow;   // fracao da camera que a camada acompanha (igual a Unity)
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
  // fio fino nunca abaixo de ~1,6 px na tela: sem isso a hifa virava tracejado
  w = max(w, (aInfo.w > .5 ? 1.6 : 1.0) * uPx);
  p += nrm * aSide.x * w * .5;
  // Paralaxe igual a da Unity (ParallaxLayer): a camada anda uma fracao do
  // deslocamento da camera e fica no plano z=0, sem encolher pela perspectiva.
  // Na perspectiva, um plano distante encolhe e EMPACOTA mais raizes por tela:
  // era o principal motivo da poluicao visual da versao anterior.
  p += uCamDelta * uFollow;
  vWorld = p;
  vAcross = aSide.x;
  vAlong = aAlong + len * aSide.y * grow;
  vDir = dir;
  vKind = aInfo.w;
  vAge = age;
  vEnd = aSide.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 0.0, 1.0);
}`;

const FRAG = /* glsl */`
${LIGHTING_GLSL}
uniform vec3 uRootColor;
uniform vec3 uHyphaColor;
uniform float uZ;
uniform float uDim;
uniform float uOpacity;
uniform float uDesat;
uniform float uLightGain;
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
  vec3 wp = vec3(vWorld, 0.0);
  vec3 light = accumulateLight(wp, N, .45, spec, rim) * uLightGain;
  // camadas de tras recebem menos luz das fontes (que estao perto do plano do
  // jogo) e menos ambiente: a diferenca de valor entre planos e o que le
  // como profundidade, mais que o movimento
  vec3 col = albedo * (uAmbient * mix(.9, 1.6, uLightGain) + light) + rim * albedo * .9 * uLightGain + albedo * emis;
  col *= uDim;
  // longe, a cor perde saturacao antes de sumir na nevoa (perspectiva aerea)
  float gray = dot(col, vec3(.2126, .7152, .0722));
  col = mix(col, vec3(gray), uDesat);
  gl_FragColor = vec4(col, cover * uOpacity);
}`;

export function createGrowthLayer({ shared, z, seed, maxSegments = 9000, dim = 1, opacity = 1, thicken = .6, follow = 0, desat = 0, lightGain = 1, maxGeneration = 2, branchSpacing = 1 }) {
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
      uPx: { value: 1 },
      uCamDelta: { value: new THREE.Vector2() },
      uFollow: { value: follow },
      uDesat: { value: desat },
      uLightGain: { value: lightGain },
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

  // segmentos ja enviados a GPU que mudaram de largura (afinamento da ponta)
  const touched = new Set();
  function setWidths(idx, w0, w1) {
    const v = idx * 4;
    for (let k = 0; k < 4; k++) { aInfo[(v + k) * 4] = w0; aInfo[(v + k) * 4 + 1] = w1; }
    if (idx < dirtyFrom) touched.add(idx);
  }
  // Ponta conica: os ultimos TIP_SEGS segmentos de cada raiz afinam ate quase
  // zero. Quando a raiz avanca, o segmento que sai da ponta volta a largura
  // cheia. Sem isso toda ponta em crescimento (ou parada fora da tela)
  // terminava reta, como cortada.
  const TIP_SEGS = 3;
  function taperTip(t) {
    const r = t.recent;
    const n = r.length;
    for (let k = 0; k < n; k++) {
      const fromTip0 = n - k;          // segmentos ate a ponta, contando este
      const f0 = Math.min(1, (fromTip0) / TIP_SEGS);
      const f1 = Math.min(1, (fromTip0 - 1) / TIP_SEGS);
      setWidths(r[k].idx, r[k].w0 * (.12 + .88 * f0), r[k].w1 * (.12 + .88 * f1));
    }
  }

  function addSegment(ax, ay, bx, by, w0, w1, born, kind, along) {
    if (count >= cap) return -1;
    const v = count * 4;
    for (let k = 0; k < 4; k++) {
      aA.set([ax, ay], (v + k) * 2);
      aB.set([bx, by], (v + k) * 2);
      aInfo.set([w0, w1, born, kind], (v + k) * 4);
      aAlong[v + k] = along;
    }
    count++;
    return count - 1;
  }

  /**
   * Nova ponta. Coordenadas no mundo GL (y para cima).
   * kind: 'root' | 'hypha'
   */
  function spawn({ x, y, angle, kind = 'root', width = 7, speed = 26, maxLength = 900, generation = 0, delay = 0 }) {
    tips.push({
      x, y, angle, kind, width, speed, maxLength, generation,
      length: 0, acc: 0, along: 0, delay,
      wander: 0, base: angle, lastBranch: 0, recent: [],
      // cada raiz tem o seu "temperamento": quanto serpenteia e quanto cede a gravidade
      tort: .6 + random() * .9, grav: .002 + random() * .007,
      nextBranch: kind === 'root' ? (30 + random() * random() * 220) * branchSpacing : 26 + random() * 40,
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
        t.wander = t.wander * .88 + (random() - .5) * (isRoot ? .3 * t.tort : .7);
        if (isRoot) {
          // desvio brusco ocasional (pedra, agregado, poro): a raiz real nao e reta
          if (random() < .035 * t.tort) t.base += (random() - .5) * 1.1;
          const down = -Math.PI / 2;
          const g = t.generation > 0 ? t.grav : t.grav * .6;
          t.base += Math.atan2(Math.sin(down - t.base), Math.cos(down - t.base)) * g;
        }
        let ang = t.angle + t.wander * (isRoot ? .16 : .3);
        ang += Math.atan2(Math.sin(t.base - ang), Math.cos(t.base - ang)) * (isRoot ? .06 : .04);
        t.angle = ang;
        const nx = t.x + Math.cos(ang) * segLen;
        const ny = t.y + Math.sin(ang) * segLen;
        const taper = Math.max(.25, 1 - t.length / t.maxLength);
        const w0 = t.width * Math.max(.25, 1 - (t.length) / t.maxLength);
        const w1 = t.width * taper;
        const kindCode = isRoot ? KIND.root : KIND.hypha;
        const idx = addSegment(t.x, t.y, nx, ny, w0, w1, time, kindCode, t.along);
        // memoria cheia: so esta ponta para (ja afinada), as outras seguem
        if (idx < 0) { tips.splice(i, 1); break; }
        t.recent.push({ idx, w0, w1 });
        if (t.recent.length > TIP_SEGS) {
          const old = t.recent.shift();
          setWidths(old.idx, old.w0, old.w1);
        }
        taperTip(t);
        t.along += segLen;
        t.length += segLen;
        // pelos radiculares na zona de maturacao (um pouco atras da ponta)
        const roomy = count < cap * .8;   // perto do limite: sem pelos e sem novas laterais
        if (roomy && isRoot && t.length > 40 && random() < .45 && t.width < 9) {
          const back = 18 + random() * 22;
          const hx = t.x - Math.cos(ang) * back;
          const hy = t.y - Math.sin(ang) * back;
          const side = random() < .5 ? 1 : -1;
          const ha = ang + side * (1.2 + random() * .5);
          const hl = 4 + random() * 6;
          addSegment(hx, hy, hx + Math.cos(ha) * hl, hy + Math.sin(ha) * hl, .6, .3, time + .4 + random() * .6, KIND.hair, 0);
        }
        t.x = nx; t.y = ny;
        // ramificacao subapical
        if (roomy && t.length - t.lastBranch > t.nextBranch && t.generation < (isRoot ? maxGeneration : 4)) {
          t.lastBranch = t.length;
          // espacamento irregular (laterais agrupadas e trechos nus) e angulos
          // variados em relacao a mae — nada de espinha de peixe
          t.nextBranch = isRoot ? (25 + random() * random() * 240) * branchSpacing : 22 + random() * 46;
          const side = random() < .5 ? 1 : -1;
          const branchAngle = isRoot
            ? ang + side * (.45 + random() * .95)
            : ang + side * (.5 + random() * .7);
          spawn({
            x: t.x, y: t.y, angle: branchAngle, kind: t.kind,
            width: t.width * (isRoot ? .4 + random() * .25 : .85),
            speed: t.speed * (isRoot ? .7 + random() * .2 : .95),
            maxLength: t.maxLength * (isRoot ? .12 + random() * random() * .55 : .7),
            generation: t.generation + 1,
            delay: isRoot ? .8 + random() * 1.5 : .05 + random() * .3,
          });
        }
        if (t.length >= t.maxLength) { tips.splice(i, 1); break; }
      }
    }
  }

  function flush() {
    if (count === dirtyFrom && !touched.size) return;
    for (const attr of Object.values(attrs)) {
      if (attr === attrs.aSide) continue;
      attr.clearUpdateRanges?.();
      const item = attr.itemSize;
      if (count > dirtyFrom) attr.addUpdateRange?.(dirtyFrom * 4 * item, (count - dirtyFrom) * 4 * item);
      if (attr === attrs.aInfo) for (const idx of touched) attr.addUpdateRange?.(idx * 4 * item, 4 * item);
      attr.needsUpdate = true;
    }
    touched.clear();
    geom.setDrawRange(0, count * 6);
    dirtyFrom = count;
  }

  return {
    mesh,
    z,
    follow,
    setPixelSize(px) { material.uniforms.uPx.value = px; },
    setCamDelta(dx, dy) { material.uniforms.uCamDelta.value.set(dx, dy); },
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

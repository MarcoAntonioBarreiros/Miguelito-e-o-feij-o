// Camada nativa: o jogo continua chamando a API do Canvas 2D, mas as IMAGENS
// (fotos do fundo, telhas de paralaxe, corpos de raiz e massas de solo que o
// proprio jogo ja guarda prontos em canvases) nao sao mais rasterizadas pelo
// Canvas 2D: viram quadrilateros texturizados desenhados pela GPU. Cada imagem
// sobe para a GPU uma vez e fica la; so volta a subir quando o jogo redesenha
// aquele canvas.
//
// O que e vetor (tracos, preenchimentos, gradientes) continua no Canvas 2D,
// em "segmentos": canvases transparentes compostos na ordem certa entre os
// lotes de imagens. A ordem final e:
//   segmento 0, imagens do segmento 0, segmento 1, imagens do segmento 1, ...
// Um segmento novo comeca quando aparece vetor depois de imagem (modo
// automatico) ou quando o modulo do jogo marca a fase com __glSegment(n).
//
// O estado do contexto (matriz, alfa, estilos, pilha de save/restore, recorte)
// e replicado em todos os canvases de segmento, para que trocar de segmento no
// meio do desenho nao perca a transformacao.

import * as THREE from '../vendor/three.bundle.min.js';
import { isLitSpriteImage } from './ctx-bridge.js';

const DRAW_OPS = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'putImageData']);
const QUERY_OPS = new Set(['getTransform', 'isPointInPath', 'isPointInStroke', 'measureText', 'getImageData',
  'getLineDash', 'createLinearGradient', 'createRadialGradient', 'createConicGradient', 'createPattern', 'createImageData']);

// ---------------------------------------------------------------- versoes
// Cada desenho num canvas qualquer da pagina incrementa a versao dele. Assim a
// textura de um canvas guardado pelo jogo so sobe de novo quando ele muda.
let versionsInstalled = false;
let versionClock = 1;
export function installCanvasVersions() {
  if (versionsInstalled) return;
  versionsInstalled = true;
  const proto = CanvasRenderingContext2D.prototype;
  for (const name of ['fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'drawImage', 'putImageData', 'fillText', 'strokeText']) {
    const orig = proto[name];
    proto[name] = function (...args) {
      const c = this.canvas;
      if (c) c.__glVersion = versionClock++;
      return orig.apply(this, args);
    };
  }
}

// ---------------------------------------------------------------- texturas
export function createTextureCache(renderer) {
  const maxSize = renderer.capabilities.maxTextureSize;
  const map = new WeakMap();
  let uploads = 0;
  return {
    get uploads() { return uploads; },
    resetStats() { uploads = 0; },
    /** textura atualizada para a fonte, ou null se nao cabe na GPU */
    get(source) {
      const isCanvas = source instanceof HTMLCanvasElement || (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas);
      const w = isCanvas ? source.width : (source.naturalWidth || source.width);
      const h = isCanvas ? source.height : (source.naturalHeight || source.height);
      if (!w || !h || w > maxSize || h > maxSize) return null;
      let e = map.get(source);
      if (!e) {
        const tex = isCanvas ? new THREE.CanvasTexture(source) : new THREE.Texture(source);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = !isCanvas;
        tex.minFilter = isCanvas ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        e = { tex, version: -1, w: 0, h: 0, isCanvas };
        map.set(source, e);
      }
      const version = isCanvas ? (source.__glVersion || 0) : 1;
      if (e.version !== version || e.w !== w || e.h !== h) {
        if (!isCanvas && !(source.complete && source.naturalWidth)) return null;
        if (e.w && (e.w !== w || e.h !== h)) { e.tex.dispose(); e.tex = e.tex.clone(); e.tex.image = source; }
        e.tex.needsUpdate = true;
        e.version = version; e.w = w; e.h = h;
        uploads++;
      }
      return e;
    },
  };
}

// ---------------------------------------------------------------- composicao
const QUAD_VERT = /* glsl */`
attribute vec2 aUv;
attribute float aAlpha;
varying vec2 vUv;
varying float vAlpha;
void main() { vUv = aUv; vAlpha = aAlpha; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const QUAD_FRAG = /* glsl */`
uniform sampler2D uMap;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 c = texture2D(uMap, vUv);
  // saida pre-multiplicada: as bordas nao escurecem quando a camada e borrada
  float a = c.a * vAlpha;
  gl_FragColor = vec4(c.rgb * a, a);
}`;

function makeQuadMaterial(tex, additive) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex } },
    vertexShader: QUAD_VERT, fragmentShader: QUAD_FRAG,
    depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
  });
}

/**
 * @param {object} o
 * @param {number} o.width   largura do alvo (px)
 * @param {number} o.height  altura do alvo (px)
 * @param {number} o.scale   escala inicial da matriz (camada de fundo em meia resolucao)
 * @param {number} o.maxSegments  canvases de vetor no modo automatico
 * @param {(s:object)=>void} [o.onSprite] sprites iluminados (Miguelito, microrganismos)
 * @param {()=>CanvasRenderingContext2D|null} [o.textTarget] onde vai o texto
 */
export function createNativeLayer({ renderer, textures, width, height, scale = 1, maxSegments = 4, onSprite = null, textTarget = null, maxQuads = 1024 }) {
  const segments = [];
  function makeSegment() {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return { canvas, ctx, tex, used: false };
  }
  for (let i = 0; i < maxSegments; i++) segments.push(makeSegment());

  let seg = 0;            // segmento que recebe vetor agora
  let quadSeg = 0;        // segmento cujas imagens estao sendo registradas
  let quadSinceVector = false;
  let marked = false;     // o modulo do jogo marcou as fases: sem troca automatica
  let captureSprites = true;
  const quads = [];       // { e (entrada de textura), seg, p0, pu, pv, src, alpha, add }
  let fallbackDraws = 0;

  const all = fn => { for (const s of segments) fn(s.ctx); };
  const cur = () => segments[seg].ctx;

  function vectorTarget() {
    if (!marked && quadSinceVector && seg < segments.length - 1) { seg++; quadSeg = seg; }
    quadSinceVector = false;
    segments[seg].used = true;
    return cur();
  }

  function drawImage(image, ...args) {
    const c = cur();
    if (captureSprites && onSprite && isLitSpriteImage(image) && image.complete && image.naturalWidth) {
      let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight, dx, dy, dw, dh;
      if (args.length === 2) { [dx, dy] = args; dw = sw; dh = sh; }
      else if (args.length === 4) { [dx, dy, dw, dh] = args; }
      else { [sx, sy, sw, sh, dx, dy, dw, dh] = args; }
      const m = c.getTransform();
      const corner = (x, y) => ({ x: (m.a * x + m.c * y + m.e) / scale, y: (m.b * x + m.d * y + m.f) / scale });
      onSprite({ image, src: { x: sx, y: sy, w: sw, h: sh }, p0: corner(dx, dy), pu: corner(dx + dw, dy), pv: corner(dx, dy + dh), alpha: c.globalAlpha, order: quads.length });
      return;
    }
    const e = (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement) ? textures.get(image) : null;
    const op = c.globalCompositeOperation;
    if (!e || quads.length >= maxQuads || (op !== 'source-over' && op !== 'lighter')) {
      fallbackDraws++;
      vectorTarget().drawImage(image, ...args);
      return;
    }
    const W = e.w, H = e.h;
    let sx = 0, sy = 0, sw = W, sh = H, dx, dy, dw, dh;
    if (args.length === 2) { [dx, dy] = args; dw = sw; dh = sh; }
    else if (args.length === 4) { [dx, dy, dw, dh] = args; }
    else { [sx, sy, sw, sh, dx, dy, dw, dh] = args; }
    // imagem fonte com escala diferente (imagem decodificada): fonte em px da textura
    const m = c.getTransform();
    const corner = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
    quads.push({
      e, seg: quadSeg,
      p0: corner(dx, dy), pu: corner(dx + dw, dy), pv: corner(dx, dy + dh),
      u0: sx / W, u1: (sx + sw) / W, v0: 1 - sy / H, v1: 1 - (sy + sh) / H,
      alpha: c.globalAlpha, add: op === 'lighter',
    });
    quadSinceVector = true;
  }

  const TEXT_STATE = ['font', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'lineCap', 'miterLimit',
    'textAlign', 'textBaseline', 'direction', 'globalAlpha', 'shadowColor', 'shadowBlur', 'shadowOffsetX',
    'shadowOffsetY', 'filter', 'letterSpacing', 'wordSpacing', 'fontKerning'];
  function drawText(kind, args) {
    const target = textTarget?.();
    if (!target) return vectorTarget()[kind](...args);
    const c = cur();
    target.save();
    const m = c.getTransform();
    target.setTransform(m.a / scale, m.b / scale, m.c / scale, m.d / scale, m.e / scale, m.f / scale);
    for (const k of TEXT_STATE) if (k in c) { try { target[k] = c[k]; } catch (_) {} }
    target[kind](...args);
    target.restore();
    return undefined;
  }

  const fnCache = new Map();
  const proxy = new Proxy({}, {
    get(_, prop) {
      if (prop === 'drawImage') return drawImage;
      if (prop === 'fillText') return (...a) => drawText('fillText', a);
      if (prop === 'strokeText') return (...a) => drawText('strokeText', a);
      // fase marcada pelo modulo do jogo: as imagens da fase n ficam no lote n
      // e o vetor da fase vai POR CIMA delas (canvas n+1)
      if (prop === '__glSegment') return n => {
        marked = true;
        quadSeg = Math.max(0, Math.min(segments.length - 2, n));
        seg = quadSeg + 1;
        quadSinceVector = false;
      };
      if (prop === 'canvas') return segments[0].canvas;
      const value = cur()[prop];
      if (typeof value !== 'function') return value;
      let f = fnCache.get(prop);
      if (!f) {
        if (DRAW_OPS.has(prop)) f = (...a) => vectorTarget()[prop](...a);
        else if (QUERY_OPS.has(prop)) f = (...a) => cur()[prop](...a);
        else f = (...a) => { let r; for (const s of segments) r = s.ctx[prop](...a); return r; };
        fnCache.set(prop, f);
      }
      return f;
    },
    set(_, prop, value) {
      all(c => { c[prop] = value; });
      return true;
    },
    has(_, prop) { return prop in segments[0].ctx; },
  });

  // ---- composicao na GPU ------------------------------------------------
  const MAXV = (maxQuads + maxSegments) * 4;
  const pos = new Float32Array(MAXV * 3);
  const uv = new Float32Array(MAXV * 2);
  const al = new Float32Array(MAXV);
  const idx = new Uint32Array((maxQuads + maxSegments) * 6);
  for (let i = 0; i < maxQuads + maxSegments; i++) idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
  const geom = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aUv = new THREE.BufferAttribute(uv, 2), aAl = new THREE.BufferAttribute(al, 1);
  geom.setAttribute('position', aPos); geom.setAttribute('aUv', aUv); geom.setAttribute('aAlpha', aAl);
  geom.setIndex(new THREE.BufferAttribute(idx, 1));
  const mats = new Map();       // textura -> material (normal / aditivo)
  const matList = [];
  const mesh = new THREE.Mesh(geom, matList);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function materialIndex(tex, add) {
    const key = tex.uuid + (add ? '+' : '');
    let i = mats.get(key);
    if (i === undefined) { i = matList.length; matList.push(makeQuadMaterial(tex, add)); mats.set(key, i); }
    else matList[i].uniforms.uMap.value = tex;
    return i;
  }

  function begin() {
    seg = 0; quadSeg = 0; quadSinceVector = false; marked = false;
    quads.length = 0; fallbackDraws = 0;
    for (const s of segments) {
      s.used = false;
      s.ctx.setTransform(1, 0, 0, 1, 0, 0);
      s.ctx.clearRect(0, 0, width, height);
      s.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }
  }

  /** desenha a camada inteira no alvo (pre-multiplicado, transparente) */
  function render(target) {
    let n = 0;
    geom.clearGroups();
    const toNdc = ([x, y]) => [x / width * 2 - 1, 1 - y / height * 2];
    const push = (p0, pu, pv, u0, u1, v0, v1, a, mi) => {
      const p1 = [pu[0] + pv[0] - p0[0], pu[1] + pv[1] - p0[1]];
      const P = [p0, pu, pv, p1].map(toNdc);
      const v = n * 4;
      pos.set([P[0][0], P[0][1], 0, P[1][0], P[1][1], 0, P[2][0], P[2][1], 0, P[3][0], P[3][1], 0], v * 3);
      uv.set([u0, v0, u1, v0, u0, v1, u1, v1], v * 2);
      al.fill(a, v, v + 4);
      const last = geom.groups[geom.groups.length - 1];
      if (last && last.materialIndex === mi && last.start + last.count === n * 6) last.count += 6;
      else geom.addGroup(n * 6, 6, mi);
      n++;
    };
    for (let k = 0; k < segments.length; k++) {
      const s = segments[k];
      if (s.used) {
        s.tex.needsUpdate = true;
        push([0, 0], [width, 0], [0, height], 0, 1, 1, 0, 1, materialIndex(s.tex, false));
      }
      for (const q of quads) {
        if (q.seg !== k) continue;
        push(q.p0, q.pu, q.pv, q.u0, q.u1, q.v0, q.v1, q.alpha, materialIndex(q.e.tex, q.add));
      }
    }
    aPos.needsUpdate = aUv.needsUpdate = aAl.needsUpdate = true;
    geom.setDrawRange(0, n * 6);
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    return { quads: quads.length, segmentsUsed: segments.filter(s => s.used).length, fallbackDraws };
  }

  return {
    ctx: proxy,
    begin,
    render,
    setCapture(v) { captureSprites = Boolean(v); },
    get stats() { return { quads: quads.length, segmentsUsed: segments.filter(s => s.used).length, fallbackDraws }; },
    dispose() { for (const s of segments) s.tex.dispose(); for (const m of matList) m.dispose(); geom.dispose(); },
  };
}

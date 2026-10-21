// CENA DA FAZENDINHA EM WEBGL
// ===========================
//
// Mesma linguagem do jogo: camadas em profundidade, luz e textura. As camadas
// pintadas (morros, arvores, casa, canteiro, chao e primeiro plano) viram
// planos com relevo — o normal map sai da propria arte, pelo mesmo gerador do
// renderizador 2,5D (sprite-normals.js) — e o sol, atras da cena, e uma luz de
// verdade: contorna copas, telhado e itens comprados com borda quente.
//
//   · ceu procedural (gradiente de fim de tarde, sol, nuvens andando)
//   · chao como plano em perspectiva (o capim encolhe ate o horizonte)
//   · paralaxe por profundidade (mouse; no celular, deriva lenta + arrasto)
//   · vento nas copas, no canteiro e no capim do primeiro plano
//   · desfoque de profundidade no primeiro plano e nos morros
//   · brilho e raios do sol por cima de tudo, granulado e vinheta
//
// Coordenadas da cena: 1920 x 1080. O enquadramento cobre a tela (cover).

import { generateSpriteNormalMap } from '../../experimental/2_5d/gl/sprite-normals.js';

export const SCENE_W = 1920;
export const SCENE_H = 1080;
export const HORIZON = 640;
const SUN = [960, 352];
const PARALLAX = 46;   // px de cena entre o mais longe e o mais perto
const FOCUS = .35;     // profundidade que nao se move (o plano da casa)
const BASE = './assets/farm/';

// Camadas pintadas. `anchor`: ponto da imagem que pousa em `at` (base do
// tronco, base da casa). `depth`: 0 longe, 1 perto.
const LAYERS = {
  hills: { src: 'morros.webp', blur: 1.6 },
  treeA: { src: 'arvore-a.webp', anchor: [584, 1057], at: [250, 806], height: 720, depth: .46, sway: 1, swayAmp: .006, normal: true },
  treeB: { src: 'arvore-b.webp', anchor: [513, 1071], at: [1748, 792], height: 650, depth: .43, sway: 1, swayAmp: .006, normal: true },
  house: { src: 'casa.webp', anchor: [631, 696], at: [790, 676], width: 270, depth: .3, normal: true },
  bedHealthy: { src: 'canteiro-saudavel.webp', anchor: [719, 698], at: [1300, 812], width: 560, depth: .52, sway: 2, swayAmp: .004, normal: true },
  bedSick: { src: 'canteiro-doente.webp', anchor: [689, 477], at: [1300, 812], width: 556, depth: .52, sway: 2, swayAmp: .003, normal: true },
  foreground: { src: 'primeiro-plano.webp', blur: 3.2 },
  ground: { src: 'chao.webp' },
};

// Espacos de melhoria: base do item na cena e escala.
export const FARM_SLOTS = [
  { x: 975, y: 708, s: .64 },
  { x: 735, y: 800, s: .76 },
  { x: 430, y: 905, s: .95 },
  { x: 1600, y: 912, s: .98 },
];

export function depthAt(y) {
  return Math.max(0, Math.min(1, .3 + (y - HORIZON) / (SCENE_H - HORIZON) * .7));
}

// ---- shaders ------------------------------------------------------------------
const VS = `
attribute vec2 aPos;
uniform vec4 uRect;      // x, y, w, h em px de cena
uniform vec4 uView;      // escala x, escala y, deslocamento x, y (cena -> clip)
varying vec2 vUv;
varying vec2 vScene;
void main(){
  vUv = aPos;
  vec2 p = uRect.xy + aPos * uRect.zw;
  vScene = p;
  vec2 clip = p * uView.xy + uView.zw;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const FS_SPRITE = `
precision mediump float;
varying vec2 vUv;
varying vec2 vScene;
uniform sampler2D uTex;
uniform sampler2D uNorm;
uniform float uHasNorm;
uniform vec2 uSun;
uniform float uTime;
uniform float uSwayMode;
uniform float uSwayAmp;
uniform float uSeed;
uniform float uHaze;
uniform vec3 uTint;
uniform float uOpacity;
uniform float uRim;
void main(){
  vec2 uv = vUv;
  if (uSwayMode > 0.5) {
    float k = uSwayMode < 1.5 ? pow(1.0 - uv.y, 2.2) : pow(1.0 - uv.y, 1.2);
    uv.x += (sin(uTime * 1.1 + uv.y * 5.0 + uSeed) + .35 * sin(uTime * 2.9 + uv.y * 19.0 + uv.x * 7.0 + uSeed)) * uSwayAmp * k;
  }
  vec4 c = texture2D(uTex, uv);
  if (c.a < 0.01) discard;
  vec3 col = c.rgb * uTint;
  vec2 toSun = normalize(uSun - vScene + 1e-4);
  if (uHasNorm > 0.5) {
    vec3 n = texture2D(uNorm, uv).xyz * 2.0 - 1.0;
    // contraluz: a frente fica um pouco na sombra; as bordas viradas para o
    // sol acendem em tom quente (rim light)
    float facing = dot(n.xy, toSun);
    float edge = clamp(1.0 - n.z, 0.0, 1.0);
    col *= 0.86 + 0.18 * facing + 0.06 * n.z;
    col += vec3(1.0, 0.78, 0.48) * max(facing, 0.0) * edge * uRim;
  }
  // luz quente da tarde e perspectiva aerea
  col *= vec3(1.04, 1.0, 0.93);
  col = mix(col, vec3(0.93, 0.80, 0.70), uHaze);
  gl_FragColor = vec4(col, c.a * uOpacity);
}`;

const FS_GROUND = `
precision mediump float;
varying vec2 vScene;
uniform sampler2D uTex;
uniform vec2 uSun;
uniform vec2 uPointer;
uniform float uHorizon;
uniform float uParallax;
uniform float uFocus;
void main(){
  float t = clamp((vScene.y - uHorizon) / (1080.0 - uHorizon), 0.0, 1.0);
  float depth = mix(0.3, 1.0, t);
  float sx = vScene.x - uPointer.x * (depth - uFocus) * uParallax;
  // plano em perspectiva: as linhas perto do horizonte se comprimem
  float v = 0.80 - 0.80 * pow(1.0 - t, 1.55);
  float u = 0.5 + (sx / 1920.0 - 0.5) * mix(1.32, 0.98, t);
  u = abs(mod(u + 1.0, 2.0) - 1.0);
  vec3 col = texture2D(uTex, vec2(u, v)).rgb;
  // contraluz no campo: perto do horizonte o ar fica quente e claro
  float far = pow(1.0 - t, 3.0);
  float sunX = exp(-pow((vScene.x - uSun.x) / 520.0, 2.0));
  col = mix(col, vec3(0.95, 0.84, 0.66), far * (0.35 + 0.35 * sunX));
  col *= vec3(1.03, 1.0, 0.92) * mix(1.0, 0.9, t * t);
  gl_FragColor = vec4(col, 1.0);
}`;

const FS_SKY = `
precision mediump float;
varying vec2 vScene;
uniform vec2 uSun;
uniform float uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  float y = vScene.y / 1080.0;
  vec3 top = vec3(0.36, 0.60, 0.85);
  vec3 mid = vec3(0.62, 0.77, 0.92);
  vec3 low = vec3(0.98, 0.80, 0.62);
  vec3 col = mix(top, mid, smoothstep(0.0, 0.38, y));
  col = mix(col, low, smoothstep(0.30, 0.62, y));
  float d = distance(vScene, uSun);
  col += vec3(1.0, 0.70, 0.40) * exp(-d / 230.0) * 0.32;
  // sol nitido: disco claro com um anel amarelo, como na referencia
  col = mix(col, vec3(1.0, 0.86, 0.45), smoothstep(84.0, 62.0, d) * 0.55);
  col = mix(col, vec3(1.0, 0.99, 0.94), smoothstep(60.0, 56.0, d));
  // nuvens: duas faixas, iluminadas por tras em rosa e laranja
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    vec2 p = vScene * vec2(0.0021, 0.0046) + vec2(uTime * (0.006 + fk * 0.004) + fk * 7.3, fk * 3.1);
    float band = smoothstep(0.04 + fk * 0.1, 0.16 + fk * 0.1, y) * smoothstep(0.48 + fk * 0.04, 0.28 + fk * 0.04, y);
    float n = fbm(p);
    float cloud = smoothstep(0.47, 0.6, n) * band * smoothstep(110.0, 300.0, d);
    float shade = smoothstep(0.52, 0.8, fbm(p + vec2(0.0, 0.08)));
    float lit = exp(-d / 520.0);
    vec3 cc = mix(vec3(0.62, 0.68, 0.88), vec3(1.0, 0.93, 0.90), shade);
    cc = mix(cc, vec3(1.0, 0.80, 0.68), lit * 0.75);
    col = mix(col, cc, cloud * 0.92);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// brilho do sol e raios por cima de tudo (aditivo) + granulado
const FS_GLOW = `
precision mediump float;
varying vec2 vScene;
uniform vec2 uSun;
uniform float uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 dv = vScene - uSun;
  float d = length(dv);
  float ang = atan(dv.y, dv.x);
  float rays = 0.5 + 0.5 * sin(ang * 23.0 + uTime * 0.25) * sin(ang * 9.0 - uTime * 0.15);
  float below = smoothstep(-80.0, 260.0, dv.y);
  vec3 g = vec3(1.0, 0.72, 0.42) * (exp(-d / 240.0) * 0.16 + rays * exp(-d / 700.0) * 0.10 * below);
  float grain = (hash(vScene + fract(uTime) * 91.0) - 0.5) * 0.045;
  gl_FragColor = vec4(g + grain, 1.0);
}`;

// vinheta (multiplicativa)
const FS_VIGNETTE = `
precision mediump float;
varying vec2 vScene;
void main(){
  vec2 q = vScene / vec2(1920.0, 1080.0) - 0.5;
  float v = 1.0 - smoothstep(0.35, 0.85, length(q * vec2(1.0, 1.15))) * 0.38;
  gl_FragColor = vec4(vec3(v), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    uniforms[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u: uniforms };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    img.src = src;
  });
}

function blurred(img, radius) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  g.filter = `blur(${radius}px)`;
  g.drawImage(img, 0, 0);
  return c;
}

// normal map em resolucao reduzida: o relevo e suave, nao precisa de 1400 px
function normalsFor(img) {
  const w = img.naturalWidth || img.width;
  const scale = Math.min(1, 720 / w);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round((img.naturalHeight || img.height) * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return generateSpriteNormalMap(c, { volume: 1, detail: .5 });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ items?: () => Array<{slot:number, image:HTMLCanvasElement, key:string}>, plantState?: () => number }} hooks
 */
export function createFarmScene(canvas, { items = () => [], plantState = () => 1 } = {}) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true, premultipliedAlpha: false });
  if (!gl) return null;
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const progSprite = program(gl, FS_SPRITE);
  const progGround = program(gl, FS_GROUND);
  const progSky = program(gl, FS_SKY);
  const progGlow = program(gl, FS_GLOW);
  const progVignette = program(gl, FS_VIGNETTE);

  const textures = {};
  const itemTextures = new Map();
  let ready = false;
  let time = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };
  let pan = 0;          // deslocamento horizontal (tela estreita)
  let view = { scale: 1, ox: 0, oy: 0, w: 1, h: 1 };

  function texture(source) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { t, w: source.naturalWidth || source.width, h: source.naturalHeight || source.height };
  }

  async function load() {
    const entries = await Promise.all(Object.entries(LAYERS).map(async ([id, layer]) => [id, layer, await loadImage(BASE + layer.src)]));
    for (const [id, layer, img] of entries) {
      const source = layer.blur ? blurred(img, layer.blur) : img;
      textures[id] = { ...texture(source), norm: null };
    }
    ready = true;
    // O relevo (normal map) e calculado depois, uma camada por vez, para a cena
    // aparecer logo; cada camada ganha a luz assim que o seu fica pronto.
    for (const [id, layer, img] of entries) {
      if (!layer.normal) continue;
      await new Promise(resolve => setTimeout(resolve, 30));
      textures[id].norm = texture(normalsFor(img)).t;
    }
  }
  const loading = load();
  const whenReady = new Promise((resolve, reject) => {
    loading.catch(reject);
    const poll = () => (ready ? resolve() : setTimeout(poll, 50));
    poll();
  });

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
    // so muda o tamanho quando precisa: atribuir width limpa o canvas
    const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    const scale = Math.max(cw / SCENE_W, ch / SCENE_H);
    const maxPan = Math.max(0, (SCENE_W * scale - cw) / 2);
    pan = Math.max(-maxPan, Math.min(maxPan, pan));
    view = {
      scale,
      ox: (cw - SCENE_W * scale) / 2 + pan,
      oy: (ch - SCENE_H * scale) / 2,
      w: cw, h: ch, maxPan,
    };
  }

  // deslocamento de paralaxe em px de cena para uma profundidade
  function shift(depth) {
    return { x: pointer.x * (depth - FOCUS) * PARALLAX, y: pointer.y * (depth - FOCUS) * PARALLAX * .35 };
  }

  function useView(prog, depth = FOCUS) {
    const s = shift(depth);
    // cena -> px da tela -> clip
    const sx = 2 * view.scale / view.w, sy = -2 * view.scale / view.h;
    const ox = (view.ox + s.x * view.scale) * 2 / view.w - 1;
    const oy = 1 - (view.oy + s.y * view.scale) * 2 / view.h;
    gl.uniform4f(prog.u.uView, sx, sy, ox, oy);
  }

  function drawSprite(tex, rect, { depth = .5, sway = 0, swayAmp = 0, seed = 0, haze = 0, tint = [1, 1, 1], opacity = 1, rim = 0 } = {}) {
    const P = progSprite;
    gl.useProgram(P.p);
    useView(P, depth);
    gl.uniform4f(P.u.uRect, rect[0], rect[1], rect[2], rect[3]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.t); gl.uniform1i(P.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex.norm || tex.t); gl.uniform1i(P.u.uNorm, 1);
    gl.uniform1f(P.u.uHasNorm, tex.norm ? 1 : 0);
    gl.uniform2f(P.u.uSun, SUN[0], SUN[1]);
    gl.uniform1f(P.u.uTime, time);
    gl.uniform1f(P.u.uSwayMode, sway);
    gl.uniform1f(P.u.uSwayAmp, swayAmp);
    gl.uniform1f(P.u.uSeed, seed);
    gl.uniform1f(P.u.uHaze, haze);
    gl.uniform3f(P.u.uTint, tint[0], tint[1], tint[2]);
    gl.uniform1f(P.u.uOpacity, opacity);
    gl.uniform1f(P.u.uRim, rim);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function anchoredRect(layer, tex) {
    const scale = layer.height ? layer.height / tex.h : layer.width / tex.w;
    const w = tex.w * scale, h = tex.h * scale;
    return [layer.at[0] - layer.anchor[0] * scale, layer.at[1] - layer.anchor[1] * scale, w, h];
  }

  function fullscreen(prog, extra = () => {}) {
    gl.useProgram(prog.p);
    useView(prog, FOCUS);
    gl.uniform4f(prog.u.uRect, -200, -100, SCENE_W + 400, SCENE_H + 200);
    if (prog.u.uSun) gl.uniform2f(prog.u.uSun, SUN[0], SUN[1]);
    if (prog.u.uTime) gl.uniform1f(prog.u.uTime, time);
    extra(prog);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function render(dt) {
    time += dt;
    // paralaxe: segue o ponteiro; sem ponteiro, uma deriva lenta
    if (!pointer.active) { pointer.tx = Math.sin(time * .23) * .55; pointer.ty = Math.sin(time * .17) * .3; }
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
    resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    fullscreen(progSky);
    if (!ready) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // morros distantes (achatados um pouco, sobre o horizonte)
    const hills = textures.hills;
    const hw = SCENE_W * 1.04, hs = hw / hills.w, hh = hills.h * hs * .78;
    drawSprite(hills, [-SCENE_W * .02, HORIZON + 50 - hh, hw, hh], { depth: .08, haze: .32 });

    // chao em perspectiva
    gl.disable(gl.BLEND);
    gl.useProgram(progGround.p);
    useView(progGround, FOCUS);
    gl.uniform4f(progGround.u.uRect, -200, HORIZON, SCENE_W + 400, SCENE_H - HORIZON + 100);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.ground.t); gl.uniform1i(progGround.u.uTex, 0);
    gl.uniform2f(progGround.u.uSun, SUN[0], SUN[1]);
    gl.uniform2f(progGround.u.uPointer, pointer.x, pointer.y);
    gl.uniform1f(progGround.u.uHorizon, HORIZON);
    gl.uniform1f(progGround.u.uParallax, PARALLAX);
    gl.uniform1f(progGround.u.uFocus, FOCUS);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);

    // tudo que pousa no chao, de tras para frente
    const state = plantState();
    const bedId = state === 0 ? 'bedSick' : 'bedHealthy';
    const bedTint = state === 1 ? [.94, .97, .86] : [1, 1, 1];
    const props = [
      { id: 'house', y: LAYERS.house.at[1], draw: () => drawSprite(textures.house, anchoredRect(LAYERS.house, textures.house), { depth: .3, haze: .12, rim: .55 }) },
      { id: 'treeB', y: LAYERS.treeB.at[1], draw: () => drawSprite(textures.treeB, anchoredRect(LAYERS.treeB, textures.treeB), { depth: .43, sway: 1, swayAmp: LAYERS.treeB.swayAmp, seed: 1.7, rim: .75 }) },
      { id: 'treeA', y: LAYERS.treeA.at[1], draw: () => drawSprite(textures.treeA, anchoredRect(LAYERS.treeA, textures.treeA), { depth: .46, sway: 1, swayAmp: LAYERS.treeA.swayAmp, seed: 4.1, rim: .75 }) },
      { id: 'bed', y: LAYERS[bedId].at[1], draw: () => drawSprite(textures[bedId], anchoredRect(LAYERS[bedId], textures[bedId]), { depth: .52, sway: 2, swayAmp: LAYERS[bedId].swayAmp, seed: 2.3, tint: bedTint, rim: .5 }) },
    ];
    for (const item of items()) {
      const slot = FARM_SLOTS[item.slot];
      let tex = itemTextures.get(item.key);
      if (!tex) {
        tex = { ...texture(item.image), norm: null };
        itemTextures.set(item.key, tex);
        setTimeout(() => { tex.norm = texture(normalsFor(item.image)).t; }, 0);
      }
      const w = tex.w * slot.s * .8, h = tex.h * slot.s * .8;
      props.push({ id: item.key, y: slot.y, draw: () => drawSprite(tex, [slot.x - w / 2, slot.y - h * .94, w, h], { depth: depthAt(slot.y), rim: .7 }) });
    }
    props.sort((a, b) => a.y - b.y).forEach(prop => prop.draw());

    // primeiro plano desfocado, balancando
    const fg = textures.foreground;
    const fw = SCENE_W * 1.06, fs = fw / fg.w, fh = fg.h * fs;
    drawSprite(fg, [-SCENE_W * .03, SCENE_H + 190 - fh, fw, fh], { depth: 1, sway: 2, swayAmp: .005, seed: .5 });

    // luz do sol por cima de tudo + granulado, depois a vinheta
    gl.blendFunc(gl.ONE, gl.ONE);
    fullscreen(progGlow);
    gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
    fullscreen(progVignette);
  }

  // cena <-> tela (px CSS), considerando a paralaxe da profundidade
  function sceneToScreen(x, y, depth = depthAt(y)) {
    const s = shift(depth);
    return { x: view.ox + (x + s.x) * view.scale, y: view.oy + (y + s.y) * view.scale, scale: view.scale };
  }
  function screenToScene(px, py, depth = .7) {
    const s = shift(depth);
    return { x: (px - view.ox) / view.scale - s.x, y: (py - view.oy) / view.scale - s.y };
  }

  return {
    loading: whenReady,
    render,
    sceneToScreen,
    screenToScene,
    setPointer(nx, ny) { pointer.tx = nx; pointer.ty = ny; pointer.active = true; },
    releasePointer() { pointer.active = false; },
    panBy(dx) { pan += dx; },
    get ready() { return ready; },
    get maxPan() { return view.maxPan || 0; },
  };
}

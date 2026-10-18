// Continuous root ribbons. Neighbouring spans use the SAME cross-section
// vertices: direction, width, birth time and lighting cannot split at a join.
// This changes decorative WebGL geometry only. Its original cell/cortex
// shader is retained; playable roots keep their original Canvas tissue art.
import * as THREE from '../vendor/three.bundle.min.js';
import { LIGHTING_GLSL } from './shading.js';

const EPS = 1e-7;

export function createRibbonBuffers(maxSegments) {
  const maxVertices = (maxSegments * 2 + 2) * 2;
  return {
    point: new Float32Array(maxVertices * 2),
    previous: new Float32Array(maxVertices * 3),
    normal: new Float32Array(maxVertices * 2),
    info: new Float32Array(maxVertices * 4),
    side: new Float32Array(maxVertices),
    index: new Uint32Array(maxSegments * 6),
    nodes: [], vertices: 0, segments: 0, dirtyVertex: 0, maxSegments,
  };
}

function writeNormal(data, node, dx, dy) {
  const len = Math.hypot(dx, dy) || 1;
  node.nx = -dy / len; node.ny = dx / len;
  for (let k = 0; k < 2; k++) data.normal.set([node.nx, node.ny], (node.vertex + k) * 2);
  data.dirtyVertex = Math.min(data.dirtyVertex, node.vertex);
}

/** One strand owns its rings; branches start inside their mother's body. */
export function appendRibbonNode(data, strand, { x, y, width, born = -1000, kind = 0, along = 0 }) {
  const prev = strand.last;
  if (prev && Math.hypot(x - prev.x, y - prev.y) < EPS) return prev;
  if (data.vertices + 2 > data.side.length || (prev && data.segments >= data.maxSegments)) return null;
  const node = { x, y, width, born, kind, along, vertex: data.vertices, previous: prev };
  for (let k = 0; k < 2; k++) {
    const v = node.vertex + k;
    data.point.set([x, y], v * 2);
    data.previous.set([prev?.x ?? x, prev?.y ?? y, prev?.along ?? along], v * 3);
    data.info.set([width, born, kind, along], v * 4);
    data.side[v] = k === 0 ? -1 : 1;
  }
  data.vertices += 2;
  data.nodes.push(node);
  if (prev) {
    const p = prev.vertex, v = node.vertex;
    data.index.set([p, p + 1, v, v, p + 1, v + 1], data.segments * 6);
    data.segments++;
    writeNormal(data, node, x - prev.x, y - prev.y);
    const before = prev.previous || prev;
    writeNormal(data, prev, x - before.x, y - before.y);
  } else writeNormal(data, node, 0, -1);
  strand.last = node;
  return node;
}

// Cubic Hermite/Catmull-Rom sampling with bounded tangents. It passes through
// each authored point, preserves both ends and widths, and never adds a joint
// per texture slice. Short/duplicate samples are legal (some live roots use them).
export function smoothRootPath(points, widths, spacing = 3) {
  const src = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!Number.isFinite(p?.[0]) || !Number.isFinite(p?.[1])) continue;
    const w = Math.max(0, Number(widths[i]) || 0);
    if (src.length && Math.hypot(p[0] - src.at(-1).x, p[1] - src.at(-1).y) < EPS) {
      src.at(-1).width = w;
    } else src.push({ x: p[0], y: p[1], width: w });
  }
  if (src.length < 2) return src;
  const out = [{ ...src[0], along: 0 }];
  let along = 0;
  const tangent = (before, p, next, limit) => {
    let x = (next.x - before.x) * .5, y = (next.y - before.y) * .5;
    const len = Math.hypot(x, y), scale = len > limit ? limit / len : 1;
    return [x * scale, y * scale];
  };
  for (let i = 0; i < src.length - 1; i++) {
    const a = src[i], b = src[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const ma = tangent(src[Math.max(0, i - 1)], a, b, length);
    const mb = tangent(a, b, src[Math.min(src.length - 1, i + 2)], length);
    const steps = Math.max(1, Math.ceil(length / Math.max(.5, spacing)));
    for (let j = 1; j <= steps; j++) {
      const t = j / steps, tt = t * t, ttt = tt * t;
      const h0 = 2 * ttt - 3 * tt + 1, h1 = ttt - 2 * tt + t;
      const h2 = -2 * ttt + 3 * tt, h3 = ttt - tt;
      const x = h0 * a.x + h1 * ma[0] + h2 * b.x + h3 * mb[0];
      const y = h0 * a.y + h1 * ma[1] + h2 * b.y + h3 * mb[1];
      const prev = out.at(-1);
      along += Math.hypot(x - prev.x, y - prev.y);
      out.push({ x, y, width: a.width + (b.width - a.width) * t, along });
    }
  }
  return out;
}

export function buildRootRibbon(points, widths, { spacing = 3, cap = true } = {}) {
  const path = smoothRootPath(points, widths, spacing);
  if (path.length < 2) return createRibbonBuffers(1);
  const ends = [];
  // Rounded closed silhouettes at the two true ends only. There are no caps
  // between spans, and a branch's base cap is hidden inside its parent root.
  const capEnd = (p, near, start) => {
    const dx = p.x - near.x, dy = p.y - near.y;
    const len = Math.hypot(dx, dy) || 1, radius = p.width * .5;
    for (let k = 1; k <= 4; k++) {
      const t = k * Math.PI / 8;
      ends.push({ x: p.x + dx / len * Math.sin(t) * radius, y: p.y + dy / len * Math.sin(t) * radius,
        width: Math.cos(t) * p.width, along: p.along + (start ? -1 : 1) * Math.sin(t) * radius });
    }
  };
  let samples = path;
  if (cap) {
    capEnd(path[0], path[1], true);
    const start = ends.splice(0).reverse();
    capEnd(path.at(-1), path.at(-2), false);
    samples = start.concat(path, ends);
  }
  const data = createRibbonBuffers(samples.length - 1);
  const strand = {};
  for (const sample of samples) appendRibbonNode(data, strand, sample);
  return data;
}

/** Reusable closed silhouettes for the fronts that are STILL growing.
 * The first ring copies the body's complete vertex state, so the join also
 * stays coincident while its newest span is extending or thickening.
 */
export function writeActiveTipCaps(target, source, tips) {
  target.vertices = target.segments = target.dirtyVertex = 0;
  target.nodes.length = 0;
  for (const tip of tips) {
    // A strand whose first body span did not fit has no visible body to cap.
    if (!tip?.previous || target.segments + 4 > target.maxSegments) continue;
    const v = tip.vertex, x = source.point[v * 2], y = source.point[v * 2 + 1];
    const nx = source.normal[v * 2], ny = source.normal[v * 2 + 1];
    const width = source.info[v * 4], born = source.info[v * 4 + 1];
    const kind = source.info[v * 4 + 2], along = source.info[v * 4 + 3];
    if (width < .001) continue;
    const radius = width * .5, strand = {}, firstVertex = target.vertices;
    for (let k = 0; k <= 4; k++) {
      const angle = k * Math.PI / 8, distance = Math.sin(angle) * radius;
      appendRibbonNode(target, strand, {
        x: x + ny * distance, y: y - nx * distance,
        width: k === 4 ? 0 : Math.cos(angle) * width, born, kind, along: along + distance,
      });
    }
    for (let c = firstVertex; c < target.vertices; c++) {
      // All cap sections grow from the same preceding body center. Their
      // axial extent therefore scales by the SAME factor as their radius.
      target.previous.set(source.previous.subarray(v * 3, v * 3 + 3), c * 3);
      target.normal.set([nx, ny], c * 2);
    }
  }
  return target;
}

export function geometryFromRibbon(data, dynamic = false) {
  const geometry = new THREE.BufferGeometry();
  const attrs = {};
  for (const [key, array, size] of [['aPoint', data.point, 2], ['aPrevious', data.previous, 3],
    ['aNormal', data.normal, 2], ['aInfo', data.info, 4], ['aSide', data.side, 1]]) {
    const attr = new THREE.BufferAttribute(array, size);
    if (dynamic) attr.setUsage(THREE.DynamicDrawUsage);
    attrs[key] = attr; geometry.setAttribute(key, attr);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.side.length * 3), 3));
  geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
  geometry.setDrawRange(0, data.segments * 6);
  return { geometry, attrs };
}

const VERT = /* glsl */`
attribute vec2 aPoint;
attribute vec3 aPrevious;
attribute vec2 aNormal;
attribute vec4 aInfo; // width, birth, kind, continuous arc length
attribute float aSide;
uniform float uTime;
uniform float uThicken;
uniform float uPx;
uniform vec2 uCamDelta;
uniform float uFollow;
varying vec2 vWorld;
varying float vAcross;
varying float vAlong;
varying vec2 vDir;
varying float vKind;
varying float vAge;
void main() {
  float age = max(0.0, uTime - aInfo.y);
  float grow = smoothstep(0.0, .35, age);
  vec2 nrm = normalize(aNormal);
  vec2 p = mix(aPrevious.xy, aPoint, grow);
  float w = aInfo.x;
  if (aInfo.z < .5) w *= 1.0 + uThicken * clamp(age / 40.0, 0.0, 1.0);
  // Only a true end may have zero radius. Shared rings keep the same width
  // and the same growth/age in BOTH neighbouring spans, including while young.
  if (w > .001) w = max(w, (aInfo.z > .5 ? 1.1 : .8) * uPx);
  w *= grow;
  p += nrm * aSide * w * .5 + uCamDelta * uFollow;
  vWorld = p; vAcross = aSide;
  vAlong = mix(aPrevious.z, aInfo.w, grow);
  vDir = vec2(nrm.y, -nrm.x); vKind = aInfo.z; vAge = age;
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

export function createRootMaterial(shared, { dim = 1, opacity = 1, thicken = 0, follow = 0,
  desat = 0, lightGain = 1, z = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared,
      uZ: { value: z }, uDim: { value: dim }, uOpacity: { value: opacity }, uThicken: { value: thicken },
      uPx: { value: 1 }, uCamDelta: { value: new THREE.Vector2() }, uFollow: { value: follow },
      uDesat: { value: desat }, uLightGain: { value: lightGain },
      uRootColor: { value: new THREE.Color('#cfaa72').convertSRGBToLinear() },
      uHyphaColor: { value: new THREE.Color('#d9c8ee').convertSRGBToLinear() },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  });
}

// Decorative growth, independent of the game's root colliders and biology.
// A strand is one joined ribbon, never a pile of independently growing quads.
import * as THREE from '../vendor/three.bundle.min.js';
import { appendRibbonNode, createRibbonBuffers, createRootMaterial, geometryFromRibbon, writeActiveTipCaps } from './root-ribbon.js';
import { createRootGrowthProfile, rootGrowthHeading, rootGrowthWidth } from './root-growth-profile.js';

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

export function createGrowthLayer({ shared, z, seed, maxSegments = 9000, dim = 1, opacity = 1, thicken = .6,
  follow = 0, desat = 0, lightGain = 1, maxGeneration = 2, branchSpacing = 1 }) {
  const data = createRibbonBuffers(maxSegments);
  const { geometry, attrs } = geometryFromRibbon(data, true);
  const material = createRootMaterial(shared, { dim, opacity, thicken, follow, desat, lightGain });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  // One reusable cap batch per depth layer, not an individual mesh per tip.
  const capData = createRibbonBuffers(Math.min(maxSegments * 4, 4096));
  const capGeometry = geometryFromRibbon(capData, true);
  const caps = new THREE.Mesh(capGeometry.geometry, material);
  caps.frustumCulled = false;
  mesh.add(caps);
  const tips = [], random = rng(seed);
  const systems = [];
  let dirty = false, uploadedSegments = 0, exhausted = false;

  function spawn({ x, y, angle, kind = 'root', width = 7, speed = 26, maxLength = 900,
    generation = 0, delay = 0, profileSeed = null, archetype = null, dominant = false }) {
    const tipSeed = profileSeed ?? Math.floor(random() * 4294967296);
    const profile = kind === 'root' ? createRootGrowthProfile({ seed: tipSeed, length: maxLength,
      generation, maxGeneration, branchSpacing, archetype, dominant }) : null;
    if (profile) {
      width *= profile.girth; speed *= profile.speed; maxLength = profile.length;
      if (generation === 0) systems.push({ x, y, width, length: maxLength, profile });
    }
    tips.push({
      x, y, angle, kind, width, speed, maxLength, generation,
      length: 0, acc: 0, along: 0, delay, wander: 0, base: angle,
      phase: random() * Math.PI * 2, lastBranch: 0, strand: {}, profile,
      random: rng(tipSeed ^ 0x3a72f1), branchIndex: 0,
      nextBranch: profile ? (profile.branches[0]?.at ?? Infinity) : 26 + random() * 40,
    });
  }

  function addNode(t, x, y, width, born, kind, along) {
    const node = appendRibbonNode(data, t.strand, { x, y, width, born, kind, along });
    if (node) dirty = true;
    return node;
  }

  function closeTip(t, time) {
    const prev = t.strand.last;
    if (!prev) return true;
    // A root reaching its target as the body pool fills still needs a cap.
    // Freeze it with the other live fronts; their auxiliary cap pool is
    // independent of the exhausted body geometry.
    if (data.segments + 4 > data.maxSegments) { exhausted = true; return false; }
    const radius = prev.width * .5;
    for (let k = 1; k <= 4; k++) {
      const angle = k * Math.PI / 8, distance = Math.sin(angle) * radius;
      addNode(t, t.x + Math.cos(t.angle) * distance, t.y + Math.sin(t.angle) * distance,
        Math.cos(angle) * prev.width, time, KIND[t.kind], t.along + distance);
    }
    return true;
  }

  function step(dt, time, bounds) {
    if (exhausted) return;
    const segLen = 6;
    for (let i = tips.length - 1; i >= 0; i--) {
      const t = tips[i];
      if (t.delay > 0) { t.delay -= dt; continue; }
      if (bounds && (t.x < bounds.x0 || t.x > bounds.x1)) continue;
      t.acc += t.speed * dt;
      while (t.acc >= segLen) {
        t.acc -= segLen;
        const isRoot = t.kind === 'root';
        t.wander = t.wander * .94 + (t.random() - .5) * (isRoot ? .08 : .55);
        const desired = isRoot ? rootGrowthHeading(t.profile, t.length, t.base) : t.base;
        let ang = t.angle + t.wander * (isRoot ? .02 : .2);
        ang += Math.atan2(Math.sin(desired - ang), Math.cos(desired - ang)) * (isRoot ? .08 : .04);
        t.angle = ang;
        const nx = t.x + Math.cos(ang) * segLen, ny = t.y + Math.sin(ang) * segLen;
        // Both adjoining spans use the very same width/birth/normal ring.
        const w0 = isRoot ? rootGrowthWidth(t.profile, t.length, t.width) : t.width;
        const w1 = isRoot ? rootGrowthWidth(t.profile, t.length + segLen, t.width) : t.width;
        if (!t.strand.last) addNode(t, t.x, t.y, w0, time - .35, KIND[t.kind], t.along);
        if (!addNode(t, nx, ny, w1, time, KIND[t.kind], t.along + segLen)) {
          // Keep every existing front, and therefore its closed cap, when
          // the bounded pool fills. Clearing tips used to expose all cuts.
          exhausted = true; return;
        }
        t.along += segLen; t.length += segLen;
        if (isRoot && t.generation > 0 && t.length > 40 && w1 < 3.8 && t.random() < .08) {
          const back = 18 + t.random() * 22;
          const hx = t.x - Math.cos(ang) * back, hy = t.y - Math.sin(ang) * back;
          const side = t.random() < .5 ? 1 : -1;
          const ha = ang + side * (1.2 + t.random() * .5), hl = 3 + t.random() * 5;
          const hair = { strand: {} }, born = time + .4 + t.random() * .6;
          addNode(hair, hx, hy, .6, born, KIND.hair, 0);
          addNode(hair, hx + Math.cos(ha) * hl * .55, hy + Math.sin(ha) * hl * .55, .35, born, KIND.hair, hl * .55);
          addNode(hair, hx + Math.cos(ha) * hl, hy + Math.sin(ha) * hl, 0, born, KIND.hair, hl);
        }
        t.x = nx; t.y = ny;
        if ((isRoot ? t.length >= t.nextBranch : t.length - t.lastBranch > t.nextBranch)
            && t.generation < (isRoot ? maxGeneration : 4)) {
          t.lastBranch = t.length;
          const planned = isRoot ? t.profile.branches[t.branchIndex++] : null;
          t.nextBranch = isRoot ? (t.profile.branches[t.branchIndex]?.at ?? Infinity) : 22 + t.random() * 46;
          const side = t.random() < .5 ? 1 : -1;
          const branchAngle = isRoot ? ang + planned.angle : ang + side * (.5 + t.random() * .7);
          spawn({ x: t.x, y: t.y, angle: branchAngle, kind: t.kind,
            width: w1 * (isRoot ? planned.width : .85), speed: t.speed * (isRoot ? planned.speed : .95),
            maxLength: t.maxLength * (isRoot ? planned.length : .7), generation: t.generation + 1,
            delay: isRoot ? planned.delay : .05 + t.random() * .3,
            ...(isRoot ? { profileSeed: planned.seed, archetype: t.profile.archetype, dominant: planned.dominant } : {}) });
          const child = tips.at(-1);
          child.angle = ang; child.base = branchAngle;
        }
        if (t.length >= t.maxLength) {
          if (closeTip(t, time)) tips.splice(i, 1);
          if (exhausted) return;
          break;
        }
      }
    }
  }

  function flush() {
    if (!dirty) return;
    for (const attr of Object.values(attrs)) {
      attr.clearUpdateRanges?.();
      attr.addUpdateRange?.(data.dirtyVertex * attr.itemSize, (data.vertices - data.dirtyVertex) * attr.itemSize);
      attr.needsUpdate = true;
    }
    geometry.index.clearUpdateRanges?.();
    geometry.index.addUpdateRange?.(uploadedSegments * 6, (data.segments - uploadedSegments) * 6);
    geometry.index.needsUpdate = true;
    geometry.setDrawRange(0, data.segments * 6);
    data.dirtyVertex = data.vertices; uploadedSegments = data.segments; dirty = false;
  }

  function flushCaps() {
    writeActiveTipCaps(capData, data, tips.map(t => t.strand.last));
    for (const attr of Object.values(capGeometry.attrs)) {
      attr.clearUpdateRanges?.();
      if (capData.vertices) attr.addUpdateRange?.(0, capData.vertices * attr.itemSize);
      attr.needsUpdate = true;
    }
    capGeometry.geometry.index.clearUpdateRanges?.();
    if (capData.segments) capGeometry.geometry.index.addUpdateRange?.(0, capData.segments * 6);
    capGeometry.geometry.index.needsUpdate = true;
    capGeometry.geometry.setDrawRange(0, capData.segments * 6);
    caps.renderOrder = mesh.renderOrder;
  }

  return {
    mesh, z, follow,
    setPixelSize(px) { material.uniforms.uPx.value = px; },
    setCamDelta(dx, dy) { material.uniforms.uCamDelta.value.set(dx, dy); },
    spawn,
    step(dt, time, bounds) {
      step(dt, time, bounds);
      if (dirty) { flush(); flushCaps(); }
      // Render order may be configured by the caller after prewarming.
      caps.renderOrder = mesh.renderOrder;
    },
    prewarm(seconds, time0 = -1000) { const dt = 1 / 15; for (let s = 0; s < seconds; s += dt) step(dt, time0 + s, null); flush(); flushCaps(); },
    get segments() { return data.segments; },
    get tips() { return tips.length; },
    get exhausted() { return exhausted; },
    get systems() { return systems; },
    random,
    dispose() { geometry.dispose(); capGeometry.geometry.dispose(); material.dispose(); },
  };
}

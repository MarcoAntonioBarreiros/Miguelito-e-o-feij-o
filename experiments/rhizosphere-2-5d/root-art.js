import { growPlantRoots, seededRandom } from '../../src/render/root-architecture.js';
import { ROOT_PALETTE, paintRootTissueVertical } from '../../src/render/root-tissue.js';

const PIXELS_PER_UNIT = 100;
const MAX_DIAMETER = .14;
const TAU = Math.PI * 2;

// Keep the author's cellular tissue and branching algorithm. Only their
// presentation changes: the paths become narrow lit tubes behind the game.
function tissueMaps(THREE) {
  if (typeof document === 'undefined') return { map: null, normalMap: null };
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const muted = color => {
    const value = parseInt(color.slice(1), 16);
    const luma = ((value >> 16) & 255) * .3 + ((value >> 8) & 255) * .59 + (value & 255) * .11;
    const light = 36 + luma * .83;
    return `rgb(${Math.round(light)},${Math.round(light * 1.025)},${Math.round(light * .97)})`;
  };
  const palette = Object.fromEntries(Object.entries(ROOT_PALETTE).map(([key, value]) => [
    key, Array.isArray(value) ? value.map(muted) : muted(value),
  ]));
  ctx.fillStyle = palette.innerBase;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  paintRootTissueVertical(ctx, 420031, 64, -16, 272, 64, palette);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 2;

  const pixels = ctx.getImageData(0, 0, 128, 256).data;
  const normals = new Uint8Array(128 * 256 * 4);
  const valueAt = (x, y) => pixels[(((y + 256) % 256) * 128 + ((x + 128) % 128)) * 4] / 255;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 128; x++) {
      const dx = (valueAt(x + 1, y) - valueAt(x - 1, y)) * .65;
      const dy = (valueAt(x, y + 1) - valueAt(x, y - 1)) * .65;
      const length = Math.hypot(dx, dy, 1);
      const i = (y * 128 + x) * 4;
      normals[i] = Math.round((.5 - dx / length * .5) * 255);
      normals[i + 1] = Math.round((.5 - dy / length * .5) * 255);
      normals[i + 2] = Math.round((.5 + 1 / length * .5) * 255);
      normals[i + 3] = 255;
    }
  }
  const normalMap = new THREE.DataTexture(normals, 128, 256);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.needsUpdate = true;
  return { map, normalMap };
}

function emptyBatch() {
  return { positions: [], normals: [], uvs: [], indices: [], hairs: [], ranges: [], rootCount: 0 };
}

function appendRoot(batch, root, plantIndex, layerIndex) {
  const radialSegments = 6;
  const points = root.points;
  const base = batch.positions.length / 3;
  const indexStart = batch.indices.length;
  let distance = 0;
  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tx = next[0] - previous[0];
    const ty = -(next[1] - previous[1]);
    const length = Math.hypot(tx, ty) || 1;
    const nx = -ty / length;
    const ny = tx / length;
    const x = points[i][0] / PIXELS_PER_UNIT;
    const y = -points[i][1] / PIXELS_PER_UNIT;
    const z = Math.sin(i * .09 + plantIndex) * .018;
    const diameter = Math.min(MAX_DIAMETER, root.widths[i] / PIXELS_PER_UNIT);
    const radius = Math.max(.0025, diameter / 2);
    if (i) distance += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]) / PIXELS_PER_UNIT;
    for (let ring = 0; ring <= radialSegments; ring++) {
      const angle = ring / radialSegments * TAU;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      batch.positions.push(x + nx * c * radius, y + ny * c * radius, z + s * radius);
      batch.normals.push(nx * c, ny * c, s);
      // Repeat the original tissue along the path, instead of stretching a
      // single texture over an entire nine-unit root.
      batch.uvs.push(ring / radialSegments, distance / 1.6);
      if (i < points.length - 1 && ring < radialSegments) {
        const a = base + i * (radialSegments + 1) + ring;
        const b = a + radialSegments + 1;
        batch.indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const order = root.order || 0;
  batch.ranges.push({
    start: indexStart, count: batch.indices.length - indexStart, order,
    delay: order * .6,
    duration: 3 + ((points.length * 17 + plantIndex * 53 + layerIndex * 97) % 301) / 100,
  });
  batch.rootCount++;
  if (!root.hairs || root.order > 1) return;
  const random = seededRandom(plantIndex * 177 + layerIndex * 101 + points.length);
  for (let i = Math.floor(points.length * .66); i < points.length - 2; i += 2) {
    if (random() > .45) continue;
    const point = points[i];
    const next = points[i + 1];
    const dx = next[0] - point[0];
    const dy = -(next[1] - point[1]);
    const length = Math.hypot(dx, dy) || 1;
    const side = random() < .5 ? -1 : 1;
    const nx = -dy / length * side;
    const ny = dx / length * side;
    const hairLength = (.035 + random() * .055) * (layerIndex === 2 ? 1 : .75);
    const radius = Math.min(MAX_DIAMETER, root.widths[i] / PIXELS_PER_UNIT) / 2;
    const x = point[0] / PIXELS_PER_UNIT;
    const y = -point[1] / PIXELS_PER_UNIT;
    batch.hairs.push(x + nx * radius, y + ny * radius, .02,
      x + nx * (radius + hairLength), y + ny * (radius + hairLength) - .015, .02);
  }
}

function geometryFor(THREE, batch) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(batch.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uvs, 2));
  geometry.setIndex(batch.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * origin is in the WebGL adapter's world units (100 original pixels = 1 unit).
 * bounds optionally supplies { x, y, width, height } in the same world units;
 * y is its LOWER edge, since WebGL +y is up. platforms, when supplied, retain
 * the original simulator's pixel coordinates for native branching avoidance.
 * The returned group is added to scene once. Each layer group can receive a
 * small camera-relative x offset using its parallaxFactor. No colliders, game
 * state, timers or input are created or changed by this module.
 */
export function buildRootLayers(THREE, { origin, bounds = {}, normal = null, platforms = [] } = {}) {
  const center = {
    x: Number.isFinite(origin?.x) ? origin.x : 12.2,
    y: Number.isFinite(origin?.y) ? origin.y : -4.8,
  };
  const left = Number.isFinite(bounds.x) ? bounds.x : center.x - 10;
  const width = Number.isFinite(bounds.width) ? bounds.width : 22;
  const bottom = Number.isFinite(bounds.y) ? bounds.y : center.y - 4.5;
  const height = Number.isFinite(bounds.height) ? bounds.height : 9;
  const surface = -(bottom + height) * PIXELS_PER_UNIT;
  const tipY = -bottom * PIXELS_PER_UNIT;
  const group = new THREE.Group();
  group.name = 'Original root architecture / visual layers';
  const maps = tissueMaps(THREE);
  const materials = [];
  const geometries = [];
  const layers = [];
  const growthBatches = [];
  const stats = { source: 'growPlantRoots', roots: 0, plants: 0, maxDiameter: MAX_DIAMETER, drawCalls: 0 };
  const specs = [
    { depth: -4, factor: .04, color: 0x687f80, mainWidth: 9, xs: [-4.9, 2.7], reach: 4.8 },
    { depth: -2, factor: .1, color: 0x9aaba4, mainWidth: 12, xs: [-3.5, 4.6], reach: 4.2 },
    { depth: -.8, factor: .17, color: 0xb7b8a3, mainWidth: 14, xs: [-4.8, 5.6], reach: 3.6 },
  ];
  specs.forEach((spec, layerIndex) => {
    const layer = new THREE.Group();
    layer.name = `Original roots / depth ${spec.depth}`;
    layer.position.z = spec.depth;
    const batch = emptyBatch();
    spec.xs.forEach((offset, plantIndex) => {
      const x = Math.max(left + .5, Math.min(left + width - .5, center.x + offset));
      const seed = 420031 + layerIndex * 733 + plantIndex * 171;
      const side = offset < 0 ? 1 : -1;
      const links = [0, 1].map(index => {
        const startY = surface + (2.1 + index * 2.35 + layerIndex * .2) * PIXELS_PER_UNIT;
        const endX = x + side * (spec.reach + index * .45);
        const endY = startY + (index ? -.6 : 1.1) * PIXELS_PER_UNIT;
        const entry = [endX * PIXELS_PER_UNIT, endY];
        return { index, attachY: startY, entry, band: 4, blockCenters: [entry], blockWidths: [2.4] };
      });
      const { roots } = growPlantRoots({
        plant: { x: x * PIXELS_PER_UNIT, seed }, surface, tipY,
        links, platforms, mainWidth: spec.mainWidth,
      });
      let freeBranch = 0;
      let fineBranch = 0;
      for (const root of roots) {
        // The source produces many fine branches. Keep a restrained subset
        // at this scale; primary and authored long laterals remain complete.
        if (root.order === 1 && root.linkIndex === undefined && freeBranch++ % 2) continue;
        if (root.order === 2 && fineBranch++ % (layerIndex === 2 ? 3 : 4)) continue;
        appendRoot(batch, root, plantIndex, layerIndex);
      }
      stats.plants++;
    });
    const material = new THREE.MeshStandardMaterial({
      color: spec.color, map: maps.map, roughness: .94, metalness: 0,
      normalMap: normal || maps.normalMap, normalScale: new THREE.Vector2(.12, .12),
    });
    material.name = `Original cellular root tissue / depth ${spec.depth}`;
    material.userData.originalNormalScale = material.normalScale.clone();
    materials.push(material);
    const geometry = geometryFor(THREE, batch);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Batched tapered tubes from growPlantRoots';
    mesh.castShadow = layerIndex === 2;
    mesh.receiveShadow = true;
    mesh.userData.source = 'src/render/root-architecture.js / growPlantRoots';
    layer.add(mesh);
    const sourceIndex = geometry.index.array.slice();
    geometry.index.setUsage(THREE.DynamicDrawUsage);
    const growthBatch = {
      geometry, sourceIndex, ranges: batch.ranges, hairs: null,
      hairRevealTime: Math.max(...batch.ranges.map(range => range.delay + range.duration)) * .92,
    };
    growthBatches.push(growthBatch);
    if (batch.hairs.length) {
      const hairGeometry = new THREE.BufferGeometry();
      hairGeometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.hairs, 3));
      geometries.push(hairGeometry);
      const hairMaterial = new THREE.LineBasicMaterial({
        color: layerIndex === 2 ? 0xa0a69a : 0x687b7c, transparent: true,
        opacity: layerIndex === 2 ? .3 : .18, depthWrite: false,
      });
      const hairs = new THREE.LineSegments(hairGeometry, hairMaterial);
      hairs.name = 'Sparse original root hairs';
      layer.add(hairs);
      growthBatch.hairs = hairs;
      materials.push(hairMaterial);
      stats.drawCalls++;
    }
    stats.roots += batch.rootCount;
    stats.drawCalls++;
    group.add(layer);
    layers.push({ group: layer, parallaxFactor: spec.factor, depth: spec.depth });
  });
  let growthComplete = true;
  function updateGrowth(seconds) {
    const elapsed = Number.isNaN(Number(seconds)) ? 0 : Math.max(0, Number(seconds));
    if (elapsed >= 8 && growthComplete) return;
    let allComplete = true;
    for (const batch of growthBatches) {
      const index = batch.geometry.index;
      const destination = index.array;
      let cursor = 0;
      for (const range of batch.ranges) {
        const progress = Math.max(0, Math.min(1, (elapsed - range.delay) / range.duration));
        // Complete triangles only. The same reused index buffer is consumed by
        // color and shadow passes, so unseen tips cannot cast mature shadows.
        const count = progress >= 1 ? range.count : Math.floor(range.count * progress / 3) * 3;
        if (count !== range.count) allComplete = false;
        for (let i = 0; i < count; i++) destination[cursor++] = batch.sourceIndex[range.start + i];
      }
      batch.geometry.setDrawRange(0, cursor);
      index.needsUpdate = true;
      if (batch.hairs) batch.hairs.visible = elapsed >= batch.hairRevealTime;
    }
    growthComplete = allComplete;
  }
  return {
    group, layers, materials, growing: [], stats, updateGrowth,
    dispose() {
      group.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      maps.map?.dispose();
      maps.normalMap?.dispose();
    },
  };
}

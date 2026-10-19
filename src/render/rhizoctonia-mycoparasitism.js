// Read-only presentation of the existing Trichoderma contact/lysis lifecycle.
// Each coil is supported by a real persistent pathogenic hypha; no ring or
// independently moving particle substitutes for the biological interaction.
import { rhizoctoniaContactPaths } from './rhizoctonia-mycelium.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const TAU = Math.PI * 2;

function measuredPath(points) {
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return { points, distances, length: distances[distances.length - 1] || 0 };
}

function atDistance(path, distance) {
  let end = 1;
  while (end < path.distances.length - 1 && path.distances[end] < distance) end++;
  const a = path.points[end - 1];
  const b = path.points[end];
  const span = Math.max(.001, path.distances[end] - path.distances[end - 1]);
  const t = clamp((distance - path.distances[end - 1]) / span);
  const dx = b.x - a.x, dy = b.y - a.y;
  const norm = Math.max(.001, Math.hypot(dx, dy));
  return { x: a.x + dx * t, y: a.y + dy * t, nx: -dy / norm, ny: dx / norm };
}

/** Geometry is derived from contact, never from elapsed animation time. */
export function buildRhizoctoniaCoils(network, contact, phase = 0, lysis = 0) {
  if (!network?.paths?.length || !(contact > 0)) return [];
  const coils = [];
  // A small fixed budget keeps the interaction legible on a 14–20 px root
  // band. The pathogenic network itself supplies all remaining fine branches.
  const paths = network.paths.filter(path => path.points?.length > 1).slice(0, 12);
  for (let i = 0; i < paths.length; i++) {
    const substrate = paths[i];
    const path = measuredPath(substrate.points);
    if (path.length < 2) continue;
    const extension = clamp(contact * 1.36 - i * .031);
    const visibleLength = path.length * extension;
    if (visibleLength < .35) continue;
    const radius = .75 + clamp(substrate.width || 1, .5, 3) * .45;
    const period = 10.5 + (i % 4) * 1.45;
    const stepCount = Math.min(110, Math.max(2, Math.ceil(visibleLength / 1.7)));
    const points = [];
    for (let k = 0; k <= stepCount; k++) {
      const distance = visibleLength * k / stepCount;
      const p = atDistance(path, distance);
      const turn = distance / period * TAU + phase + i * 1.73;
      // A fine helix wraps the existing hypha in projection. Its alternating
      // front/back shading supplies volume without an orbit around the sprite.
      const endTaper = Math.min(1, distance / 3, (visibleLength - distance + 1.5) / 3);
      const offset = Math.sin(turn) * radius * endTaper;
      points.push({ x: p.x + p.nx * offset, y: p.y + p.ny * offset, front: Math.cos(turn) > 0 });
    }
    coils.push({ points, width: .8 + clamp(substrate.width || 1, .5, 3) * .12,
      opacity: (.36 + contact * .39) * (1 - clamp(lysis) * .12), integrity: clamp(substrate.integrity ?? 1) });
  }
  return coils;
}

export function drawTrichodermaRhizoctoniaContact(ctx, attack, state) {
  if (attack.state === 'search') return;
  const network = rhizoctoniaContactPaths(attack.enemy);
  const contact = clamp(attack.contact || 0);
  const lysis = clamp(attack.lysis || 0);
  const coils = buildRhizoctoniaCoils(network, contact, attack.phase || 0, lysis);
  if (!coils.length) return;
  const inheritedAlpha = ctx.globalAlpha;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const coil of coils) {
    // The underside remains a quiet olive thread; the upper turns catch a
    // restrained moist highlight as lysis loosens the pathogenic substrate.
    ctx.globalAlpha = inheritedAlpha * coil.opacity;
    ctx.strokeStyle = lysis > .5 ? '#839366' : '#718957';
    ctx.lineWidth = coil.width + .75;
    ctx.beginPath();
    coil.points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke();
    ctx.strokeStyle = '#c8d8a1';
    ctx.lineWidth = coil.width;
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i < coil.points.length; i++) {
      const point = coil.points[i];
      if (!point.front) { drawing = false; continue; }
      if (!drawing) {
        const previous = coil.points[Math.max(0, i - 1)];
        ctx.moveTo(previous.x, previous.y);
        drawing = true;
      }
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

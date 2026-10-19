// Read-only projection of Trichoderma's real contact and lysis onto the
// opportunist's persistent hyphae. Geometry never advances on a visual clock.
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const TAU = Math.PI * 2;

function measuredPath(points) {
  const distances = [0];
  for (let index = 1; index < points.length; index++) {
    distances.push(distances[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  return { points, distances, length: distances[distances.length - 1] || 0 };
}

function atDistance(path, distance) {
  let end = 1;
  while (end < path.distances.length - 1 && path.distances[end] < distance) end++;
  const a = path.points[end - 1], b = path.points[end];
  const span = Math.max(.001, path.distances[end] - path.distances[end - 1]);
  const t = clamp((distance - path.distances[end - 1]) / span);
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.max(.001, Math.hypot(dx, dy));
  return { x: a.x + dx * t, y: a.y + dy * t, nx: -dy / length, ny: dx / length };
}

/** A bounded helix follows each living substrate; contact pays for its extent. */
export function buildOpportunisticCoils(network, contact, phase = 0, lysis = 0) {
  if (!network?.paths?.length || !(contact > 0)) return [];
  const coils = [];
  const paths = network.paths.filter(path => path.points?.length > 1 && (path.integrity ?? 1) > .015).slice(0, 8);
  for (let index = 0; index < paths.length; index++) {
    const substrate = paths[index];
    const path = measuredPath(substrate.points);
    if (path.length < 2) continue;
    const extension = clamp(contact * 1.28 - index * .038);
    const visibleLength = path.length * extension;
    if (visibleLength < .5) continue;
    const width = clamp(substrate.width || 1, .4, 3);
    const radius = .7 + width * .46;
    const period = 9.5 + index % 4 * 1.4;
    const steps = Math.min(96, Math.max(2, Math.ceil(visibleLength / 1.7)));
    const points = [];
    for (let step = 0; step <= steps; step++) {
      const distance = visibleLength * step / steps;
      const p = atDistance(path, distance);
      const turn = distance / period * TAU + phase + index * 1.73;
      const taper = Math.min(1, distance / 3, (visibleLength - distance + 1.5) / 3);
      const offset = Math.sin(turn) * radius * taper;
      points.push({ x: p.x + p.nx * offset, y: p.y + p.ny * offset, front: Math.cos(turn) > 0 });
    }
    const integrity = clamp(substrate.integrity ?? 1);
    coils.push({
      points, integrity, width: .65 + width * .15,
      // Already formed contacts remain attached while the substrate loses
      // integrity. They fade with real lysis rather than orbiting the sprite.
      opacity: (.34 + contact * .36) * (.3 + integrity * .7) * (1 - clamp(lysis) * .24),
    });
  }
  return coils;
}

export function drawOpportunisticMycoparasitism(ctx, network, attack, state) {
  const metadata = attack.metadata || {};
  if (!metadata.contactLocked && !(metadata.contact > 0)) return;
  const coils = buildOpportunisticCoils(network, metadata.contact || 0, metadata.phase || 0, metadata.lysis || 0);
  if (!coils.length) return;
  const inheritedAlpha = ctx.globalAlpha;
  const fade = clamp(1 - (attack.fading || 0));
  ctx.save();
  ctx.translate(-state.cameraX, 0);
  ctx.shadowBlur = 0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const coil of coils) {
    ctx.globalAlpha = inheritedAlpha * coil.opacity * fade;
    ctx.strokeStyle = '#6e865c';
    ctx.lineWidth = coil.width + .6;
    ctx.beginPath();
    coil.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke();
    ctx.strokeStyle = '#c1d4a5';
    ctx.lineWidth = coil.width;
    ctx.beginPath();
    let drawing = false;
    for (let index = 0; index < coil.points.length; index++) {
      const point = coil.points[index];
      if (!point.front) { drawing = false; continue; }
      if (!drawing) {
        const previous = coil.points[Math.max(0, index - 1)];
        ctx.moveTo(previous.x, previous.y);
        drawing = true;
      }
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Keep the mechanically grown search stalk, trimming its subsequent orbit. */
export function opportunisticSearchPath(tip, target, substrate) {
  if (tip.mode !== 'coil') return tip.points;
  const center = target || substrate?.anchor;
  if (!center) return [];
  const points = [];
  // The contact radius is the existing biological collision threshold (48).
  // Daughter coils begin inside it and therefore have no aerial search stalk.
  for (const point of tip.points) {
    points.push(point);
    if (Math.hypot(point.x - center.x, point.y - center.y) < 49) break;
  }
  if (points.length < 2) return [];
  const last = points[points.length - 1];
  const anchor = substrate?.anchor;
  if (anchor && Math.hypot(last.x - center.x, last.y - center.y) < 49) {
    points.push({ x: anchor.x, y: anchor.y });
  }
  return points;
}

// Presentation of the EXISTING opportunist network. No biological writes,
// random draws, extra collision filaments or independent growth simulation.
import { clamp, smoothHyphalNoise } from '../procgen/hyphal-growth.js';
import { visibleRootRect } from './rhizosphere-geometry.js';

const models = new WeakMap();
const TAU = Math.PI * 2;
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const noise = value => (Math.sin(value * 127.1 + 311.7) + 1) * .5;

function biologicalControl(network, attacks, model) {
  for (const agent of network.agents || []) model.agentIds.add(agent.id);
  const live = new Set((network.agents || []).map(agent => agent.id));
  let loss = 0;
  let contact = 0;
  for (const id of model.agentIds) {
    if (!live.has(id)) { loss += 1; contact += 1; continue; }
    let agentLysis = 0;
    let agentContact = 0;
    for (const attack of attacks) {
      const meta = attack.metadata || attack;
      if (meta.targetId !== id || meta.aborted || meta.exhausted) continue;
      agentLysis = Math.max(agentLysis, clamp(meta.lysis || 0, 0, 1));
      agentContact = Math.max(agentContact, clamp(meta.contact || 0, 0, 1));
    }
    loss += agentLysis;
    contact += agentContact;
  }
  const total = Math.max(1, model.agentIds.size);
  return { lysis: clamp(loss / total, 0, 1), contact: clamp(contact / total, 0, 1) };
}

function tissuePoint(network, point) {
  const root = network.hostRoot;
  if (!root) return { x: point.x, y: point.y };
  const rect = visibleRootRect(root);
  return {
    x: clamp(point.x, rect.x + 2, rect.x + rect.w - 2),
    y: rect.y + rect.h * (.1 + clamp((point.y - root.y + 24) / 25, 0, 1) * .8),
  };
}

function makeModel(network, time) {
  const model = {
    lastTime: time, clock: 0, segments: [], branches: new Map(), lesions: new Map(),
    agentIds: new Set((network.agents || []).map(agent => agent.id)),
    displayVigor: network.response?.vigor ?? 1, lysis: 0, contact: 0,
  };
  models.set(network, model);
  return model;
}

export function syncOpportunisticVisual(network, time = 0, attacks = []) {
  const model = models.get(network) || makeModel(network, time);
  const dt = Math.max(0, time - model.lastTime);
  model.lastTime = Math.max(time, model.lastTime);
  const response = network.response || { vigor: 1, growth: 1, branching: 1, sporulation: 1 };
  // The real growth response paces extension interpolation and tissue maturation.
  // This clock never generates new points, lesions or spores.
  if (network.activated) model.clock += dt * 4.6 * Math.max(0, response.growth || 0);
  model.displayVigor = mix(model.displayVigor, response.vigor, 1 - Math.exp(-dt * 1.8));
  const control = biologicalControl(network, attacks, model);
  model.lysis = control.lysis;
  model.contact = control.contact;

  for (let i = model.segments.length; i < network.segments.length; i++) {
    const source = network.segments[i];
    const key = `${source.phase}:${source.depth}`;
    let branch = model.branches.get(key);
    if (!branch) {
      branch = { depth: source.depth, phase: source.phase, segments: [] };
      model.branches.set(key, branch);
    }
    const segment = { source, born: model.clock, index: i, branchIndex: branch.segments.length };
    model.segments.push(segment);
    branch.segments.push(segment);
  }
  for (const lesion of network.lesions) {
    if (!lesion.reached) continue;
    if (!model.lesions.has(lesion)) model.lesions.set(lesion, {
      born: lesion === network.lesions[0] ? model.clock - 12 : model.clock,
    });
  }
  return model;
}

function integrity(model, segment) {
  // Loss is derived from actual per-agent lysis/removal, not low iron vigor.
  // Stable susceptibility makes degradation irregular without flashing RNG.
  const susceptibility = .88 + noise(segment.source.phase + segment.index * .07) * .24;
  return smooth(clamp((1 - model.lysis) * susceptibility, 0, 1));
}

function extension(model, segment) {
  // Draw only between two points already produced by the real simulation.
  return smooth(model.clock - segment.born);
}

function segmentPoints(network, model, segment) {
  const start = tissuePoint(network, segment.source.start);
  const end = tissuePoint(network, segment.source.end);
  const t = extension(model, segment);
  return [start, { x: mix(start.x, end.x, t), y: mix(start.y, end.y, t) }];
}

function lesionMaturity(model, lesion) {
  const record = model.lesions.get(lesion);
  return record ? smooth((model.clock - record.born) / 12) : 0;
}

export function opportunisticVisualSnapshot(network, time = 0, attacks = []) {
  const model = syncOpportunisticVisual(network, time, attacks);
  let totalLength = 0;
  let remainingLength = 0;
  for (const segment of model.segments) {
    const [a, b] = segmentPoints(network, model, segment);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    totalLength += length;
    remainingLength += length * integrity(model, segment);
  }
  const lesions = network.lesions.map(lesion => ({
    reached: lesion.reached, biologicalMaturity: lesion.maturity,
    maturity: lesionMaturity(model, lesion), ...tissuePoint(network, lesion),
  }));
  const reached = lesions.filter(lesion => lesion.reached);
  return {
    key: network.key, activated: network.activated, response: { ...network.response },
    vigor: network.response?.vigor ?? 1, displayVigor: model.displayVigor,
    growth: network.response?.growth ?? 0, branching: network.response?.branching ?? 0,
    sporulation: network.response?.sporulation ?? 0,
    maturity: reached.length ? reached.reduce((sum, lesion) => sum + lesion.maturity, 0) / reached.length : 0,
    reachedLesions: network.reachedLesions, lesions,
    segments: model.segments.length, branches: model.branches.size,
    activeTips: network.tips.filter(tip => tip.active).length,
    spores: network.spores.length, totalLength, remainingLength,
    contact: model.contact, lysis: model.lysis,
    survivingAgents: network.agents.length, initialAgents: model.agentIds.size,
    points: model.segments.map(segment => {
      const [start, end] = segmentPoints(network, model, segment);
      return { start, end, fraction: extension(model, segment), integrity: integrity(model, segment) };
    }),
  };
}

export function opportunisticContactPaths(network, time = 0, attacks = []) {
  const model = syncOpportunisticVisual(network, time, attacks);
  const paths = [];
  for (const branch of model.branches.values()) {
    if (branch.segments.length < 2) continue;
    const points = [];
    let survival = 0;
    for (const segment of branch.segments) {
      const [a, b] = segmentPoints(network, model, segment);
      if (!points.length) points.push(a);
      points.push(b);
      survival += integrity(model, segment);
    }
    paths.push({ points, width: Math.max(.6, 1.65 - branch.depth * .24), integrity: survival / branch.segments.length });
  }
  return { anchor: tissuePoint(network, network.anchor), paths, lysis: model.lysis, contact: model.contact };
}

function drawLesions(ctx, network, model) {
  for (const lesion of network.lesions) {
    const maturity = lesionMaturity(model, lesion);
    if (!lesion.reached || maturity <= .001) continue;
    const center = tissuePoint(network, lesion);
    const root = network.hostRoot ? visibleRootRect(network.hostRoot) : null;
    const radius = (3 + maturity * 10) * (1 - model.lysis * .45);
    ctx.fillStyle = `rgba(97,48,57,${(.08 + maturity * .24) * (1 - model.lysis * .72)})`;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const angle = i / 16 * TAU;
      const ripple = 1 + Math.sin(angle * 3 + lesion.phase) * .15 + Math.cos(angle * 5 + lesion.phase) * .09;
      const x = center.x + Math.cos(angle) * radius * ripple;
      const y = center.y + Math.sin(angle) * radius * .32 * ripple;
      const point = { x: root ? clamp(x, root.x + 1, root.x + root.w - 1) : x,
        y: root ? clamp(y, root.y + 1, root.y + root.h - 1) : y };
      if (i) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y);
    }
    ctx.closePath(); ctx.fill();
  }
}

function traceRun(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i]; const next = points[i + 1];
    ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) * .5, (point.y + next.y) * .5);
  }
  const end = points[points.length - 1]; ctx.lineTo(end.x, end.y);
}

export function drawOpportunisticMycelium(ctx, network, state, attacks = []) {
  const model = syncOpportunisticVisual(network, state.time, attacks);
  const vigor = model.displayVigor;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowBlur = 0;
  drawLesions(ctx, network, model);
  for (const branch of model.branches.values()) {
    // Short runs keep variable widths/transparency without per-point glows.
    for (let first = 0; first < branch.segments.length; first += 7) {
      const run = branch.segments.slice(first, first + 7);
      const points = [];
      let life = 0;
      for (const segment of run) {
        const [a, b] = segmentPoints(network, model, segment);
        if (!points.length) points.push(a);
        points.push(b); life += integrity(model, segment);
      }
      life /= run.length;
      if (life < .004) continue;
      const organic = .86 + smoothHyphalNoise(points[0].x, points[0].y, 0, branch.phase) * .16;
      const width = Math.max(.45, (1.85 - branch.depth * .28) * organic * (.72 + vigor * .28));
      const alpha = (.36 + vigor * .39) * life;
      traceRun(ctx, points); ctx.lineWidth = width + 1.15;
      ctx.strokeStyle = `rgba(79,39,47,${alpha * .65})`; ctx.stroke();
      traceRun(ctx, points); ctx.lineWidth = width;
      ctx.strokeStyle = `rgba(${Math.round(156 + vigor * 49)},${Math.round(100 + vigor * 22)},${Math.round(112 + vigor * 20)},${alpha})`;
      ctx.stroke();
    }
    const last = branch.segments[branch.segments.length - 1];
    const tip = network.tips.find(candidate => candidate.phase === branch.phase && candidate.depth === branch.depth);
    if (!last || !tip?.active || model.lysis >= .98) continue;
    const [a, b] = segmentPoints(network, model, last);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.fillStyle = `rgba(236,193,171,${(.28 + vigor * .45) * integrity(model, last)})`;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, 1.6, .8, angle, 0, TAU); ctx.fill();
  }
  // Every spore is the real, potentially contaminating entity. Do not remove
  // hazard particles or change their trajectories to manufacture suppression.
  const reached = [...model.lesions.keys()];
  const maturity = reached.length ? reached.reduce((sum, lesion) => sum + lesionMaturity(model, lesion), 0) / reached.length : 0;
  for (const spore of network.spores) {
    const alpha = clamp(spore.life / 3.5, .08, .42) * (.55 + vigor * .45) * (.65 + maturity * .35);
    ctx.fillStyle = `rgba(220,180,204,${alpha})`;
    ctx.beginPath(); ctx.ellipse(spore.x, spore.y, 1.8, 1.25, spore.phase, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function forgetOpportunisticVisual(network) { models.delete(network); }

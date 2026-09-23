import { organismSprites } from '../render/organism-sprites.js';
import { drawRoamingBacillusSprite, drawInoculatedBacillusSprite } from '../render/bacillus-sprite.js';
import { drawArbuscule } from './hyphal-growth.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const STAGES = ['recognition', 'root-hair-curl', 'infection-thread', 'primordium', 'young-nodule', 'mature-nodule'];
const stageIndex = stage => Math.max(0, STAGES.indexOf(stage));

// As rotinas privadas abaixo são transpostas do jogo sem importar sistemas de
// física/atualização: rhizobium-nodulation, meloidogyne-lifecycle e
// pseudomonas-siderophores. O relógio é local; nenhum estado da fase é alterado.
function drawNodule(c, time) {
function drawRootHair(ctx, site) {
    const stage = stageIndex(site.stage);
    if (stage < 1) return;
    const curl = clamp(stage === 1 ? site.progress : 1, 0, 1);
    const y = site.surfaceY - 4;
    ctx.strokeStyle = `rgba(235,221,198,${.35 + curl * .55})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(site.x - 28, y + 2);
    ctx.bezierCurveTo(
      site.x - 18, y - 24 * curl,
      site.x + 22, y - 25 * curl,
      site.x + 11, y - 4,
    );
    if (curl > .56) {
      ctx.bezierCurveTo(site.x + 2, y + 7, site.x - 7, y - 3, site.x + 1, y - 10);
    }
    ctx.stroke();
  }

  function drawInfectionThread(ctx, site) {
    const index = stageIndex(site.stage);
    if (index < 2) return;
    const progress = index === 2 ? site.progress : 1;
    const startY = site.surfaceY - 7;
    const endY = site.surfaceY + site.depth * progress;
    ctx.strokeStyle = `rgba(224,190,255,${.42 + progress * .5})`;
    ctx.lineWidth = 2.1;
    ctx.shadowBlur = 7;
    ctx.shadowColor = '#c7a5ff';
    ctx.beginPath();
    ctx.moveTo(site.x + 1, startY);
    ctx.bezierCurveTo(
      site.x + 12, lerp(startY, endY, .34),
      site.x - 10, lerp(startY, endY, .7),
      site.x + 2, endY,
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    const cellCount = 2 + Math.floor(progress * 5);
    for (let i = 0; i < cellCount; i++) {
      const t = (i + .5) / cellCount * progress;
      const yy = lerp(startY, site.surfaceY + site.depth, t);
      const xx = site.x + Math.sin(t * Math.PI * 3 + site.phase) * 5;
      ctx.fillStyle = '#ead8ff';
      ctx.beginPath();
      ctx.ellipse(xx, yy, 2.8, 1.4, t * 2, 0, TAU);
      ctx.fill();
    }
  }

  function drawPrimordium(ctx, site) {
    const index = stageIndex(site.stage);
    if (index < 3) return;
    const development = index === 3 ? site.progress * .48 : index === 4 ? .48 + site.progress * .42 : 1;
    const radius = lerp(3, 15 + site.lobes * 1.7, development);
    const centerY = site.surfaceY + site.depth;

    ctx.save();
    ctx.translate(site.x, centerY);
    ctx.scale(1, .76);
    const gradient = ctx.createRadialGradient(-radius * .2, -radius * .25, 1, 0, 0, radius * 1.2);
    gradient.addColorStop(0, index >= 5 ? '#ffd0da' : '#f6dfc8');
    gradient.addColorStop(.62, index >= 5 ? '#df6688' : '#dba98f');
    gradient.addColorStop(1, 'rgba(94,38,50,.82)');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = index >= 5 ? '#ffb2c5' : '#f1c7ac';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * TAU;
      const lobe = 1 + Math.sin(angle * site.lobes + site.phase) * .12 * development;
      const x = Math.cos(angle) * radius * lobe;
      const y = Math.sin(angle) * radius * lobe;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (index >= 4) {
      const count = 5 + site.colony.sourceCount * 3;
      for (let i = 0; i < count; i++) {
        const angle = i / count * TAU + site.phase;
        const rr = radius * (.2 + (i % 4) * .15);
        ctx.fillStyle = index >= 5 ? '#7b254a' : '#a2697d';
        ctx.globalAlpha = .52 + (i % 3) * .15;
        ctx.beginPath();
        ctx.ellipse(Math.cos(angle) * rr, Math.sin(angle) * rr, 3.2, 1.25, angle, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawFixationFlux(ctx, site) {
    if (!site.mature || site.activity <= .08) return;
    const centerY = site.surfaceY + site.depth;
    const intensity = clamp(site.activity, 0, 1);
    for (let i = 0; i < 5; i++) {
      const t = (time * (.18 + i * .012) + i * .21 + site.phase) % 1;
      const angle = site.phase + i * 1.37;
      const startX = site.x + Math.cos(angle) * (36 + i * 3);
      const startY = centerY - 30 - i * 3;
      const x = lerp(startX, site.x, t);
      const y = lerp(startY, centerY, t) + Math.sin(t * Math.PI) * 8;
      ctx.globalAlpha = (.25 + intensity * .6) * (1 - Math.abs(t - .5) * .7);
      ctx.fillStyle = '#8db8ff';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, TAU);
      ctx.fill();
    }

    for (let i = 0; i < 4; i++) {
      const t = (time * .22 + i * .27 + site.phase * .2) % 1;
      const x = site.x + (i - 1.5) * 5 + Math.sin(t * TAU + i) * 2;
      const y = lerp(centerY, site.surfaceY + 5, t);
      ctx.globalAlpha = .25 + intensity * .65;
      ctx.fillStyle = '#ffd783';
      ctx.beginPath();
      ctx.arc(x, y, 2.1, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.font = '700 8px Inter,system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(180,208,255,.82)';
    ctx.fillText('N₂', site.x - 27, centerY - 24);
    ctx.fillStyle = 'rgba(255,220,139,.9)';
    ctx.fillText('NH₄⁺', site.x + 26, site.surfaceY + 4);
  }
  const site = { x: 0, surfaceY: -20, depth: 28, stage: 'mature-nodule',
    progress: 1, lobes: 3, phase: .7, colony: { sourceCount: 3 }, mature: true, activity: .9 };
  c.save(); c.scale(3.6, 3.6);
  drawRootHair(c, site); drawInfectionThread(c, site);
  drawPrimordium(c, site); drawFixationFlux(c, site);
  c.restore();
}

function drawAdultFemale(ctx, g, p) {
    if (p < .72) return;
    const maturity = clamp((p - .72) / .28 + g.femaleMaturity * .25, 0, 1.2);
    const bodyW = 9 + maturity * 12;
    const bodyH = 12 + maturity * 19;
    ctx.save();
    ctx.translate(0, 5 + Math.min(8, g.platform.h * .12));
    const gradient = ctx.createRadialGradient(-bodyW * .25, -bodyH * .2, 2, 0, 0, bodyH);
    gradient.addColorStop(0, '#fff8e8');
    gradient.addColorStop(.5, '#f4d7c4');
    gradient.addColorStop(1, '#c77d73');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#fff1de';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(0, -bodyH * .58);
    ctx.bezierCurveTo(bodyW * .75, -bodyH * .45, bodyW, bodyH * .22, bodyW * .28, bodyH * .62);
    ctx.bezierCurveTo(0, bodyH * .78, -bodyW * .72, bodyH * .56, -bodyW * .82, 0);
    ctx.bezierCurveTo(-bodyW * .72, -bodyH * .38, -bodyW * .3, -bodyH * .55, 0, -bodyH * .58);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8f4f55'; ctx.beginPath(); ctx.arc(0, -bodyH * .54, 2.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(177,94,91,.42)'; ctx.lineWidth = .8;
    for (let i = 0; i < 4; i++) {
      const yy = -bodyH * .25 + i * bodyH * .19;
      ctx.beginPath(); ctx.moveTo(-bodyW * .45, yy); ctx.quadraticCurveTo(0, yy + 3, bodyW * .5, yy - 1); ctx.stroke();
    }
    ctx.restore();
  }

function drawEgg(ctx, m) {
    const ratio = m.eggs / Math.max(1, m.maxEggs), empty = m.eggs <= 0;
    const neutralized = Boolean(m.neutralized);
    ctx.save(); ctx.translate(m.x, m.y); ctx.globalAlpha = empty ? clamp(1 - m.emptyAge / 11, 0, .55) : 1;
    ctx.fillStyle = neutralized ? 'rgba(94,181,116,.24)' : empty ? 'rgba(180,132,105,.22)' : 'rgba(255,213,155,.28)';
    ctx.strokeStyle = neutralized ? 'rgba(141,240,168,.82)' : empty ? 'rgba(199,157,128,.25)' : 'rgba(255,235,196,.82)';
    ctx.beginPath(); ctx.ellipse(0, -2, 16 + ratio * 6, 9 + ratio * 4, 0, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < Math.max(2, m.eggs); i++) {
      const a = i / Math.max(2, m.eggs) * TAU + m.phase, r = 3 + i % 3 * 3;
      ctx.fillStyle = neutralized ? '#9dd7a8' : i % 2 ? '#fff0cf' : '#ffd7a0'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r, -2 + Math.sin(a) * r * .48, 2.7, 1.9, a, 0, TAU); ctx.fill();
    }
    ctx.font = '700 8px Inter,system-ui'; ctx.textAlign = 'center';
    // "massa neutralizada" e confirmacao de uma acao que o jogador acabou de
    // fazer, e fica. A CONTAGEM de ovos e numero de infestacao, e o desenho da
    // massa ja mostra quantos ovos restam pelo tamanho e pela quantidade de
    // pontos — o numero por cima disso e a mesma informacao duas vezes.
    if (neutralized) { ctx.fillStyle = '#baffc7'; ctx.fillText('massa neutralizada', 0, -17); }
    else if (!empty && false) {
      ctx.fillStyle = '#fff0cf'; ctx.fillText(`ovos ${m.eggs}`, 0, -17);
    }
    ctx.restore();
  }

function drawIron(c, time) {
function drawSiderophore(ctx, particle) {
    const loaded = particle.state === 'loaded';
    const color = loaded ? '#ffb15c' : '#d5ff6d';
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.shadowBlur = loaded ? 15 : 11;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.fillStyle = loaded ? '#ffcf83' : '#efffb8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = i * TAU / 6 + particle.phase + time * .45;
      const x = Math.cos(angle) * 5.8;
      const y = Math.sin(angle) * 5.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, loaded ? 3.2 : 1.8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5 + time * .15;
    c.save(); c.translate(Math.cos(a) * 100, Math.sin(a) * 100); c.scale(2.2, 2.2);
    drawSiderophore(c, {x:0, y:0, state:i % 2 ? 'loaded':'search', phase:i}); c.restore();
  }
}

const kinds = Object.freeze({
  'organism-rhizobium': 'rhizobium',
  'organism-azospirillum': 'azospirillum',
  'organism-bacillus': 'bacillus',
  'organism-phosphate-solubilizer': 'bacillus',
  'organism-pseudomonas': 'pseudomonas',
  'organism-trichoderma': 'trichoderma',
  'organism-rhizoctonia': 'rhizoctonia',
  'organism-opportunistic-fungus': 'oportunista',
  'organism-ralstonia': 'ralstonia',
  'organism-mycorrhiza': 'micorriza',
  'organism-meloidogyne-j2': 'nematoide',
  'organism-meloidogyne-female': 'female',
  'action-exudate': 'exudate',
  'structure-nodule': 'nodule',
  'process-fbn': 'nodule',
  'structure-biofilm': 'biofilm',
  'process-siderophore': 'iron',
  'process-iron-competition': 'iron',
  'structure-arbuscule': 'arbuscule',
  'structure-mycorrhiza-path': 'arbuscule',
  'structure-lateral-root': 'azospirillum',
  'structure-egg-mass': 'eggs',
  'structure-gall': 'female',
  'process-mycoparasitism': 'trichoderma',
  'process-ralstonia-entry': 'ralstonia',
  'process-vascular-obstruction': 'ralstonia',
  'process-ralstonia-containment': 'ralstonia',
  'process-ralstonia-spread': 'ralstonia',
});

function drawPopulation(c, kind, time) {
  // Mesmos PNGs, recortes e cadências da fase. A profundidade vem do tamanho,
  // foco e movimento discreto; o espécime principal mantém sua leitura intacta.
  const draw = (x, y, height, phase, alpha, rotation = 0) => {
    c.save(); c.translate(x, y); c.rotate(rotation);
    if (kind === 'bacillus' || kind === 'biofilm') {
      const render = kind === 'biofilm' ? drawInoculatedBacillusSprite : drawRoamingBacillusSprite;
      if (kind === 'biofilm') render(c, 0, 0, height * .6, null, time, phase, alpha);
      else render(c, 0, 0, height * .6, time, phase, alpha);
    } else {
      organismSprites.draw(c, kind, {height, time, phase, alpha, flipX: phase === 2});
    }
    c.restore();
  };
  c.filter = 'blur(1.2px)';
  draw(-108 + Math.sin(time * .18) * 8, -72, 135, 2, .4, -.28);
  draw(113, 66 + Math.cos(time * .21) * 7, 125, 3, .35, .23);
  c.filter = 'none';
  draw(8 + Math.sin(time * .35) * 5, 2 + Math.cos(time * .4) * 7, kind === 'nematoide' ? 290 : 310, 0, 1, Math.sin(time * .2) * .025);
}

function drawExudates(c, time) {
  // Mesmos núcleos verde-lima, halo e pulsação usados por renderer.js.
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4, radius = 30 + i * 20;
    c.save(); c.translate(Math.cos(angle) * radius, Math.sin(angle) * radius + Math.sin(time * 2 + i) * 7);
    c.scale(i === 0 ? 2.2 : 1.3, i === 0 ? 2.2 : 1.3);
    c.shadowBlur = 18; c.shadowColor = '#b7f36b'; c.fillStyle = '#cfff88';
    c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.strokeStyle = 'rgba(183,243,107,.5)'; c.beginPath(); c.arc(0, 0, 14 + Math.sin(time * 3 + i) * 2, 0, TAU); c.stroke();
    c.restore();
  }
}

function drawField(c, kind, time) {
  if (kind === 'nodule') drawNodule(c, time);
  else if (kind === 'exudate') drawExudates(c, time);
  else if (kind === 'iron') {
    organismSprites.draw(c, 'pseudomonas', {height: 165, time});
    drawIron(c, time);
  } else if (kind === 'arbuscule') {
    c.save(); c.translate(25, 100); c.scale(6, 6);
    drawArbuscule(c, {x: 0, y: 0, seed: 3, life: 1}, time, '#d6afff');
    c.restore();
  } else if (kind === 'female') {
    c.save(); c.scale(4.5, 4.5);
    drawAdultFemale(c, {femaleMaturity: .9, platform: {h: 30}}, .98);
    c.restore();
  } else if (kind === 'eggs') {
    c.save(); c.scale(6, 6);
    drawEgg(c, {x: 0, y: 0, eggs: 14, maxEggs: 14, phase: time * .015});
    c.restore();
  } else if (kind === 'community') {
    organismSprites.draw(c, 'rhizobium', {x: -60, y: -40, height: 170, time, rotation: -.15});
    drawRoamingBacillusSprite(c, 65, 45, 85, time, 2);
    organismSprites.draw(c, 'micorriza', {x: -60, y: 95, height: 110, time, alpha: .75});
  } else drawPopulation(c, kind, time);
}

// O campo óptico preserva renderScope(t) do protótipo: fundo radial, matéria
// suspensa e vinheta. Dentro dele, a arte é a mesma vista no jogo atual.
function renderScope(c, kind, time) {
  const w = c.canvas.width;
  c.setTransform(w / 440, 0, 0, w / 440, 0, 0);
  const bg = c.createRadialGradient(220, 220, 10, 220, 220, 220);
  bg.addColorStop(0, '#1d0e0a'); bg.addColorStop(1, '#040101');
  c.fillStyle = bg; c.fillRect(0, 0, 440, 440);
  c.save(); c.translate(220, 220);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    c.fillStyle = `rgba(255,230,200,${.04 + (i % 5) * .01})`;
    c.beginPath(); c.arc(Math.sin(i * 7.1 + time * .1) * 170, Math.cos(i * 3.3 + time * .08) * 170, 1 + i % 3, 0, TAU); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  drawField(c, kind, time);
  c.restore();
  const vg = c.createRadialGradient(220, 220, 132, 220, 220, 220);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)');
  c.fillStyle = vg; c.fillRect(0, 0, 440, 440);
}

export function createTutorialMicroscope(canvas) {
  const context = canvas.getContext('2d');
  let frame = null, kind = null, elapsed = 0, previousTime = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function tick(now) {
    frame = null;
    if (!kind || !canvas.isConnected) return;
    if (!document.hidden) {
      if (previousTime !== null) elapsed += Math.min((now - previousTime) / 1000, .05) * (reducedMotion.matches ? .15 : 1);
      renderScope(context, kind, elapsed);
    }
    previousTime = now;
    frame = requestAnimationFrame(tick);
  }
  return {
    show(cardId) {
      kind = kinds[cardId] || 'community';
      canvas.dataset.microscopeKind = kind;
      if (context && frame === null) { previousTime = null; frame = requestAnimationFrame(tick); }
    },
    stop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null; kind = null; previousTime = null;
    },
  };
}

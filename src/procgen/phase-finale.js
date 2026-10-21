// FIM DE FASE — CONTINUAÇÃO DA FASE, NÃO UMA SEGUNDA CENA
// =======================================================
//
// A primeira versão disto era um protótipo HTML encaixado depois da fase: tinha
// mundo próprio (1800x1320), câmera própria, raiz própria e um Miguelito vetorial
// improvisado, e pintava a tela inteira por cima do jogo. O jogador terminava a
// fase e caía dentro de outra coisa.
//
// Este módulo não desenha jogo nenhum. Ele é um CONTROLADOR:
//
//   · assume a câmera REAL (`cameraView.beginCinematic()`) e a interpola a
//     partir do enquadramento que estava no ar no instante da vitória;
//   · lê o colo e os limites da raiz final COMPARTILHADA (`final-root-visual`),
//     a mesma que `goal-system` desenha desde o começo da fase;
//   · empurra o pulso por `level.finalRootPulse`, sem redesenhar a raiz;
//   · acrescenta ao MUNDO só o que ainda não existia: a faixa de superfície, o
//     céu acima dela, as nuvens e o feijoeiro nascendo do mesmo colo;
//   · desenha o cartão de resultado em coordenadas de tela.
//
// Miguelito continua sendo desenhado pelo renderizador normal, no lugar real
// onde terminou a fase, com a animação `celebrate` que o renderer já escolhe em
// `gameState === 'transition'`. Não existe segundo personagem, e o jogador nunca
// é teleportado.
//
// A PLANTA É O BOLETIM: o porte sai de `buildPhaseReport().score`.

import {
  beanPlantHeight,
  drawBeanPlant,
  plantStateFromScore,
  BEAN_PLANT_LABEL,
} from '../render/bean-plant-visual.js';
import {
  finalRootBounds,
  FINAL_ROOT_SCALE,
} from '../render/final-root-visual.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

// Escala do feijoeiro. A mesma da raiz: caule e raiz saem do mesmo colo e têm
// que ter a mesma unidade, senão a planta fica desproporcional à raiz que a
// sustenta.
export const BEAN_PLANT_SCALE = FINAL_ROOT_SCALE;

// Duração das etapas depois da comemoração. A comemoração NÃO tem duração fixa
// aqui: ela vem do ciclo da folha de sprite (`celebrationCycleSeconds`).
const ROOT_PULSE_SECONDS = 0.9;
const REVEAL_SECONDS = 2.8;
const HOLD_SECONDS = 1.2;

// Faixa do topo reservada ao cartão. Sem ela o enquadramento centraliza a planta
// na tela inteira e a copa nasce atrás do texto.
const CARD_BAND = 0.19;
const CROWN_MARGIN = 90;
const TIP_MARGIN = 70;
const CINEMATIC_MIN_ZOOM = 0.22;
const CINEMATIC_MAX_ZOOM = 1.6;

/**
 * Quanto a cinemática leva do começo até `done`, dado o ciclo da comemoração.
 *
 * `maybeAdvanceCampaign` precisa disto: a espera SEM áudio é de 3,4 s
 * (`PHASE_VICTORY_TRANSITION_SECONDS`), menor que a cena, e cortaria o
 * afastamento no meio. Com áudio o stinger de 10,24 s já cobre tudo.
 */
export function phaseFinaleSeconds(celebrationSeconds = 0) {
  const celebrate = Math.max(0, Number(celebrationSeconds) || 0);
  return celebrate + ROOT_PULSE_SECONDS + REVEAL_SECONDS + HOLD_SECONDS;
}

// COLHEITA NO FIM DA FASE: um feijoal (camadas pintadas da fazendinha) cresce na
// superficie junto com o feijoeiro e, depois, a colheitadeira passa colhendo:
// a lavoura vira moeda. A arte vem de assets/farm; sem ela (testes), a cena
// segue exatamente como antes, so com o feijoeiro.
export const FINALE_HARVEST_SECONDS = 6.5;
const FIELD_ROWS = [
  { src: './assets/farm/feijao-1.webp', height: 1, lift: 0, haze: 0 },
];
const HARVESTER_SRC = './assets/farm/colheitadeira.webp';
// tom da lavoura por estado do feijoeiro (doente amarela)
const FIELD_TONE = ['sepia(0.5) saturate(1.15) hue-rotate(-14deg) brightness(0.96)', 'saturate(0.92)', 'none'];

function loadFieldArt() {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return null;
  const art = { rows: [], harvester: null, ready: false };
  let pending = FIELD_ROWS.length + 1;
  const done = () => { if (--pending === 0) art.ready = true; };
  FIELD_ROWS.forEach((row, i) => {
    const img = new Image();
    img.onload = () => {
      // tres versoes ja tingidas (doente, saudavel, super): nada de filtro por quadro
      art.rows[i] = FIELD_TONE.map(filter => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d');
        g.filter = filter;
        g.drawImage(img, 0, 0);
        return c;
      });
      done();
    };
    img.onerror = () => { pending = Infinity; };
    img.src = row.src;
  });
  const tractor = new Image();
  tractor.onload = () => { art.harvester = tractor; done(); };
  tractor.onerror = () => { pending = Infinity; };
  tractor.src = HARVESTER_SRC;
  return art;
}

export function createPhaseFinale({ state, cameraView, getViewport, onHarvested = () => {} } = {}) {
  const fieldArt = loadFieldArt();
  const viewport = typeof getViewport === 'function'
    ? getViewport
    : () => ({
      width: state?.viewportWidth || 1280,
      height: state?.viewportHeight || 720,
    });

  let mode = 'idle';
  let elapsed = 0;
  let clock = 0;
  let report = null;
  let plantState = 1;
  let celebrateSeconds = 0;
  let celebratedFrom = 0;
  let goal = null;
  let collar = null;
  let startCamera = null;
  let endCamera = null;
  let pulse = 0;
  let growth = 0;
  let skyAlpha = 0;
  let cardAlpha = 0;
  // colheita: 0..1 do percurso da colheitadeira; moedas mostradas no cartao
  let harvest = null;
  const pops = [];

  const clouds = [
    { x: 120, y: -520, scale: 1.1, speed: 8, opacity: 0.82 },
    { x: 580, y: -430, scale: 0.85, speed: 5, opacity: 0.70 },
    { x: 1050, y: -560, scale: 1.35, speed: 11, opacity: 0.88 },
    { x: 1520, y: -450, scale: 0.95, speed: 7, opacity: 0.75 },
  ];
  const CLOUD_SPAN = 1800;

  function publish() {
    if (!state?.level) return;
    // A raiz é desenhada por `goal-system`; daqui sai só o quanto ela acende.
    state.level.finalRootPulse = mode === 'idle' ? undefined : pulse;
    state.level.finalRootLabelHidden = mode !== 'idle' && mode !== 'celebrate';
  }

  function reset() {
    const wasActive = mode !== 'idle';
    mode = 'idle';
    elapsed = 0;
    clock = 0;
    report = null;
    plantState = 1;
    celebrateSeconds = 0;
    celebratedFrom = 0;
    goal = null;
    collar = null;
    startCamera = null;
    endCamera = null;
    pulse = 0;
    growth = 0;
    skyAlpha = 0;
    cardAlpha = 0;
    harvest = null;
    pops.length = 0;
    if (state?.level) {
      state.level.finalRootPulse = undefined;
      state.level.finalRootLabelHidden = false;
    }
    if (wasActive) cameraView?.endCinematic?.();
  }

  /**
   * Enquadramento final, calculado a partir dos limites REAIS.
   *
   * Copa (que muda de altura com o resultado), ponta da raiz compartilhada e a
   * faixa do cartão. Nada de valores fixos: o mesmo cálculo serve paisagem,
   * retrato e qualquer zoom que o jogador estivesse usando.
   */
  function computeEndCamera() {
    const bounds = finalRootBounds(goal, FINAL_ROOT_SCALE);
    const crown = bounds.collarY - beanPlantHeight(plantState) * BEAN_PLANT_SCALE - CROWN_MARGIN;
    const tip = bounds.tipY + TIP_MARGIN;
    const { width, height } = viewport();
    const span = Math.max(1, tip - crown);
    const zoom = clamp((height * (0.94 - CARD_BAND)) / span, CINEMATIC_MIN_ZOOM, CINEMATIC_MAX_ZOOM);
    const visibleWidth = width / zoom;
    const visibleHeight = height / zoom;
    return {
      x: bounds.collarX - visibleWidth / 2,
      // A copa encosta logo abaixo da faixa do cartão; a ponta da raiz cai
      // dentro dos 94% restantes.
      y: crown - CARD_BAND * visibleHeight,
      zoom,
      crown,
      tip,
    };
  }

  /**
   * Começa a cinemática. Chamada no mesmo ponto em que a fase é dada por
   * concluída — `goal-system` já validou os objetivos pelo guard.
   */
  function begin({ report: phaseReport = null, celebrationSeconds = 0 } = {}) {
    if (mode !== 'idle') return false;
    goal = state?.level?.goal || null;
    if (!goal) return false;
    startCamera = cameraView?.beginCinematic?.();
    if (!startCamera) return false;

    report = phaseReport;
    // a nota nova (phase-score.js) ja traz o estado; relatorio antigo cai na regra antiga
    plantState = Number.isInteger(phaseReport?.plantState) ? phaseReport.plantState : plantStateFromScore(phaseReport?.score);
    celebrateSeconds = Math.max(0, Number(celebrationSeconds) || 0);
    const bounds = finalRootBounds(goal, FINAL_ROOT_SCALE);
    collar = { x: bounds.collarX, y: bounds.collarY };
    endCamera = computeEndCamera();
    celebratedFrom = Number(state?.time) || 0;
    mode = 'celebrate';
    elapsed = 0;
    pulse = 0;
    growth = 0;
    skyAlpha = 0;
    cardAlpha = 0;
    // Primeiro quadro da cinemática = último quadro jogável, exatamente.
    cameraView.setCinematic(startCamera);
    publish();
    return true;
  }

  function applyCamera(t) {
    if (!startCamera || !endCamera) return;
    const eased = smooth(clamp(t));
    cameraView.setCinematic({
      x: lerp(startCamera.x, endCamera.x, eased),
      y: lerp(startCamera.y, endCamera.y, eased),
      zoom: lerp(startCamera.zoom, endCamera.zoom, eased),
    });
  }

  function update(dt = 0) {
    const step = Number(dt) || 0;
    clock += step;
    for (const cloud of clouds) {
      cloud.x += cloud.speed * step;
      if (cloud.x >= CLOUD_SPAN) cloud.x -= CLOUD_SPAN;
    }
    if (mode === 'idle') return;
    elapsed += step;

    if (mode === 'celebrate') {
      // A câmera fica parada no enquadramento do gameplay: o afastamento não
      // pode começar antes de a comemoração ter rodado inteira.
      cameraView.setCinematic(startCamera);
      if (elapsed >= celebrateSeconds) { mode = 'rootPulse'; elapsed = 0; }
      publish();
      return;
    }
    if (mode === 'rootPulse') {
      const t = clamp(elapsed / ROOT_PULSE_SECONDS);
      pulse = Math.sin(Math.PI * t) * 0.85;
      cameraView.setCinematic(startCamera);
      if (t >= 1) { mode = 'reveal'; elapsed = 0; }
      publish();
      return;
    }
    if (mode === 'reveal') {
      const t = clamp(elapsed / REVEAL_SECONDS);
      applyCamera(t);
      pulse = 0.25 + Math.sin(clock * 3) * 0.12;
      skyAlpha = clamp(t / 0.45);
      // O caule sai do colo depois de o céu já estar aparecendo.
      growth = clamp((t - 0.3) / 0.6);
      cardAlpha = clamp((t - 0.82) / 0.18);
      if (t >= 1) { mode = 'hold'; elapsed = 0; growth = 1; }
      publish();
      return;
    }
    if (mode === 'hold') {
      applyCamera(1);
      pulse = 0.25 + Math.sin(clock * 3) * 0.12;
      skyAlpha = 1;
      growth = 1;
      cardAlpha = 1;
      // com a arte carregada, a colheitadeira entra logo (a musica de vitoria e
      // curta); sem ela, a cena termina como antes, depois da pausa
      const harvestReady = fieldArt?.ready && endCamera;
      if (harvestReady && elapsed >= .2) {
        const { width } = viewport();
        const span = width / endCamera.zoom;
        const half = harvesterSize().w * .55;
        harvest = { t: 0, x0: endCamera.x - half, x1: endCamera.x + span + half, coins: Number(report?.coinsEarned) || 0, shown: 0, nextPop: 0 };
        mode = 'harvest';
        elapsed = 0;
      } else if (!harvestReady && elapsed >= HOLD_SECONDS) {
        mode = 'done';
        elapsed = 0;
      }
      publish();
      return;
    }
    if (mode === 'harvest') {
      applyCamera(1);
      pulse = 0.25 + Math.sin(clock * 3) * 0.12;
      harvest.t = clamp(elapsed / FINALE_HARVEST_SECONDS);
      const k = harvestProgress();
      harvest.shown = Math.round(harvest.coins * k);
      if (k > 0 && k < 1 && elapsed >= harvest.nextPop && harvest.coins > 0) {
        harvest.nextPop = elapsed + .32;
        pops.push({ wx: harvestCut(), wy: collar.y - fieldHeight() * 1.2, life: 1.2, value: Math.max(1, Math.round(harvest.coins / 18)) });
      }
      if (harvest.t >= 1) {
        mode = 'done';
        elapsed = 0;
        harvest.shown = harvest.coins;
        onHarvested({ coins: harvest.coins });
      }
      publish();
      return;
    }
    // done: quadro final parado. Quem troca de fase é `maybeAdvanceCampaign`.
    applyCamera(1);
    pulse = 0.25 + Math.sin(clock * 3) * 0.12;
    skyAlpha = 1;
    growth = 1;
    cardAlpha = 1;
    publish();
  }

  // --- DESENHO ---------------------------------------------------------------

  function drawSky(ctx, view) {
    if (skyAlpha <= 0.002) return;
    const surface = collar.y;
    if (view.y1 <= surface - 4000) return;
    const top = Math.min(view.y0, surface - 1400);
    ctx.save();
    ctx.globalAlpha *= skyAlpha;

    // SÓ ACIMA DA SUPERFÍCIE. O subsolo continua sendo o cenário real da fase,
    // desenhado pelo renderizador normal — nada aqui repinta plataforma,
    // organismo, partícula, raiz ou jogador.
    ctx.beginPath();
    ctx.rect(view.x0, top, view.x1 - view.x0, surface - top);
    ctx.clip();

    const sky = ctx.createLinearGradient(0, surface - 900, 0, surface);
    sky.addColorStop(0, '#2572b8');
    sky.addColorStop(0.55, '#4ea1e6');
    sky.addColorStop(1, '#99e0f8');
    ctx.fillStyle = sky;
    ctx.fillRect(view.x0, top, view.x1 - view.x0, surface - top);

    const first = Math.floor((view.x0 - 260) / CLOUD_SPAN);
    const last = Math.ceil((view.x1 + 260) / CLOUD_SPAN);
    for (let tile = first; tile <= last; tile++) {
      for (const cloud of clouds) {
        ctx.save();
        ctx.translate(collar.x - CLOUD_SPAN / 2 + cloud.x + tile * CLOUD_SPAN, surface + cloud.y);
        ctx.scale(cloud.scale, cloud.scale);
        ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
        ctx.beginPath();
        ctx.arc(0, 160, 48, 0, Math.PI * 2);
        ctx.arc(38, 142, 38, 0, Math.PI * 2);
        ctx.arc(75, 160, 44, 0, Math.PI * 2);
        ctx.arc(115, 165, 32, 0, Math.PI * 2);
        ctx.arc(38, 172, 30, 0, Math.PI * 2);
        ctx.arc(75, 175, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const horizon = ctx.createLinearGradient(0, surface - 90, 0, surface);
    horizon.addColorStop(0, 'rgba(255, 255, 255, 0)');
    horizon.addColorStop(1, 'rgba(255, 255, 255, 0.35)');
    ctx.fillStyle = horizon;
    ctx.fillRect(view.x0, surface - 90, view.x1 - view.x0, 90);
    ctx.restore();

    // Crosta: a linha do horizonte, encostada na superfície. Fica fora do clip
    // para fechar a emenda entre céu e subsolo real.
    ctx.save();
    ctx.globalAlpha *= skyAlpha;
    const crust = ctx.createLinearGradient(0, surface - 10, 0, surface + 14);
    crust.addColorStop(0, '#3d1e16');
    crust.addColorStop(0.5, '#23110d');
    crust.addColorStop(1, 'rgba(35, 17, 13, 0)');
    ctx.fillStyle = crust;
    ctx.fillRect(view.x0, surface - 10, view.x1 - view.x0, 24);
    ctx.restore();
  }

  // altura da fileira da frente, em unidades de mundo (acompanha o enquadramento)
  function fieldHeight() {
    const { height } = viewport();
    return (height / (endCamera?.zoom || 1)) * .13;
  }
  // posicao da colheitadeira (centro) e da plataforma de corte
  function harvesterX() {
    if (!harvest) return -Infinity;
    const e = smooth(harvest.t);
    return harvest.x0 + (harvest.x1 - harvest.x0) * e;
  }
  function harvesterSize() {
    const img = fieldArt?.harvester;
    const h = fieldHeight() * 1.6;
    return { w: img ? h * img.naturalWidth / img.naturalHeight : h * 1.8, h };
  }
  function harvestCut() { return harvesterX() + harvesterSize().w * .45; }
  // fracao da lavoura visivel ja colhida (para as moedas)
  function harvestProgress() {
    if (!harvest || !endCamera) return 0;
    const { width } = viewport();
    const span = width / endCamera.zoom;
    return clamp((harvestCut() - endCamera.x) / span);
  }

  function drawField(ctx, view) {
    if (!fieldArt?.ready || growth <= 0.002) return;
    const rowH = fieldHeight();
    const surface = collar.y;
    const cut = mode === 'done' && report ? (harvest ? Infinity : -Infinity) : harvest ? harvestCut() : -Infinity;
    // o feijoeiro da fase (o boletim) fica num vao proprio, a vista: as
    // fileiras nascem das bordas do vao para fora, com a ponta natural da arte
    const gap = rowH * .7;
    FIELD_ROWS.forEach((row, r) => {
      const tex = fieldArt.rows[r]?.[plantState] || fieldArt.rows[r]?.[1];
      if (!tex) return;
      const h = rowH * row.height;
      const w = tex.width * h / (tex.height * .9);
      const step = w * .9;
      const base = surface - rowH * row.lift + 2;
      const tiles = [];
      for (let x = collar.x + gap, k = 0; x < view.x1 + w; x += step, k++) tiles.push({ x, k, flip: k % 2 === 1 });
      for (let x = collar.x - gap - w, k = 0; x > view.x0 - w * 2; x -= step, k++) tiles.push({ x, k: -k - 1, flip: k % 2 === 0 });
      for (const tile of tiles) {
        const { x, k } = tile;
        // cresce do chao, cada pe com um pequeno atraso
        const g = smooth(clamp(growth * 1.25 - (((k % 5) + 5) % 5) * .05));
        if (g <= 0) continue;
        const dh = h * g;
        ctx.save();
        if (row.haze) ctx.globalAlpha *= 1 - row.haze * .5;
        const flip = tile.flip;
        const draw = (sx, sy, sw, sh, dx, dy, dw, dhh) => {
          ctx.save();
          if (flip) { ctx.translate(dx * 2 + dw, 0); ctx.scale(-1, 1); }
          ctx.drawImage(tex, sx, sy, sw, sh, dx, dy, dw, dhh);
          ctx.restore();
        };
        // parte ainda de pe (a direita do corte)
        if (x + w > cut) {
          ctx.save();
          ctx.beginPath(); ctx.rect(Math.max(x, cut), base - dh - 4, x + w - Math.max(x, cut), dh + 8); ctx.clip();
          draw(0, 0, tex.width, tex.height, x, base - dh * .97, w, dh);
          ctx.restore();
        }
        // parte colhida: so a faixa de terra
        if (x < cut) {
          ctx.save();
          ctx.beginPath(); ctx.rect(x, base - h, Math.min(w, cut - x), h + 8); ctx.clip();
          const band = tex.height * .14;
          draw(0, tex.height - band, tex.width, band, x, base - h * .97 + h - h * .14, w, h * .14);
          ctx.restore();
        }
        ctx.restore();
      }
    });
  }

  function drawHarvester(ctx) {
    if (!harvest || mode !== 'harvest' || !fieldArt?.harvester) return;
    const { w, h } = harvesterSize();
    const x = harvesterX();
    const bob = Math.sin(clock * 9) * h * .008;
    ctx.drawImage(fieldArt.harvester, x - w / 2, collar.y - h + 3 + bob, w, h);
  }

  /**
   * Camada de MUNDO da cinemática: superfície, céu e feijoeiro.
   *
   * Entra depois do renderizador normal, dentro da mesma transformação de
   * câmera. Não limpa o canvas e não cobre o subsolo.
   */
  function renderWorldLayer(ctx) {
    if (mode === 'idle' || !collar) return false;
    if (skyAlpha <= 0.002 && growth <= 0.002) return false;
    const zoom = Number(state.cameraZoom) || 1;
    const { width, height } = viewport();
    const view = {
      x0: (state.cameraX || 0),
      x1: (state.cameraX || 0) + width / zoom,
      y0: (state.cameraY || 0),
      y1: (state.cameraY || 0) + height / zoom,
    };

    ctx.save();
    ctx.translate(-(state.cameraX || 0), 0);
    drawSky(ctx, view);
    drawField(ctx, view);
    drawBeanPlant(ctx, {
      collarX: collar.x,
      collarY: collar.y,
      scale: BEAN_PLANT_SCALE,
      plantState,
      growth,
      time: clock,
    });
    drawHarvester(ctx);
    ctx.restore();
    return true;
  }

  /**
   * Cartão de resultado, em coordenadas de TELA — texto não acompanha zoom.
   * Só aparece depois de a planta estar visível, e fica na faixa que o
   * enquadramento reservou para ele, longe da copa.
   */
  function renderOverlay(ctx) {
    if (cardAlpha <= 0.002) return false;
    const { width, height } = viewport();
    const w = Math.min(430, width * 0.7);
    const h = 94;
    const x = (width - w) / 2;
    const y = Math.max(54, height * 0.075);

    ctx.save();
    ctx.globalAlpha = cardAlpha;
    ctx.fillStyle = 'rgba(4, 22, 27, 0.90)';
    ctx.strokeStyle = 'rgba(255, 235, 138, 0.82)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255, 235, 138, 0.4)';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, 18);
    else ctx.rect(x, y, w, h);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff5be';
    ctx.font = '800 21px system-ui, sans-serif';
    ctx.fillText('FASE CONCLUÍDA', x + w / 2, y + 30);
    ctx.fillStyle = '#b9d8d1';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(BEAN_PLANT_LABEL[plantState], x + w / 2, y + 52);
    const numeros = [
      Number.isFinite(report?.score) ? `${report.score}/100 pontos` : '',
      Number.isFinite(report?.coinsEarned)
        ? (harvest ? `colheita +${harvest.shown} moedas` : `+${report.coinsEarned} moedas`) : '',
    ].filter(Boolean);
    if (numeros.length) {
      ctx.fillStyle = '#8fb8b0';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(numeros.join(' · '), x + w / 2, y + 74);
    }
    ctx.textAlign = 'left';
    ctx.restore();
    drawPops(ctx);
    return true;
  }

  // moedas subindo da plataforma de corte, em coordenadas de tela
  function drawPops(ctx) {
    if (!pops.length) return;
    const zoom = Number(state.cameraZoom) || 1;
    const dt = 1 / 60;
    ctx.save();
    for (let i = pops.length - 1; i >= 0; i--) {
      const pop = pops[i];
      pop.life -= dt;
      pop.wy -= 40 * dt / zoom;
      if (pop.life <= 0) { pops.splice(i, 1); continue; }
      const x = (pop.wx - (state.cameraX || 0)) * zoom;
      const y = (pop.wy - (state.cameraY || 0)) * zoom;
      ctx.globalAlpha = Math.min(1, pop.life * 1.6);
      ctx.fillStyle = '#f2b63c'; ctx.strokeStyle = '#b97a17'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = '800 16px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,30,5,.7)'; ctx.fillStyle = '#fff6d0';
      ctx.strokeText(`+${pop.value}`, x + 14, y + 6); ctx.fillText(`+${pop.value}`, x + 14, y + 6);
    }
    ctx.restore();
  }

  return {
    begin,
    update,
    renderWorldLayer,
    renderOverlay,
    reset,
    clear: reset,
    get active() { return mode !== 'idle'; },
    get mode() { return mode; },
    get plantState() { return plantState; },
    get growth() { return growth; },
    get harvesting() { return mode === 'harvest'; },
    get cardAlpha() { return cardAlpha; },
    get pulse() { return pulse; },
    get celebrationSeconds() { return celebrateSeconds; },
    get celebrationStartedAt() { return celebratedFrom; },
    get startCamera() { return startCamera ? { ...startCamera } : null; },
    get endCamera() { return endCamera ? { ...endCamera } : null; },
  };
}

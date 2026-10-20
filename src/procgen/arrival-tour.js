// Chegada guiada: logo que Miguelito pousa na rizosfera (primeira campanha), a
// camera passeia por cinco pontos e um balao curto explica cada um. O mundo
// fica congelado (o app trata o tour como um cartao aberto); a camera usa o
// modo cinematografico que o zoom do nodulo ja usa.
//
// Toque, Espaco, Enter ou seta para a direita avancam; Esc ou "Pular" saem.
// Pode ser revisto pelo menu de pausa.

const STORAGE_KEY = 'miguelito:arrival-tour:v1';
const MOVE_SECONDS = .8;
const ZOOM_DEMO_SECONDS = 2.6;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
const mix = (a, b, t) => {
  const k = ease(t);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: a.zoom + (b.zoom - a.zoom) * k };
};

export function arrivalTourSeen() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
}
function markSeen(value = true) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch (_) { /* sem armazenamento: o tour so nao lembra */ }
}

/** Textos curtos (ate ~90 caracteres), com variante para toque. */
export const ARRIVAL_TOUR_TEXT = Object.freeze({
  player: {
    keys: 'Bem-vindo à rizosfera! Você encolheu até virar um micróbio. ← → anda · Espaço salta.',
    touch: 'Bem-vindo à rizosfera! Você encolheu até virar um micróbio. Use os botões para andar e saltar.',
  },
  platform: 'Raízes e torrões são suas plataformas. Ande e salte por eles.',
  necrotic: 'Lá embaixo é a zona necrótica. Cair nela tira toda a Vitalidade.',
  zoom: {
    keys: 'Afaste ou aproxime a câmera: − e +, ou a roda do mouse.',
    touch: 'Afaste ou aproxime a câmera com − e +.',
  },
  direction: 'Siga para a direita até a raiz principal.',
});

export function createArrivalTour({ state, canvas, cameraView, isTouch = () => false, playerFraming, onEnd = () => {}, ready = () => true, onClosed = () => {} }) {
  let active = false;
  // esperando o cartao da fase sair da tela (o mundo ja fica congelado)
  let pending = false;
  let pendingForce = false;
  let steps = [];
  let index = 0;
  let t = 0;
  let from = null;
  let back = 1;
  let leaving = false;
  let root = null;
  let forced = false;

  // ---- DOM ------------------------------------------------------------------
  function ensureDom() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'arrival-tour';
    root.hidden = true;
    root.innerHTML = `
      <div class="arrival-ring" aria-hidden="true"></div>
      <div class="arrival-bubble" role="dialog" aria-live="polite">
        <p class="arrival-text"></p>
        <div class="arrival-footer">
          <span class="arrival-count"></span>
          <button type="button" class="arrival-skip">Pular</button>
          <button type="button" class="arrival-next">Continuar</button>
        </div>
        <span class="arrival-arrow" aria-hidden="true"></span>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (event.target.closest('.arrival-skip')) finish(true);
      else next();
    });
  }

  function onKey(event) {
    if (!active) return;
    const codes = ['Space', 'Enter', 'ArrowRight', 'Escape', 'NumpadEnter'];
    if (!codes.includes(event.code)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type !== 'keydown' || event.repeat) return;
    if (event.code === 'Escape') finish(true);
    else next();
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
  }

  // ---- alvos -----------------------------------------------------------------
  function viewSize(zoom) {
    return { w: (canvas.width || 1280) / zoom, h: (canvas.height || 720) / zoom };
  }
  function frameOn(x, y, zoom, anchorY = .5) {
    const { w, h } = viewSize(zoom);
    return { x: Math.max(0, x - w / 2), y: y - h * anchorY, zoom };
  }
  function supportPlatform() {
    const pl = state.player;
    const cx = pl.x + pl.w / 2;
    const feet = pl.y + pl.h;
    return (state.level.platforms || [])
      .filter(p => cx >= p.x - 4 && cx <= p.x + p.w + 4 && Math.abs(feet - p.y) < 24)
      .sort((a, b) => Math.abs(feet - a.y) - Math.abs(feet - b.y))[0] || null;
  }
  function necroticTop(x) {
    const hz = (state.level.hazards || []).filter(h => x >= h.x - 400 && x <= h.x + h.w + 400);
    const list = hz.length ? hz : (state.level.hazards || []);
    return list.length ? Math.min(...list.map(h => h.y)) : 700;
  }
  function zoomButtonsRect() {
    const els = ['out', 'reset', 'in']
      .map(a => document.querySelector(`[data-camera-action="${a}"]`))
      .filter(el => el && el.offsetParent !== null);
    if (!els.length) return null;
    const rects = els.map(el => el.getBoundingClientRect());
    const left = Math.min(...rects.map(r => r.left)), top = Math.min(...rects.map(r => r.top));
    const right = Math.max(...rects.map(r => r.right)), bottom = Math.max(...rects.map(r => r.bottom));
    return { left, top, width: right - left, height: bottom - top };
  }

  function buildSteps() {
    const pl = state.player;
    const px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
    const support = supportPlatform();
    const touch = isTouch();
    const nx = px + 260;
    const ny = necroticTop(nx);
    return [
      { id: 'player', text: touch ? ARRIVAL_TOUR_TEXT.player.touch : ARRIVAL_TOUR_TEXT.player.keys,
        frame: () => frameOn(px, py, back * 1.35), point: () => ({ x: px, y: py, r: 44 }) },
      { id: 'platform', text: ARRIVAL_TOUR_TEXT.platform,
        frame: () => frameOn(support ? support.x + support.w / 2 : px, (support ? support.y : pl.y + pl.h) + 20, back),
        point: () => support
          ? { x: support.x + support.w / 2, y: support.y + Math.min(30, support.h * .4), r: Math.min(220, support.w * .55), flat: true }
          : { x: px, y: pl.y + pl.h + 12, r: 90, flat: true } },
      { id: 'necrotic', text: ARRIVAL_TOUR_TEXT.necrotic,
        frame: () => frameOn(nx, ny - 40, back * .9, .45), point: () => ({ x: nx, y: ny + 30, r: 200, flat: true }) },
      { id: 'zoom', text: touch ? ARRIVAL_TOUR_TEXT.zoom.touch : ARRIVAL_TOUR_TEXT.zoom.keys,
        frame: () => frameOn(px, py, back), dom: zoomButtonsRect, zoomDemo: true },
      { id: 'direction', text: ARRIVAL_TOUR_TEXT.direction,
        frame: () => frameOn(px + 620, py, back * .8), point: () => ({ x: px + 820, y: py, r: 70 }), arrowRight: true },
    ];
  }

  // ---- ciclo -----------------------------------------------------------------
  function start({ force = false } = {}) {
    if (active || pending || (!force && arrivalTourSeen())) return false;
    if (!ready()) { pending = true; pendingForce = force; return true; }
    return begin(force);
  }

  function begin(force = false) {
    forced = force;
    if (typeof document === 'undefined' || !state.player || !state.level) return false;
    const begin = cameraView.beginCinematic();
    if (!begin) return false;
    ensureDom();
    back = begin.zoom;
    from = { x: begin.x, y: begin.y, zoom: begin.zoom };
    steps = buildSteps();
    index = 0;
    t = 0;
    leaving = false;
    active = true;
    root.hidden = false;
    render();
    return true;
  }

  function currentFrame() {
    return { x: state.cameraX || 0, y: state.cameraY || 0, zoom: state.cameraZoom || back };
  }

  function next() {
    if (!active || leaving) return;
    if (index >= steps.length - 1) { finish(false); return; }
    from = currentFrame();
    index++;
    t = 0;
    render();
  }

  function finish(skipped) {
    if (!active) return;
    markSeen(true);
    leaving = true;
    from = currentFrame();
    t = 0;
    root.hidden = true;
    onEnd({ skipped });
  }

  function update(dt) {
    if (pending) {
      if (!ready()) return;
      pending = false;
      begin(pendingForce);
    }
    if (!active) return;
    t += dt;
    if (leaving) {
      const target = playerFraming ? playerFraming(back) : from;
      cameraView.setCinematic(mix(from, target, t / MOVE_SECONDS));
      if (t >= MOVE_SECONDS) {
        cameraView.endCinematic();
        active = false;
        leaving = false;
        onClosed({ replay: forced });
      }
      return;
    }
    const step = steps[index];
    let frame = mix(from, step.frame(), t / MOVE_SECONDS);
    if (step.zoomDemo && t > MOVE_SECONDS) {
      // afasta e volta, uma vez, para mostrar o efeito do zoom
      const k = clamp((t - MOVE_SECONDS) / ZOOM_DEMO_SECONDS, 0, 1);
      const z = back * (1 - .32 * Math.sin(Math.PI * k));
      const pl = state.player;
      frame = frameOn(pl.x + pl.w / 2, pl.y + pl.h / 2, z);
    }
    cameraView.setCinematic(frame);
    position();
  }

  // ---- desenho do balao --------------------------------------------------------
  function toScreen(x, y) {
    const rect = canvas.getBoundingClientRect();
    const cw = canvas.width || 1280, ch = canvas.height || 720;
    const scale = Math.min(rect.width / cw, rect.height / ch);
    const ox = rect.left + (rect.width - cw * scale) / 2;
    const oy = rect.top + (rect.height - ch * scale) / 2;
    const zoom = state.cameraZoom || 1;
    return {
      x: ox + (x - (state.cameraX || 0)) * zoom * scale,
      y: oy + (y - (state.cameraY || 0)) * zoom * scale,
      s: zoom * scale,
    };
  }

  function render() {
    const step = steps[index];
    root.querySelector('.arrival-text').textContent = step.text;
    root.querySelector('.arrival-count').textContent = `${index + 1}/${steps.length}`;
    root.querySelector('.arrival-next').textContent = index === steps.length - 1 ? 'Jogar' : 'Continuar';
    root.classList.toggle('arrival-tour--right', Boolean(step.arrowRight));
    position();
  }

  function position() {
    if (!root || root.hidden) return;
    const step = steps[index];
    const ring = root.querySelector('.arrival-ring');
    const bubble = root.querySelector('.arrival-bubble');
    let target;
    if (step.dom) {
      const r = step.dom();
      target = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width + 16, h: r.height + 16 } : null;
    } else {
      const p = step.point();
      const s = toScreen(p.x, p.y);
      const radius = p.r * s.s;
      target = { x: s.x, y: s.y, w: radius * 2, h: p.flat ? Math.max(40, radius * .55) : radius * 2 };
    }
    if (target) {
      ring.hidden = false;
      Object.assign(ring.style, {
        left: `${target.x - target.w / 2}px`, top: `${target.y - target.h / 2}px`,
        width: `${target.w}px`, height: `${target.h}px`,
      });
    } else ring.hidden = true;

    const vw = window.innerWidth, vh = window.innerHeight;
    const bw = bubble.offsetWidth || 300, bh = bubble.offsetHeight || 110;
    const tx = target ? target.x : vw / 2;
    const ty = target ? target.y : vh / 2;
    const below = ty < vh * .5;
    const gap = target ? target.h / 2 + 18 : 0;
    let left = clamp(tx - bw / 2, 12, vw - bw - 12);
    let top = below ? ty + gap : ty - gap - bh;
    top = clamp(top, 12, vh - bh - 12);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.classList.toggle('arrival-bubble--below', below);
    const arrow = root.querySelector('.arrival-arrow');
    arrow.style.left = `${clamp(tx - left, 18, bw - 18)}px`;
  }

  return {
    start,
    update,
    skip: () => finish(true),
    reset: () => markSeen(false),
    get active() { return active; },
    // congela o mundo tambem enquanto espera o cartao da fase sair
    get blocking() { return active || pending; },
    get stepId() { return active ? steps[index]?.id : null; },
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  biofilmSurface,
  biofilmVisualState,
  buildBiofilmProfile,
  drawBacillusBiofilm,
} from '../src/render/bacillus-biofilm.js';
import { createBacillusBioprotection } from '../src/procgen/bacillus-bioprotection.js';
import { createBacillusBioprotectionSafety } from '../src/procgen/bacillus-bioprotection-safety.js';
import { createCampaignObjectiveEvaluator } from '../src/procgen/campaign-objectives.js';
import { getPhaseManifest } from '../src/procgen/campaign-manifest.js';

function fixture(maturity = .08, options = {}) {
  const platform = { x: 100, y: 300, w: 300, h: 64, type: 'root', logicIndex: 7 };
  const colony = { id: 'film-host', type: 'bacillus', x: 250, y: 293,
    platform, vigor: 1, sourceCount: 3, growth: 1, ...options.colony };
  const film = { x: colony.x, y: colony.y, platform, growth: 1, radius: 90,
    functional: false, ...options.film };
  const entry = { colony, film, maturity, mode: 'matrix', ...options.entry };
  return { platform, colony, film, entry };
}

function profileFor(spec, time = 0) {
  const visual = biofilmVisualState({ entry: spec.entry });
  const surface = biofilmSurface({ entry: spec.entry, colony: spec.colony, film: spec.film });
  return { visual, surface, profile: buildBiofilmProfile(surface, visual, time) };
}

function area(profile) {
  let result = 0;
  for (let index = 1; index < profile.samples.length; index++) {
    const a = profile.samples[index - 1], b = profile.samples[index];
    result += (b.x - a.x) * ((a.bottom - a.top) + (b.bottom - b.top)) / 2;
  }
  return result;
}

test('a adesão segue a maturidade real mesmo quando os crescimentos genéricos já são 1', () => {
  const spec = fixture(.08);
  const initial = profileFor(spec);
  assert.equal(initial.visual.maturity, .08);
  assert.equal(initial.visual.matrix, 0);
  assert.equal(initial.visual.functional, false);
  assert.equal(initial.profile.segments.length, 0, 'a matriz ainda não existe na adesão inicial');
  assert.ok(initial.visual.adhesion > 0, 'os primeiros bacilos já podem aderir');

  spec.colony.growth = 0;
  spec.film.growth = 0;
  assert.deepEqual(profileFor(spec).visual, initial.visual);
  assert.deepEqual(profileFor(spec).profile, initial.profile,
    'campos genéricos não podem antecipar a maturidade gerida pelo Bacillus');
});

test('o relógio apenas anima a respiração; não faz o biofilme expandir ou amadurecer', () => {
  const spec = fixture(.60);
  const base = profileFor(spec);
  const frames = Array.from({ length: 101 }, (_, time) => profileFor(spec, time));
  for (const frame of frames) {
    assert.deepEqual(frame.visual, base.visual);
    assert.equal(frame.profile.left, base.profile.left);
    assert.equal(frame.profile.right, base.profile.right);
    assert.deepEqual(frame.profile.samples.map(point => point.x), base.profile.samples.map(point => point.x));
    assert.deepEqual(frame.profile.samples.map(point => point.height), base.profile.samples.map(point => point.height));
    assert.deepEqual(frame.profile.samples.map(point => point.bottom), base.profile.samples.map(point => point.bottom));
  }
  for (let index = 0; index < base.profile.samples.length; index++) {
    const heights = frames.map(frame => frame.profile.samples[index].top);
    const halfAmplitude = (Math.max(...heights) - Math.min(...heights)) / 2;
    assert.ok(halfAmplitude <= .25, 'respiração deve permanecer menor que um pixel de mundo');
  }
});

test('as ilhas de EPS aparecem separadas e se unem antes de o filme ficar funcional', () => {
  const microcolony = profileFor(fixture(.24)).profile;
  const functional = profileFor(fixture(.42, { film: { functional: true } })).profile;
  assert.ok(microcolony.segments.length > 1, 'microcolônias começam como regiões separadas');
  assert.equal(functional.segments.length, 1, 'o limiar funcional já apresenta película unida');
  assert.ok(functional.samples.slice(4, -4).every(point => point.height > .025),
    'a região central do filme deve estar conectada, sem frestas entre pétalas');
  assert.ok(area(functional) > area(microcolony));
});

test('a progressão aumenta principalmente o comprimento e conserva uma película fina na superfície', () => {
  const specs = [.18, .24, .42, .72, 1].map(maturity => profileFor(fixture(maturity)));
  for (let index = 1; index < specs.length; index++) {
    const before = specs[index - 1].profile, after = specs[index].profile;
    assert.ok(after.right - after.left >= before.right - before.left);
    assert.ok(area(after) > area(before), 'maior maturidade produz mais matriz aderida');
  }
  const { surface, profile } = specs.at(-1);
  const extent = profile.right - profile.left;
  const thickness = Math.max(...profile.samples.map(point => point.bottom))
    - Math.min(...profile.samples.map(point => point.top));
  assert.ok(extent > thickness * 5, 'a expansão longitudinal deve dominar sobre a radial');
  assert.ok(profile.samples.every(point => point.top <= surface.y && point.bottom >= surface.y),
    'a película acompanha e toca a superfície, em vez de flutuar acima da raiz');
});

test('a geometria não salta nas fronteiras biológicas de adesão, função e maturação', () => {
  for (const maturity of [.28, .42, .72]) {
    const before = profileFor(fixture(maturity - .00001)).profile;
    const after = profileFor(fixture(maturity + .00001)).profile;
    assert.ok(Math.abs(after.left - before.left) < .02);
    assert.ok(Math.abs(after.right - before.right) < .02);
    for (let index = 0; index < before.samples.length; index++) {
      assert.ok(Math.abs(after.samples[index].top - before.samples[index].top) < .02);
      assert.ok(Math.abs(after.samples[index].bottom - before.samples[index].bottom) < .02);
    }
  }
});

test('a película respeita o hospedeiro estreito, nas duas bordas e depois de movê-lo', () => {
  for (const side of ['left', 'right']) {
    const spec = fixture(1);
    spec.platform.w = 92;
    spec.colony.x = side === 'left' ? spec.platform.x + 2 : spec.platform.x + spec.platform.w - 2;
    const before = profileFor(spec);
    assert.ok(before.profile.left >= spec.platform.x + 6);
    assert.ok(before.profile.right <= spec.platform.x + spec.platform.w - 6);
    assert.ok(before.profile.samples.every(point => point.x >= before.surface.left && point.x <= before.surface.right));
    spec.platform.x += 600;
    spec.platform.y -= 80;
    spec.colony.x += 600;
    spec.colony.y -= 80;
    const after = profileFor(spec);
    assert.equal(after.surface.y, spec.platform.y);
    assert.ok(after.profile.left >= spec.platform.x + 6);
    assert.ok(after.profile.right <= spec.platform.x + spec.platform.w - 6);
    assert.ok(after.profile.samples.every(point => point.top <= spec.platform.y && point.bottom >= spec.platform.y));
  }
});

test('checkpoint natural acompanha sua posição atual e encontra a raiz só para desenhar', () => {
  const platform = { x: 600, y: 250, w: 240, h: 64, type: 'root' };
  const checkpoint = { x: 720, y: 235 };
  const film = { x: 120, y: 400, growth: 1, checkpoint, natural: true };
  const before = structuredClone({ checkpoint, platform, film });
  const surface = biofilmSurface({ film, platforms: [platform] });
  assert.equal(surface.x, checkpoint.x);
  assert.equal(surface.y, platform.y);
  assert.equal(surface.band, 17.92, 'o volume visível da raiz usa a faixa original, não o agregado inteiro');
  assert.deepEqual({ checkpoint, platform, film }, before);
  assert.equal(film.platform, undefined, 'resolver o host gráfico não muda a simulação');
});

test('esporulação reduz a matriz e esporos não mantêm uma película ativa', () => {
  const healthy = profileFor(fixture(.8));
  const stressed = profileFor(fixture(.8, { entry: { mode: 'sporulating', sporulation: .8 } }));
  const spores = profileFor(fixture(.18, { entry: { mode: 'spores' } }));
  assert.ok(area(stressed.profile) < area(healthy.profile) * .5);
  assert.equal(spores.visual.hydration, 0);
  assert.equal(spores.profile.segments.length, 0);
  assert.equal(area(spores.profile), 0);
});

test('as funções visuais não alteram colônia, filme nem geometria do nível', () => {
  const spec = fixture(.6, { film: { functional: true } });
  const before = structuredClone(spec);
  // visibleRootRect creates a lightweight object inheriting from this platform.
  // Its source need not be frozen: the snapshot checks mutation of every field.
  Object.freeze(spec.colony);
  Object.freeze(spec.film);
  Object.freeze(spec.entry);
  for (const time of [0, 10, 100]) profileFor(spec, time);
  assert.deepEqual(spec, before);
});

function biologicalHarness() {
  const platform = { x: 100, y: 300, w: 260, h: 64, type: 'root', objectiveTarget: 'p1-intro-root' };
  const colony = { id: 'inoculated-bacillus', type: 'bacillus', x: 200, y: 293, platform,
    vigor: .9, growth: .06, dormant: false, sourceCount: 3, rechargeIntensity: .5, stage: '' };
  const state = { time: 0, gameState: 'play', cameraX: 0,
    player: { x: 180, y: 252, w: 30, h: 48, soil: 0, hope: 0, infection: 0, infectionExposure: 0 },
    level: { platforms: [platform], biofilms: [] } };
  const inoculants = { colonies: [colony] };
  const system = createBacillusBioprotection({ state, inoculants,
    ecology: { agents: [] }, entities: { burst() {} } });
  const safety = createBacillusBioprotectionSafety({ state, inoculants });
  const evaluator = createCampaignObjectiveEvaluator({ state, systems: { inoculants } });
  return { state, colony, system, safety, evaluator };
}

test('a transição funcional desenhada coincide com o limiar biológico real de 42% e o objetivo da fase 1', () => {
  const { state, system, safety, evaluator } = biologicalHarness();
  const condition = getPhaseManifest(1).finalTest.requires.find(item => item.key === 'functionalBiofilmCount');
  let firstFunctional = null;
  let previousMaturity = 0;
  let firstMature = null;
  for (let step = 0; step < 1800; step++) {
    state.time += .01;
    system.update(.01);
    safety.update();
    const entry = system.entries[0];
    const visual = biofilmVisualState({ entry });
    const passes = evaluator.evaluate([condition]).passed;
    assert.equal(visual.functional, entry.film.functional);
    assert.equal(passes, entry.film.functional,
      'a película não concede nem antecipa o objetivo por desenhar maior');
    if (entry.maturity < .42) assert.equal(visual.functional, false);
    if (!firstFunctional && entry.film.functional) {
      firstFunctional = { maturity: entry.maturity, previousMaturity, time: state.time };
      const surface = biofilmSurface({ entry, colony: entry.colony, film: entry.film });
      const profile = buildBiofilmProfile(surface, visual, state.time);
      assert.equal(profile.segments.length, 1, 'a primeira função já tem EPS conectado');
      assert.ok(visual.maturation < 1, 'funcional não significa biologicamente maduro');
    }
    if (!firstMature && entry.maturity >= .72) firstMature = state.time;
    previousMaturity = entry.maturity;
  }
  assert.ok(firstFunctional, 'o sistema biológico real deve tornar o filme funcional');
  assert.ok(firstFunctional.previousMaturity < .42 && firstFunctional.maturity >= .42);
  assert.ok(firstMature > firstFunctional.time, 'a maturação original de 72% ocorre depois da função');
});

test('o desenho lê a perda de função imposta pelo safety, mesmo com maturidade elevada', () => {
  const { state, colony, system, safety } = biologicalHarness();
  for (let index = 0; index < 300; index++) { state.time += .05; system.update(.05); safety.update(); }
  const entry = system.entries[0];
  assert.ok(entry.maturity >= .72);
  assert.equal(entry.film.functional, true);
  colony.vigor = .06;
  colony.rechargeIntensity = 0;
  safety.update();
  const visual = biofilmVisualState({ entry });
  assert.ok(visual.maturity >= .72);
  assert.equal(visual.functional, false);
  assert.equal(entry.film.functional, false);
});

function drawingHarness() {
  const calls = { canvases: [], clears: 0, packets: [], fallbackDraws: 0 };
  const gradient = { addColorStop() {} };
  const document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { width: 0, height: 0, ownerDocument: document };
      const target = new Proxy({
        canvas,
        clearRect() { calls.clears++; },
        createLinearGradient: () => gradient,
        createRadialGradient: () => gradient,
      }, { get: (object, name) => name in object ? object[name] : (() => {}) });
      canvas.getContext = kind => { assert.equal(kind, '2d'); return target; };
      calls.canvases.push(canvas);
      return canvas;
    },
  };
  let transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const ctx = {
    canvas: { width: 1024, height: 768, ownerDocument: document },
    getTransform: () => transform,
    __glBiofilm(packet) { calls.packets.push(packet); },
    drawImage() { calls.fallbackDraws++; },
  };
  return { ctx, calls, setTransform(next) { transform = { ...transform, ...next }; } };
}

test('mover câmera ou hospedeiro reposiciona o pacote sem recriar ou repintar suas texturas', () => {
  const spec = fixture(.8);
  const { ctx, calls, setTransform } = drawingHarness();
  drawBacillusBiofilm(ctx, { entry: spec.entry }, 10);
  const first = calls.packets[0];
  assert.equal(calls.canvases.length, 2, 'um pacote local de cor e relevo é suficiente');
  const paintCalls = calls.clears;

  setTransform({ e: -50, f: 12 });
  drawBacillusBiofilm(ctx, { entry: spec.entry }, 10);
  spec.platform.x += 35;
  spec.platform.y -= 8;
  spec.colony.x += 35;
  spec.colony.y -= 8;
  drawBacillusBiofilm(ctx, { entry: spec.entry }, 10);

  assert.equal(calls.packets.length, 3, 'o renderer continua recebendo a posição atual do filme');
  assert.equal(calls.canvases.length, 2, 'câmera e deslocamento não alocam mais texturas');
  assert.equal(calls.clears, paintCalls, 'o movimento não invalida pixels locais sem avanço da animação');
  for (const packet of calls.packets) {
    assert.equal(packet.revision, first.revision);
    assert.equal(packet.image, first.image);
    assert.equal(packet.relief, first.relief);
  }
  const moved = calls.packets.at(-1);
  assert.ok(Math.abs(moved.x - first.x - 35) < .001);
  assert.equal(moved.y, first.y - 8);
  assert.equal(calls.fallbackDraws, 0, 'WebGL recebeu o pacote sem cópia duplicada no Canvas');
});

test('filmes fora do viewport não alocam texturas nem enviam pacotes WebGL', () => {
  const spec = fixture(.8);
  const { ctx, calls, setTransform } = drawingHarness();
  for (const transform of [
    { a: 1, d: 1, e: -4000, f: 0 },
    { a: 2, d: 2, e: 0, f: -4000 },
    { a: .5, d: .5, e: 4000, f: 0 },
  ]) {
    setTransform(transform);
    drawBacillusBiofilm(ctx, { entry: spec.entry }, 10);
  }
  assert.equal(calls.canvases.length, 0);
  assert.equal(calls.packets.length, 0);
  assert.equal(calls.clears, 0);

  setTransform({ a: 1, d: 1, e: 0, f: 0 });
  drawBacillusBiofilm(ctx, { entry: spec.entry }, 10);
  assert.equal(calls.packets.length, 1, 'a película reaparece quando entra no viewport');
  assert.equal(calls.canvases.length, 2);
});

test('uma raiz larga e oito fontes mantêm cor e relevo em texturas locais limitadas', () => {
  const spec = fixture(1, { colony: { sourceCount: 8 } });
  spec.platform.w = 2000;
  spec.colony.x = spec.platform.x + spec.platform.w / 2;
  const { ctx, calls, setTransform } = drawingHarness();
  setTransform({ e: -700 });
  drawBacillusBiofilm(ctx, { entry: spec.entry }, 10);
  assert.equal(calls.packets.length, 1);
  const packet = calls.packets[0];
  assert.ok(packet.w < spec.platform.w / 2, 'o filme não cria uma textura para toda a plataforma');
  for (const image of [packet.image, packet.relief]) {
    assert.ok(image.width > 0 && image.width <= 1024, 'largura limitada, mesmo em hospedeiro de 2000 px');
    assert.ok(image.height > 0 && image.height <= 160, 'altura limitada à faixa superficial da matriz');
  }
});

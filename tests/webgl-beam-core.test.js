import assert from 'node:assert/strict';
import test from 'node:test';
import { beamPlanePoint, beamTwinkle } from '../experimental/2_5d/gl/beam-core.js';
import { shaftCone, shaftParticleCore, shaftStreak } from '../experimental/2_5d/gl/shaft-profile.js';

const source = [600, 1100];
const delta = point => ({ x: source[0] - point[0], y: source[1] - point[1] });

test('o nucleo segue as cristas luminosas inclinadas, sem acender o pedestal do halo', () => {
  let litOffAxis = false, darkInsideHalo = false;
  for (let x = -400; x <= 400; x += 2) {
    const d = { x, y: 1300 };
    const streak = shaftStreak(d, 30);
    const core = shaftParticleCore(d, 30);
    if (Math.abs(x) > 100 && core > .8) litOffAxis = true;
    if (Math.abs(x) < 300 && streak <= .02) {
      darkInsideHalo = true;
      assert.equal(core, 0, 'halo sem crista luminosa nao recebe brilho');
    }
    assert.ok(core >= 0 && core <= 1);
  }
  assert.ok(litOffAxis, 'acompanha uma crista real deslocada da antiga coluna vertical');
  assert.ok(darkInsideHalo, 'diferencia o halo amplo de suas faixas luminosas');
  assert.equal(shaftParticleCore({ x: 0, y: -100 }, 30), 0, 'acima da fonte nao ha raio descendente');
  assert.equal(shaftParticleCore({ x: 2000, y: 1300 }, 30), 0, 'fora do cone nao ha nucleo');
});

test('afastar a camera/alterar zoom nao muda a intensidade no mesmo ponto do mundo', () => {
  const world = [650, -200];
  const views = [
    [0, -500, 1280, 720],
    [-640, -860, 2560, 1440],
    [300, -350, 640, 360],
  ];
  const expected = shaftParticleCore(delta(world), 30);
  for (const camera of views) {
    const uv = [(world[0] - camera[0]) / camera[2], 1 - (-world[1] - camera[1]) / camera[3]];
    const projected = beamPlanePoint(uv, camera);
    assert.ok(Math.abs(projected[0] - world[0]) < 1e-10);
    assert.ok(Math.abs(projected[1] - world[1]) < 1e-10);
    assert.ok(Math.abs(shaftParticleCore(delta(projected), 30) - expected) < 1e-10);
  }
});

test('o movimento das fissuras controla o brilho sem uma segunda faixa independente', () => {
  let changed = false;
  for (let x = -300; x <= 300; x += 10) {
    const d = { x, y: 1300 };
    if (Math.abs(shaftParticleCore(d, 0) - shaftParticleCore(d, 45)) > .2) changed = true;
    for (const time of [0, 15, 45]) {
      if (shaftStreak(d, time) <= .02) assert.equal(shaftParticleCore(d, time), 0);
    }
  }
  assert.ok(changed, 'as particulas acompanham a mesma variacao angular lenta do volume');
});

test('ampliacao das cristas alarga a regiao iluminada e preserva os vaos escuros', () => {
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  let originalWidth = 0, widenedWidth = 0;
  let sawBright = false, sawDarkAfterBright = false, boundedGap = false;
  for (let x = -600; x <= 600; x++) {
    const d = { x, y: 1300 };
    const streak = shaftStreak(d, 45);
    const original = smooth(.12, .42, streak) * smooth(.08, .25, shaftCone(d));
    const widened = shaftParticleCore(d, 45);
    if (original > .15) originalWidth++;
    if (widened > .15) widenedWidth++;
    if (streak === 0) {
      assert.equal(widened, 0, 'a dilatacao angular nunca ilumina um vao apagado');
      if (sawBright) sawDarkAfterBright = true;
    }
    if (widened > .4) {
      if (sawDarkAfterBright) boundedGap = true;
      sawBright = true;
    }
  }
  assert.ok(widenedWidth > originalWidth * 1.15, 'a faixa luminosa fica visivelmente mais larga');
  assert.ok(boundedGap, 'existe um vao escuro preservado entre duas faixas luminosas');
});

test('cintilacao e individual, deterministica e varia suavemente', () => {
  const seed = .37;
  assert.equal(beamTwinkle(12.3, seed), beamTwinkle(12.3, seed));
  assert.notEqual(beamTwinkle(12.3, seed), beamTwinkle(12.3, .63));
  assert.ok(Math.abs(beamTwinkle(12.3, seed) - beamTwinkle(12.301, seed)) < .01);
  for (let time = 0; time < 30; time += .1) {
    const level = beamTwinkle(time, seed);
    assert.ok(level >= .66 && level <= 1.22);
    const outsideMask = shaftParticleCore({ x: 2000, y: 1300 }, time);
    assert.equal((1 - outsideMask) + outsideMask * level, 1, 'fora do nucleo o brilho e constante');
  }
});

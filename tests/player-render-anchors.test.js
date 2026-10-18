import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../experimental/2_5d/vendor/three.bundle.min.js';
import { createBridgeContext, paintEquipmentOverlay } from '../experimental/2_5d/gl/ctx-bridge.js';
import { writeSpritePlanePositions } from '../experimental/2_5d/gl/sprite-plane.js';
import { createPlayerSprite } from '../src/render/player-sprite.js';
import { PLAYER_SKINS } from '../src/render/player-skins.js';
import { initPlayerTuning, setPlayerTuning } from '../src/render/player-skin-tuning.js';
import { jetpackPose } from '../src/render/player-equipment.js';
import { createRenderer } from '../src/render/renderer.js';

const image = { tagName: 'IMG', src: '/assets/miguelito/idle.png', complete: true, naturalWidth: 2560, naturalHeight: 400 };

function cameraFor(zoom) {
  const width = 1280 / zoom, height = 720 / zoom, x = 300, y = 120;
  const distance = height / 2 / Math.tan(THREE.MathUtils.degToRad(16));
  const camera = new THREE.PerspectiveCamera(32, 1280 / 720, 10, distance + 4000);
  camera.position.set(x + width / 2, -(y + height / 2), distance);
  camera.lookAt(camera.position.x, camera.position.y, 0);
  camera.updateMatrixWorld();
  return { camera, distance, toWorld: p => ({ x: x + p.x / zoom, y: -(y + p.y / zoom) }) };
}

function screenPoint(x, y, z, camera) {
  const p = new THREE.Vector3(x, y, z).project(camera);
  return { x: (p.x + 1) * 640, y: (1 - p.y) * 360 };
}

test('sprites stay on the Canvas/platform plane after 100,000 captures, at every zoom and facing', () => {
  let captured;
  const bridge = createBridgeContext({ getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }, s => { captured = s; });
  for (let i = 0; i <= 100000; i++) bridge.ctx.drawImage(image, 0, 0, 320, 400, 300, 130, 80, 100);
  assert.equal(captured.order, 100000, 'reproduces the historical accumulating counter');
  for (const zoom of [.7, 1, 1.6, 2]) for (const facing of [-1, 1]) {
    const s = { ...captured, p0: { x: 470, y: 260 }, pu: { x: 470 + facing * 100, y: 260 }, pv: { x: 470, y: 420 } };
    const { camera, toWorld } = cameraFor(zoom), positions = new Float32Array(12);
    writeSpritePlanePositions(positions, 0, s, toWorld);
    const expected = [s.p0, s.pu, s.pv, { x: s.pu.x, y: s.pv.y }];
    for (let i = 0; i < 4; i++) {
      const p = screenPoint(...positions.slice(i * 3, i * 3 + 3), camera);
      assert.ok(Math.abs(p.x - expected[i].x) < .01, `x drift at zoom ${zoom}, facing ${facing}`);
      assert.ok(Math.abs(p.y - expected[i].y) < .01, `foot/ground drift at zoom ${zoom}, facing ${facing}`);
    }
    const foot = toWorld(s.pv), old = screenPoint(foot.x, foot.y, .5 + s.order * .001, camera);
    assert.ok(Math.abs(old.y - s.pv.y) > 2, 'the old z-from-order implementation must fail this contact test');
  }
  bridge.beginFrame();
  bridge.ctx.drawImage(image, 0, 0);
  assert.equal(captured.order, 0, 'frame-local order starts over when the renderer begins the next frame');
});

class ReadyImage {
  naturalWidth = 2560;
  naturalHeight = 400;
  set src(value) { this.url = value; this.onload?.(); }
}

function withSprite(run) {
  const previous = globalThis.Image;
  globalThis.Image = ReadyImage;
  initPlayerTuning(null);
  try { run(createPlayerSprite(PLAYER_SKINS.miguelito)); }
  finally { globalThis.Image = previous; initPlayerTuning(null); }
}

const player = () => ({ x: 400, y: 300, w: 32, h: 48, vx: 0, vy: 0, onGround: true,
  alive: true, invuln: 0, dashTime: 0, facing: 1, canJetpack: true, jetpackEnergy: .7 });

test('backpack attachment uses the actual frame rectangle, including idle/run/hover/celebration fallbacks', () => {
  withSprite(sprite => {
    for (const [mode, patch, gameState, sheetName] of [
      ['idle', {}, 'play', 'idle'], ['run', { vx: 245 }, 'play', 'run'],
      ['hover', { jetpackActive: true, onGround: false }, 'play', 'run'],
      ['celebrate', {}, 'transition', 'celebrate'], ['hurt', { invuln: 1 }, 'play', 'hurt'],
    ]) {
      const p = { ...player(), ...patch }, original = structuredClone(p), seen = new Set();
      let draw;
      const ctx = { drawImage(...args) { draw = args; } };
      for (let tick = 0; tick < 240; tick++) {
        sprite.draw(ctx, p, tick / 30, gameState);
        const frame = Math.round(draw[1] / 320), attachment = sprite.attachment('backpack');
        const source = PLAYER_SKINS.miguelito.states[sheetName].attachments.backpack[frame];
        seen.add(frame);
        assert.ok(attachment.x < 0, `${mode}: backpack stays behind the right-facing character`);
        assert.ok(Math.abs(attachment.x - (draw[5] + source.x * draw[7] / 320)) < 1e-9);
        assert.ok(Math.abs(attachment.y - (draw[6] + source.y * draw[8] / 400)) < 1e-9);
        const pose = jetpackPose(attachment);
        assert.ok(pose.width <= attachment.width && pose.height <= attachment.height, `${mode}: gauge fits the bag`);
        assert.ok(pose.nozzleY > attachment.y && pose.nozzleY <= attachment.y + attachment.height / 2, `${mode}: nozzle is on the bag underside`);
        for (const facing of [-1, 1]) {
          const centre = p.x + p.w / 2, gaugeX = centre + facing * pose.x;
          assert.ok((gaugeX - centre) * facing < 0, `${mode}: meter/nozzle/thrust mirror to the back`);
        }
      }
      assert.equal(seen.size, 8, `${mode}: all original frames have a measured bag`);
      assert.deepEqual(p, original, 'visual attachments do not change player physics, energy or animation flags');
    }
  });
});

test('equipment foreground pass inherits the exact Canvas pose and restores its target', () => {
  for (const zoom of [.7, 1, 1.6, 2]) for (const facing of [-1, 1]) {
    const matrix = { a: zoom * facing, b: 0, c: 0, d: zoom, e: 480, f: 360 };
    const source = { getTransform: () => matrix, globalAlpha: .35, globalCompositeOperation: 'source-over', lineCap: 'round' };
    let saved = 0, restored = 0;
    const target = { save() { saved++; }, restore() { restored++; }, setTransform(m) { this.matrix = m; } };
    paintEquipmentOverlay(source, target, ctx => {
      assert.equal(ctx, target);
      assert.deepEqual(ctx.matrix, matrix);
      assert.equal(ctx.globalAlpha, source.globalAlpha);
      assert.equal(ctx.globalCompositeOperation, source.globalCompositeOperation);
      assert.equal(ctx.lineCap, 'round');
    });
    assert.equal(saved, 1); assert.equal(restored, 1);
    assert.throws(() => paintEquipmentOverlay(source, target, () => { throw Error('paint'); }), /paint/);
    assert.equal(saved, 2); assert.equal(restored, 2, 'even a failed draw must not leak its mirrored transform');
  }
});

test('drawPlayer paints capsule path, clipping, gauge and active jet on the same foreground context', () => {
  withSprite(() => {
    function context() {
      const calls = [], path = [];
      const target = { calls, globalAlpha: 1,
        beginPath() { path.length = 0; calls.push('beginPath'); },
        moveTo(...p) { path.push(p); }, lineTo(...p) { path.push(p); }, arcTo(...p) { path.push(p); },
        fill() { assert.ok(path.length, 'fill must use the path in its own context'); calls.push('fill'); },
        clip() { assert.ok(path.length, 'clip must use the capsule in its own context'); calls.push('clip'); },
        stroke() { assert.ok(path.length, 'stroke must use the path in its own context'); calls.push('stroke'); },
        createLinearGradient() { return { addColorStop() {} }; },
        drawImage() { calls.push('sprite'); },
      };
      return new Proxy(target, { get(o, key) {
        if (key in o) return o[key];
        if (String(key).startsWith('__gl')) return undefined;
        return (...args) => calls.push([key, ...args]);
      } });
    }
    const source = context(), foreground = context();
    source.__glPlayerEquipment = paint => paint(foreground);
    const p = { ...player(), onGround: false, jetpackActive: true };
    const renderer = createRenderer({ canvas: { getContext: () => source }, state: { player: p, time: 12, gameState: 'play' }, entities: {}, playerSkin: PLAYER_SKINS.miguelito });
    renderer.drawPlayer();
    assert.ok(source.calls.includes('sprite'));
    assert.ok(!source.calls.includes('beginPath'), 'the capsule path must not leak into the earlier FX context');
    assert.equal(foreground.calls.filter(c => c === 'clip').length, 1);
    assert.equal(foreground.calls.filter(c => c === 'fill').length, 3, 'capsule, nozzle and active thrust remain visible together');
    assert.equal(foreground.calls.filter(c => c === 'stroke').length, 4, 'capsule rim and three air streaks share the foreground');
  });
});

test('equipment scales with the visible sprite, rather than its unchanged collider', () => {
  withSprite(sprite => {
    const p = player(), ctx = { drawImage() {} }, sizes = [];
    for (const height of [40, 72, 120]) {
      setPlayerTuning({ characterHeight: height });
      sprite.draw(ctx, p, 0, 'play');
      const attachment = sprite.attachment('backpack'), pose = jetpackPose(attachment);
      sizes.push({ height, x: attachment.x, width: pose.width, nozzle: pose.nozzleY - attachment.y });
      assert.equal(p.h, 48); assert.equal(p.w, 32);
    }
    for (const s of sizes) {
      assert.ok(Math.abs(s.width / s.height - sizes[0].width / sizes[0].height) < 1e-9);
      assert.ok(Math.abs(s.nozzle / s.height - sizes[0].nozzle / sizes[0].height) < 1e-9);
    }
  });
  assert.deepEqual(jetpackPose(), { x: -13, y: -6, scale: 1, width: 8, height: 19, nozzleY: 6.1 }, 'astronaut/failed sheet retains its original equipment placement');
});

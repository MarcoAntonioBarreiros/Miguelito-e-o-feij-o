/**
 * Rendering adapter for the experimental WebGL scene. Coordinates, dt, input,
 * collisions and biological rules retain the production game's units (px/s).
 * This is a staged excerpt of phase 4, not a replacement campaign runtime.
 *
 * The simulation below is the real createSimulator: in particular, jumps,
 * coyote time, double jump, acceleration, friction and mature bridge colliders
 * are NOT reimplemented. The authored mature colony and starting exudates are
 * explicit demo fixtures, using the same authored-colony API as the game.
 *
 * createMycorrhizaGrowth deliberately hides its internal network geometry.
 * The WebGL filament paths therefore use the game's exported hyphal-growth
 * algorithm as a VISUAL companion only. Actual bridge growth, maturity and
 * collisions come from sim.mycorrhizaStructures, never from those filaments.
 * Geometry is seeded; biological branching and some ecology still use the
 * production engine's Math.random calls. Biology is not a deterministic replay.
 */
import { createSimulator } from '../../src/procgen/simulator.js';
import { generateLevel } from '../../src/procgen/generator.js';
import {
  applyPersistentUnlocks, campaignPhaseSeed, createCampaign,
  decorateCampaignLevel, prepareCampaignGeneration,
} from '../../src/procgen/campaign-progression.js';
import {
  getPersistentUnlocksBeforePhase, getPhaseManifest,
} from '../../src/procgen/campaign-manifest.js';
import { generateCampaignEncounters } from '../../src/procgen/campaign-encounters.js';
import { applyPhaseFourMycorrhizaIntro } from '../../src/procgen/phase-four-mycorrhiza-intro.js';
import { createHyphalNetwork, updateHyphalNetwork } from '../../src/procgen/hyphal-growth.js';
import { synchronizeWorldBounds } from '../../src/procgen/world-bounds.js';

const SPRITE_SIZES = { rhizobium: 65, azospirillum: 65, myco: 65, bacillus: 48,
  pseudomonas: 65, trichoderma: 65, oportunista: 78 };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * API: update(seconds, {left,right,jump,inoculate,regrow,dash,cycle}) or a
 * DOM-code dictionary / Set (KeyA, ArrowRight, Space, KeyE, KeyR, ArrowDown).
 * snapshot() uses original screen coordinates: +x right, +y down. Convert to
 * Three.js with (x/100, -y/100, depth); player x/y is collider TOP LEFT.
 */
export function createSimulation({ seed = 'miguelito-webgl-rhizosphere', autoGrow = true } = {}) {
  const sim = createSimulator();
  let previousRegrow = false;
  let visualNetworks = [];
  let host;
  let destination;
  let stageBounds;
  let generationSeed;

  function reset() {
    const campaign = createCampaign(seed, { storage: null });
    campaign.phase = 4;
    campaign.unlocks = { ...getPersistentUnlocksBeforePhase(4), mycorrhizaStructures: true };
    const profile = prepareCampaignGeneration(campaign);
    generationSeed = campaignPhaseSeed(campaign);
    let level = generateLevel(generationSeed, {
      referenceScreenWorldWidth: 1280,
      referenceScreenWorldHeight: 720,
      verticalPlan: false,
    });
    const intro = applyPhaseFourMycorrhizaIntro(level, 4, getPhaseManifest(4).mycorrhizaBridge);
    level = decorateCampaignLevel(level, campaign, profile);
    level.microbeEncounters = generateCampaignEncounters({
      platforms: level.platforms, phase: 4, seedValue: generationSeed,
    }).concat(level.authoredEncounters || []);
    host = intro.source;
    destination = intro.target;
    // The actual intro platforms from the source generator stay unchanged.
    // A pre-established colony avoids replaying the full tutorial in a POC.
    level.authoredBeneficialColonies = [{
      id: 'webgl-demo-mycorrhiza', type: 'myco', platform: host,
      x: host.x + host.w - 36, y: host.y - 8,
      growth: 1, vigor: 1, sourceCount: 4, stage: 'micorriza estabelecida',
    }];
    synchronizeWorldBounds(level);
    sim.state.campaign = campaign;
    sim.reset();
    Object.assign(sim.state.level, level);
    sim.state.campaign = campaign;
    applyPersistentUnlocks(sim.state.player, campaign);
    sim.resetEcology(level.microbeEncounters);
    sim.resetBiology();
    sim.state.player.x = host.x + Math.min(60, host.w * .2);
    sim.state.player.y = host.y - sim.state.player.h;
    sim.state.player.onGround = true;
    sim.state.player.supportPlatform = host;
    sim.state.player.exudates = 6;
    sim.state.currentCheckpoint = { x: sim.state.player.x, y: sim.state.player.y };
    stageBounds = {
      x: Math.max(0, host.x - 700), y: Math.min(0, host.y - 600),
      width: destination.x + destination.w - Math.max(0, host.x - 700) + 900,
      height: 1050,
    };
    sim.state.cameraX = Math.max(0, host.x - 550);
    sim.state.cameraY = 0;
    previousRegrow = false;
    regrow({ createCloud: autoGrow });
    return snapshot();
  }

  function regrow({ createCloud = true } = {}) {
    sim.mycorrhizaStructures.reset();
    sim.mycorrhiza.reset();
    sim.state.level.exudateClouds.length = 0;
    if (createCloud) {
      // Identical cloud structure to ecological-gameplay.js. It is an authored
      // starting stimulus, not a substitute implementation of the E action.
      sim.state.level.exudateClouds.push({
        id: `webgl-demo-growth-${sim.state.time}`, x: host.x + host.w - 30,
        y: host.y - 24, radius: 76, targetRadius: 155,
        life: 9.4, maxLife: 10, phase: 0,
      });
    }
    const colonyX = host.x + host.w - 36;
    visualNetworks = [-.65, -2.35, 1.1].map((angle, i) => createHyphalNetwork({
      kind: 'mycorrhiza', x: colonyX - i * 22, y: host.y - 8,
      angle, seed: 1.7 + i * 2.4, maxBranches: 14, maxPoints: 330,
      metadata: { visualOnly: true },
    }));
  }

  function pressed(input, code) {
    return input instanceof Set ? input.has(code) : Boolean(input?.[code] || input?.keys?.[code]);
  }

  function update(dt, input = {}) {
    const shouldRegrow = Boolean(input.regrow || pressed(input, 'KeyR'));
    if (shouldRegrow && !previousRegrow) regrow();
    previousRegrow = shouldRegrow;
    const keys = {
      ArrowLeft: Boolean(input.left || pressed(input, 'ArrowLeft') || pressed(input, 'KeyA')),
      ArrowRight: Boolean(input.right || pressed(input, 'ArrowRight') || pressed(input, 'KeyD')),
      Space: Boolean(input.jump || pressed(input, 'Space') || pressed(input, 'ArrowUp') || pressed(input, 'KeyW')),
      KeyE: Boolean(input.inoculate || pressed(input, 'KeyE')),
      KeyJ: Boolean(input.dash || pressed(input, 'KeyJ') || pressed(input, 'ShiftLeft')),
      ArrowDown: Boolean(input.cycle || pressed(input, 'ArrowDown')),
      KeyK: pressed(input, 'KeyK'), KeyC: pressed(input, 'KeyC'),
    };
    sim.setInputs(keys);
    // Preserve the production game's variable frame integration: exactly one
    // native step per update, with the same .1 s cap used by the scene loop.
    const step = clamp(Number(dt) || 0, 0, .1);
    sim.step(step);
    for (const network of visualNetworks) {
      updateHyphalNetwork(network, step, {
        level: sim.state.level, time: sim.state.time,
        targetProvider: tip => {
          const target = tip.depth % 2 ? destination : host;
          return {
            id: `visual-root-${target.logicIndex}`, kind: 'root',
            x: clamp(tip.x, target.x + 12, target.x + target.w - 12),
            y: target.y + target.h * .5, strength: .55,
          };
        },
      });
    }
    return snapshot();
  }

  function snapshot() {
    const { state } = sim;
    const player = state.player;
    return {
      time: state.time,
      phase: 4, title: 'Micorriza e expansão do solo explorado',
      seed: generationSeed, gameState: state.gameState,
      player: { ...player, supportPlatform: undefined, jetpackRechargeRoot: undefined,
        width: player.w, height: player.h },
      platforms: state.level.platforms.filter(p => !p.recovery && !p.inactive).map((p, i) => ({
        id: p.platformId || p.id || `platform-${i}`, x: p.x, y: p.y, w: p.w, h: p.h,
        type: p.type, logicIndex: p.logicIndex, rootHealth: p.rootHealth ?? 1,
        mycorrhizaStructure: Boolean(p.mycorrhizaStructure),
        introHost: p === host, introDestination: p === destination,
      })),
      microbes: sim.ecology.agents.map(agent => ({
        id: agent.id, type: agent.type, x: agent.x, y: agent.y,
        vx: agent.vx, vy: agent.vy, angle: agent.angle, phase: agent.phase,
        r: (SPRITE_SIZES[agent.type] || 60) * (agent.size || 1) / 2,
        size: agent.size, facing: agent.vx < 0 ? -1 : 1,
        recruited: Boolean(agent.beneficialRecruitedUntil > state.time),
      })),
      colonies: sim.beneficialInoculants.colonies.map(colony => ({
        id: colony.id, type: colony.type, x: colony.x, y: colony.y,
        growth: colony.growth, vigor: colony.vigor,
      })),
      roots: (state.level.roots || []).map(root => ({ ...root })),
      hyphae: visualNetworks.map((network, i) => ({
        id: `webgl-filaments-${i}`, kind: network.kind, visualOnly: true,
        paths: network.tips.map(tip => tip.points.map(p => ({ x: p.x, y: p.y }))),
        tips: network.tips.filter(tip => tip.active).map(tip => ({ x: tip.x, y: tip.y })),
      })),
      structures: sim.mycorrhizaStructures.structures.map(structure => ({
        id: structure.id, type: structure.type, progress: structure.progress,
        maturity: structure.maturity, mature: structure.mature,
        start: { ...structure.start }, end: { ...structure.end },
        points: structure.points.map(point => ({ ...point })),
      })),
      particles: state.level.particles.map(p => ({ ...p })),
      exudates: state.level.exudates.filter(p => !p.taken).map(p => ({ ...p })),
      clouds: state.level.exudateClouds.map(cloud => ({
        x: cloud.x, y: cloud.y, radius: cloud.radius, life: cloud.life,
      })),
      bounds: { ...stageBounds },
      worldBounds: { x: 0, y: state.level.worldTopY || 0,
        width: state.level.endX, height: state.level.worldHeight || 720 },
      cameraHint: { x: host.x + host.w + 65, y: host.y - 130 },
      interaction: sim.inoculumSelection.summary,
      stats: { microbes: sim.ecology.agents.length,
        bridges: sim.mycorrhizaStructures.structureCount,
        matureBridges: sim.mycorrhizaStructures.matureCount,
        colonies: sim.beneficialInoculants.colonyCount,
        originalArbuscules: sim.mycorrhiza.arbusculeCount },
      toast: state.toast || '',
    };
  }

  reset();
  return { update, snapshot, regrow, reset, engine: sim };
}

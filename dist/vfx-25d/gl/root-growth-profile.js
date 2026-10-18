// Decorative root architecture only: no game colliders or microbiology.
// Each seeded system has its own hierarchy, rather than repeating one Y at
// fixed intervals. Sampling the same profile at any frame rate is stable.
export const ROOT_ARCHETYPES = Object.freeze(['taproot', 'fan', 'sweep', 'old']);

function randomFor(seed) {
  // Avalanche small/sequential seeds too; otherwise their first sample would
  // all choose the same root family even though later samples look random.
  let s = (seed >>> 0) ^ 0x9e3779b9;
  s = Math.imul(s ^ (s >>> 16), 0x21f0aaad);
  s = Math.imul(s ^ (s >>> 15), 0x735a2d97);
  s = (s ^ (s >>> 15)) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 1 | s);
    s ^= s + Math.imul(s ^ (s >>> 7), 61 | s);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = x => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));

export function createRootGrowthProfile({ seed, length, generation = 0, maxGeneration = 2,
  branchSpacing = 1, archetype = null, dominant = false }) {
  const random = randomFor(seed);
  const type = ROOT_ARCHETYPES.includes(archetype) ? archetype : ROOT_ARCHETYPES[Math.floor(random() * ROOT_ARCHETYPES.length)];
  const side = random() < .5 ? -1 : 1;
  const primary = generation === 0;
  const settings = {
    taproot: { girth: 2.05, taper: .8, bend: .42, wave: 220, clusters: 3 },
    fan: { girth: 1.8, taper: .96, bend: .32, wave: 250, clusters: 2 },
    sweep: { girth: 2.1, taper: .9, bend: .72, wave: 270, clusters: 2 },
    old: { girth: 2.6, taper: .62, bend: .57, wave: 175, clusters: 2 },
  }[type];
  const lengthScale = primary ? .8 + random() * .4 : 1;
  const actualLength = Math.max(18, length * lengthScale);
  const profile = {
    seed, archetype: type, generation, dominant,
    length: actualLength,
    girth: primary ? settings.girth * (.88 + random() * .24) : 1,
    speed: primary ? .86 + random() * .28 : 1,
    taper: settings.taper * (.83 + random() * .34),
    bend: settings.bend * (.8 + random() * .4) * (primary || dominant ? 1 : .7),
    wave: settings.wave * (.78 + random() * .44) * (primary || dominant ? 1 : .55),
    phase: random() * Math.PI * 2,
    phase2: random() * Math.PI * 2,
    lean: side * (type === 'sweep' ? .18 : .04 + random() * .09),
    gravity: primary ? 0 : .3 + random() * .45,
    branches: [],
  };
  if (generation >= maxGeneration) return profile;
  const branch = (at, direction, robust = false, crown = false) => {
    const width = crown ? .63 + random() * .16 : robust ? .48 + random() * .19 : .23 + random() * .20;
    profile.branches.push({
      at: clamp(at, 12, actualLength * .86),
      angle: direction * (crown ? .24 + random() * .34 : .58 + random() * .68),
      width,
      length: crown ? .65 + random() * .25 : robust ? .36 + random() * .23 : .13 + random() * .18,
      speed: crown ? .84 + random() * .12 : .7 + random() * .25,
      delay: .35 + random() * 1.8,
      dominant: crown || robust,
      seed: Math.floor(random() * 4294967296) >>> 0,
    });
  };

  // A minority of crowns carry several strong axes, at different depths and
  // angles. They read as a fan/root clump, not a repeated symmetric fork.
  if (primary && type === 'fan') {
    branch(22 + random() * 28, side, true, true);
    branch(64 + random() * 45, -side, true, true);
  }
  if (primary && type === 'sweep') branch(actualLength * (.15 + random() * .14), side, true);

  const clusterCount = primary
    ? Math.max(1, Math.round((settings.clusters + random() * 1.5) / Math.sqrt(Math.max(.35, Number(branchSpacing) || 1))))
    : dominant ? 2 : (random() < .72 ? 1 : 0);
  for (let cluster = 0; cluster < clusterCount; cluster++) {
    const fraction = .16 + (cluster + .2 + random() * .6) / Math.max(1, clusterCount) * .64;
    const base = actualLength * fraction;
    const count = primary && type !== 'old' && random() < .6 ? 2 : 1;
    const clusterSide = random() < .72 ? side : -side;
    for (let j = 0; j < count; j++) {
      const direction = j > 0 && random() < .38 ? -clusterSide : clusterSide;
      branch(base + j * (18 + random() * 42), direction, primary && type === 'old');
    }
  }
  profile.branches.sort((a, b) => a.at - b.at);
  // Even clustered branches have their own node; no two equal Y junctions.
  for (let i = 1; i < profile.branches.length; i++) {
    profile.branches[i].at = Math.max(profile.branches[i].at, profile.branches[i - 1].at + 15);
  }
  profile.branches = profile.branches.filter(b => b.at < actualLength * .9);
  return profile;
}

export function rootGrowthHeading(profile, distance, baseAngle) {
  const wave = Math.max(25, profile.wave);
  const start = ease(distance / (profile.generation ? 70 : 105));
  const bend = Math.sin(distance / wave + profile.phase) * profile.bend
    + Math.sin(distance / (wave * .43) + profile.phase2) * profile.bend * .18;
  let heading = baseAngle + (bend + profile.lean) * start;
  if (profile.generation > 0) {
    // Laterals explore sideways before their tips gradually turn down.
    const gravity = ease((distance / profile.length - .22) / .78) * profile.gravity;
    heading += wrap(-Math.PI / 2 - heading) * gravity;
  }
  return heading;
}

export function rootGrowthWidth(profile, distance, baseWidth) {
  const t = clamp(distance / profile.length, 0, 1);
  const taper = Math.pow(1 - t, profile.taper);
  const tissue = 1 + Math.sin(distance / 54 + profile.phase) * Math.sin(t * Math.PI) * .045;
  return Math.max(.28, baseWidth * taper * tissue);
}

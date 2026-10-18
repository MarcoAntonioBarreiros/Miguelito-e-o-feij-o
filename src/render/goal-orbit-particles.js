// Presentation of the fourteen particles already orbiting the final root.
// Positions, radii, two original colours and completion speed are unchanged.
// WebGL can collect these particles for its HDR emitter pass; Canvas stays intact.
const TAU = Math.PI * 2;
export const GOAL_ORBIT_PARTICLE_COUNT = 14;

export function goalOrbitParticle(index, time, completed = false) {
  const angle = index / GOAL_ORBIT_PARTICLE_COUNT * TAU + time * (completed ? .42 : .18);
  const orbitRadius = 42 + (index % 4) * 11 + Math.sin(time * 1.7 + index) * 4;
  return {
    x: Math.cos(angle) * orbitRadius,
    y: 44 + Math.sin(angle) * orbitRadius * .55,
    radius: 2.2 + (index % 3),
    alpha: completed ? .82 : .42,
    color: index % 2 ? '#d6afff' : '#8ff2c1',
  };
}

export function goalOrbitTwinkle(index, time) {
  const seed = (index + .5) / GOAL_ORBIT_PARTICLE_COUNT;
  const slow = .5 + .5 * Math.sin(time * (.9 + seed * 1.1) + seed * 71);
  const pulse = .5 + .5 * Math.sin(time * (2.3 + seed * 1.7) + seed * 127);
  return .66 + .28 * slow + .28 * pulse ** 8;
}

export function drawGoalOrbitParticles(ctx, time, completed = false) {
  const collect = ctx.__glGoalOrbitParticle;
  if (typeof collect === 'function') {
    // Local coordinates deliberately retain the caller's full Canvas matrix.
    // The renderer projects that matrix once, then emits coloured HDR halos
    // and bright small cores at these exact original orbital positions.
    for (let i = 0; i < GOAL_ORBIT_PARTICLE_COUNT; i++) {
      collect.call(ctx, { ...goalOrbitParticle(i, time, completed), index: i, time, completed, twinkle: goalOrbitTwinkle(i, time) });
    }
    return;
  }
  ctx.save();
  for (let i = 0; i < GOAL_ORBIT_PARTICLE_COUNT; i++) {
    const particle = goalOrbitParticle(i, time, completed);
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = particle.alpha;
    ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.radius, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

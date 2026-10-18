// Canvas sprites and their platform contacts share z=0. Canvas draw order is
// not a depth coordinate: moving a sprite towards a perspective camera also
// moves its feet away from the platform, even when its 2D coordinates are exact.
export function writeSpritePlanePositions(target, offset, sprite, toWorld) {
  const p0 = toWorld(sprite.p0), pu = toWorld(sprite.pu), pv = toWorld(sprite.pv);
  const p1 = { x: pu.x + pv.x - p0.x, y: pu.y + pv.y - p0.y };
  target.set([
    p0.x, p0.y, 0, pu.x, pu.y, 0,
    pv.x, pv.y, 0, p1.x, p1.y, 0,
  ], offset);
  return { p0, pu, pv };
}

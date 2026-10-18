// Coordinates are local to drawPlayer's translate/facing transform. Both the
// equipment and the sprite therefore mirror together, without changing physics.
export function jetpackPose(attachment = null) {
  const scale = attachment
    ? Math.max(.1, Math.min(attachment.width / 10, attachment.height / 26.4))
    : 1;
  const x = attachment?.x ?? -13, y = attachment?.y ?? -6;
  const width = 8 * scale, height = 19 * scale;
  return { x, y, scale, width, height, nozzleY: y + height / 2 + 2.6 * scale };
}

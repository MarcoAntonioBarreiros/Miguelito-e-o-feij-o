// The original game's cellular artwork, used as the front of a shallow WebGL
// platform. This file only changes presentation: its bounds are never colliders.
import {
  ROOT_PALETTE, paintRootTissue, paintRootCondition, pseudo, clamp,
} from '../../src/render/root-tissue.js';
import { rootBandThickness } from '../../src/render/rhizosphere-geometry.js';

function platformSeed(platform) {
  return Math.abs((Math.round(platform.x || 0) * 73856093)
    ^ (Math.round(platform.rootBaseY ?? platform.y ?? 0) * 19349663)
    ^ (Math.round(platform.w || 0) * 83492791));
}

// A flat upper surface follows platform.y precisely. Only the distal cap curls
// below it, as the existing rhizosphere renderer's lateral roots do.
function traceRoot(ctx, width, height) {
  ctx.beginPath();
  ctx.moveTo(-3, height * .57);
  ctx.quadraticCurveTo(0, 0, 10, 0);
  ctx.lineTo(width - 12, 0);
  ctx.quadraticCurveTo(width + 3, 0, width + 7, height * .92);
  ctx.quadraticCurveTo(width + 13, height * 2.2, width + 7, height * 2.04);
  ctx.quadraticCurveTo(width + 1, height * 1.82, width, height * .98);
  ctx.quadraticCurveTo(width - 12, height * .79, width - 22, height * .92);
  ctx.lineTo(8, height);
  ctx.quadraticCurveTo(-3, height * 1.04, -3, height * .57);
  ctx.closePath();
}

function paintHairs(ctx, width, height, seed) {
  const count = Math.max(6, Math.round(width / 9));
  ctx.save();
  ctx.lineCap = 'round';
  // Fine radicles retain the author's olive palette. Several faint lengths
  // produce the hanging silhouette without a solid floating bowl of earth.
  for (let i = 0; i < count; i++) {
    const t = (i + .3 + pseudo(seed, i * 9 + 30) * .4) / count;
    const x = 9 + t * Math.max(1, width - 24);
    const startY = height * (.87 + pseudo(seed, i * 9 + 31) * .15);
    const length = 9 + Math.pow(pseudo(seed, i * 9 + 32), 1.5) * 55;
    const bend = (pseudo(seed, i * 9 + 33) - .5) * 13;
    ctx.globalAlpha = .34 + pseudo(seed, i * 9 + 34) * .42;
    ctx.strokeStyle = i % 4 ? ROOT_PALETTE.radicle : ROOT_PALETTE.green[1];
    ctx.lineWidth = .5 + pseudo(seed, i * 9 + 35) * .65;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.bezierCurveTo(x + bend * .2, startY + length * .3,
      x + bend, startY + length * .73, x + bend * .65, startY + length);
    ctx.stroke();
    if (length > 30 && i % 3 === 0) {
      ctx.lineWidth *= .65;
      ctx.beginPath();
      ctx.moveTo(x + bend * .5, startY + length * .5);
      ctx.quadraticCurveTo(x + bend + 4, startY + length * .67,
        x + bend + 2, startY + length * .84);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function makeNormalCanvas(canvas, resolution, anchorTopPx, bodyHeightPx) {
  const source = canvas.getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, canvas.width, canvas.height);
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = canvas.width;
  normalCanvas.height = canvas.height;
  const ctx = normalCanvas.getContext('2d');
  const result = ctx.createImageData(canvas.width, canvas.height);
  const { width, height, data } = source;
  const luminance = (x, y, fallback) => {
    const k = (clamp(y, 0, height - 1) * width + clamp(x, 0, width - 1)) * 4;
    return data[k + 3] < 25 ? fallback
      : (data[k] * .2126 + data[k + 1] * .7152 + data[k + 2] * .0722) / 255;
  };
  const step = Math.max(1, Math.round(resolution));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const k = (y * width + x) * 4;
    const center = luminance(x, y, .3);
    let nx = -(luminance(x + step, y, center) - luminance(x - step, y, center)) * .7;
    let ny = (luminance(x, y + step, center) - luminance(x, y - step, center)) * .7;
    const bandY = y / resolution - anchorTopPx;
    if (bandY >= 0 && bandY <= bodyHeightPx) {
      // A shallow curve adds directional light response to the original cells;
      // the map does not repaint their colors or apply an artificial gloss.
      ny += (.5 - bandY / bodyHeightPx) * .45;
    }
    const invLength = 1 / Math.hypot(nx, ny, 1);
    result.data[k] = Math.round((nx * invLength * .5 + .5) * 255);
    result.data[k + 1] = Math.round((ny * invLength * .5 + .5) * 255);
    result.data[k + 2] = Math.round((invLength * .5 + .5) * 255);
    result.data[k + 3] = data[k + 3];
  }
  ctx.putImageData(result, 0, 0);
  return normalCanvas;
}

/**
 * Return original cellular root art for a shallow WebGL platform front.
 * All dimensions/anchors are GAME pixels, independent of backing resolution.
 * The collider's upper-left corner is at (anchorLeftPx, anchorTopPx) in canvas.
 *
 * For a Three.PlaneGeometry(widthPx/P, heightPx/P), place its center at:
 *   x = (platform.x - anchorLeftPx + widthPx/2) / P
 *   y = -(platform.y - anchorTopPx + heightPx/2) / P
 *
 * Set color texture.colorSpace = THREE.SRGBColorSpace; leave the normal linear.
 * No Three dependency is required, and no source platform is modified.
 */
export function renderPlatformArtwork(platform, { resolution = 2, normals = true } = {}) {
  const width = Math.max(20, Number(platform.w) || 100);
  const bodyHeightPx = rootBandThickness(platform);
  const anchorLeftPx = 14;
  const anchorTopPx = 7;
  const widthPx = Math.ceil(width + anchorLeftPx + 22);
  const heightPx = Math.ceil(anchorTopPx + bodyHeightPx + 72);
  const scale = clamp(Number(resolution) || 2, .5, 4);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(widthPx * scale);
  canvas.height = Math.ceil(heightPx * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: normals });
  ctx.scale(scale, scale);
  ctx.translate(anchorLeftPx, anchorTopPx);
  const seed = platformSeed(platform);

  paintHairs(ctx, width, bodyHeightPx, seed);
  ctx.save();
  traceRoot(ctx, width, bodyHeightPx);
  ctx.fillStyle = ROOT_PALETTE.innerBase;
  ctx.fill();
  ctx.clip();
  // Direct reuse of the game's author-painted cellular layers and health tint.
  paintRootTissue(ctx, seed, -6, 0, width + 24, bodyHeightPx);
  paintRootCondition(ctx, { ...platform, x: -6, y: 0, w: width + 24, h: bodyHeightPx });
  const underside = ctx.createLinearGradient(0, 0, 0, bodyHeightPx * 1.5);
  underside.addColorStop(0, 'rgba(8,8,5,0)');
  underside.addColorStop(.7, 'rgba(8,8,5,.04)');
  underside.addColorStop(1, 'rgba(8,8,5,.24)');
  ctx.fillStyle = underside;
  ctx.fillRect(-8, 0, width + 40, bodyHeightPx * 3);
  ctx.restore();
  ctx.save();
  traceRoot(ctx, width, bodyHeightPx);
  ctx.strokeStyle = ROOT_PALETTE.outline;
  ctx.lineWidth = .85;
  ctx.stroke();
  ctx.restore();

  // Low, broken moss catches rim light while the top remains level.
  ctx.save();
  const mossCount = Math.round(width / 12);
  for (let i = 0; i < mossCount; i++) {
    const x = 7 + (i + pseudo(seed, i + 700)) / mossCount * (width - 18);
    ctx.globalAlpha = .35 + pseudo(seed, i + 800) * .35;
    ctx.fillStyle = ROOT_PALETTE.green[i % 3];
    ctx.beginPath();
    ctx.ellipse(x, .5, 1.5 + pseudo(seed, i + 900) * 3, .6 + pseudo(seed, i + 1000), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  return {
    canvas,
    normalCanvas: normals ? makeNormalCanvas(canvas, scale, anchorTopPx, bodyHeightPx) : null,
    widthPx,
    heightPx,
    anchorLeftPx,
    anchorTopPx,
    bodyHeightPx,
    depthPx: 14,
    resolution: scale,
  };
}

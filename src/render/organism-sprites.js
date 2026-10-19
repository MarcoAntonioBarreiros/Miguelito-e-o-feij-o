const DEFAULT_FRAME_WIDTH = 320;
const DEFAULT_FRAME_HEIGHT = 400;

export const ORGANISM_SPRITE_SHEETS = Object.freeze({
  rhizobium: Object.freeze({
    src: 'assets/organisms/rhizobium.png',
    frameCount: 12,
    fps: 6,
    height: 62,
  }),
  azospirillum: Object.freeze({
    src: 'assets/organisms/azospirillum.png',
    frameCount: 12,
    fps: 7,
    height: 68,
  }),
  ralstonia: Object.freeze({
    src: 'assets/organisms/ralstonia.png',
    frameCount: 12,
    fps: 7,
    height: 60,
  }),
  rhizoctonia: Object.freeze({
    src: 'assets/organisms/rhizoctonia.png',
    frameCount: 12,
    fps: 7,
    height: 82,
  }),
  micorriza: Object.freeze({
    src: 'assets/organisms/micorriza.png',
    frameCount: 24,
    fps: 10,
    height: 62,
  }),
  oportunista: Object.freeze({
    src: 'assets/organisms/oportunista.png',
    frameCount: 12,
    fps: 7,
    height: 78,
  }),
  pseudomonas: Object.freeze({
    src: 'assets/organisms/pseudomonas.png',
    frameCount: 24,
    fps: 10,
    height: 66,
  }),
  nematoide: Object.freeze({
    src: 'assets/organisms/nematoide.png',
    frameCount: 12,
    fps: 7,
    height: 68,
  }),
  trichoderma: Object.freeze({
    src: 'assets/organisms/trichoderma.png',
    frameCount: 12,
    fps: 7,
    height: 72,
  }),
});

// Versoes "calmas" (kawaii) para a calmaria de Pseudomonas + Bacillus. Mesmo
// formato de folha (quadros 320x400 lado a lado). Para ligar uma, basta
// acrescentar aqui, por exemplo:
//   oportunista: Object.freeze({ src: 'assets/organisms/calm/oportunista.png', frameCount: 12, fps: 5 }),
// Enquanto nao houver arte, o organismo calmo usa a folha normal com um brilho
// quente suave atras.
export const CALM_SPRITE_SHEETS = Object.freeze({});

const enabled = new Map(Object.keys(ORGANISM_SPRITE_SHEETS).map(type => [type, true]));

export function calculateOrganismSpriteFrame(type, time = 0, phase = 0) {
  const sheet = ORGANISM_SPRITE_SHEETS[type];
  if (!sheet) return null;
  const raw = Math.floor(Math.max(0, time) * sheet.fps + Math.abs(phase) * 3.7);
  const frameIndex = raw % sheet.frameCount;
  return {
    frameIndex,
    sourceX: frameIndex * DEFAULT_FRAME_WIDTH,
    sourceY: 0,
    sourceWidth: DEFAULT_FRAME_WIDTH,
    sourceHeight: DEFAULT_FRAME_HEIGHT,
  };
}

export function createOrganismSpriteRenderer({
  imageFactory = () => (typeof Image === 'undefined' ? null : new Image()),
} = {}) {
  const images = new Map();

  function ensureImage(type, calmVariant = false) {
    const sheet = calmVariant ? CALM_SPRITE_SHEETS[type] : ORGANISM_SPRITE_SHEETS[type];
    if (!sheet) return null;
    const key = calmVariant ? `${type}:calm` : type;
    if (images.has(key)) return images.get(key);

    const image = imageFactory(type, sheet);
    const record = { image, loaded: false, failed: !image };
    images.set(key, record);
    if (!image) return record;

    image.onload = () => {
      record.loaded = true;
      record.failed = false;
    };
    image.onerror = () => {
      record.failed = true;
      record.loaded = false;
    };
    image.src = sheet.src;
    return record;
  }

  function draw(ctx, type, {
    x = 0,
    y = 0,
    height = null,
    time = 0,
    phase = 0,
    alpha = 1,
    rotation = 0,
    flipX = false,
    anchorX = .5,
    anchorY = .5,
    calm = 0,
  } = {}) {
    const sheet = ORGANISM_SPRITE_SHEETS[type];
    if (!sheet || !enabled.get(type)) return false;
    const record = ensureImage(type);
    if (!record?.loaded || record.failed) return false;

    const renderHeight = Math.max(1, height ?? sheet.height);
    const renderWidth = renderHeight * (DEFAULT_FRAME_WIDTH / DEFAULT_FRAME_HEIGHT);
    const k = Math.max(0, Math.min(1, calm || 0));
    const calmSheet = k > 0 ? CALM_SPRITE_SHEETS[type] : null;
    const calmRecord = calmSheet ? ensureImage(type, true) : null;
    const calmReady = Boolean(calmRecord?.loaded && !calmRecord.failed);

    const blit = (image, frameSheet, a) => {
      if (a <= 0) return;
      const raw = Math.floor(Math.max(0, time) * frameSheet.fps + Math.abs(phase) * 3.7);
      const frameIndex = raw % frameSheet.frameCount;
      ctx.save();
      ctx.globalAlpha *= Math.max(0, Math.min(1, alpha)) * a;
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(flipX ? -1 : 1, 1);
      ctx.drawImage(
        image,
        frameIndex * DEFAULT_FRAME_WIDTH,
        0,
        DEFAULT_FRAME_WIDTH,
        DEFAULT_FRAME_HEIGHT,
        -renderWidth * anchorX,
        -renderHeight * anchorY,
        renderWidth,
        renderHeight,
      );
      ctx.restore();
    };

    if (k > 0 && !calmReady) {
      // provisorio ate a arte kawaii: brilho quente e suave atras do organismo
      const cx = x + renderWidth * (.5 - anchorX) * (flipX ? -1 : 1);
      const cy = y + renderHeight * (.5 - anchorY);
      const r = Math.max(renderWidth, renderHeight) * .62;
      ctx.save();
      ctx.globalAlpha *= Math.max(0, Math.min(1, alpha)) * k;
      const g = ctx.createRadialGradient(cx, cy, r * .1, cx, cy, r);
      g.addColorStop(0, 'rgba(255,196,170,.55)');
      g.addColorStop(.55, 'rgba(255,160,190,.26)');
      g.addColorStop(1, 'rgba(255,160,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    blit(record.image, sheet, calmReady ? 1 - k : 1);
    if (calmReady) blit(calmRecord.image, calmSheet, k);
    return true;
  }

  return {
    draw,
    preload(types = Object.keys(ORGANISM_SPRITE_SHEETS)) {
      types.forEach(ensureImage);
    },
    status(type) {
      const record = images.get(type);
      return {
        enabled: Boolean(enabled.get(type)),
        requested: Boolean(record),
        loaded: Boolean(record?.loaded),
        failed: Boolean(record?.failed),
      };
    },
  };
}

export function isOrganismSpriteEnabled(type) {
  return Boolean(enabled.get(type));
}

export function setOrganismSpriteEnabled(type, value) {
  if (!ORGANISM_SPRITE_SHEETS[type]) return false;
  enabled.set(type, Boolean(value));
  return true;
}

export const organismSprites = createOrganismSpriteRenderer();

if (typeof window !== 'undefined') {
  organismSprites.preload();
  window.miguelitoOrganismSprites = {
    enable(type) {
      if (type === 'all') Object.keys(ORGANISM_SPRITE_SHEETS).forEach(key => enabled.set(key, true));
      else setOrganismSpriteEnabled(type, true);
      return this.status();
    },
    disable(type) {
      if (type === 'all') Object.keys(ORGANISM_SPRITE_SHEETS).forEach(key => enabled.set(key, false));
      else setOrganismSpriteEnabled(type, false);
      return this.status();
    },
    toggle(type) {
      if (!ORGANISM_SPRITE_SHEETS[type]) return this.status();
      enabled.set(type, !enabled.get(type));
      return this.status();
    },
    status() {
      return Object.fromEntries(
        Object.keys(ORGANISM_SPRITE_SHEETS).map(type => [type, organismSprites.status(type)]),
      );
    },
  };
}

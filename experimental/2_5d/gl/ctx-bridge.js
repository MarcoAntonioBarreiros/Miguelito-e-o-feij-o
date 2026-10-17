// Ponte Canvas 2D -> WebGL.
//
// Os ~20 subsistemas do jogo desenham com `render(ctx)`. Reescrever todos para
// a GPU seria a migracao inteira. Este contexto intermediario deixa cada um
// desenhar exatamente como hoje — e intercepta SO os `drawImage` das folhas de
// sprite do Miguelito e dos microrganismos. Esses viram instancias iluminadas
// na cena 2,5D; todo o resto (trilhas, pontes, rotulos, nodulos, zonas
// necroticas...) continua indo para um canvas 2D comum, que e composto por cima.
//
// A posicao de cada sprite sai da propria matriz do contexto no momento do
// desenho: translate, rotate, scale e o espelhamento do facing ja feitos pelo
// codigo do jogo. Nenhuma regra de animacao foi copiada — o quadro e o que o
// modulo original escolheu.

const SPRITE_SOURCES = /assets\/(miguelito|organisms|bacillus)\//;

export function isLitSpriteImage(image) {
  return Boolean(image && image.tagName === 'IMG' && SPRITE_SOURCES.test(image.src || ''));
}

/**
 * @param {CanvasRenderingContext2D} real contexto do canvas de sobreposicao
 * @param {(sprite:object)=>void} onSprite recebe cada sprite capturado
 */
export function createBridgeContext(real, onSprite, { textTarget = null } = {}) {
  const bound = new Map();
  let capture = true;
  let order = 0;

  // Texto nao passa pela luz nem pelo bloom: vai direto para o canvas do jogo,
  // que fica por cima da imagem WebGL. Copia o estado de desenho do momento
  // (matriz, fonte, cor, sombra) para sair identico ao original.
  const TEXT_STATE = ['font', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'lineCap', 'miterLimit',
    'textAlign', 'textBaseline', 'direction', 'globalAlpha', 'shadowColor', 'shadowBlur', 'shadowOffsetX',
    'shadowOffsetY', 'filter', 'letterSpacing', 'wordSpacing', 'fontKerning'];
  function drawText(kind, args) {
    const target = textTarget?.();
    if (!capture || !target) return real[kind](...args);
    target.save();
    target.setTransform(real.getTransform());
    for (const k of TEXT_STATE) if (k in real) { try { target[k] = real[k]; } catch (_) {} }
    const op = real.globalCompositeOperation;
    target.globalCompositeOperation = op === 'lighter' || op === 'screen' ? op : 'source-over';
    target[kind](...args);
    target.restore();
    return undefined;
  }
  const fillText = (...args) => drawText('fillText', args);
  const strokeText = (...args) => drawText('strokeText', args);

  function drawImage(image, ...args) {
    if (!capture || !isLitSpriteImage(image) || !image.complete || !image.naturalWidth) {
      return real.drawImage(image, ...args);
    }
    let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight, dx, dy, dw, dh;
    if (args.length === 2) { [dx, dy] = args; dw = sw; dh = sh; }
    else if (args.length === 4) { [dx, dy, dw, dh] = args; }
    else { [sx, sy, sw, sh, dx, dy, dw, dh] = args; }
    const m = real.getTransform();
    // Cantos em pixels de TELA do canvas de sobreposicao.
    const corner = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
    onSprite({
      image,
      src: { x: sx, y: sy, w: sw, h: sh },
      // origem (canto sup. esq. do destino), eixo u (largura) e eixo v (altura)
      p0: corner(dx, dy),
      pu: corner(dx + dw, dy),
      pv: corner(dx, dy + dh),
      alpha: real.globalAlpha,
      order: order++,
    });
    return undefined;
  }

  const proxy = new Proxy(real, {
    get(target, prop) {
      if (prop === 'drawImage') return drawImage;
      if (prop === 'fillText') return fillText;
      if (prop === 'strokeText') return strokeText;
      if (prop === '__real') return target;
      const value = target[prop];
      if (typeof value !== 'function') return value;
      let fn = bound.get(prop);
      if (!fn) { fn = value.bind(target); bound.set(prop, fn); }
      return fn;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });

  return {
    ctx: proxy,
    beginFrame() { order = 0; },
    setCapture(value) { capture = Boolean(value); },
  };
}

/** Um "canvas" que entrega o contexto-ponte a quem chamar getContext('2d'). */
export function createBridgeCanvas(realCanvas, bridgeCtx) {
  return new Proxy(realCanvas, {
    get(target, prop) {
      if (prop === 'getContext') return () => bridgeCtx;
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

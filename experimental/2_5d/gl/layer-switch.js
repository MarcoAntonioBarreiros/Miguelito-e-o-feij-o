// Comutador de camadas para o modo 2,5D (sem dependencia de Three.js).
//
// O renderizador do jogo (`createRenderer`) guarda o contexto 2D que recebe ao
// nascer e desenha sempre nele. No modo 2,5D cada parte do quadro precisa ir
// para uma camada diferente — fundo, terreno, efeitos — porque cada uma recebe
// um tratamento de luz e profundidade proprio na GPU.
//
// Em vez de mexer no renderizador, ele recebe um canvas cujo contexto e um
// "desvio": cada chamada vai para o contexto que estiver selecionado no
// momento. Sem modo 2,5D o alvo e o contexto real, e o jogo desenha
// exatamente como sempre.
//
// Este arquivo e importado estaticamente por app.js; o Three.js so e carregado
// (import dinamico) quando `?render=25d` esta na URL.

export function read25DPreference(locationLike) {
  try {
    const params = new URLSearchParams(locationLike?.search || '');
    const value = (params.get('render') || '').toLowerCase();
    if (value === '2d') return false;
    if (value === '25d' || value === '2.5d' || value === '2,5d') return true;
    // a demonstracao publicada liga o 2,5D por padrao (build-web-demo.cjs)
    return globalThis.MIGUELITO_RENDER_25D_DEFAULT === true;
  } catch (_) {
    return false;
  }
}

export function createLayerSwitch(canvas) {
  const realCtx = canvas.getContext('2d');
  let target = realCtx;
  const bound = new WeakMap();

  function boundFor(ctx, prop, fn) {
    let map = bound.get(ctx);
    if (!map) { map = new Map(); bound.set(ctx, map); }
    let f = map.get(prop);
    if (!f) { f = fn.bind(ctx); map.set(prop, f); }
    return f;
  }

  const ctx = new Proxy({}, {
    get(_, prop) {
      const value = target[prop];
      return typeof value === 'function' ? boundFor(target, prop, value) : value;
    },
    set(_, prop, value) {
      target[prop] = value;
      return true;
    },
    has(_, prop) { return prop in target; },
  });

  const proxyCanvas = new Proxy(canvas, {
    get(real, prop) {
      if (prop === 'getContext') return () => ctx;
      const value = real[prop];
      return typeof value === 'function' ? value.bind(real) : value;
    },
    set(real, prop, value) {
      real[prop] = value;
      return true;
    },
  });

  return {
    canvas: proxyCanvas,
    ctx,
    realCtx,
    /** Seleciona o contexto que recebe as proximas chamadas (null = real). */
    target(next) { target = next || realCtx; },
  };
}

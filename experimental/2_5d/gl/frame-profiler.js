// Perfil do quadro 2D (so com ?perfil=1): mede quanto cada parte do desenho
// custa. Depois de cada trecho forca o canvas a terminar o que foi pedido
// (getImageData de 1 pixel), entao o tempo inclui a rasterizacao, nao so a
// chamada. Serve para comparar as partes entre si, nao como FPS real.

export function readProfilePreference(locationLike) {
  try { const v = new URLSearchParams(locationLike?.search || '').get('perfil'); return v === '1' ? 'flush' : v === '2' ? 'cpu' : false; } catch (_) { return false; }
}

export function createFrameProfiler(ctx, active) {
  const acc = new Map();
  let frames = 0;
  // contagem de operacoes por trecho (drawImage com area, preenchimentos,
  // tracos, com sombra borrada) — diz O QUE pesa dentro de cada trecho
  let current = null;
  if (active) {
    const proto = CanvasRenderingContext2D.prototype;
    const wrap = (name, count) => {
      const orig = proto[name];
      proto[name] = function (...args) {
        if (current) count(current, this, args);
        return orig.apply(this, args);
      };
    };
    const bump = (e, k, v = 1) => { e.ops[k] = (e.ops[k] || 0) + v; };
    const blur = (e, c) => { if (c.shadowBlur > 0 && c.shadowColor !== 'rgba(0, 0, 0, 0)') bump(e, 'comSombra'); };
    wrap('drawImage', (e, c, a) => {
      bump(e, 'drawImage');
      const src = a[0];
      const tag = src?.tagName === 'CANVAS' ? 'canvas' : 'img';
      bump(e, 'drawImage:' + tag);
      const w = a.length >= 8 ? a[7] : a.length >= 4 ? a[3] : (src?.width || 0);
      const h = a.length >= 8 ? a[8] : a.length >= 4 ? a[4] : (src?.height || 0);
      const m = c.getTransform();
      bump(e, 'pxImagem', Math.abs(w * h * m.a * m.d) / 1000);
      blur(e, c);
    });
    for (const n of ['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'clip', 'putImageData']) wrap(n, (e, c) => { bump(e, n); blur(e, c); });
    for (const n of ['createLinearGradient', 'createRadialGradient', 'createPattern']) wrap(n, e => bump(e, 'gradiente/padrao'));
  }
  // 'flush': forca a rasterizacao em cada trecho; 'cpu': so o tempo das chamadas
  const flush = active === 'flush' ? () => { try { ctx.getImageData(0, 0, 1, 1); } catch (_) {} } : () => {};
  const api = {
    active: Boolean(active),
    frame() { frames++; },
    run(name, fn) {
      if (!active) return fn();
      flush();
      const e = acc.get(name) || { ms: 0, n: 0, ops: {} };
      acc.set(name, e);
      const t0 = performance.now();
      const prev = current;
      current = e;
      try { return fn(); } finally {
        flush();
        current = prev;
        e.ms += performance.now() - t0; e.n++;
      }
    },
    reset() { acc.clear(); frames = 0; },
    report() {
      const f = Math.max(1, frames);
      const rows = [...acc.entries()].map(([name, e]) => ({
        name, msPerFrame: +(e.ms / f).toFixed(3),
        ops: Object.fromEntries(Object.entries(e.ops).map(([k, v]) => [k, +(v / f).toFixed(1)])),
      }));
      rows.sort((a, b) => b.msPerFrame - a.msPerFrame);
      const total = rows.reduce((s, r) => s + r.msPerFrame, 0);
      return { frames, totalMs: +total.toFixed(2), rows };
    },
  };
  // trechos internos de modulos do jogo (so medem com o perfil ligado)
  if (active) globalThis.__perfRun = (name, fn) => api.run(name, fn);
  return api;
}

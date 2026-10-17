// Normal maps derivados da propria arte, sem redesenhar nada.
//
// A folha original (cor + alfa) continua sendo a unica fonte. Daqui sai um
// "relevo" estimado em duas camadas:
//   1. volume: o alfa borrado vira uma almofada — o centro do corpo fica alto e
//      a borda desce. E isso que faz a luz contornar o Miguelito e as bacterias
//      como se fossem volumes, e nao recortes de papel.
//   2. detalhe: o passa-alta da luminancia. O traco escuro do contorno e das
//      dobras afunda, os brilhos pintados sobem — o relevo segue o desenho.
//
// O resultado vai para o espaco tangente da imagem (u para a direita, v para
// baixo). Quem desenha converte para o mundo com a orientacao real do sprite,
// entao espelhar ou girar a folha nao estraga a luz.
//
// Se um dia existir um normal map pintado a mao (`run_n.png` ao lado de
// `run.png`), ele tem prioridade: este gerador e so o ponto de partida.

const MAX_WIDTH = 4096; // folhas de 7680px sao calculadas em meia resolucao

function boxBlur(src, dst, w, h, r) {
  // Separavel, janela deslizante: O(w*h) independente do raio.
  const tmp = new Float32Array(w * h);
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + Math.min(w - 1, Math.max(0, i))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * inv;
      const add = src[row + Math.min(w - 1, x + r + 1)];
      const sub = src[row + Math.max(0, x - r)];
      acc += add - sub;
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[Math.min(h - 1, Math.max(0, i)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * inv;
      const add = tmp[Math.min(h - 1, y + r + 1) * w + x];
      const sub = tmp[Math.max(0, y - r) * w + x];
      acc += add - sub;
    }
  }
}

function blur3(src, w, h, r) {
  const a = new Float32Array(w * h);
  const b = new Float32Array(w * h);
  boxBlur(src, a, w, h, r);
  boxBlur(a, b, w, h, r);
  boxBlur(b, a, w, h, r);
  return a;
}

/**
 * @param {HTMLImageElement|HTMLCanvasElement} image folha original
 * @param {{frameHeight?:number, volume?:number, detail?:number}} options
 * @returns {HTMLCanvasElement} normal map RGBA (A = alfa original)
 */
export function generateSpriteNormalMap(image, { volume = 1, detail = .35 } = {}) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_WIDTH / iw);
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h);
  const d = px.data;

  const n = w * h;
  const alpha = new Float32Array(n);
  const lum = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const a = d[j + 3] / 255;
    alpha[i] = a;
    lum[i] = (d[j] * .2126 + d[j + 1] * .7152 + d[j + 2] * .0722) / 255 * a;
  }

  // O raio do volume acompanha a altura do quadro: um organismo de 400px e um
  // bacilo de 104px precisam do mesmo "arredondamento" relativo.
  const rVolume = Math.max(2, Math.round(h * .028));
  const dome = blur3(alpha, w, h, rVolume);
  const lumSoft = blur3(lum, w, h, Math.max(1, Math.round(h * .006)));
  const lumBase = blur3(lum, w, h, Math.max(2, Math.round(h * .02)));

  const height = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // sqrt deixa o domo mais "cheio" no meio, como um volume de ilustracao.
    const body = Math.sqrt(Math.max(0, dome[i]));
    height[i] = body * volume + (lumSoft[i] - lumBase[i]) * detail;
  }

  // Converte gradiente por pixel em inclinacao. O domo sobe numa rampa de ~2,5
  // raios, entao o ganho acompanha o raio para a borda inclinar ~45 graus em
  // qualquer resolucao de folha.
  const gain = rVolume * 2.2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const xl = height[y * w + Math.max(0, x - 1)];
      const xr = height[y * w + Math.min(w - 1, x + 1)];
      const yu = height[Math.max(0, y - 1) * w + x];
      const yd = height[Math.min(h - 1, y + 1) * w + x];
      let nx = -(xr - xl) * .5 * gain;
      let ny = -(yd - yu) * .5 * gain;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const j = i * 4;
      d[j] = Math.round((nx * .5 + .5) * 255);
      d[j + 1] = Math.round((ny * .5 + .5) * 255);
      d[j + 2] = Math.round((nz * .5 + .5) * 255);
      d[j + 3] = Math.round(alpha[i] * 255);
    }
  }
  g.putImageData(px, 0, 0);
  return c;
}

/** Tenta um normal map pintado a mao antes de gerar. */
export function loadAuthoredNormal(src) {
  return new Promise(resolve => {
    const alt = src.replace(/\.png$/i, '_n.png');
    if (alt === src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = alt;
  });
}

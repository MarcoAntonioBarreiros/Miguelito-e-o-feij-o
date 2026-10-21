// LUGARES DA FAZENDINHA (sem DOM nem WebGL: o estado e os testes usam isto)
//
// Coordenadas da cena 1920 x 1080. Cada lugar aceita um tipo de item:
//   casa    casas e galpoes, na linha da casa (fundo, a esquerda da lavoura)
//   arvore  arvores
//   objeto  objetos do meio do campo (tambem aceita os pequenos)
//   pequeno enfeites na frente, abaixo do lago (so ate ~1,5 m)

export const FARM_SLOTS = Object.freeze([
  { kind: 'casa', x: 600, y: 690 },
  { kind: 'casa', x: 845, y: 678 },
  { kind: 'casa', x: 1400, y: 644 },
  { kind: 'arvore', x: 230, y: 806 },
  { kind: 'arvore', x: 1750, y: 792 },
  { kind: 'arvore', x: 70, y: 718 },
  { kind: 'arvore', x: 1880, y: 712 },
  { kind: 'arvore', x: 1130, y: 642 },
  { kind: 'objeto', x: 470, y: 762 },
  { kind: 'objeto', x: 700, y: 750 },
  { kind: 'objeto', x: 930, y: 740 },
  { kind: 'objeto', x: 1150, y: 762 },
  { kind: 'objeto', x: 1410, y: 772 },
  { kind: 'objeto', x: 1640, y: 760 },
  { kind: 'pequeno', x: 600, y: 900 },
  { kind: 'pequeno', x: 800, y: 908 },
  { kind: 'pequeno', x: 1000, y: 898 },
  { kind: 'pequeno', x: 1200, y: 906 },
  { kind: 'pequeno', x: 1400, y: 896 },
].map(Object.freeze));

export const FARM_SLOT_COUNT = FARM_SLOTS.length;

/** O lugar `slotKind` aceita um item do tipo `itemKind`? */
export function slotAccepts(slotKind, itemKind) {
  return slotKind === itemKind || (slotKind === 'objeto' && itemKind === 'pequeno');
}

// Perspectiva: o tamanho cresce a partir de y = 540 e vale 1 em y = 900
// (frente do lago). 80 px de cena por metro em escala 1: a casa de pedra
// (4,6 m) fica do tamanho que tinha no cenario fixo.
export const PX_PER_METER = 80;
export function perspectiveAt(y) {
  return Math.max(.08, (y - 540) / 360);
}

/** Retangulo do item na cena ([x, y, w, h]), com a base pousada no lugar. */
export function itemSceneRect(slot, item) {
  const h = item.meters * PX_PER_METER * perspectiveAt(slot.y);
  const w = h * item.w / item.h;
  return [slot.x - w / 2, slot.y - h * .97, w, h];
}

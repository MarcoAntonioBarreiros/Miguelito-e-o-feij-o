// Catalogo da lojinha da fazendinha: itens com arte propria (assets/farm/itens),
// separados por tipo de lugar (farm-layout.js). A lista fica em farm-catalog.js.

import { FARM_CATALOG } from './farm-catalog.js';

export const FARM_ITEMS = FARM_CATALOG;

// abas da lojinha, na ordem
export const FARM_TABS = Object.freeze([
  { kind: 'casa', label: 'Casas' },
  { kind: 'arvore', label: 'Árvores' },
  { kind: 'objeto', label: 'Objetos' },
  { kind: 'pequeno', label: 'Enfeites' },
]);

const BY_ID = new Map(FARM_ITEMS.map(item => [item.id, item]));

// itens da primeira versao (arte em canvas) -> equivalentes com arte nova
export const LEGACY_ITEM_IDS = Object.freeze({
  fence: 'cerca-madeira-baixa',
  'water-tank': 'caixa-agua-azul',
  nursery: 'viveiro-pequeno',
});

export function getFarmItem(id) {
  return BY_ID.get(LEGACY_ITEM_IDS[id] || id) || null;
}

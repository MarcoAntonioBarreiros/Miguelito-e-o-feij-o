import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankFarm, buyItem, canBuy, collectHarvests, FARM_STORAGE_KEY, harvestIdFor, loadFarm, pendingCoins, pickUpItem,
  placeItem, registerHarvest, saveFarm,
} from '../src/farm/farm-state.js';
import { FARM_ITEMS } from '../src/farm/farm-items.js';
import { FARM_SLOTS } from '../src/farm/farm-layout.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
}

test('cada fase planta uma vez so; as moedas entram quando a colheitadeira colhe', () => {
  const storage = memoryStorage();
  const id = harvestIdFor('seed-x', 3);
  let farm = loadFarm(storage);
  assert.equal(registerHarvest(farm, { harvestId: id, coins: 83, score: 83 }).registered, true);
  assert.equal(farm.coins, 0, 'plantar nao paga');
  saveFarm(farm, storage);
  farm = loadFarm(storage); // "recarregou a pagina"
  assert.equal(registerHarvest(farm, { harvestId: id, coins: 83, score: 83 }).registered, false);
  registerHarvest(farm, { harvestId: harvestIdFor('seed-x', 4), coins: 50, score: 50 });
  assert.equal(pendingCoins(farm), 133);
  const result = collectHarvests(farm);
  assert.deepEqual([result.coins, result.count, result.score], [133, 2, 50]);
  assert.equal(farm.coins, 133);
  assert.equal(collectHarvests(farm).coins, 0, 'colher de novo nao paga');
  assert.ok(storage.data.has(FARM_STORAGE_KEY));
});

test('registro antigo (sem collected) conta como ja pago', () => {
  const storage = memoryStorage();
  storage.setItem(FARM_STORAGE_KEY, JSON.stringify({ coins: 16, harvests: { 'a:fase-2': { coins: 16 } } }));
  const farm = loadFarm(storage);
  assert.equal(pendingCoins(farm), 0);
  assert.equal(farm.coins, 16);
});

test('loja: catalogo com arte, compra com moedas e lugares por tipo', () => {
  assert.ok(FARM_ITEMS.length > 100);
  assert.equal(new Set(FARM_ITEMS.map(item => item.id)).size, FARM_ITEMS.length, 'ids unicos');
  for (const item of FARM_ITEMS) {
    assert.ok(['casa', 'arvore', 'objeto', 'pequeno'].includes(item.kind), item.id);
    assert.ok(item.price > 0 && item.meters > 0 && item.src.startsWith('itens/'), item.id);
  }
  const casas = FARM_SLOTS.filter(slot => slot.kind === 'casa').length;
  const farm = blankFarm();
  assert.equal(farm.slots.length, FARM_SLOTS.length);
  assert.equal(canBuy(farm, 'casarao').reason, 'coins');
  farm.coins = 10000;
  for (let i = 0; i < casas; i++) assert.equal(buyItem(farm, 'casa-laranja').ok, true);
  assert.equal(buyItem(farm, 'casa-laranja').reason, 'no-space', 'acabaram os lugares de casa');
  assert.equal(buyItem(farm, 'macieira').ok, true, 'arvore tem lugar proprio');
  const casaSlot = FARM_SLOTS.findIndex(slot => slot.kind === 'casa');
  const arvoreSlot = FARM_SLOTS.findIndex(slot => slot.kind === 'arvore');
  assert.equal(placeItem(farm, arvoreSlot, 'casa-laranja'), false, 'casa nao vai em lugar de arvore');
  assert.equal(placeItem(farm, casaSlot, 'casa-laranja'), true);
  assert.equal(placeItem(farm, casaSlot, 'casa-laranja'), false, 'lugar ocupado');
  assert.equal(placeItem(farm, 99, 'macieira'), false);
  assert.equal(placeItem(farm, arvoreSlot, 'macieira'), true);
  assert.equal(pickUpItem(farm, casaSlot), true);
  assert.equal(farm.inventory[0], 'casa-laranja');
});

test('enfeite pequeno tambem cabe em lugar de objeto', () => {
  const farm = blankFarm();
  farm.coins = 100000;
  const objetos = FARM_SLOTS.filter(slot => slot.kind === 'objeto').length;
  const pequenos = FARM_SLOTS.filter(slot => slot.kind === 'pequeno').length;
  for (let i = 0; i < objetos + pequenos; i++) assert.equal(buyItem(farm, 'balde-metal').ok, true, `balde ${i}`);
  assert.equal(buyItem(farm, 'balde-metal').reason, 'no-space');
  assert.equal(buyItem(farm, 'caixa-agua-azul').reason, 'no-space', 'os baldes ocuparam os lugares de objeto');
  const objetoSlot = FARM_SLOTS.findIndex(slot => slot.kind === 'objeto');
  const pequenoSlot = FARM_SLOTS.findIndex(slot => slot.kind === 'pequeno');
  assert.equal(placeItem(farm, objetoSlot, 'balde-metal'), true);
  assert.equal(placeItem(farm, pequenoSlot, 'balde-metal'), true);
});

test('estado salvo e restaurado; save da primeira versao vira "sem lugar"; lixo nao quebra', () => {
  const storage = memoryStorage();
  const farm = blankFarm(); farm.coins = 70; buyItem(farm, 'caixa-agua-azul');
  const slot = FARM_SLOTS.findIndex(s => s.kind === 'objeto');
  placeItem(farm, slot, 'caixa-agua-azul');
  saveFarm(farm, storage);
  assert.equal(loadFarm(storage).slots[slot], 'caixa-agua-azul');
  storage.setItem(FARM_STORAGE_KEY, JSON.stringify({ version: 1, coins: 5, slots: [null, 'water-tank', 'fence', null], inventory: ['nursery'] }));
  const old = loadFarm(storage);
  assert.deepEqual(old.inventory.sort(), ['caixa-agua-azul', 'cerca-madeira-baixa', 'viveiro-pequeno']);
  assert.equal(old.slots.filter(Boolean).length, 0);
  storage.setItem(FARM_STORAGE_KEY, '{quebrado');
  assert.deepEqual(loadFarm(storage), blankFarm());
});

test('lavoura: quatro niveis de arte pela nota da colheita', async () => {
  const { fieldLevelFromScore, FIELD_ART } = await import('../src/farm/bean-field.js');
  assert.equal(fieldLevelFromScore(0), 0);
  assert.equal(fieldLevelFromScore(34.9), 0);
  assert.equal(fieldLevelFromScore(35), 1);
  assert.equal(fieldLevelFromScore(59), 1);
  assert.equal(fieldLevelFromScore(60), 2);
  assert.equal(fieldLevelFromScore(84), 2);
  assert.equal(fieldLevelFromScore(85), 3);
  assert.equal(fieldLevelFromScore(undefined), 2);
  assert.equal(FIELD_ART.length, 4);
});

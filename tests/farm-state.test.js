import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankFarm, buyItem, canBuy, collectHarvests, FARM_STORAGE_KEY, harvestIdFor, loadFarm, pendingCoins, pickUpItem,
  placeItem, registerHarvest, saveFarm,
} from '../src/farm/farm-state.js';
import { FARM_ITEMS } from '../src/farm/farm-items.js';

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

test('loja: 3 itens, compra com moedas, 4 espacos', () => {
  assert.equal(FARM_ITEMS.length, 3);
  const farm = blankFarm();
  assert.equal(canBuy(farm, 'fence').reason, 'coins');
  farm.coins = 1000;
  for (let i = 0; i < 4; i++) assert.equal(buyItem(farm, 'fence').ok, true);
  assert.equal(buyItem(farm, 'fence').reason, 'no-space');
  assert.equal(farm.coins, 1000 - 4 * 30);
  assert.equal(placeItem(farm, 0), true);
  assert.equal(placeItem(farm, 0), false, 'espaco ocupado');
  assert.equal(placeItem(farm, 9), false);
  assert.deepEqual(farm.slots, ['fence', null, null, null]);
  assert.equal(pickUpItem(farm, 0), true);
  assert.equal(placeItem(farm, 3), true);
  assert.equal(farm.slots[3], 'fence');
});

test('estado salvo e restaurado; lixo no storage nao quebra', () => {
  const storage = memoryStorage();
  const farm = blankFarm(); farm.coins = 70; buyItem(farm, 'water-tank'); placeItem(farm, 2);
  saveFarm(farm, storage);
  assert.deepEqual(loadFarm(storage).slots, [null, null, 'water-tank', null]);
  storage.setItem(FARM_STORAGE_KEY, '{quebrado');
  assert.deepEqual(loadFarm(storage), blankFarm());
});

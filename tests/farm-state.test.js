import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankFarm, buyItem, canBuy, creditHarvest, FARM_STORAGE_KEY, harvestIdFor, loadFarm, pickUpItem, placeItem, saveFarm,
} from '../src/farm/farm-state.js';
import { FARM_ITEMS } from '../src/farm/farm-items.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
}

test('cada colheita paga uma vez so (recarga nao duplica)', () => {
  const storage = memoryStorage();
  const id = harvestIdFor('seed-x', 3);
  let farm = loadFarm(storage);
  assert.equal(creditHarvest(farm, { harvestId: id, coins: 83, score: 83 }).credited, true);
  saveFarm(farm, storage);
  farm = loadFarm(storage); // "recarregou a pagina"
  assert.equal(creditHarvest(farm, { harvestId: id, coins: 83, score: 83 }).credited, false);
  assert.equal(farm.coins, 83);
  assert.equal(creditHarvest(farm, { harvestId: harvestIdFor('seed-x', 4), coins: 50 }).credited, true);
  assert.equal(farm.coins, 133);
  assert.ok(storage.data.has(FARM_STORAGE_KEY));
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

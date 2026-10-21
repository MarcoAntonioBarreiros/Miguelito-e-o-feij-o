// ESTADO DA FAZENDINHA (moedas, compras, slots e colheitas ja creditadas)
//
// A campanha mora no sessionStorage; a fazendinha precisa durar entre sessoes,
// entao fica no localStorage, em chave propria. Cada fase concluida credita as
// moedas UMA vez: a colheita tem um id (campanha + fase) e um id repetido nao
// paga de novo, mesmo recarregando a pagina no meio do fim de fase.

import { FARM_SLOT_COUNT, getFarmItem } from './farm-items.js';

export const FARM_STORAGE_KEY = 'miguelito:farm:v1';

export function blankFarm() {
  return {
    version: 1,
    coins: 0,
    totalEarned: 0,
    harvests: {},
    // itens comprados ainda sem lugar (ids do catalogo)
    inventory: [],
    // o que esta em cada espaco de melhoria (id do catalogo ou null)
    slots: Array(FARM_SLOT_COUNT).fill(null),
    lastHarvest: null,
  };
}

function sanitize(raw) {
  const farm = blankFarm();
  if (!raw || typeof raw !== 'object') return farm;
  farm.coins = Math.max(0, Math.floor(Number(raw.coins) || 0));
  farm.totalEarned = Math.max(0, Math.floor(Number(raw.totalEarned) || 0));
  farm.harvests = raw.harvests && typeof raw.harvests === 'object' ? { ...raw.harvests } : {};
  farm.inventory = Array.isArray(raw.inventory) ? raw.inventory.filter(id => getFarmItem(id)) : [];
  if (Array.isArray(raw.slots)) {
    farm.slots = Array.from({ length: FARM_SLOT_COUNT }, (_, i) => (getFarmItem(raw.slots[i]) ? raw.slots[i] : null));
  }
  farm.lastHarvest = raw.lastHarvest && typeof raw.lastHarvest === 'object' ? { ...raw.lastHarvest } : null;
  return farm;
}

function defaultStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (_) { return null; }
}

export function loadFarm(storage = defaultStorage()) {
  try { return sanitize(JSON.parse(storage?.getItem(FARM_STORAGE_KEY) || 'null')); } catch (_) { return blankFarm(); }
}

export function saveFarm(farm, storage = defaultStorage()) {
  try { storage?.setItem(FARM_STORAGE_KEY, JSON.stringify(farm)); return true; } catch (_) { return false; }
}

/** Id da colheita: a mesma fase da mesma campanha nunca paga duas vezes. */
export function harvestIdFor(campaignSeed, phaseNumber) {
  return `${campaignSeed}:fase-${phaseNumber}`;
}

/**
 * Credita a colheita de uma fase. Devolve { credited, coins }: `credited` falso
 * quando esse id ja foi pago (recarga, fase repetida).
 */
export function creditHarvest(farm, { harvestId, coins, score = null, phase = null, at = Date.now() }) {
  if (!harvestId) return { credited: false, coins: 0 };
  if (farm.harvests[harvestId]) return { credited: false, coins: farm.harvests[harvestId].coins || 0 };
  const amount = Math.max(0, Math.round(Number(coins) || 0));
  farm.harvests[harvestId] = { coins: amount, score, phase, at };
  farm.coins += amount;
  farm.totalEarned += amount;
  farm.lastHarvest = { harvestId, coins: amount, score, phase };
  return { credited: true, coins: amount };
}

export function itemCount(farm) {
  return farm.inventory.length + farm.slots.filter(Boolean).length;
}

/** Pode comprar se tem moedas e ainda ha espaco para o item. */
export function canBuy(farm, itemId) {
  const item = getFarmItem(itemId);
  if (!item) return { ok: false, reason: 'unknown' };
  if (itemCount(farm) >= FARM_SLOT_COUNT) return { ok: false, reason: 'no-space' };
  if (farm.coins < item.price) return { ok: false, reason: 'coins' };
  return { ok: true };
}

export function buyItem(farm, itemId) {
  const check = canBuy(farm, itemId);
  if (!check.ok) return check;
  farm.coins -= getFarmItem(itemId).price;
  farm.inventory.push(itemId);
  return { ok: true };
}

/** Coloca o primeiro item sem lugar (ou `itemId`) no espaco vazio indicado. */
export function placeItem(farm, slotIndex, itemId = farm.inventory[0]) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= FARM_SLOT_COUNT) return false;
  if (farm.slots[slotIndex]) return false;
  const at = farm.inventory.indexOf(itemId);
  if (at < 0) return false;
  farm.inventory.splice(at, 1);
  farm.slots[slotIndex] = itemId;
  return true;
}

/** Tira o item do espaco e devolve para "sem lugar" (para mudar de posicao). */
export function pickUpItem(farm, slotIndex) {
  const itemId = farm.slots[slotIndex];
  if (!itemId) return false;
  farm.slots[slotIndex] = null;
  farm.inventory.unshift(itemId);
  return true;
}


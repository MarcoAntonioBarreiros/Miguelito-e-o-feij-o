// ESTADO DA FAZENDINHA (moedas, compras, slots e colheitas ja creditadas)
//
// A campanha mora no sessionStorage; a fazendinha precisa durar entre sessoes,
// entao fica no localStorage, em chave propria.
//
// Cada fase concluida PLANTA uma lavoura (a nota decide como ela cresce). As
// moedas so entram quando a colheitadeira colhe, na fazendinha. A colheita tem
// um id (campanha + fase): um id repetido nao planta de novo, mesmo recarregando
// a pagina no meio do fim de fase. Colheitas nao colhidas ficam guardadas.

import { getFarmItem } from './farm-items.js';
import { FARM_SLOTS, FARM_SLOT_COUNT, slotAccepts } from './farm-layout.js';

export const FARM_STORAGE_KEY = 'miguelito:farm:v1';

export function blankFarm() {
  return {
    version: 2,
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
  farm.harvests = {};
  if (raw.harvests && typeof raw.harvests === 'object') {
    for (const [id, entry] of Object.entries(raw.harvests)) {
      // registro antigo (sem `collected`) ja tinha pago as moedas
      farm.harvests[id] = { ...entry, collected: entry?.collected !== false };
    }
  }
  const known = id => getFarmItem(id)?.id || null;
  farm.inventory = Array.isArray(raw.inventory) ? raw.inventory.map(known).filter(Boolean) : [];
  const oldSlots = Array.isArray(raw.slots) ? raw.slots.map(known) : [];
  if (raw.version === 2) {
    // item fora do tipo do lugar (catalogo mudou) volta para "sem lugar"
    farm.slots = FARM_SLOTS.map((slot, i) => {
      const id = oldSlots[i];
      if (id && slotAccepts(slot.kind, getFarmItem(id).kind)) return id;
      if (id) farm.inventory.push(id);
      return null;
    });
  } else {
    // primeira versao (4 espacos sem tipo): os itens voltam para "sem lugar"
    farm.inventory.push(...oldSlots.filter(Boolean));
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
 * Planta a colheita de uma fase (sem pagar ainda). Devolve { registered, coins }:
 * `registered` falso quando esse id ja existia (recarga, fase repetida).
 */
export function registerHarvest(farm, { harvestId, coins, score = null, phase = null, at = Date.now() }) {
  if (!harvestId) return { registered: false, coins: 0 };
  if (farm.harvests[harvestId]) return { registered: false, coins: farm.harvests[harvestId].coins || 0 };
  const amount = Math.max(0, Math.round(Number(coins) || 0));
  farm.harvests[harvestId] = { coins: amount, score, phase, at, collected: false };
  farm.lastHarvest = { harvestId, coins: amount, score, phase };
  return { registered: true, coins: amount };
}

export function pendingHarvests(farm) {
  return Object.entries(farm.harvests)
    .filter(([, entry]) => entry.collected === false)
    .map(([harvestId, entry]) => ({ harvestId, ...entry }))
    .sort((a, b) => (a.at || 0) - (b.at || 0));
}

export function pendingCoins(farm) {
  return pendingHarvests(farm).reduce((sum, entry) => sum + (entry.coins || 0), 0);
}

/** A colheitadeira passou: tudo o que estava plantado vira moeda. */
export function collectHarvests(farm) {
  const pending = pendingHarvests(farm);
  const coins = pending.reduce((sum, entry) => sum + (entry.coins || 0), 0);
  for (const entry of pending) farm.harvests[entry.harvestId].collected = true;
  farm.coins += coins;
  farm.totalEarned += coins;
  return { coins, count: pending.length, score: pending.at(-1)?.score ?? null };
}

export function itemCount(farm) {
  return farm.inventory.length + farm.slots.filter(Boolean).length;
}

/**
 * Ainda cabe um item deste tipo? Conta os lugares livres de cada tipo menos
 * os itens comprados que esperam lugar (pequeno tambem cabe em lugar de objeto).
 */
export function hasSpaceFor(farm, kind) {
  const free = { casa: 0, arvore: 0, objeto: 0, pequeno: 0 };
  FARM_SLOTS.forEach((slot, i) => { if (!farm.slots[i]) free[slot.kind]++; });
  const waiting = { casa: 0, arvore: 0, objeto: 0, pequeno: 0 };
  for (const id of farm.inventory) waiting[getFarmItem(id).kind]++;
  waiting[kind]++;
  if (waiting.casa > free.casa || waiting.arvore > free.arvore || waiting.objeto > free.objeto) return false;
  return waiting.pequeno <= free.pequeno + (free.objeto - waiting.objeto);
}

/** Pode comprar se tem moedas e ainda ha lugar livre para o item. */
export function canBuy(farm, itemId) {
  const item = getFarmItem(itemId);
  if (!item) return { ok: false, reason: 'unknown' };
  if (!hasSpaceFor(farm, item.kind)) return { ok: false, reason: 'no-space' };
  if (farm.coins < item.price) return { ok: false, reason: 'coins' };
  return { ok: true };
}

export function buyItem(farm, itemId) {
  const check = canBuy(farm, itemId);
  if (!check.ok) return check;
  const item = getFarmItem(itemId);
  farm.coins -= item.price;
  farm.inventory.push(item.id);
  return { ok: true };
}

/** O item pode ir para este lugar (livre e do tipo certo)? */
export function canPlace(farm, slotIndex, itemId) {
  const slot = FARM_SLOTS[slotIndex];
  const item = getFarmItem(itemId);
  return Boolean(slot && item && !farm.slots[slotIndex] && slotAccepts(slot.kind, item.kind));
}

/** Coloca o primeiro item sem lugar (ou `itemId`) no lugar indicado. */
export function placeItem(farm, slotIndex, itemId = farm.inventory[0]) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= FARM_SLOT_COUNT) return false;
  const at = farm.inventory.indexOf(itemId);
  if (at < 0 || !canPlace(farm, slotIndex, itemId)) return false;
  farm.inventory.splice(at, 1);
  farm.slots[slotIndex] = itemId;
  return true;
}

/** Tira o item do lugar e devolve para "sem lugar" (para mudar de posicao). */
export function pickUpItem(farm, slotIndex) {
  const itemId = farm.slots[slotIndex];
  if (!itemId) return false;
  farm.slots[slotIndex] = null;
  farm.inventory.unshift(itemId);
  return true;
}

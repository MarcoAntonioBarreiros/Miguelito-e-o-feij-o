#!/usr/bin/env node
// Exporta uma cena real do jogo (fase + trecho) para a prova de conceito Unity.
//
// Gera, a partir do proprio jogo rodando no navegador:
//   level.json      plataformas, exsudatos, checkpoints e organismos do trecho
//   terrain_XX.png  terreno desenhado por platform-visuals (fatias de 2048 px)
//
// Uso (servidor HTTP na raiz do repositorio, porta 8123):
//   node experimental/2_5d/tools/export-scene.cjs <saida> [fase] [x0] [x1]
//
// CHROME_PATH aponta o navegador; padrao: Chromium do Playwright.
const fs = require('node:fs');
const path = require('node:path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (_) { puppeteer = require('/opt/npm-tools/node_modules/puppeteer'); }

const [outDir = 'scene-export', phaseArg = '4', x0Arg = '0', x1Arg = '4200'] = process.argv.slice(2);
const phase = Number(phaseArg);
const X0 = Number(x0Arg), X1 = Number(x1Arg);
const TILE = 2048;
const base = process.env.GAME_URL || 'http://127.0.0.1:8123/index.html';

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument(ph => {
    sessionStorage.setItem('miguelito:campaign:v2', JSON.stringify({
      seed: 'poc-seed', phase: ph,
      unlocks: { doubleJump: true, dash: true, pulse: true, jetpack: true },
      totalScore: 0, history: [], narrationSeen: [],
    }));
  }, phase);
  await page.goto(`${base}?render=25d&painel=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.miguelitoExportTerrain && window.miguelitoSim?.state?.level?.platforms?.length, { timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const data = await page.evaluate(({ X0, X1 }) => {
    const st = window.miguelitoSim.state;
    const L = st.level;
    const inRange = o => Number.isFinite(o?.x) && o.x + (o.w || 0) >= X0 - 200 && o.x <= X1 + 200;
    const plats = L.platforms.filter(p => !p.recovery && inRange(p));
    const ys = plats.flatMap(p => [p.y, p.y + p.h]);
    const sizes = { rhizobium: 90 * .72, azospirillum: 83 * .78, bacillus: 55 * .7, pseudomonas: 92 * .7,
      trichoderma: 77 * .84, myco: 75 * .8, oportunista: 115 * .82, rhizoctonia: 105 * .8 };
    return {
      phase: st.campaign?.phase, seed: L.seed ?? null, title: L.phaseTitle ?? null,
      x0: X0, x1: X1,
      top: Math.min(...ys), bottom: Math.max(...ys),
      platforms: plats.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h, type: p.type, oneWay: Boolean(p.oneWay || p.mycorrhizaStructure) })),
      exudates: (L.exudates || []).filter(inRange).map(e => ({ x: e.x, y: e.y })),
      checkpoints: (L.checkpoints || []).filter(inRange).map(c => ({ x: c.x, y: c.y })),
      hazards: (L.hazards || []).filter(inRange).map(h => ({ x: h.x, y: h.y, w: h.w, h: h.h })),
      agents: (window.miguelitoSim.ecology?.agents || []).filter(inRange).map(a => ({
        type: a.type, x: a.x, y: a.y, size: a.size || 1, height: (sizes[a.type] || 60) * (a.size || 1),
        homeX: a.homeX ?? a.x, homeY: a.homeY ?? a.y, radius: a.radius ?? 120, phase: a.phase || 0,
      })),
      player: { x: 100, y: 400, w: st.player.w, h: st.player.h },
    };
  }, { X0, X1 });

  const y0 = Math.floor(data.top - 260);
  const height = Math.ceil(data.bottom + 200 - y0);
  data.terrain = { y0, height, tiles: [] };
  for (let x = X0; x < X1; x += TILE) {
    const width = Math.min(TILE, X1 - x);
    const url = await page.evaluate(args => window.miguelitoExportTerrain(args), { x0: x, y0, width, height });
    const name = `terrain_${String(data.terrain.tiles.length).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(outDir, name), Buffer.from(url.split(',')[1], 'base64'));
    data.terrain.tiles.push({ file: name, x, width });
  }
  fs.writeFileSync(path.join(outDir, 'level.json'), JSON.stringify(data, null, 1));
  console.log(`fase ${data.phase}: ${data.platforms.length} plataformas, ${data.agents.length} organismos, ${data.terrain.tiles.length} fatias de terreno`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

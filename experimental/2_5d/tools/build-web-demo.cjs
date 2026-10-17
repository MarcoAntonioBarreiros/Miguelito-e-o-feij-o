#!/usr/bin/env node
// Gera uma versao publicavel da demonstracao 2,5D: um unico bundle JS
// (jogo + renderizador 2,5D + Three.js) e um index.html com o 2,5D ligado por
// padrao e a skin do Miguelito. Os assets continuam os originais.
//
//   node experimental/2_5d/tools/build-web-demo.cjs [saida]
//
// Precisa do esbuild (npx esbuild ou instalado globalmente).
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../..');
const outArg = process.argv.slice(2).find(a => !a.startsWith('--'));
const out = path.resolve(outArg || path.join(root, 'experimental/2_5d/web-demo'));
fs.mkdirSync(out, { recursive: true });

const entry = path.join(out, '.entry.js');
fs.writeFileSync(entry, [
  `import ${JSON.stringify(path.join(root, 'src/procgen/app.js'))};`,
  `import ${JSON.stringify(path.join(root, 'src/procgen/mobile-controls.js'))};`,
].join('\n'));
const esbuild = process.env.ESBUILD || 'esbuild';
execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--minify', '--target=es2020',
  `--outfile=${path.join(out, 'game-25d.bundle.js')}`], { stdio: 'inherit' });
fs.rmSync(entry);

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script type="module" src="\.\/src\/procgen\/app\.js[^"]*"><\/script>\s*/, '')
  .replace(/<script type="module" src="\.\/src\/procgen\/mobile-controls\.js[^"]*"><\/script>/,
    `<script>
  // Demonstracao: 2,5D por padrao (?render=2d volta ao original) e skin do Miguelito.
  window.MIGUELITO_RENDER_25D_DEFAULT = true;
  try { if (!localStorage.getItem('miguelito:player-skin:v1')) localStorage.setItem('miguelito:player-skin:v1', 'miguelito'); } catch (_) {}
  </script>
  <script type="module" src="./game-25d.bundle.js"></script>`);
html = html.replace(/<title>[^<]*<\/title>/, '<title>Miguelito 2,5D</title>');
// --artifact: sem as tags de documento (a pagina publicada ganha o esqueleto na hora)
if (process.argv.includes('--artifact')) {
  html = html.replace(/<!DOCTYPE html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
    .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body[^>]*>\s*/i, '').replace(/<\/body>\s*/i, '')
    .replace(/<meta charset="utf-8">\s*/i, '');
}
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.mkdirSync(path.join(out, 'src/procgen'), { recursive: true });
fs.copyFileSync(path.join(root, 'src/procgen/tutorial-overlay.css'), path.join(out, 'src/procgen/tutorial-overlay.css'));
console.log('demo em', out, '— sirva a pasta junto com assets/ na raiz do repositorio');

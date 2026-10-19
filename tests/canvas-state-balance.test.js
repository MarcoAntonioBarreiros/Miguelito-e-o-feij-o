import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// Um ctx.restore() sem o save() correspondente desempilha a camera de quem
// chamou: tudo o que e desenhado depois sai sem zoom e sem a altura da camera.
// Era o biofilme "solto no ar" que acompanhava o pulo (controles do
// Trichoderma) e, antes, exsudatos e organismos deslocados (Ralstonia).
// Conferencia simples: em cada modulo de desenho, save() e restore() batem.
const DIRS = ['src/procgen', 'src/render'];
// Retornos antecipados que fecham o proprio save() (um save, dois restore).
const EARLY_EXITS = { 'src/render/vfx-particles.js': 1 };

test('save() e restore() equilibrados nos modulos de desenho', () => {
  const unbalanced = [];
  for (const dir of DIRS) {
    for (const name of readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const file = `${dir}/${name}`;
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      const saves = (src.match(/\.save\(\)/g) || []).length;
      const restores = (src.match(/\.restore\(\)/g) || []).length;
      if (saves !== restores - (EARLY_EXITS[file] || 0)) unbalanced.push(`${file}: ${saves} save, ${restores} restore`);
    }
  }
  assert.deepEqual(unbalanced, []);
});

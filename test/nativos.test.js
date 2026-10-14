import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { procurarNativos } from '../scripts/lib/nativos.js';

function montar() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nativos-'));
  const pkg = (nome, json, arquivos = {}) => {
    const dir = path.join(base, ...nome.split('/'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: nome, version: '1.0.0', ...json }));
    for (const [rel, conteudo] of Object.entries(arquivos)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), conteudo);
    }
  };
  pkg('puro', {});
  pkg('com-gyp', { gypfile: true }, { 'binding.gyp': '{}' });
  pkg('com-script', { scripts: { install: 'node-gyp rebuild' } });
  pkg('com-binario', {}, { 'prebuilds/linux-x64/x.node': 'bin' });
  pkg('@escopo/nativo', { gypfile: true });
  pkg('.bin', {});
  return base;
}

test('acha módulos nativos e ignora puros', () => {
  const achados = procurarNativos(montar());
  assert.deepEqual(achados.map((a) => a.pacote), ['@escopo/nativo', 'com-binario', 'com-gyp', 'com-script']);
  assert.ok(achados.find((a) => a.pacote === 'com-binario').motivos[0].includes('.node'));
});

test('pasta inexistente devolve lista vazia', () => {
  assert.deepEqual(procurarNativos('/nao/existe'), []);
});

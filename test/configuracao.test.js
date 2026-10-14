import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarConfiguracao } from '../src/server/configuracao.js';

const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));

test('salva, lê e remove a chave; o resumo mostra só os 4 últimos caracteres', () => {
  const dir = pasta();
  const c = criarConfiguracao(dir, {});
  assert.equal(c.chaveEuler(), null);
  assert.deepEqual(c.resumoEuler(), { configurada: false, final: null, origem: null });
  c.salvarChaveEuler('  euler_ABCDEFGH1234  ');
  assert.equal(c.chaveEuler(), 'euler_ABCDEFGH1234');
  assert.deepEqual(c.resumoEuler(), { configurada: true, final: '1234', origem: 'app' });
  assert.ok(!JSON.stringify(c.resumoEuler()).includes('ABCDEFGH'));
  // persiste entre instâncias
  assert.equal(criarConfiguracao(dir, {}).chaveEuler(), 'euler_ABCDEFGH1234');
  c.salvarChaveEuler('');
  assert.equal(c.chaveEuler(), null);
});

test('variável EULER_API_KEY vale quando não há chave salva; a salva tem prioridade', () => {
  const c = criarConfiguracao(pasta(), { EULER_API_KEY: 'euler_DOAMBIENTE99' });
  assert.deepEqual(c.resumoEuler(), { configurada: true, final: 'NTE99'.slice(-4), origem: 'EULER_API_KEY' });
  c.salvarChaveEuler('euler_SALVANOAPP77');
  assert.equal(c.chaveEuler(), 'euler_SALVANOAPP77');
  assert.equal(c.resumoEuler().origem, 'app');
});

test('rejeita chave com espaço, aspas ou curta demais', () => {
  const c = criarConfiguracao(pasta(), {});
  for (const ruim of ['abc', 'euler com espaco 123', 'euler_"aspas"123', 'x'.repeat(300)]) {
    assert.throws(() => c.salvarChaveEuler(ruim), (e) => e.code === 'CHAVE_INVALIDA');
  }
});

test('arquivo de configuração corrompido não derruba nada', () => {
  const dir = pasta();
  fs.writeFileSync(path.join(dir, 'config.json'), '{quebrado');
  const c = criarConfiguracao(dir, {});
  assert.equal(c.chaveEuler(), null);
  c.salvarChaveEuler('euler_RECUPERADA01');
  assert.equal(c.chaveEuler(), 'euler_RECUPERADA01');
});

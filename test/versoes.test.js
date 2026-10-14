import test from 'node:test';
import assert from 'node:assert/strict';
import { satisfaz, avaliarEngines, parseVersao } from '../src/server/versoes.js';

test('parseVersao entende v18.20.4 e partes ausentes', () => {
  assert.deepEqual(parseVersao('v18.20.4'), [18, 20, 4]);
  assert.deepEqual(parseVersao('20'), [20, null, null]);
  assert.deepEqual(parseVersao('20.x'), [20, null, null]);
  assert.equal(parseVersao('abc'), null);
});

test('Node 18.20.4 (embutido) não atende ">=20.0.0", mas atende ">=18" e ">=10.0.0"', () => {
  assert.equal(satisfaz('v18.20.4', '>=20.0.0'), false);
  assert.equal(satisfaz('v18.20.4', '>=18'), true);
  assert.equal(satisfaz('v18.20.4', '>=10.0.0'), true);
});

test('faixas com ^, ~, || e espaços', () => {
  assert.equal(satisfaz('v18.20.4', '^18.17.0'), true);
  assert.equal(satisfaz('v18.16.0', '^18.17.0'), false);
  assert.equal(satisfaz('v19.0.0', '^18.17.0'), false);
  assert.equal(satisfaz('v20.11.1', '^20 || ^22'), true);
  assert.equal(satisfaz('v18.20.4', '^20 || ^22'), false);
  assert.equal(satisfaz('v18.20.4', '~18.20.0'), true);
  assert.equal(satisfaz('v18.21.0', '~18.20.0'), false);
  assert.equal(satisfaz('v20.5.0', '>= 18 < 21'), true);
  assert.equal(satisfaz('v22.1.0', '>= 18 < 21'), false);
  assert.equal(satisfaz('v22.22.2', '>=22.0.0'), true);
});

test('comparadores parciais', () => {
  assert.equal(satisfaz('v20.9.0', '<=20'), true);
  assert.equal(satisfaz('v21.0.0', '<=20'), false);
  assert.equal(satisfaz('v18.20.4', '18.x'), true);
  assert.equal(satisfaz('v19.0.0', '18.x'), false);
  assert.equal(satisfaz('v18.20.4', '*'), true);
});

test('avaliarEngines devolve texto claro e tolera ausência/erro', () => {
  assert.equal(avaliarEngines('v18.20.4', '>=20.0.0').ok, false);
  assert.match(avaliarEngines('v18.20.4', '>=20.0.0').texto, /NÃO atende/);
  assert.equal(avaliarEngines('v22.0.0', '>=20.0.0').ok, true);
  assert.equal(avaliarEngines('v18.20.4', undefined).ok, null);
  assert.equal(avaliarEngines('v18.20.4', '??').ok, null);
});

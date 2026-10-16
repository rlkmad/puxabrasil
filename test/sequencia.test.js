import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSequencias } from '../src/engine/sequencia.js';

const ev = (u, q, extra = {}) => ({ usuario: { id: u }, giftId: extra.giftId ?? 'rosa', nome: 'Rosa', quantidade: q, sequencia: true, fimSequencia: false, ...extra });

test('sequência 1, 2, 3, 5 e 5 com fim: o total tem de ser 5 unidades', () => {
  const s = criarSequencias();
  const total = [ev('a', 1), ev('a', 2), ev('a', 3), ev('a', 5), ev('a', 5, { fimSequencia: true })]
    .reduce((soma, e) => soma + s.unidadesNovas(e), 0);
  assert.equal(total, 5);
  assert.equal(s.abertas(), 0, 'a chave é apagada no fim');
});

test('depois do fim, uma nova sequência começa do zero', () => {
  const s = criarSequencias();
  s.unidadesNovas(ev('a', 3, { fimSequencia: true }));
  assert.equal(s.unidadesNovas(ev('a', 2)), 2);
});

test('quantidade menor que a última = nova sequência (conta a quantidade inteira)', () => {
  const s = criarSequencias();
  assert.equal(s.unidadesNovas(ev('a', 4)), 4);
  assert.equal(s.unidadesNovas(ev('a', 2)), 2);
  assert.equal(s.unidadesNovas(ev('a', 3)), 1);
});

test('presente que não é sequência conta uma vez, com a quantidade informada', () => {
  const s = criarSequencias();
  assert.equal(s.unidadesNovas(ev('a', 7, { sequencia: false })), 7);
  assert.equal(s.unidadesNovas(ev('a', 7, { sequencia: false })), 7);
  assert.equal(s.abertas(), 0);
});

test('pessoas e presentes diferentes têm sequências separadas', () => {
  const s = criarSequencias();
  assert.equal(s.unidadesNovas(ev('a', 3)), 3);
  assert.equal(s.unidadesNovas(ev('b', 3)), 3);
  assert.equal(s.unidadesNovas(ev('a', 3, { giftId: 'gg' })), 3);
  assert.equal(s.unidadesNovas(ev('a', 5)), 2);
});

test('quantidade inválida não conta', () => {
  const s = criarSequencias();
  assert.equal(s.unidadesNovas(ev('a', 0)), 0);
  assert.equal(s.unidadesNovas(ev('a', -2)), 0);
  assert.equal(s.unidadesNovas(ev('a', NaN)), 0);
});

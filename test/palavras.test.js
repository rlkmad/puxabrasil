import test from 'node:test';
import assert from 'node:assert/strict';
import { detectarLado, normalizarTexto, palavrasDoTexto } from '../src/engine/palavras.js';
import { PADROES } from '../src/engine/config.js';

const lado = (t) => detectarLado(t, PADROES.lados);

test('normaliza: minúsculas, sem acentos, sem emojis soltos, letras repetidas reduzidas', () => {
  assert.equal(normalizarTexto('LULAAAA!!!'), 'lula');
  assert.equal(normalizarTexto('Flávio 🎉🎉 Bolsonaaaro'), 'flavio bolsonaro');
  assert.deepEqual(palavrasDoTexto('  vai   Lula,  13!  '), ['vai', 'lula', '13']);
  assert.equal(normalizarTexto('2222'), '2222', 'números não são reduzidos');
});

test('palavras do Lula escolhem o lado do Lula', () => {
  for (const t of ['lula', 'LULA', 'Lulaaaa', 'vai lula!', 'vermelho', 'vermelhooo', '13', 'vamos 13!', '🔴', 'time 🔴 vai']) {
    assert.equal(lado(t).lado, 'lula', t);
  }
});

test('palavras do Flávio escolhem o lado do Flávio', () => {
  for (const t of ['flavio', 'Flávio', 'bolsonaro', 'BOLSONARO!!!', 'bolso', 'verde', 'amarelo', 'verde e amarelo', '22', '🟢', '🟡', '🟢🟡']) {
    assert.equal(lado(t).lado, 'flavio', t);
  }
});

test('só vale palavra inteira', () => {
  for (const t of ['luladinho', 'lulinha', '113', '1322', 'bolsonarismo', 'flaviano', 'oi', '', '   ', '🎉']) {
    assert.equal(lado(t).lado, null, `"${t}"`);
    assert.equal(lado(t).ambos, false);
  }
});

test('palavras dos dois lados ao mesmo tempo: ignorado', () => {
  for (const t of ['lula e flavio', 'lula 22', '13 bolsonaro', '🔴🟢', 'vermelho verde']) {
    const r = lado(t);
    assert.equal(r.lado, null, t);
    assert.equal(r.ambos, true, t);
  }
});

test('devolve a palavra da lista (nunca o texto livre) para o feed', () => {
  assert.equal(lado('LULAAAA vai ganhar demais').palavra, 'lula');
  assert.equal(lado('forca bolsonaro hoje').palavra, 'bolsonaro');
});

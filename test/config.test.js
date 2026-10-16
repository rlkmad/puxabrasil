import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validarConfig, PADROES } from '../src/engine/config.js';
import { validarGifts, GIFTS_PADRAO, resolverPresente, EFEITOS, efeitoPorValor } from '../src/engine/efeitos.js';

const ler = (a) => JSON.parse(fs.readFileSync(new URL(`../config/${a}`, import.meta.url), 'utf8'));

test('os arquivos config/game.json e config/gifts.json do app validam sem nenhum aviso', () => {
  const g = validarConfig(ler('game.json'));
  assert.deepEqual(g.avisos, []);
  const p = validarGifts(ler('gifts.json'));
  assert.deepEqual(p.avisos, []);
});

test('config ausente usa os padrões', () => {
  const { config, avisos } = validarConfig(undefined);
  assert.deepEqual(avisos, []);
  assert.equal(config.duracoes.disputaS, PADROES.duracoes.disputaS);
});

test('valores inválidos voltam ao padrão com aviso em português, sem lançar erro', () => {
  const { config, avisos } = validarConfig({ duracoes: { disputaS: -5 }, corda: { meiaVidaS: 'abc' } });
  assert.equal(config.duracoes.disputaS, PADROES.duracoes.disputaS);
  assert.equal(config.corda.meiaVidaS, PADROES.corda.meiaVidaS);
  assert.ok(avisos.length >= 1);
  assert.ok(avisos.every((a) => typeof a === 'string' && a.length > 10));
});

test('config totalmente inválida não derruba o app', () => {
  for (const ruim of [42, 'texto', [], null]) {
    const { config } = validarConfig(ruim);
    assert.ok(config.duracoes.disputaS > 0);
  }
});

test('gifts: efeito desconhecido é ignorado com aviso', () => {
  const { gifts, avisos } = validarGifts({ efeitos: { 'efeito-que-nao-existe': { lula: { nome: 'X', moedas: 1 } } } });
  assert.ok(avisos.some((a) => /desconhecido/i.test(a)));
  assert.equal(gifts.efeitos['efeito-que-nao-existe'], undefined);
});

test('gifts: arquivo inválido volta aos presentes padrão', () => {
  const { gifts, avisos } = validarGifts('lixo');
  assert.equal(avisos.length, 1);
  assert.deepEqual(gifts, GIFTS_PADRAO);
});

test('efeitoPorValor: faixas e valores entre faixas', () => {
  assert.equal(efeitoPorValor(1).id, 'apoiador-vip');
  assert.equal(efeitoPorValor(3).id, 'apoiador-vip');
  assert.equal(efeitoPorValor(5).id, 'rojao');
  assert.equal(efeitoPorValor(7).id, 'rojao');
  assert.equal(efeitoPorValor(10).id, 'trio-eletrico');
  assert.equal(efeitoPorValor(49).id, 'trio-eletrico');
  assert.equal(efeitoPorValor(100).id, 'gelo');
  assert.equal(efeitoPorValor(1000).id, 'dominacao');
  assert.equal(efeitoPorValor(10000).id, 'final-epica');
});

test('presente da tabela define o lado; fora da tabela não define', () => {
  const { gifts } = validarGifts(undefined);
  const a = resolverPresente('Rosa', 1, gifts);
  assert.equal(a.lado, 'lula');
  const b = resolverPresente('Rosa branca', 1, gifts);
  assert.equal(b.lado, 'flavio');
  const c = resolverPresente('GG', 1, gifts); // apelido (alias)
  assert.equal(c.lado, 'flavio');
  const d = resolverPresente('Presente Qualquer', 100, gifts);
  assert.equal(d.lado ?? null, null);
  assert.equal(d.efeito.id, 'gelo');
});

test('os pares de presentes têm o mesmo valor por efeito (simetria da tabela)', () => {
  for (const [id, d] of Object.entries(GIFTS_PADRAO.efeitos)) {
    assert.equal(d.lula.moedas, d.flavio.moedas, `efeito ${id}`);
  }
  assert.equal(EFEITOS.length, 10);
});

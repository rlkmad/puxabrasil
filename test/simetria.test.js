import test from 'node:test';
import assert from 'node:assert/strict';
import { criar, rodar, chat, presente, curtidas, seguir, compartilhar } from './lib/util.js';

// Teste de simetria (seção 4): a mesma sequência de eventos com os times trocados tem de dar o resultado espelhado.
const ESPELHO_PALAVRA = { lula: 'flavio', flavio: 'lula', vermelho: 'verde', verde: 'vermelho', '13': '22', '22': '13', '🔴': '🟢', '🟢': '🔴' };
const ESPELHO_PRESENTE = { 'Rosa': 'Rosa branca', 'Rosa branca': 'Rosa', 'Heart Me': 'Bom jogo (GG)', 'Bom jogo (GG)': 'Heart Me', 'Fogos de artifício': 'Coração com os dedos', 'Coração com os dedos': 'Fogos de artifício' };
const espelhar = (ev) => {
  if (ev.tipo === 'chat') return { ...ev, texto: ESPELHO_PALAVRA[ev.texto] ?? ev.texto };
  if (ev.tipo === 'gift') return { ...ev, nome: ESPELHO_PRESENTE[ev.nome] ?? ev.nome, giftId: ESPELHO_PRESENTE[ev.nome] ?? ev.giftId };
  return ev;
};

/** Gerador pseudoaleatório com semente (mulberry32), para o teste ser repetível. */
function aleatorio(semente) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function roteiro(semente, passos) {
  const rnd = aleatorio(semente);
  const palavras = ['lula', 'flavio', 'vermelho', 'verde', '13', '22', '🔴', '🟢'];
  const presentes = [['Rosa', 1], ['Rosa branca', 1], ['Heart Me', 1], ['Bom jogo (GG)', 1], ['Fogos de artifício', 5], ['Coração com os dedos', 5], ['Leão', 10], ['Universo', 1000]];
  const porPasso = [];
  for (let i = 0; i < passos; i++) {
    const lista = [];
    const n = rnd() < 0.5 ? 0 : 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const id = 1 + Math.floor(rnd() * 60);
      const r = rnd();
      if (r < 0.5) lista.push(chat(id, palavras[Math.floor(rnd() * palavras.length)]));
      else if (r < 0.65) { const [nome, v] = presentes[Math.floor(rnd() * presentes.length)]; lista.push(presente(id, nome, v, 1 + Math.floor(rnd() * 3))); }
      else if (r < 0.85) lista.push(curtidas(id, 1 + Math.floor(rnd() * 30)));
      else if (r < 0.93) lista.push(seguir(id));
      else lista.push(compartilhar(id));
    }
    porPasso.push(lista);
  }
  return porPasso;
}

function comparar(semente, mudanca = {}) {
  const A = criar(mudanca); const B = criar(mudanca);
  A.motor.iniciar(); B.motor.iniciar();
  const passos = roteiro(semente, 4000); // 400 s de jogo, cerca de 3 rodadas
  for (const lista of passos) {
    for (const ev of lista) { A.motor.processarEvento(ev); B.motor.processarEvento(espelhar(ev)); }
    rodar(A, 100); rodar(B, 100);
    const a = A.motor.estado(); const b = B.motor.estado();
    assert.equal(a.fase.nome, b.fase.nome, 'mesma fase');
    assert.ok(Math.abs(a.corda.P - (100 - b.corda.P)) < 0.11, `P ${a.corda.P} x ${b.corda.P}`);
    assert.ok(Math.abs(a.placar.rodada.lula - b.placar.rodada.flavio) < 0.11);
    assert.ok(Math.abs(a.placar.rodada.flavio - b.placar.rodada.lula) < 0.11);
    assert.equal(a.placar.live.lula, b.placar.live.flavio);
    assert.equal(a.placar.live.flavio, b.placar.live.lula);
    assert.equal(a.corda.zebra, b.corda.zebra === null ? null : (b.corda.zebra === 'lula' ? 'flavio' : 'lula'));
    assert.equal(a.barra.valor, b.barra.valor);
  }
  const ra = A.motor.rodadas; const rb = B.motor.rodadas;
  assert.equal(ra.length, rb.length);
  assert.ok(ra.length >= 2, 'rodou ao menos 2 rodadas completas');
  ra.forEach((r, i) => {
    assert.equal(r.como, rb[i].como);
    assert.equal(r.vencedor, rb[i].vencedor === null ? null : (rb[i].vencedor === 'lula' ? 'flavio' : 'lula'));
    assert.equal(r.participantes, rb[i].participantes);
    assert.ok(Math.abs(r.pontos.lula - rb[i].pontos.flavio) < 0.11);
    assert.deepEqual(r.moedas, { lula: rb[i].moedas.flavio, flavio: rb[i].moedas.lula });
  });
}

test('simetria: os mesmos eventos com os times trocados dão o resultado espelhado (3 sementes)', () => {
  for (const semente of [1, 7, 2026]) comparar(semente);
});

test('simetria também com Zebra e Barra da Virada mais sensíveis', () => {
  comparar(99, { zebra: { tempoS: 1, distancia: 20 }, barraVirada: { meta: 60 } });
});

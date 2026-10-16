import test from 'node:test';
import assert from 'node:assert/strict';
import { criar, rodar, ate, chat, presente, curtidas } from './lib/util.js';

const pts = (ctx, lado = 'lula') => ctx.motor.estado().placar.rodada[lado];

test('intervalo de 1,5 s entre comentários que contam', () => {
  const ctx = criar(); ate(ctx, 'disputa'); rodar(ctx, 1000);
  ctx.motor.processarEvento(chat(1, 'lula'));
  rodar(ctx, 1000);
  ctx.motor.processarEvento(chat(1, 'vermelho')); // 1 s depois: ignorado
  assert.equal(pts(ctx), 1);
  rodar(ctx, 600);
  ctx.motor.processarEvento(chat(1, '13')); // 1,6 s depois: conta
  assert.equal(pts(ctx), 2);
});

test('máximo de 60 pontos por minuto vindos de comentários', () => {
  const ctx = criar({ limites: { comentarioIntervaloS: 0, comentarioRepetidoS: 0 } }); ate(ctx, 'disputa');
  for (let i = 0; i < 100; i++) { ctx.motor.processarEvento(chat(1, 'lula')); rodar(ctx, 100); }
  assert.equal(pts(ctx), 60, 'em 10 s só 60 pontos');
  rodar(ctx, 55_000);
  ctx.motor.processarEvento(chat(1, 'lula'));
  assert.ok(pts(ctx) > 60, 'depois de 1 minuto libera de novo');
});

test('comentário repetido igual da mesma pessoa em menos de 5 s é ignorado', () => {
  const ctx = criar({ limites: { comentarioIntervaloS: 0 } }); ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat(1, 'LULA!!'));
  rodar(ctx, 2000);
  ctx.motor.processarEvento(chat(1, 'lula')); // mesmo texto normalizado
  assert.equal(pts(ctx), 1);
  rodar(ctx, 3500);
  ctx.motor.processarEvento(chat(1, 'lula')); // ainda a menos de 5 s da repetição anterior: quem insiste não passa
  assert.equal(pts(ctx), 1);
  rodar(ctx, 5100);
  ctx.motor.processarEvento(chat(1, 'lula'));
  assert.equal(pts(ctx), 2);
});

test('comentário com palavras dos dois lados é ignorado', () => {
  const ctx = criar(); ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat(1, 'lula e flavio'));
  assert.equal(pts(ctx) + pts(ctx, 'flavio'), 0);
});

test('trocar de lado por comentário só a cada 20 s; presente sempre vale para o lado do presente', () => {
  const ctx = criar({ limites: { comentarioIntervaloS: 0 } }); ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat(1, 'lula'));
  rodar(ctx, 6000);
  ctx.motor.processarEvento(chat(1, 'flavio'));
  assert.equal(pts(ctx, 'flavio'), 0, 'troca antes de 20 s é ignorada');
  ctx.motor.processarEvento(presente(1, 'Rosa branca', 1, 1));
  assert.equal(pts(ctx, 'flavio'), 3, 'o presente vale na hora');
  rodar(ctx, 21_000);
  ctx.motor.processarEvento(chat(1, 'lula'));
  assert.equal(pts(ctx, 'lula'), 2, 'depois de 20 s da troca pode voltar');
});

test('curtidas: 0,1 ponto cada e no máximo 20 pontos por minuto por pessoa', () => {
  const ctx = criar(); ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat(1, 'lula'));
  const base = pts(ctx);
  ctx.motor.processarEvento(curtidas(1, 50));
  assert.ok(Math.abs(pts(ctx) - base - 5) < 1e-9);
  ctx.motor.processarEvento(curtidas(1, 1000));
  assert.ok(Math.abs(pts(ctx) - base - 20) < 1e-9, 'limite de 20 pontos por minuto');
});

test('presentes não têm limite', () => {
  const ctx = criar(); ate(ctx, 'disputa');
  for (let i = 0; i < 50; i++) ctx.motor.processarEvento(presente(1, 'Rosa', 1, 10));
  assert.equal(pts(ctx), 1500);
});

test('Resultado e Abertura: o lado é guardado, mas ninguém pontua', () => {
  const ctx = criar(); ctx.motor.iniciar();
  ctx.motor.processarEvento(chat(1, 'lula'));
  ctx.motor.processarEvento(presente(2, 'Rosa', 1, 5));
  assert.equal(pts(ctx), 0);
  rodar(ctx, 6000); // entra na Disputa
  ctx.motor.processarEvento(curtidas(1, 10)); // o lado Lula ficou guardado, então a curtida vira ponto
  assert.ok(pts(ctx) > 0);
});

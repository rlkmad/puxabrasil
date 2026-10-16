import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarJogo } from '../src/server/jogo.js';
import { executarSimulador } from '../src/server/simulador-api.js';
import { validarConfig } from '../src/engine/config.js';
import { validarGifts } from '../src/engine/efeitos.js';
import { relogioFalso, chat } from './lib/util.js';

function novo(mudar) {
  const { config } = validarConfig(mudar);
  const { gifts } = validarGifts(undefined);
  const relogio = relogioFalso();
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'puxa-jogo-'));
  const difundidos = [];
  const jogo = criarJogo({ config, gifts, pastaDados: pasta, difundir: (m) => difundidos.push(m), relogio });
  return { jogo, relogio, pasta, difundidos };
}
const rodarCiclos = (ctx, n) => { for (let i = 0; i < n; i++) { ctx.relogio.avancar(100); ctx.jogo.ciclo(); } };

test('ciclo difunde o estado (e só o estado completo) a cada 100 ms', () => {
  const ctx = novo();
  ctx.jogo.comando('iniciar');
  rodarCiclos(ctx, 5);
  const estados = ctx.difundidos.filter((m) => m.tipo === 'estado');
  assert.equal(estados.length, 5);
  assert.equal(estados[0].sessao.status, 'rodando');
});

test('eventos do simulador entram na fila e chegam ao motor', () => {
  const ctx = novo();
  ctx.jogo.comando('iniciar');
  rodarCiclos(ctx, 60); // passa da abertura (5 s)
  executarSimulador(ctx.jogo, { acao: 'comentar', lado: 'lula', usuario: 'ana' });
  executarSimulador(ctx.jogo, { acao: 'comentar', lado: 'flavio', usuario: 'beto' });
  rodarCiclos(ctx, 2);
  const e = ctx.jogo.motor.estado();
  assert.equal(e.placar.apoiadores.lula, 1);
  assert.equal(e.placar.apoiadores.flavio, 1);
  assert.equal(e.sessao.modoTeste, true);
});

test('evento inválido é descartado e contado, sem quebrar', () => {
  const ctx = novo();
  assert.equal(ctx.jogo.enfileirar({ tipo: 'chat' }), false);
  assert.equal(ctx.jogo.metricas().descartados, 1);
});

test('acima de 20 eventos por ciclo as curtidas da mesma pessoa são agrupadas', () => {
  const ctx = novo();
  ctx.jogo.comando('iniciar');
  rodarCiclos(ctx, 60);
  for (let i = 0; i < 100; i++) ctx.jogo.enfileirar({ tipo: 'like', usuario: { id: 'u1', uniqueId: 'u1', nickname: 'u1', avatarUrl: null }, quantidade: 1, total: i + 1, origem: 'simulador' });
  ctx.jogo.enfileirar(chat('u2', 'lula'));
  rodarCiclos(ctx, 1);
  assert.ok(ctx.jogo.metricas().agrupados >= 99);
});

test('encerrar para o simulador, salva o relatório em JSON e devolve o caminho', () => {
  const ctx = novo();
  ctx.jogo.comando('iniciar');
  executarSimulador(ctx.jogo, { acao: 'live-falsa', ligar: true, porMinuto: 60 });
  assert.ok(ctx.jogo.metricas().simulador.liveFalsa);
  const r = ctx.jogo.comando('encerrar');
  assert.equal(r.ok, true);
  assert.equal(ctx.jogo.metricas().simulador.liveFalsa, null);
  assert.ok(r.relatorio.arquivo && fs.existsSync(r.relatorio.arquivo));
  const lido = JSON.parse(fs.readFileSync(r.relatorio.arquivo, 'utf8'));
  assert.equal(typeof lido.rodadas, 'number');
  assert.equal(ctx.jogo.motor.status, 'encerrado');
});

test('comando desconhecido é recusado', () => {
  const ctx = novo();
  assert.equal(ctx.jogo.comando('explodir').ok, false);
});

test('rodadas se repetem sozinhas até encerrar', () => {
  const ctx = novo({ duracoes: { aberturaS: 1, disputaS: 45, retaFinalS: 5, morteSubitaS: 3, resultadoS: 3 } });
  ctx.jogo.comando('iniciar');
  rodarCiclos(ctx, 2000); // 200 s
  assert.ok(ctx.jogo.motor.rodadaAtual >= 3, 'rodada ' + ctx.jogo.motor.rodadaAtual);
  assert.equal(ctx.jogo.motor.status, 'rodando');
});

test('pedido ruim ao simulador gera erro claro', () => {
  const ctx = novo();
  assert.throws(() => executarSimulador(ctx.jogo, { acao: 'nada' }), /desconhecida/);
  assert.throws(() => executarSimulador(ctx.jogo, { acao: 'presente', valor: 1 }), /nome e o valor/);
});

test('fps do overlay só vale se for um número razoável e expira', () => {
  const ctx = novo();
  ctx.jogo.registrarFpsDoOverlay('abc');
  assert.equal(ctx.jogo.metricas().overlayFps, null);
  ctx.jogo.registrarFpsDoOverlay(58);
  assert.equal(ctx.jogo.metricas().overlayFps, 58);
  ctx.relogio.avancar(7000);
  assert.equal(ctx.jogo.metricas().overlayFps, null);
});

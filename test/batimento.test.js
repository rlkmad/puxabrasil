import test from 'node:test';
import assert from 'node:assert/strict';
import { criarBatimento } from '../src/server/batimento.js';

test('registra batidas, avisos do app e zera a medição', () => {
  const b = criarBatimento();
  b._bater(); b._bater();
  b.registrarEventoApp('pause');
  let e = b.estado();
  assert.equal(e.batidas, 2);
  assert.equal(e.eventosApp[0].tipo, 'pause');
  b.zerarMedicao();
  e = b.estado();
  assert.equal(e.batidas, 0);
  assert.equal(e.eventosApp.length, 0);
  assert.equal(e.maiorPausaMs, 0);
});

test('detecta pausa grande quando o Node fica parado', async () => {
  const b = criarBatimento();
  b.zerarMedicao();
  await new Promise((r) => setTimeout(r, 3700)); // sem iniciar() o "relógio" fica parado, como no app em segundo plano
  b._bater();
  const e = b.estado();
  assert.ok(e.maiorPausaMs >= 2500, 'maior pausa ' + e.maiorPausaMs);
  assert.equal(e.pausas.length, 1);
});

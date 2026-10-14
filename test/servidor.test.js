// Teste de fumaça do servidor. Precisa de express e ws instalados (npm install);
// sem eles (por exemplo, sem internet) o teste é pulado, nunca marcado como aprovado.
import test from 'node:test';
import assert from 'node:assert/strict';

let dependencias = true;
try { await import('express'); await import('ws'); } catch (_) { dependencias = false; }

test('servidor sobe em 127.0.0.1, responde /api/ping, /painel, /overlay e WebSocket', { skip: !dependencias && 'express/ws não instalados' }, async () => {
  const { iniciarServidor } = await import('../src/server/index.js');
  const { WebSocket } = await import('ws');
  process.env.PUXA_DATA_DIR = (await import('node:os')).tmpdir() + '/puxa-teste-' + Date.now();
  const s = await iniciarServidor({ portaInicial: 3400, tentativas: 50 });
  try {
    const base = `http://127.0.0.1:${s.porta}`;
    const ping = await (await fetch(base + '/api/ping')).json();
    assert.equal(ping.app, 'puxa-brasil');
    assert.match(await (await fetch(base + '/painel')).text(), /Diagnóstico/);
    assert.match(await (await fetch(base + '/overlay')).text(), /Aguardando/);
    const diag = await (await fetch(base + '/api/diagnostico')).json();
    assert.equal(diag.porta, s.porta);
    assert.equal(diag.pastaDados.gravavel, true);

    const msg = await new Promise((ok, falha) => {
      const ws = new WebSocket(`ws://127.0.0.1:${s.porta}/ws`);
      ws.on('message', (m) => { ok(JSON.parse(String(m))); ws.close(); });
      ws.on('error', falha);
    });
    assert.equal(msg.tipo, 'ola');

    const ruim = await fetch(base + '/api/testar-conector', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'a b' }) });
    assert.equal(ruim.status, 400);
  } finally {
    await s.parar();
  }
});

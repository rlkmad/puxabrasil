// Teste de fumaça do servidor. Precisa de express e ws instalados (npm install);
// sem eles (por exemplo, sem internet) o teste é pulado, nunca marcado como aprovado.
import test from 'node:test';
import assert from 'node:assert/strict';

let dependencias = true;
try { await import('express'); await import('ws'); } catch (_) { dependencias = false; }

test('servidor sobe em 127.0.0.1, responde /api/ping, /painel, /overlay e WebSocket', { skip: !dependencias && 'express/ws não instalados' }, async () => {
  const { iniciarServidor } = await import('../src/server/index.js');
  const { WebSocket } = await import('ws');
  delete process.env.EULER_API_KEY;
  process.env.PUXA_DATA_DIR = (await import('node:os')).tmpdir() + '/puxa-teste-' + Date.now();
  const s = await iniciarServidor({ portaInicial: 3400, tentativas: 50 });
  try {
    const base = `http://127.0.0.1:${s.porta}`;
    const ping = await (await fetch(base + '/api/ping')).json();
    assert.equal(ping.app, 'puxa-brasil');
    assert.match(await (await fetch(base + '/painel')).text(), /Diagnóstico/);
    assert.match(await (await fetch(base + '/overlay')).text(), /overlay\.js/);
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

    // chave opcional do Euler: salva, mostra só o final, nunca devolve a chave inteira
    const post = (corpo) => fetch(base + '/api/config/euler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    assert.equal((await (await fetch(base + '/api/config/euler')).json()).configurada, false);
    assert.equal((await post({ chave: 'abc' })).status, 400);
    const salvo = await (await post({ chave: 'euler_TESTE12345678' })).json();
    assert.deepEqual(salvo, { configurada: true, final: '5678', origem: 'app' });
    const diag2 = await (await fetch(base + '/api/diagnostico')).json();
    assert.equal(diag2.euler.final, '5678');
    assert.ok(!JSON.stringify(diag2).includes('TESTE1234'), 'a chave vazou no diagnóstico');
    assert.equal((await (await post({ chave: '' })).json()).configurada, false);
  } finally {
    await s.parar();
  }
});

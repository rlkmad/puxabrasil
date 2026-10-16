// Teste do jogo pelo servidor de verdade (HTTP + WebSocket). Precisa de express e ws; sem eles é pulado.
import test from 'node:test';
import assert from 'node:assert/strict';

let dependencias = true;
try { await import('express'); await import('ws'); } catch (_) { dependencias = false; }

test('jogo pelo servidor: comandos, simulador, estado por WebSocket e telas', { skip: !dependencias && 'express/ws não instalados' }, async () => {
  const { iniciarServidor } = await import('../src/server/index.js');
  const { WebSocket } = await import('ws');
  delete process.env.EULER_API_KEY;
  process.env.PUXA_DATA_DIR = (await import('node:os')).tmpdir() + '/puxa-teste-jogo-' + Date.now();
  const s = await iniciarServidor({ portaInicial: 3500, tentativas: 50 });
  const base = `http://127.0.0.1:${s.porta}`;
  const json = (caminho, corpo) => fetch(base + caminho, corpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  let ws;
  try {
    // arquivos das telas
    for (const a of ['/painel/painel-jogo.js', '/overlay/overlay.js']) {
      const r = await fetch(base + a);
      assert.equal(r.status, 200, a);
      assert.match(r.headers.get('content-type') || '', /javascript/);
    }
    // configuração do jogo (padrões + nota legal fixa + lista de presentes do simulador)
    const conf = await (await json('/api/jogo/config')).json();
    assert.match(conf.avisoLegal, /Jogo de entretenimento/);
    assert.ok(conf.presentesDoSimulador.length >= 6);
    assert.ok(conf.legenda.length >= 3);

    // estado inicial: parado
    assert.equal((await (await json('/api/jogo/estado')).json()).sessao.status, 'parado');

    // WebSocket recebe estado 10x por segundo
    const recebidos = [];
    ws = new WebSocket(`ws://127.0.0.1:${s.porta}/ws`);
    ws.on('message', (m) => recebidos.push(JSON.parse(String(m))));
    await new Promise((ok, falha) => { ws.on('open', ok); ws.on('error', falha); });

    assert.equal((await json('/api/jogo/comando', { comando: 'explodir' })).status, 400);
    assert.equal((await json('/api/jogo/comando', { comando: 'iniciar' })).status, 200);
    assert.equal((await json('/api/simulador', { acao: 'nada' })).status, 400);
    assert.equal((await json('/api/simulador', { acao: 'multidao', quantidade: 20 })).status, 200);
    assert.equal((await json('/api/simulador', { acao: 'comentar', lado: 'lula', usuario: 'ana' })).status, 200);

    await new Promise((r) => setTimeout(r, 1500));
    const estados = recebidos.filter((m) => m.tipo === 'estado');
    assert.ok(estados.length >= 8, `estados recebidos: ${estados.length}`);
    assert.equal(estados.at(-1).sessao.status, 'rodando');
    assert.equal(estados.at(-1).sessao.modoTeste, true);
    assert.ok(recebidos.some((m) => m.tipo === 'evento' && m.nome === 'fase'));

    // o overlay informa seus quadros por segundo
    ws.send(JSON.stringify({ tipo: 'fps', fps: 57 }));
    await new Promise((r) => setTimeout(r, 200));
    assert.equal((await (await json('/api/jogo/metricas')).json()).overlayFps, 57);

    // encerrar salva o relatório
    const fim = await (await json('/api/jogo/comando', { comando: 'encerrar' })).json();
    assert.equal(fim.ok, true);
    assert.ok(fim.relatorio.arquivo);
    assert.equal((await (await json('/api/jogo/estado')).json()).sessao.status, 'encerrado');
  } finally {
    try { ws?.close(); } catch (_) { /* ignora */ }
    await s.parar();
  }
});

// Ponto de entrada do Node embutido (CommonJS de propósito: roda no Node 18 do app).
// 1) Carregar o módulo "bridge" avisa o plugin de que o Node está pronto.
// 2) Depois importamos o servidor (ES module) de src/.
// 3) Se o servidor não conseguir iniciar, sobe um servidorzinho de emergência em 127.0.0.1:3000-3010
//    que mostra o erro exato no painel (em vez de a tela de abertura só dizer que "não respondeu").
'use strict';

let ponte = null;
try {
  ponte = require('bridge');
} catch (e) {
  console.log('[main] módulo bridge ausente (normal fora do app):', e.message);
}

globalThis.__PUXA_PONTE__ = ponte;

function escapar(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function servidorDeEmergencia(erro) {
  try {
    const http = require('http');
    const detalhe = [
      'Falha ao iniciar o servidor do jogo.',
      'Node: ' + process.version + ' · V8: ' + process.versions.v8 + ' · ICU: ' + (process.versions.icu || 'ausente'),
      '',
      String(erro && erro.stack ? erro.stack : erro),
    ].join('\n');
    const pagina = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Puxa Brasil · erro ao iniciar</title><style>body{margin:0;padding:16px;background:#0B1B3A;color:#f4f7ff;font:16px/1.45 system-ui,sans-serif}' +
      'pre{background:#0a1630;border:1px solid #2a4272;border-radius:8px;padding:10px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}' +
      'button{min-height:48px;padding:0 16px;border-radius:10px;border:2px solid #ffdf00;background:#ffdf00;color:#1b2a00;font-weight:700;font-size:16px}</style></head><body>' +
      '<h1>O servidor do jogo não iniciou</h1><p>Toque em <b>Copiar erro</b> e envie para análise.</p>' +
      '<button id="c" type="button">Copiar erro</button><pre id="t">' + escapar(detalhe) + '</pre>' +
      '<script>document.getElementById("c").onclick=function(){var t=document.getElementById("t").textContent;' +
      'if(navigator.clipboard){navigator.clipboard.writeText(t).catch(function(){})}' +
      'var r=document.createRange();r.selectNodeContents(document.getElementById("t"));var s=getSelection();s.removeAllRanges();s.addRange(r);try{document.execCommand("copy")}catch(e){}};</script></body></html>';
    let porta = 3000;
    const subir = () => {
      const srv = http.createServer((req, res) => {
        if (req.url.indexOf('/api/ping') === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ app: 'puxa-brasil', fase: 'erro-de-inicio', node: process.version }));
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(pagina);
        }
      });
      srv.on('error', () => { porta += 1; if (porta <= 3010) subir(); });
      srv.listen(porta, '127.0.0.1');
    };
    subir();
  } catch (e) {
    console.error('[main] nem o servidor de emergência subiu:', e);
  }
}

import('./src/server/iniciar.js').catch((erro) => {
  console.error('[main] falha ao iniciar o servidor:', erro);
  try {
    if (ponte && ponte.channel) ponte.channel.post('erro-inicio', String(erro && erro.stack ? erro.stack : erro));
  } catch (_) { /* nada a fazer */ }
  servidorDeEmergencia(erro);
});

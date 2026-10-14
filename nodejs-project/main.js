// Ponto de entrada do Node embutido (CommonJS de propósito: roda no Node 18 do app).
// 1) Carregar o módulo "bridge" avisa o plugin de que o Node está pronto.
// 2) Depois importamos o servidor (ES module) de src/.
'use strict';

let ponte = null;
try {
  ponte = require('bridge');
} catch (e) {
  console.log('[main] módulo bridge ausente (normal fora do app):', e.message);
}

globalThis.__PUXA_PONTE__ = ponte;

import('./src/server/iniciar.js').catch((erro) => {
  console.error('[main] falha ao iniciar o servidor:', erro);
  try {
    if (ponte && ponte.channel) ponte.channel.post('erro-inicio', String(erro && erro.stack ? erro.stack : erro));
  } catch (_) { /* nada a fazer */ }
});

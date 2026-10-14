// Polyfills pontuais para o Node embutido (Node 18). Este arquivo tem de ser o PRIMEIRO import de iniciar.js.
// No Node 18 não existe o "crypto" global (só chegou no Node 19+). Bibliotecas e código novo costumam usar
// crypto.randomUUID(); aqui criamos a global a partir do módulo node:crypto, que existe em todas as versões.
import nodeCrypto from 'node:crypto';

export const POLYFILLS_APLICADOS = [];

if (typeof globalThis.crypto?.randomUUID !== 'function') {
  try {
    const web = nodeCrypto.webcrypto;
    const objeto = {
      getRandomValues: (arr) => (web ? web.getRandomValues(arr) : nodeCrypto.randomFillSync(arr)),
      randomUUID: () => nodeCrypto.randomUUID(),
      get subtle() { return web?.subtle; },
    };
    Object.defineProperty(globalThis, 'crypto', { value: objeto, configurable: true, writable: true });
    POLYFILLS_APLICADOS.push('crypto');
  } catch (_) { /* sem polyfill: o código deve usar node:crypto diretamente */ }
}

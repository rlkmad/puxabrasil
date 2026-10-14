// Informações sobre o Node em execução e sobre a pasta de dados.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { POLYFILLS_APLICADOS } from './polifills.js';

/** Pasta de dados privada: a do app (via bridge), uma variável de ambiente, ou uma pasta temporária (desenvolvimento). */
export function resolverPastaDados() {
  const ponte = globalThis.__PUXA_PONTE__;
  try {
    if (ponte && ponte.app && typeof ponte.app.datadir === 'function') {
      const d = ponte.app.datadir();
      if (d) return { caminho: d, origem: 'app (bridge.datadir)' };
    }
  } catch (_) { /* cai para as opções seguintes */ }
  if (process.env.PUXA_DATA_DIR) return { caminho: process.env.PUXA_DATA_DIR, origem: 'variável PUXA_DATA_DIR' };
  return { caminho: path.join(os.tmpdir(), 'puxa-brasil-dev'), origem: 'pasta temporária (desenvolvimento)' };
}

/** Cria, lê e apaga um arquivo para provar que a pasta é gravável. */
export function testarGravacao(pasta) {
  try {
    fs.mkdirSync(pasta, { recursive: true });
    const arq = path.join(pasta, 'teste-gravacao.tmp');
    const marca = String(Date.now());
    fs.writeFileSync(arq, marca);
    const lido = fs.readFileSync(arq, 'utf8');
    fs.unlinkSync(arq);
    return { gravavel: lido === marca, erro: lido === marca ? null : 'conteúdo lido diferente do gravado' };
  } catch (e) {
    return { gravavel: false, erro: `${e.code || e.name}: ${e.message}` };
  }
}

/** Recursos que o servidor e o conector costumam usar. "false" = falta no Node embutido. */
export function recursosDoNode() {
  const f = {
    fetch: typeof fetch === 'function',
    'AbortSignal.timeout': typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function',
    structuredClone: typeof structuredClone === 'function',
    ReadableStream: typeof ReadableStream !== 'undefined',
    TextDecoderStream: typeof TextDecoderStream !== 'undefined',
    [POLYFILLS_APLICADOS.includes('crypto') ? 'crypto.randomUUID (via polyfill)' : 'crypto.randomUUID']: typeof globalThis.crypto?.randomUUID === 'function',
    'import() dinâmico': true,
    'node:test (só testes)': undefined,
  };
  delete f['node:test (só testes)'];
  return f;
}

export function infoDoNode() {
  return {
    versao: process.version,
    v8: process.versions.v8,
    openssl: process.versions.openssl,
    plataforma: process.platform,
    arquitetura: process.arch,
    modulos: process.versions.modules,
  };
}

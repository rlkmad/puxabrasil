// Log simples: guarda as últimas linhas na memória e grava em logs/app.log com rotação.
import fs from 'node:fs';
import path from 'node:path';

const LIMITE_MEMORIA = 200;
const LIMITE_ARQUIVO = 512 * 1024; // 512 KB por arquivo; guarda app.log e app.log.1

const memoria = [];
let arquivo = null;

export function configurarLog(pastaLogs) {
  try {
    fs.mkdirSync(pastaLogs, { recursive: true });
    arquivo = path.join(pastaLogs, 'app.log');
  } catch (_) {
    arquivo = null;
  }
}

function girarSePreciso() {
  try {
    if (arquivo && fs.existsSync(arquivo) && fs.statSync(arquivo).size > LIMITE_ARQUIVO) {
      fs.renameSync(arquivo, arquivo + '.1');
    }
  } catch (_) { /* log nunca derruba o app */ }
}

export function log(nivel, ...partes) {
  const texto = partes.map((p) => (p instanceof Error ? p.stack || p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
  const linha = `${new Date().toISOString()} [${nivel}] ${texto}`;
  memoria.push(linha);
  if (memoria.length > LIMITE_MEMORIA) memoria.shift();
  (nivel === 'erro' ? console.error : console.log)(linha);
  if (arquivo) {
    try {
      girarSePreciso();
      fs.appendFileSync(arquivo, linha + '\n');
    } catch (_) { /* ignora */ }
  }
}

export const info = (...a) => log('info', ...a);
export const erro = (...a) => log('erro', ...a);
export const ultimasLinhas = (n = 40) => memoria.slice(-n);

// Gravação de arquivos de dados com escrita atômica (arquivo temporário e renomear), para não corromper
// se o Android matar o app ou a bateria acabar no meio da gravação.
import fs from 'node:fs';
import path from 'node:path';

export function escreverAtomico(arquivo, conteudo) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, conteudo);
  fs.renameSync(tmp, arquivo);
}

export function lerJsonSeguro(arquivo) {
  try { return { dados: JSON.parse(fs.readFileSync(arquivo, 'utf8')), erro: null }; } catch (e) {
    return { dados: null, erro: e.code === 'ENOENT' ? null : String(e.message || e) };
  }
}

/** Nome de arquivo AAAA-MMDD_HHMM com a hora local. */
export function carimboDeHora(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

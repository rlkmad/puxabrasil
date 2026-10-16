// Funções de texto que NÃO dependem de ICU/Intl nem de propriedades Unicode em expressões regulares.
// Motivo: o Node embutido no app (Node.js for Mobile) pode ser compilado sem ICU; nesse caso
// /\p{M}/u e String.prototype.normalize falham e o servidor inteiro deixa de iniciar.

const DE = 'àáâãäåāăąçćčďèéêëēěęìíîïīłñńňòóôõöøōőŕřśšťùúûüūůűýÿźžż';
const PARA = 'aaaaaaaaacccdeeeeeeeiiiiilnnnoooooooorrsstuuuuuuuyyzzz';
const MAPA = new Map();
for (let i = 0; i < DE.length; i++) MAPA.set(DE[i], PARA[i]);

const MARCAS_COMBINANTES = /[̀-ͯ]/g;

/** Minúsculas e sem acentos (tabela própria, igual ao NFD sem marcas para o português e línguas vizinhas). */
export function semAcento(texto) {
  const minusculo = String(texto ?? '').toLowerCase().replace(MARCAS_COMBINANTES, '');
  let saida = '';
  for (const c of minusculo) saida += MAPA.get(c) ?? c;
  return saida;
}

// Faixas de emoji e símbolos pictográficos (aproximação de Extended_Pictographic, sem precisar de ICU).
const FAIXAS_EMOJI = '\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{2190}-\\u{21FF}\\u{2300}-\\u{23FF}\\u{25A0}-\\u{25FF}\\u{2900}-\\u{297F}\\u{3030}\\u{303D}\\u{3297}\\u{3299}\\u{00A9}\\u{00AE}\\u{203C}\\u{2049}\\u{2122}\\u{2139}';
export const EMOJI = new RegExp(`[${FAIXAS_EMOJI}]`, 'u');
export const EMOJI_TODOS = new RegExp(`[${FAIXAS_EMOJI}\\u{FE0F}\\u{200D}]`, 'gu');

// Normalização de texto e detecção do lado escolhido pelo comentário (seção 5 do prompt).
// O texto é normalizado: sem maiúsculas, sem acentos, sem emojis soltos, letras repetidas reduzidas
// ("lulaaaa" vira "lula") e comparando palavra inteira. Palavras-chave em emoji (🔴, 🟢, 🟡) são
// procuradas no texto original, antes de os emojis serem descartados.

import { semAcento, EMOJI, EMOJI_TODOS } from './texto-seguro.js';

/** Reduz sequências de letras repetidas a uma só ("lulaaa" -> "lula"). Números não são mexidos. */
function reduzirRepetidas(palavra) {
  return palavra.replace(/([a-z])\1+/g, '$1');
}

/** Texto -> lista de palavras normalizadas (sem emojis). */
export function palavrasDoTexto(texto) {
  const limpo = semAcento(texto).replace(EMOJI_TODOS, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  if (!limpo) return [];
  return limpo.split(' ').map(reduzirRepetidas);
}

/** Texto normalizado numa só linha (usado para detectar comentário repetido). */
export function normalizarTexto(texto) {
  return palavrasDoTexto(texto).join(' ');
}

/** Prepara as palavras-chave de um lado: separa as de emoji das de texto. */
function prepararLado(palavras) {
  const emojis = [];
  const termos = new Set();
  for (const p of palavras) {
    if (EMOJI.test(p)) emojis.push(p.replace(/️/g, ''));
    else {
      const n = palavrasDoTexto(p).join('');
      if (n) termos.add(n);
    }
  }
  return { emojis, termos, originais: palavras };
}

const cache = new WeakMap();
function preparado(lados) {
  let c = cache.get(lados);
  if (!c) {
    c = { lula: prepararLado(lados.lula.palavras), flavio: prepararLado(lados.flavio.palavras) };
    cache.set(lados, c);
  }
  return c;
}

function achar(prep, textoSemVs, palavras) {
  for (const e of prep.emojis) if (textoSemVs.includes(e)) return e;
  for (const p of palavras) if (prep.termos.has(p)) return p;
  return null;
}

/**
 * Descobre o lado do comentário.
 * Devolve { lado: 'lula' | 'flavio' | null, ambos: boolean, palavra }.
 * "palavra" é a palavra-chave da lista (nunca texto livre) e serve para a linha padronizada do feed.
 * Palavras dos dois lados ao mesmo tempo: ambos = true (o comentário é ignorado).
 */
export function detectarLado(texto, lados) {
  const prep = preparado(lados);
  const bruto = String(texto ?? '').replace(/️/g, '');
  const palavras = palavrasDoTexto(bruto);
  const l = achar(prep.lula, bruto, palavras);
  const f = achar(prep.flavio, bruto, palavras);
  if (l && f) return { lado: null, ambos: true, palavra: null };
  if (l) return { lado: 'lula', ambos: false, palavra: l };
  if (f) return { lado: 'flavio', ambos: false, palavra: f };
  return { lado: null, ambos: false, palavra: null };
}

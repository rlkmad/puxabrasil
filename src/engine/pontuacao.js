// Multiplicadores e arredondamento de pontos (seção 4 e 6 do prompt).

/**
 * Multiplicadores de efeitos diferentes não se multiplicam entre si: vale o maior.
 * A reta final (ou a morte súbita) multiplica em cima dele, e o total nunca passa do máximo (x6).
 */
export function multiplicadorTotal(multiplicadoresDeEfeitos, multiplicadorDaFase, maximo) {
  const efeito = multiplicadoresDeEfeitos.length ? Math.max(1, ...multiplicadoresDeEfeitos) : 1;
  return Math.min(efeito * Math.max(1, multiplicadorDaFase), maximo);
}

/** Pontos para mostrar na tela (sem casas decimais quebradas). */
export function arredondar(p) { return Math.round(p * 10) / 10; }
export function formatarPontos(p) {
  const r = arredondar(p);
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

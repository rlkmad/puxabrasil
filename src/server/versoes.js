// Comparação de versões do Node (subconjunto simples de semver).
// Serve para comparar o Node embutido com o "engines.node" exigido pelo conector.

/** "v18.20.4" -> [18, 20, 4]. Partes ausentes ou "x" viram null. */
export function parseVersao(texto) {
  const m = /^v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/i.exec(String(texto ?? '').trim());
  if (!m) return null;
  const n = (x) => (x === undefined || /^[x*]$/i.test(x) ? null : Number(x));
  return [Number(m[1]), n(m[2]), n(m[3])];
}

function comparar(a, b) {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function atendeComparador(v, texto) {
  const t = texto.trim();
  if (t === '' || t === '*' || /^x$/i.test(t)) return true;
  const m = /^(>=|<=|>|<|=|\^|~)?v?(.+)$/.exec(t);
  const op = m[1] || '=';
  const alvo = parseVersao(m[2]);
  if (!alvo) throw new Error(`Faixa de versão não entendida: "${texto}"`);
  const base = [alvo[0], alvo[1] ?? 0, alvo[2] ?? 0];
  switch (op) {
    case '>=': return comparar(v, base) >= 0;
    case '>': return comparar(v, base) > 0;
    case '<': return comparar(v, base) < 0;
    case '<=':
      if (alvo[1] === null) return v[0] <= alvo[0];
      if (alvo[2] === null) return v[0] < alvo[0] || (v[0] === alvo[0] && v[1] <= alvo[1]);
      return comparar(v, base) <= 0;
    case '=':
      return v[0] === alvo[0] && (alvo[1] === null || v[1] === alvo[1]) && (alvo[2] === null || v[2] === alvo[2]);
    case '^': {
      let teto;
      if (base[0] > 0) teto = [base[0] + 1, 0, 0];
      else if (base[1] > 0) teto = [0, base[1] + 1, 0];
      else teto = [0, 0, base[2] + 1];
      return comparar(v, base) >= 0 && comparar(v, teto) < 0;
    }
    case '~': {
      const teto = alvo[1] === null ? [base[0] + 1, 0, 0] : [base[0], base[1] + 1, 0];
      return comparar(v, base) >= 0 && comparar(v, teto) < 0;
    }
    default:
      throw new Error(`Operador não suportado: ${op}`);
  }
}

/** true/false. Lança erro se a faixa tiver formato que não conhecemos. */
export function satisfaz(versao, faixa) {
  const v = parseVersao(versao);
  if (!v) throw new Error(`Versão não entendida: "${versao}"`);
  const cheia = [v[0], v[1] ?? 0, v[2] ?? 0];
  const normalizada = String(faixa).replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1');
  return normalizada.split('||').some((conjunto) =>
    conjunto.trim().split(/\s+/).every((c) => atendeComparador(cheia, c)),
  );
}

/**
 * Compara o Node atual com o "engines.node" do pacote.
 * Devolve { ok: true|false|null, texto } (null = sem exigência declarada ou faixa desconhecida).
 */
export function avaliarEngines(versaoNode, faixa) {
  if (!faixa) return { ok: null, texto: 'o pacote não declara versão mínima do Node' };
  try {
    const ok = satisfaz(versaoNode, faixa);
    return {
      ok,
      texto: ok
        ? `Node ${versaoNode} atende a exigência "${faixa}"`
        : `Node ${versaoNode} NÃO atende a exigência "${faixa}"`,
    };
  } catch (e) {
    return { ok: null, texto: `não consegui comparar "${faixa}": ${e.message}` };
  }
}

// Lista única de efeitos de presente (seção 6). Alimenta o motor, a legenda do overlay e a aba Presentes.
// Na Fase 1 só os PONTOS de cada efeito são aplicados (na hora). Os efeitos visuais e de duração
// (Trio Elétrico, Âncora, Gelo, Megafone, Maré, Dominação, Final Épica, Combo, Rojão em etapas) entram na Fase 3.

import { semAcento } from './texto-seguro.js';

export const EFEITOS = Object.freeze([
  { id: 'apoiador-vip', nome: 'Apoiador VIP', faixa: [1, 1], pontosPorMoeda: 3 },
  { id: 'combo-de-torcida', nome: 'Combo de Torcida', faixa: [1, 1], pontosPorMoeda: 2 },
  { id: 'rojao', nome: 'Rojão', faixa: [5, 5], pontosPorMoeda: 5 },
  { id: 'trio-eletrico', nome: 'Trio Elétrico', faixa: [10, 49], pontosPorMoeda: 4 },
  { id: 'ancora', nome: 'Âncora', faixa: [50, 99], pontosPorMoeda: 3 },
  { id: 'gelo', nome: 'Gelo', faixa: [100, 199], pontosPorMoeda: 3 },
  { id: 'megafone', nome: 'Megafone', faixa: [200, 499], pontosPorMoeda: 3 },
  { id: 'mare', nome: 'Maré', faixa: [500, 999], pontosPorMoeda: 5 },
  { id: 'dominacao', nome: 'Dominação', faixa: [1000, 9999], pontosPorMoeda: 3 },
  { id: 'final-epica', nome: 'Final Épica', faixa: [10000, Infinity], pontosPorMoeda: 2 },
]);

export const efeitoPorId = (id) => EFEITOS.find((e) => e.id === id) ?? null;

/**
 * Presente fora da tabela vira o efeito da faixa do seu valor (por unidade).
 * Valores que caem entre duas faixas (2 a 4 e 6 a 9 moedas) usam a faixa de baixo.
 * Na faixa de 1 moeda existem dois efeitos; o padrão para presente fora da tabela é o Apoiador VIP.
 */
export function efeitoPorValor(valorUnitario) {
  const v = Number(valorUnitario) || 0;
  if (v < 5) return efeitoPorId('apoiador-vip');
  if (v < 10) return efeitoPorId('rojao');
  return [...EFEITOS].reverse().find((e) => v >= e.faixa[0]) ?? efeitoPorId('apoiador-vip');
}

export function normalizarNomeDePresente(nome) {
  return semAcento(nome).replace(/\s+/g, ' ').trim();
}

/** Presentes padrão (pares de mesmo valor): só os das faixas de 1 e 5 moedas, que vêm do painel de referência. */
export const GIFTS_PADRAO = Object.freeze({
  efeitos: {
    'apoiador-vip': { lula: { nome: 'Rosa', moedas: 1 }, flavio: { nome: 'Rosa branca', moedas: 1 } },
    'combo-de-torcida': { lula: { nome: 'Heart Me', moedas: 1 }, flavio: { nome: 'Bom jogo (GG)', moedas: 1, aliases: ['GG'] } },
    rojao: { lula: { nome: 'Fogos de artifício', moedas: 5 }, flavio: { nome: 'Coração com os dedos', moedas: 5 } },
  },
});

const ehObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Valida config/gifts.json. Devolve { gifts, avisos } e nunca lança erro. */
export function validarGifts(bruto) {
  const avisos = [];
  const gifts = { efeitos: {} };
  if (bruto === undefined || bruto === null) return { gifts: structuredClone(GIFTS_PADRAO), avisos };
  if (!ehObjeto(bruto) || !ehObjeto(bruto.efeitos)) {
    return { gifts: structuredClone(GIFTS_PADRAO), avisos: ['O arquivo de presentes está inválido; usei os presentes padrão.'] };
  }
  const nomesUsados = new Map();
  for (const [id, def] of Object.entries(bruto.efeitos)) {
    const efeito = efeitoPorId(id);
    if (!efeito) { avisos.push(`Efeito desconhecido "${id}" ignorado.`); continue; }
    if (!ehObjeto(def)) { avisos.push(`Efeito ${efeito.nome}: formato inválido; ignorado.`); continue; }
    const saida = {};
    if (def.pontosPorMoeda !== undefined) {
      if (typeof def.pontosPorMoeda === 'number' && def.pontosPorMoeda >= 0 && def.pontosPorMoeda <= 100) saida.pontosPorMoeda = def.pontosPorMoeda;
      else avisos.push(`Efeito ${efeito.nome}: pontos por moeda inválido; usei ${efeito.pontosPorMoeda}.`);
    }
    for (const lado of ['lula', 'flavio']) {
      const g = def[lado];
      if (g === undefined || g === null) { saida[lado] = null; continue; }
      const nomeOk = ehObjeto(g) && typeof g.nome === 'string' && g.nome.trim();
      const moedasOk = ehObjeto(g) && Number.isFinite(g.moedas) && g.moedas >= 0;
      if (!nomeOk || !moedasOk) { avisos.push(`Efeito ${efeito.nome}, lado ${lado}: presente inválido (precisa de nome e moedas); ignorado.`); saida[lado] = null; continue; }
      const aliases = Array.isArray(g.aliases) ? g.aliases.filter((a) => typeof a === 'string' && a.trim()) : [];
      saida[lado] = { nome: g.nome.trim(), moedas: g.moedas, aliases };
      for (const n of [g.nome, ...aliases].map(normalizarNomeDePresente)) {
        if (nomesUsados.has(n)) avisos.push(`O presente "${g.nome}" está em dois lugares (${nomesUsados.get(n)} e ${efeito.nome}/${lado}). Vale o primeiro.`);
        else nomesUsados.set(n, `${efeito.nome}/${lado}`);
      }
    }
    if (saida.lula && saida.flavio && saida.lula.moedas !== saida.flavio.moedas) {
      avisos.push(`Efeito ${efeito.nome}: os dois presentes têm valores diferentes (${saida.lula.moedas} e ${saida.flavio.moedas} moedas). Troque para o mesmo valor para ficar justo.`);
    }
    gifts.efeitos[id] = saida;
  }
  return { gifts, avisos };
}

/**
 * Descobre efeito, lado do presente e pontos por moeda.
 * Primeiro procura pelo NOME na tabela (o presente sempre vale para o lado dele); se não achar,
 * usa a faixa de valor e devolve lado = null (vale o lado atual da pessoa).
 */
export function resolverPresente(nome, valorUnitario, gifts) {
  const alvo = normalizarNomeDePresente(nome);
  for (const [id, def] of Object.entries(gifts?.efeitos ?? {})) {
    for (const lado of ['lula', 'flavio']) {
      const g = def[lado];
      if (!g) continue;
      const nomes = [g.nome, ...(g.aliases ?? [])].map(normalizarNomeDePresente);
      if (nomes.includes(alvo)) {
        const efeito = efeitoPorId(id);
        return { efeito, lado, pontosPorMoeda: def.pontosPorMoeda ?? efeito.pontosPorMoeda, naTabela: true };
      }
    }
  }
  const efeito = efeitoPorValor(valorUnitario);
  const def = gifts?.efeitos?.[efeito.id];
  return { efeito, lado: null, pontosPorMoeda: def?.pontosPorMoeda ?? efeito.pontosPorMoeda, naTabela: false };
}

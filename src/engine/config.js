// Configuração do jogo: padrões, validação e mistura com o que o streamer salvou.
// Regra do prompt: todos os números do jogo ficam em config/, validados ao carregar. Se algo estiver
// inválido, usa o padrão e devolve um aviso em português para o painel mostrar.

export const PADROES = Object.freeze({
  nomeDoJogo: 'PUXA BRASIL',
  duracoes: { aberturaS: 5, disputaS: 90, retaFinalS: 15, morteSubitaS: 10, resultadoS: 10 },
  pontos: { comentario: 1, curtida: 0.1, seguidor: 15, compartilhamento: 20, assinante: 50 },
  assinante: { ativo: false },
  limites: {
    comentarioIntervaloS: 1.5, comentarioPontosPorMin: 60, curtidaPontosPorMin: 20,
    comentarioRepetidoS: 5, trocaDeLadoS: 20, compartilhamentoIntervaloS: 300,
  },
  corda: {
    meiaVidaS: 10, piso: 15, velocidadeMaxPorS: 8, suavizacaoPorS: 3,
    nocauteLimite: 8, nocauteS: 2, empateMin: 49, empateMax: 51,
  },
  retaFinal: { ativa: true, multiplicador: 2 },
  morteSubita: { multiplicador: 2 },
  multiplicadorMaximo: 6,
  zebra: { ativa: true, distancia: 30, tempoS: 5, bonusPercentual: 20, sairAbaixoDe: 10 },
  barraVirada: { ativa: true, meta: 300, impulso: 40 },
  apoiadoresPorLado: 24,
  lados: {
    lula: { nome: 'LULA', palavras: ['lula', 'vermelho', '13', '🔴'] },
    flavio: { nome: 'FLÁVIO', palavras: ['flavio', 'bolsonaro', 'bolso', 'verde', 'amarelo', '22', '🟢', '🟡'] },
  },
  avisos: [
    'Comente LULA ou FLÁVIO e entre na corda',
    'Rosa = Lula · Rosa branca = Flávio',
    'Curta para ajudar quem está perdendo',
    'Compartilhe e chame a Carreata',
    'Siga e vire Torcedor Fiel',
  ],
  avisoIntervaloS: 25,
});

const ehObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Regras de cada número: [mínimo, máximo, rótulo em português]. */
const FAIXAS = {
  'duracoes.aberturaS': [1, 60, 'Duração da abertura (s)'],
  'duracoes.disputaS': [45, 180, 'Duração da disputa (s)'],
  'duracoes.retaFinalS': [5, 60, 'Duração da reta final (s)'],
  'duracoes.morteSubitaS': [3, 60, 'Duração da morte súbita (s)'],
  'duracoes.resultadoS': [3, 60, 'Duração do resultado (s)'],
  'pontos.comentario': [0, 100, 'Pontos por comentário'],
  'pontos.curtida': [0, 10, 'Pontos por curtida'],
  'pontos.seguidor': [0, 500, 'Pontos por novo seguidor'],
  'pontos.compartilhamento': [0, 500, 'Pontos por compartilhamento'],
  'pontos.assinante': [0, 1000, 'Pontos por assinante'],
  'limites.comentarioIntervaloS': [0, 60, 'Intervalo entre comentários (s)'],
  'limites.comentarioPontosPorMin': [1, 10000, 'Limite de pontos por minuto em comentários'],
  'limites.curtidaPontosPorMin': [1, 10000, 'Limite de pontos por minuto em curtidas'],
  'limites.comentarioRepetidoS': [0, 120, 'Tempo para ignorar comentário repetido (s)'],
  'limites.trocaDeLadoS': [0, 600, 'Intervalo para trocar de lado (s)'],
  'limites.compartilhamentoIntervaloS': [0, 7200, 'Intervalo entre compartilhamentos (s)'],
  'corda.meiaVidaS': [1, 120, 'Meia-vida da força (s)'],
  'corda.piso': [1, 1000, 'Piso da força'],
  'corda.velocidadeMaxPorS': [1, 50, 'Velocidade máxima da bandeira'],
  'corda.suavizacaoPorS': [0.1, 30, 'Suavização da bandeira'],
  'corda.nocauteLimite': [1, 20, 'Distância do nocaute'],
  'corda.nocauteS': [0.5, 20, 'Tempo de nocaute (s)'],
  'corda.empateMin': [30, 50, 'Limite inferior do empate'],
  'corda.empateMax': [50, 70, 'Limite superior do empate'],
  'retaFinal.multiplicador': [1, 6, 'Multiplicador da reta final'],
  'morteSubita.multiplicador': [1, 6, 'Multiplicador da morte súbita'],
  multiplicadorMaximo: [1, 20, 'Multiplicador máximo'],
  'zebra.distancia': [10, 49, 'Distância da Zebra'],
  'zebra.tempoS': [1, 60, 'Tempo para ativar a Zebra (s)'],
  'zebra.bonusPercentual': [0, 200, 'Bônus da Zebra (%)'],
  'zebra.sairAbaixoDe': [0, 40, 'Distância para a Zebra sair'],
  'barraVirada.meta': [10, 100000, 'Meta da Barra da Virada'],
  'barraVirada.impulso': [0, 1000, 'Impulso da Barra da Virada'],
  apoiadoresPorLado: [4, 60, 'Apoiadores mostrados por lado'],
  avisoIntervaloS: [5, 300, 'Intervalo dos avisos (s)'],
};

const ehBooleano = ['retaFinal.ativa', 'zebra.ativa', 'barraVirada.ativa', 'assinante.ativo'];

function ler(obj, caminho) { return caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function gravar(obj, caminho, valor) {
  const partes = caminho.split('.');
  const ultimo = partes.pop();
  const alvo = partes.reduce((o, k) => o[k], obj);
  alvo[ultimo] = valor;
}

/** Devolve { config, avisos }. Nunca lança erro: valores ruins voltam ao padrão. */
export function validarConfig(bruto) {
  const config = structuredClone(PADROES);
  const avisos = [];
  if (bruto === undefined || bruto === null) return { config, avisos };
  if (!ehObjeto(bruto)) return { config, avisos: ['O arquivo de configuração do jogo não é um objeto válido; usei os padrões.'] };

  if (typeof bruto.nomeDoJogo === 'string' && bruto.nomeDoJogo.trim() && bruto.nomeDoJogo.length <= 30) config.nomeDoJogo = bruto.nomeDoJogo.trim();
  else if (bruto.nomeDoJogo !== undefined) avisos.push('Nome do jogo inválido (use até 30 letras); usei o padrão.');

  for (const [caminho, [min, max, rotulo]] of Object.entries(FAIXAS)) {
    const v = ler(bruto, caminho);
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      avisos.push(`${rotulo}: valor inválido (${JSON.stringify(v)}). Use um número entre ${min} e ${max}. Usei ${ler(PADROES, caminho)}.`);
    } else gravar(config, caminho, v);
  }
  for (const caminho of ehBooleano) {
    const v = ler(bruto, caminho);
    if (v === undefined) continue;
    if (typeof v !== 'boolean') avisos.push(`${caminho}: use verdadeiro ou falso. Usei o padrão.`);
    else gravar(config, caminho, v);
  }

  if (bruto.lados !== undefined) {
    for (const lado of ['lula', 'flavio']) {
      const b = bruto.lados?.[lado];
      if (b === undefined) continue;
      if (typeof b.nome === 'string' && b.nome.trim() && b.nome.length <= 20) config.lados[lado].nome = b.nome.trim();
      else if (b.nome !== undefined) avisos.push(`Nome do lado ${lado} inválido; usei o padrão.`);
      if (b.palavras !== undefined) {
        const ok = Array.isArray(b.palavras) && b.palavras.length > 0 && b.palavras.every((p) => typeof p === 'string' && p.trim() && p.length <= 30);
        if (ok) config.lados[lado].palavras = b.palavras.map((p) => p.trim());
        else avisos.push(`Palavras do lado ${lado} inválidas; usei as padrão.`);
      }
    }
  }
  // as mesmas palavras nos dois lados quebrariam a regra de "palavras dos dois lados ao mesmo tempo"
  const iguais = config.lados.lula.palavras.filter((p) => config.lados.flavio.palavras.includes(p));
  if (iguais.length) {
    avisos.push(`As palavras ${iguais.join(', ')} aparecem nos dois lados. Voltei às palavras padrão.`);
    config.lados.lula.palavras = [...PADROES.lados.lula.palavras];
    config.lados.flavio.palavras = [...PADROES.lados.flavio.palavras];
  }

  if (bruto.avisos !== undefined) {
    const ok = Array.isArray(bruto.avisos) && bruto.avisos.length > 0 && bruto.avisos.length <= 20
      && bruto.avisos.every((t) => typeof t === 'string' && t.trim() && t.length <= 80);
    if (ok) config.avisos = bruto.avisos.map((t) => t.trim());
    else avisos.push('Os avisos rotativos são inválidos (lista de 1 a 20 textos de até 80 letras); usei os padrão.');
  }

  if (config.corda.empateMin > config.corda.empateMax) {
    avisos.push('Faixa de empate invertida; usei 49 a 51.');
    config.corda.empateMin = PADROES.corda.empateMin;
    config.corda.empateMax = PADROES.corda.empateMax;
  }
  return { config, avisos };
}

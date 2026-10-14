// Teste mínimo do conector do TikTok dentro do Node embutido (portão da Fase 0).
//
// Regra do prompt: chegar um evento OU receber o erro de "usuário offline" prova que
// pacote, rede e assinatura funcionam. Erro de sintaxe, módulo ausente ou recurso
// inexistente reprova. Falha de internet/limite de assinatura é "inconclusivo".
import { avaliarEngines } from './versoes.js';

export const STATUS = Object.freeze({ APROVADO: 'aprovado', REPROVADO: 'reprovado', INCONCLUSIVO: 'inconclusivo' });

const CODIGOS_INCOMPATIVEIS = new Set([
  'ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND', 'ERR_REQUIRE_ESM', 'ERR_UNKNOWN_BUILTIN_MODULE',
  'ERR_PACKAGE_PATH_NOT_EXPORTED', 'ERR_UNSUPPORTED_DIR_IMPORT', 'ERR_UNKNOWN_FILE_EXTENSION',
  'ERR_INVALID_MODULE_SPECIFIER', 'ERR_DLOPEN_FAILED',
]);
const NOMES_INCOMPATIVEIS = new Set(['SyntaxError', 'ReferenceError']);

/** Classifica um erro em: incompativel | offline | usuario | assinatura | rede | limite | desconhecido. */
export function classificarErro(err, { etapa = 'conectar' } = {}) {
  const nome = err?.name || '';
  const codigo = err?.code || '';
  const msg = String(err?.message || err || '');

  if (CODIGOS_INCOMPATIVEIS.has(codigo) || NOMES_INCOMPATIVEIS.has(nome)) return 'incompativel';
  // Recurso inexistente no Node embutido (ex.: "AbortSignal.timeout is not a function") vem antes de "rede",
  // porque a mensagem pode conter a palavra "timeout".
  if (nome === 'TypeError' && /is not a function|is not a constructor|cannot read propert|is not defined|not supported/i.test(msg)) return 'incompativel';
  if (nome === 'UserOfflineError' || /isn.?t (online|live)|not (currently )?(online|live)|user.*offline|offline|live has ended|not live/i.test(msg)) return 'offline';
  // O TikTok respondeu, mas não achou o @ (digitado errado ou conta inexistente).
  if (/user_not_found|19881007|user not found/i.test(msg)) return 'usuario';
  // Falha na assinatura (serviço de terceiros): vem antes de "rede", porque a mensagem cita "request failed".
  if (/^sign/i.test(nome) || /failed to sign|sign(ing)? (request|server|api)|eulerstream|euler stream/i.test(msg)) return 'assinatura';
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|timed? ?out|timeout|network|fetch failed|socket hang up|getaddrinfo/i.test(`${codigo} ${msg}`)) return 'rede';
  if (/rate.?limit|too many requests|429|api key|signature|sign (server|api)|unauthorized|forbidden|\b40[13]\b/i.test(msg)) return 'limite';
  // TypeError logo no carregamento/construção indica recurso inexistente no Node embutido.
  if (nome === 'TypeError' && etapa !== 'conectar') return 'incompativel';
  return 'desconhecido';
}

const CHAVE_NO_TEXTO = /(x-api-key|api[_-]?key|authorization)["']?\s*[:=]\s*["']?[^\s"',&]+/gi;

/** Tira chaves de qualquer texto que vá para a tela, o log ou o relatório. */
function ocultar(texto, segredos = []) {
  let t = String(texto ?? '');
  for (const seg of segredos) if (seg) t = t.split(seg).join('[chave oculta]');
  return t.replace(CHAVE_NO_TEXTO, '$1: [oculto]');
}

function descreverErro(err, segredos = []) {
  if (!err) return null;
  return {
    nome: err.name || null,
    codigo: err.code || null,
    mensagem: ocultar(err.message || err, segredos),
    pilha: ocultar(String(err.stack || '').split('\n').slice(0, 6).join('\n'), segredos),
    detalhes: ocultar(detalhesDaResposta(err), segredos) || null,
  };
}

/** Texto de apoio: status e corpo da resposta HTTP (se o erro trouxer), sem nunca incluir chaves. */
function detalhesDaResposta(err) {
  const alvos = [err, err?.cause, err?.exception, err?.info].filter(Boolean);
  const partes = [];
  for (const e of alvos) {
    const r = e.response;
    if (r) {
      let corpo = r.data;
      try { if (corpo && typeof corpo !== 'string') corpo = JSON.stringify(corpo); } catch (_) { corpo = null; }
      partes.push(`HTTP ${r.status ?? '?'}${corpo ? ' ' + String(corpo).slice(0, 300) : ''}`);
    }
    const host = (() => { try { return e.config?.url ? new URL(e.config.url).host : null; } catch (_) { return null; } })();
    if (host) partes.push(`servidor ${host}`);
  }
  const texto = partes.join(' · ').replace(CHAVE_NO_TEXTO, '$1: [oculto]');
  return texto || null;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function comLimite(promessa, ms, rotulo) {
  let t;
  const limite = new Promise((_, rej) => {
    t = setTimeout(() => {
      const e = new Error(`${rotulo} demorou mais de ${Math.round(ms / 1000)} s`);
      e.name = 'TimeoutError';
      e.code = 'ETIMEDOUT';
      rej(e);
    }, ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(t));
}

/**
 * Testa um candidato (nome do módulo instalado, ex.: "conector-2-0").
 * Dependências injetáveis para teste: importador.
 */
export async function testarConector({
  candidato,
  usuario,
  infoCandidato = {},          // { versao, enginesNode } vindo do build-info
  versaoNode = process.version,
  importador = (nome) => import(nome),
  timeoutConectarMs = 25000,
  esperaEventoMs = 8000,
  chaveEuler = null,           // chave opcional do Euler Stream (nunca aparece no resultado)
} = {}) {
  const inicio = Date.now();
  const resultado = {
    candidato,
    usuario,
    versaoConector: infoCandidato.versao ?? null,
    enginesNode: infoCandidato.enginesNode ?? null,
    nodeAtual: versaoNode,
    engines: avaliarEngines(versaoNode, infoCandidato.enginesNode),
    etapa: 'carregar',
    status: STATUS.INCONCLUSIVO,
    resumo: '',
    erro: null,
    evento: null,
    usouChave: Boolean(chaveEuler),
    tempoMs: 0,
  };
  const fechar = (status, resumo, erro) => {
    resultado.status = status;
    resultado.resumo = resumo;
    resultado.erro = descreverErro(erro, [chaveEuler]);
    resultado.tempoMs = Date.now() - inicio;
    return resultado;
  };

  // 1) carregar o pacote
  let modulo;
  try {
    modulo = await importador(candidato);
  } catch (e) {
    const tipo = classificarErro(e, { etapa: 'carregar' });
    return fechar(
      tipo === 'rede' ? STATUS.INCONCLUSIVO : STATUS.REPROVADO,
      `O pacote não carregou no Node embutido (${resultado.nodeAtual}).`,
      e,
    );
  }

  // 2) achar a classe de conexão (API nova ou antiga)
  const Nova = modulo.TikTokLiveConnection ?? modulo.default?.TikTokLiveConnection;
  const Antiga = modulo.WebcastPushConnection ?? modulo.default?.WebcastPushConnection;
  const Classe = Nova ?? Antiga;
  resultado.api = Nova ? 'TikTokLiveConnection (nova)' : Antiga ? 'WebcastPushConnection (antiga)' : null;
  if (typeof Classe !== 'function') {
    return fechar(STATUS.REPROVADO, 'O pacote carregou, mas não tem TikTokLiveConnection nem WebcastPushConnection.', null);
  }

  // 3) criar a conexão
  resultado.etapa = 'criar';
  let conexao;
  try {
    // A chave vai só para o serviço de assinatura. API nova: signApiKey; as duas APIs também recebem cabeçalho e parâmetro
    // (opção ignorada pela versão que não a conhece).
    const opcoes = !chaveEuler ? null
      : { ...(Nova ? { signApiKey: chaveEuler } : {}), signProviderOptions: { headers: { 'x-api-key': chaveEuler }, params: { apiKey: chaveEuler } } };
    conexao = opcoes ? new Classe(usuario, opcoes) : new Classe(usuario);
  } catch (e) {
    const tipo = classificarErro(e, { etapa: 'criar' });
    return fechar(tipo === 'rede' ? STATUS.INCONCLUSIVO : STATUS.REPROVADO, 'Não consegui criar a conexão.', e);
  }

  // 4) escutar eventos e conectar
  resultado.etapa = 'conectar';
  let primeiroEvento = null;
  let avisarEvento = () => {};
  const chegouEvento = new Promise((r) => { avisarEvento = r; });
  for (const nome of ['chat', 'gift', 'member', 'like', 'roomUser', 'social', 'follow', 'share']) {
    try {
      conexao.on(nome, () => { if (!primeiroEvento) { primeiroEvento = nome; avisarEvento(nome); } });
    } catch (_) { /* nome de evento inexistente nesta versão */ }
  }
  try { conexao.on('error', () => {}); } catch (_) { /* evita erro não tratado */ }

  try {
    await comLimite(Promise.resolve(conexao.connect()), timeoutConectarMs, 'A conexão');
  } catch (e) {
    const tipo = classificarErro(e, { etapa: 'conectar' });
    try { await comLimite(Promise.resolve(conexao.disconnect?.()), 3000, 'Desconectar'); } catch (_) { /* ignora */ }
    if (tipo === 'offline') {
      return fechar(STATUS.APROVADO, `O conector funcionou: o TikTok respondeu que @${usuario} não está ao vivo agora.`, e);
    }
    if (tipo === 'incompativel') {
      return fechar(STATUS.REPROVADO, 'O conector quebrou ao conectar por falta de recurso no Node embutido.', e);
    }
    if (tipo === 'rede') {
      return fechar(STATUS.INCONCLUSIVO, 'Sem resposta da internet ou do serviço de assinatura. Confira o sinal e tente de novo.', e);
    }
    if (tipo === 'usuario') {
      return fechar(STATUS.INCONCLUSIVO, `O TikTok não encontrou o perfil @${usuario}. Confira a grafia (sem o @) ou teste outro perfil que exista.`, e);
    }
    if (tipo === 'assinatura') {
      return fechar(
        STATUS.INCONCLUSIVO,
        chaveEuler
          ? 'O serviço de assinatura (Euler Stream) recusou o pedido mesmo com a chave. Pode ser chave inválida ou sem permissão, ou o formato de envio da chave. Copie o relatório.'
          : 'O serviço de assinatura (Euler Stream) recusou o pedido sem chave (limite gratuito por IP ou bloqueio). Cadastre uma chave grátis na seção abaixo ou tente em outra rede.',
        e,
      );
    }
    if (tipo === 'limite') {
      return fechar(STATUS.INCONCLUSIVO, 'O serviço de assinatura recusou ou limitou o pedido. Espere alguns minutos e tente de novo.', e);
    }
    return fechar(STATUS.INCONCLUSIVO, 'Erro que não reconheci. Copie o relatório e envie para análise.', e);
  }

  // conectou: espera um evento por um tempo curto e desconecta
  await Promise.race([chegouEvento, esperar(esperaEventoMs)]);
  resultado.evento = primeiroEvento;
  try { await comLimite(Promise.resolve(conexao.disconnect?.()), 3000, 'Desconectar'); } catch (_) { /* ignora */ }
  return fechar(
    STATUS.APROVADO,
    primeiroEvento
      ? `Conectou e recebeu um evento (${primeiroEvento}).`
      : `Conectou à live de @${usuario} (nenhum evento nos primeiros ${Math.round(esperaEventoMs / 1000)} s, normal se a live estiver parada).`,
    null,
  );
}

// Motor do jogo: módulo puro (sem tela, sem rede, sem TikTok). Recebe eventos normalizados e um relógio
// e devolve o estado. Por isso dá para testar tudo e reproduzir sessões.
//
// Corda: a bandeira tem posição P de 0 a 100. 0 = linha da base do Lula (Lula vence), 100 = linha da base
// do Flávio (Flávio vence), 50 = centro. Cada time acumula força recente (cada ponto perde metade do valor
// a cada "meiaVidaS"). P_alvo = 50 + 50 × (F_Flávio − F_Lula) / (F_Flávio + F_Lula + piso).
//
// Relógio: o motor usa o relógio monotônico injetado. Se um ciclo atrasar, os temporizadores seguem o relógio
// real; a física anda no máximo 1 s por ciclo e cada fase é visitada em ordem (nunca pulada).
import { LADOS, outroLado } from '../shared/textos.js';
import { TIPOS, eventoValido } from '../shared/tipos-de-evento.js';
import { detectarLado, normalizarTexto } from './palavras.js';
import { criarAntispam } from './antispam.js';
import { criarSequencias } from './sequencia.js';
import { resolverPresente } from './efeitos.js';
import { multiplicadorTotal, arredondar, formatarPontos } from './pontuacao.js';

export const FASES = Object.freeze({
  PARADO: 'parado', ABERTURA: 'abertura', DISPUTA: 'disputa', RETA_FINAL: 'reta-final',
  MORTE_SUBITA: 'morte-subita', RESULTADO: 'resultado',
});
const FASES_QUE_PONTUAM = new Set([FASES.DISPUTA, FASES.RETA_FINAL, FASES.MORTE_SUBITA]);

const FEED_MAX = 6;
const FEED_VIDA_MS = 8000;
const PASSO_FISICA_MAX_MS = 1000;
const IDS_RECENTES_MAX = 5000;

export function criarMotor({ config, gifts, relogio, relogioParede = () => Date.now() } = {}) {
  if (!config) throw new Error('criarMotor precisa de config');
  if (!relogio || typeof relogio.agora !== 'function') throw new Error('criarMotor precisa de um relógio com agora()');
  const cfg = config;
  const antispam = criarAntispam(cfg.limites);
  const sequencias = criarSequencias();

  // ---- estado ----
  let status = 'parado'; // parado | rodando | pausado | encerrado
  let fase = FASES.PARADO;
  let faseInicio = 0;
  let faseFim = 0;
  let rodadaN = 0;
  let pausadoEm = null;
  let ultimoTick = null;
  let P = 50;
  let forca = { lula: 0, flavio: 0 };
  let nocauteMs = 0;
  let zebraAtiva = null;
  let zebraCandidato = null;
  let zebraMs = 0;
  let barra = 0;
  let modoTeste = false;
  let inicioDaSessao = null;
  let rodada = novaRodada();
  let live = novoPlacarDaLive();
  let rodadas = [];
  let resultado = null;
  let espectadores = { agora: 0, pico: 0 };
  let ultimoEventoEm = null;
  let eventosContados = 0;
  const usuarios = new Map();
  const idsRecentes = new Set();
  const feed = [];
  const pendentes = [];
  let idFeed = 0;

  function novaRodada() {
    return {
      inicioMs: null, inicioParede: null,
      pontos: { lula: 0, flavio: 0 }, moedas: { lula: 0, flavio: 0 },
      participantes: new Set(), apoiadores: { lula: new Map(), flavio: new Map() },
      pMin: 50, pMax: 50,
    };
  }
  function novoPlacarDaLive() { return { ganhas: { lula: 0, flavio: 0 }, empates: 0, melhorSequencia: 0, sequenciaAtual: { lado: null, n: 0 } }; }

  const agora = () => relogio.agora();
  const emitir = (nome, dados = {}) => { pendentes.push({ nome, ...dados }); };

  function usuarioDe(u) {
    const id = String(u.id);
    let r = usuarios.get(id);
    if (!r) {
      r = { id, uid: String(u.uniqueId ?? id), nome: String(u.nickname ?? u.uniqueId ?? id), avatarUrl: u.avatarUrl ?? null, lado: null, ptsLive: 0, moedasLive: 0, rodadasJogou: new Set() };
      usuarios.set(id, r);
    } else {
      if (u.uniqueId) r.uid = String(u.uniqueId);
      if (u.nickname) r.nome = String(u.nickname);
      if (u.avatarUrl) r.avatarUrl = u.avatarUrl;
    }
    return r;
  }

  const fasePontua = () => status === 'rodando' && FASES_QUE_PONTUAM.has(fase);
  const multDaFase = () => {
    if (fase === FASES.RETA_FINAL) return cfg.retaFinal.ativa ? cfg.retaFinal.multiplicador : 1;
    if (fase === FASES.MORTE_SUBITA) return cfg.morteSubita.multiplicador;
    return 1;
  };
  const ladoNaFrente = () => (P < cfg.corda.empateMin ? 'lula' : P > cfg.corda.empateMax ? 'flavio' : null);

  function mudarLado(u, lado, t) {
    if (u.lado === lado) return;
    if (u.lado) {
      // sai da lista de apoiadores do lado antigo da rodada (os pontos da rodada ficam no registro da pessoa)
      const antigo = rodada.apoiadores[u.lado].get(u.id);
      if (antigo) rodada.apoiadores[u.lado].delete(u.id);
    }
    u.lado = lado;
    antispam.marcarLado(u.id, t);
  }

  function adicionarFeed(lado, texto, uid) {
    feed.push({ id: ++idFeed, lado, texto, uid, em: agora() });
    while (feed.length > FEED_MAX) feed.shift();
  }

  /** Aplica pontos já validados a um lado. Devolve os pontos finais (com multiplicadores). */
  function aplicarPontos(u, lado, base, { moedas = 0, dourado = false } = {}) {
    const mult = multiplicadorTotal([], multDaFase(), cfg.multiplicadorMaximo);
    const bonusZebra = zebraAtiva === lado ? 1 + cfg.zebra.bonusPercentual / 100 : 1;
    const pts = base * mult * bonusZebra;
    forca[lado] += pts;
    rodada.pontos[lado] += pts;
    rodada.moedas[lado] += moedas;
    rodada.participantes.add(u.id);
    u.rodadasJogou.add(rodadaN);
    u.ptsLive += pts;
    u.moedasLive += moedas;
    const mapa = rodada.apoiadores[lado];
    let ap = mapa.get(u.id);
    if (!ap) {
      ap = { id: u.id, uid: u.uid, nome: u.nome, lado, pts: 0, dourado: false, entrouEm: agora() };
      mapa.set(u.id, ap);
    }
    ap.pts += pts;
    ap.uid = u.uid;
    if (dourado) ap.dourado = true;
    return pts;
  }

  function adicionarNaBarra(unidades) {
    if (!cfg.barraVirada.ativa || !fasePontua() || !(unidades > 0)) return;
    barra += unidades;
    while (barra >= cfg.barraVirada.meta) {
      barra -= cfg.barraVirada.meta;
      let perdedor = P > 50.5 ? 'lula' : P < 49.5 ? 'flavio' : null;
      if (!perdedor && forca.lula !== forca.flavio) perdedor = forca.lula < forca.flavio ? 'lula' : 'flavio';
      if (perdedor) {
        forca[perdedor] += cfg.barraVirada.impulso;
        rodada.pontos[perdedor] += cfg.barraVirada.impulso;
      }
      emitir('barra-cheia', { lado: perdedor });
    }
  }

  // ---- eventos ----
  function processarChat(ev, u, t) {
    const det = detectarLado(ev.texto, cfg.lados);
    if (!det.lado || det.ambos) return;
    if (antispam.repetido(u.id, normalizarTexto(ev.texto), t)) return;
    if (!antispam.intervaloOk(u.id, t)) return;
    if (u.lado && u.lado !== det.lado && !antispam.trocaOk(u.id, t)) return;
    mudarLado(u, det.lado, t);
    antispam.marcarContado(u.id, t);
    if (!fasePontua()) return;
    const concedido = antispam.reservar(u.id, 'comentario', cfg.pontos.comentario, t);
    if (concedido <= 0) return;
    const pts = aplicarPontos(u, det.lado, concedido);
    adicionarFeed(det.lado, `@${u.uid} comentou: ${String(det.palavra).toUpperCase()} +${formatarPontos(pts)}`, u.uid);
  }

  function processarPresente(ev, u, t) {
    const unidades = sequencias.unidadesNovas(ev);
    if (unidades <= 0) return;
    const r = resolverPresente(ev.nome, ev.valorMoedas, gifts);
    if (r.lado) mudarLado(u, r.lado, t); // o presente da tabela sempre vale para o lado dele
    const lado = r.lado ?? u.lado;
    if (!fasePontua()) return;
    const moedas = unidades * Number(ev.valorMoedas);
    const base = moedas * r.pontosPorMoeda;
    const nome = String(ev.nome ?? 'presente');
    if (!lado) {
      adicionarNaBarra(base);
      adicionarFeed(null, `@${u.uid} enviou ${nome} ×${unidades}: comente ${cfg.lados.lula.nome} ou ${cfg.lados.flavio.nome} para escolher seu lado`, u.uid);
      return;
    }
    const pts = aplicarPontos(u, lado, base, { moedas });
    const nomeLado = lado === 'lula' ? 'Lula' : 'Flávio';
    adicionarFeed(lado, `@${u.uid} enviou ${nome} ×${unidades} → apoio ao ${nomeLado} +${formatarPontos(pts)}`, u.uid);
    emitir('presente', { lado, efeito: r.efeito.id, unidades, moedas, uid: u.uid });
  }

  function processarCurtida(ev, u, t) {
    if (!fasePontua()) return;
    const n = Math.floor(Number(ev.quantidade));
    if (!(n > 0)) return;
    if (!u.lado) { adicionarNaBarra(n); return; }
    const concedido = antispam.reservar(u.id, 'curtida', n * cfg.pontos.curtida, t);
    if (concedido > 0) aplicarPontos(u, u.lado, concedido);
  }

  function processarSeguidor(ev, u) {
    if (!antispam.primeiroSeguir(u.id)) return;
    if (!fasePontua()) return;
    if (!u.lado) { adicionarNaBarra(cfg.pontos.seguidor); return; }
    const pts = aplicarPontos(u, u.lado, cfg.pontos.seguidor, { dourado: true });
    adicionarFeed(u.lado, `@${u.uid} virou TORCEDOR FIEL +${formatarPontos(pts)}`, u.uid);
  }

  function processarCompartilhamento(ev, u, t) {
    if (!fasePontua() || !u.lado) return;
    if (!antispam.compartilharOk(u.id, t)) return;
    const pts = aplicarPontos(u, u.lado, cfg.pontos.compartilhamento);
    adicionarFeed(u.lado, `@${u.uid} chamou a CARREATA +${formatarPontos(pts)}`, u.uid);
  }

  function processarAssinante(ev, u) {
    if (!cfg.assinante.ativo || !fasePontua() || !u.lado) return;
    const pts = aplicarPontos(u, u.lado, cfg.pontos.assinante, { dourado: true });
    adicionarFeed(u.lado, `@${u.uid} apoiou como assinante +${formatarPontos(pts)}`, u.uid);
  }

  /** Processa um evento normalizado. Devolve true se o evento foi aceito pelo motor. */
  function processarEvento(ev) {
    if (!eventoValido(ev)) return false;
    if (ev.tipo === TIPOS.VIEWERS) {
      espectadores.agora = Number(ev.numero) || 0;
      espectadores.pico = Math.max(espectadores.pico, espectadores.agora);
      return true;
    }
    if (status !== 'rodando') return false;
    if (ev.idMensagem !== undefined && ev.idMensagem !== null) {
      const chave = String(ev.idMensagem);
      if (idsRecentes.has(chave)) return false;
      idsRecentes.add(chave);
      if (idsRecentes.size > IDS_RECENTES_MAX) idsRecentes.delete(idsRecentes.values().next().value);
    }
    if (ev.tipo === TIPOS.STREAM_END) { emitir('live-terminou'); return true; }
    if (ev.origem && ev.origem !== 'ao-vivo') modoTeste = true;
    const t = agora();
    ultimoEventoEm = t;
    eventosContados += 1;
    const u = usuarioDe(ev.usuario);
    switch (ev.tipo) {
      case TIPOS.CHAT: processarChat(ev, u, t); break;
      case TIPOS.GIFT: processarPresente(ev, u, t); break;
      case TIPOS.LIKE: processarCurtida(ev, u, t); break;
      case TIPOS.FOLLOW: processarSeguidor(ev, u); break;
      case TIPOS.SHARE: processarCompartilhamento(ev, u, t); break;
      case TIPOS.SUBSCRIBE: processarAssinante(ev, u); break;
      default: break; // join: só conta como evento recebido
    }
    return true;
  }

  // ---- fases ----
  const dur = (s) => Math.round(s * 1000);

  function entrarNaFase(nova, inicio) {
    fase = nova;
    faseInicio = inicio;
    const d = {
      [FASES.ABERTURA]: cfg.duracoes.aberturaS, [FASES.DISPUTA]: cfg.duracoes.disputaS,
      [FASES.RETA_FINAL]: cfg.duracoes.retaFinalS, [FASES.MORTE_SUBITA]: cfg.duracoes.morteSubitaS,
      [FASES.RESULTADO]: cfg.duracoes.resultadoS,
    }[nova];
    faseFim = inicio + dur(d);
    emitir('fase', { fase: nova, rodada: rodadaN });
  }

  function iniciarRodada(n, t) {
    rodadaN = n;
    forca = { lula: 0, flavio: 0 };
    barra = 0; nocauteMs = 0; zebraAtiva = null; zebraCandidato = null; zebraMs = 0;
    rodada = novaRodada();
    rodada.inicioMs = t; rodada.inicioParede = relogioParede();
    resultado = null;
    entrarNaFase(FASES.ABERTURA, t);
  }

  function capitaoDe(lado) {
    let melhor = null;
    for (const ap of rodada.apoiadores[lado].values()) if (!melhor || ap.pts > melhor.pts) melhor = ap;
    return melhor ? { id: melhor.id, uid: melhor.uid, pts: arredondar(melhor.pts) } : null;
  }

  function finalizarRodada(como, vencedor, t) {
    const registro = {
      n: rodadaN, inicioEm: rodada.inicioParede, duracaoMs: Math.max(0, t - (rodada.inicioMs ?? t)),
      vencedor, como,
      pontos: { lula: arredondar(rodada.pontos.lula), flavio: arredondar(rodada.pontos.flavio) },
      moedas: { ...rodada.moedas }, participantes: rodada.participantes.size,
      capitaes: { lula: capitaoDe('lula'), flavio: capitaoDe('flavio') },
      pFinal: arredondar(P), pMin: arredondar(rodada.pMin), pMax: arredondar(rodada.pMax),
    };
    rodadas.push(registro);
    if (vencedor) {
      live.ganhas[vencedor] += 1;
      if (live.sequenciaAtual.lado === vencedor) live.sequenciaAtual.n += 1; else live.sequenciaAtual = { lado: vencedor, n: 1 };
      live.melhorSequencia = Math.max(live.melhorSequencia, live.sequenciaAtual.n);
    } else {
      live.empates += 1;
      live.sequenciaAtual = { lado: null, n: 0 };
    }
    resultado = registro;
    entrarNaFase(FASES.RESULTADO, t);
    emitir('fim-rodada', { registro });
  }

  function decidirFimDoTempo(t) {
    if (P >= cfg.corda.empateMin && P <= cfg.corda.empateMax) {
      entrarNaFase(FASES.MORTE_SUBITA, Math.min(faseFim, t));
      return;
    }
    finalizarRodada('tempo', P < 50 ? 'lula' : 'flavio', t);
  }

  function avancarFase(t) {
    const inicioNovo = Math.min(faseFim, t); // sem "desvio" de relógio: a próxima fase começa quando a anterior acabou
    switch (fase) {
      case FASES.ABERTURA: entrarNaFase(FASES.DISPUTA, inicioNovo); break;
      case FASES.DISPUTA:
        if (cfg.retaFinal.ativa) entrarNaFase(FASES.RETA_FINAL, inicioNovo); else decidirFimDoTempo(t);
        break;
      case FASES.RETA_FINAL: decidirFimDoTempo(t); break;
      case FASES.MORTE_SUBITA: {
        if (P < 50) finalizarRodada('morte-subita', 'lula', t);
        else if (P > 50) finalizarRodada('morte-subita', 'flavio', t);
        else finalizarRodada('empate', null, t);
        break;
      }
      case FASES.RESULTADO: iniciarRodada(rodadaN + 1, inicioNovo); break;
      default: break;
    }
  }

  // ---- ciclo de atualização (chamado ~10 vezes por segundo) ----
  function tick() {
    const t = agora();
    if (status !== 'rodando') { ultimoTick = t; return; }
    const dtReal = ultimoTick === null ? 0 : Math.max(0, t - ultimoTick);
    ultimoTick = t;
    const dt = Math.min(dtReal, PASSO_FISICA_MAX_MS);

    if (t >= faseFim) avancarFase(t);

    if (fase !== FASES.RESULTADO && dt > 0) {
      const s = dt / 1000;
      const decaimento = 0.5 ** (s / cfg.corda.meiaVidaS);
      forca.lula *= decaimento;
      forca.flavio *= decaimento;
      const alvo = 50 + 50 * (forca.flavio - forca.lula) / (forca.flavio + forca.lula + cfg.corda.piso);
      const suave = (alvo - P) * (1 - Math.exp(-cfg.corda.suavizacaoPorS * s));
      const max = cfg.corda.velocidadeMaxPorS * s;
      P += Math.max(-max, Math.min(max, suave));
      P = Math.max(0, Math.min(100, P));
      if (FASES_QUE_PONTUAM.has(fase)) {
        rodada.pMin = Math.min(rodada.pMin, P);
        rodada.pMax = Math.max(rodada.pMax, P);
        atualizarZebra(dt);
        verificarNocaute(dt, t);
      }
    }
  }

  function atualizarZebra(dt) {
    if (!cfg.zebra.ativa) { zebraAtiva = null; return; }
    const dist = Math.abs(P - 50);
    if (dist > cfg.zebra.distancia) {
      const atras = P > 50 ? 'lula' : 'flavio';
      if (zebraCandidato === atras) zebraMs += dt; else { zebraCandidato = atras; zebraMs = dt; }
      if (zebraMs >= cfg.zebra.tempoS * 1000 && zebraAtiva !== atras) {
        zebraAtiva = atras;
        emitir('zebra', { lado: atras });
      }
    } else if (!zebraAtiva) {
      zebraCandidato = null; zebraMs = 0;
    }
    if (dist <= cfg.zebra.sairAbaixoDe) { zebraAtiva = null; zebraCandidato = null; zebraMs = 0; }
  }

  function verificarNocaute(dt, t) {
    if (fase === FASES.RESULTADO) return;
    if (P <= cfg.corda.nocauteLimite || P >= 100 - cfg.corda.nocauteLimite) nocauteMs += dt; else nocauteMs = 0;
    if (nocauteMs >= cfg.corda.nocauteS * 1000) {
      emitir('nocaute', { lado: P < 50 ? 'lula' : 'flavio' });
      finalizarRodada('nocaute', P < 50 ? 'lula' : 'flavio', t);
    }
  }

  // ---- comandos do streamer ----
  function iniciar() {
    if (status === 'rodando' || status === 'pausado') return false;
    const t = agora();
    live = novoPlacarDaLive(); rodadas = []; usuarios.clear(); antispam.limpar(); sequencias.limpar();
    feed.length = 0; modoTeste = false; eventosContados = 0; ultimoEventoEm = null;
    P = 50; status = 'rodando'; ultimoTick = t; pausadoEm = null;
    inicioDaSessao = relogioParede();
    iniciarRodada(1, t);
    return true;
  }
  function pausar() {
    if (status !== 'rodando') return false;
    pausadoEm = agora(); status = 'pausado';
    return true;
  }
  function retomar() {
    if (status !== 'pausado') return false;
    const t = agora();
    const parado = t - pausadoEm;
    faseInicio += parado; faseFim += parado;
    pausadoEm = null; status = 'rodando'; ultimoTick = t;
    return true;
  }
  function proximaRodada() {
    if (status !== 'rodando' && status !== 'pausado') return false;
    const t = agora();
    if (status === 'pausado') { pausadoEm = null; status = 'rodando'; }
    ultimoTick = t;
    iniciarRodada(rodadaN + 1, t);
    return true;
  }
  function reiniciarRodada() {
    if (status !== 'rodando' && status !== 'pausado') return false;
    const t = agora();
    if (status === 'pausado') { pausadoEm = null; status = 'rodando'; }
    ultimoTick = t;
    iniciarRodada(rodadaN, t);
    return true;
  }
  function zerarPlacar() {
    live = novoPlacarDaLive(); rodadas = [];
    for (const u of usuarios.values()) { u.ptsLive = 0; u.moedasLive = 0; u.rodadasJogou = new Set(); }
    return true;
  }
  function encerrar() {
    if (status === 'parado' || status === 'encerrado') return relatorio();
    const rel = relatorio();
    status = 'encerrado'; fase = FASES.PARADO; pausadoEm = null;
    emitir('encerrado');
    return rel;
  }

  // ---- saída ----
  function topUsuarios(n = 10) {
    return [...usuarios.values()].filter((u) => u.ptsLive > 0)
      .sort((a, b) => b.ptsLive - a.ptsLive).slice(0, n)
      .map((u) => ({ id: u.id, uid: u.uid, lado: u.lado, pontos: arredondar(u.ptsLive), moedas: u.moedasLive }));
  }

  function relatorio() {
    const t = relogioParede();
    return {
      geradoEm: new Date(t).toISOString(),
      inicioEm: inicioDaSessao ? new Date(inicioDaSessao).toISOString() : null,
      duracaoMs: inicioDaSessao ? t - inicioDaSessao : 0,
      modoTeste,
      rodadas: rodadas.length,
      placar: { lula: live.ganhas.lula, flavio: live.ganhas.flavio, empates: live.empates },
      melhorSequencia: live.melhorSequencia,
      pessoas: usuarios.size,
      moedas: rodadas.reduce((s, r) => ({ lula: s.lula + r.moedas.lula, flavio: s.flavio + r.moedas.flavio }), { lula: 0, flavio: 0 }),
      pico: espectadores.pico,
      topUsuarios: topUsuarios(10),
      detalheDasRodadas: rodadas,
    };
  }

  function apoiadoresVisiveis(lado, t) {
    const todos = [...rodada.apoiadores[lado].values()].sort((a, b) => b.pts - a.pts);
    const max = cfg.apoiadoresPorLado;
    return {
      lista: todos.slice(0, max).map((a) => ({ id: a.id, uid: a.uid, nome: a.nome, pts: arredondar(a.pts), dourado: a.dourado, idadeMs: t - a.entrouEm })),
      extra: Math.max(0, todos.length - max),
      total: todos.length,
    };
  }

  function contagemMs(t) {
    const resto = Math.max(0, faseFim - t);
    if (fase === FASES.DISPUTA && cfg.retaFinal.ativa) return resto + dur(cfg.duracoes.retaFinalS);
    return resto;
  }

  /** Fotografia completa do jogo, pronta para virar JSON e ir para o overlay e o painel. */
  function estado() {
    const t = status === 'pausado' ? pausadoEm : agora();
    const fT = forca.lula + forca.flavio;
    const apL = apoiadoresVisiveis('lula', t);
    const apF = apoiadoresVisiveis('flavio', t);
    const avisoIdx = cfg.avisos.length ? Math.floor((t / 1000) / cfg.avisoIntervaloS) % cfg.avisos.length : 0;
    return {
      sessao: { status, rodada: rodadaN, modoTeste, nome: cfg.nomeDoJogo },
      fase: { nome: fase, restanteMs: Math.max(0, faseFim - t), duracaoMs: Math.max(0, faseFim - faseInicio), contagemMs: contagemMs(t), multiplicador: status === 'rodando' || status === 'pausado' ? multDaFase() : 1 },
      corda: {
        P: arredondar(P), forca: { lula: arredondar(forca.lula), flavio: arredondar(forca.flavio) },
        percentual: { lula: fT > 0 ? Math.round((forca.lula / fT) * 100) : 50, flavio: fT > 0 ? 100 - Math.round((forca.lula / fT) * 100) : 50 },
        zebra: zebraAtiva, naFrente: ladoNaFrente(), nocauteMs: Math.round(nocauteMs),
      },
      placar: {
        rodada: { lula: arredondar(rodada.pontos.lula), flavio: arredondar(rodada.pontos.flavio) },
        moedas: { ...rodada.moedas },
        diferenca: arredondar(Math.abs(rodada.pontos.lula - rodada.pontos.flavio)),
        apoiadores: { lula: apL.total, flavio: apF.total },
        live: { lula: live.ganhas.lula, flavio: live.ganhas.flavio, empates: live.empates },
      },
      apoiadores: { lula: apL.lista, flavio: apF.lista, extra: { lula: apL.extra, flavio: apF.extra } },
      capitaes: { lula: capitaoDe('lula'), flavio: capitaoDe('flavio') },
      barra: { valor: Math.round(barra), meta: cfg.barraVirada.meta, ativa: cfg.barraVirada.ativa },
      feed: feed.filter((f) => t - f.em < FEED_VIDA_MS).map((f) => ({ id: f.id, lado: f.lado, texto: f.texto, idadeMs: t - f.em })),
      aviso: cfg.avisos[avisoIdx] ?? '',
      resultado,
      espectadores: { ...espectadores },
      lados: { lula: cfg.lados.lula.nome, flavio: cfg.lados.flavio.nome },
    };
  }

  const drenarEventos = () => pendentes.splice(0, pendentes.length);

  return {
    processarEvento, tick, estado, drenarEventos, relatorio,
    iniciar, pausar, retomar, proximaRodada, reiniciarRodada, zerarPlacar, encerrar,
    // leitura para métricas e testes
    get status() { return status; },
    get fase() { return fase; },
    get rodadaAtual() { return rodadaN; },
    get rodadas() { return rodadas; },
    get posicao() { return P; },
    get ultimoEventoEm() { return ultimoEventoEm; },
    get eventosContados() { return eventosContados; },
    pessoas: () => usuarios.size,
    topUsuarios,
  };
}

export { LADOS, outroLado };

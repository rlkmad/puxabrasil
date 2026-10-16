// Cola entre o motor do jogo (puro), as fontes de eventos e as telas (overlay e painel).
// - recebe eventos das fontes numa fila protegida (acima de 200 eventos por segundo, agrupa curtidas por pessoa);
// - roda o motor 10 vezes por segundo com o relógio monotônico;
// - difunde o estado e os eventos discretos pelo WebSocket;
// - mede o próprio desempenho (atraso do motor, fila, eventos por segundo, memória) para o painel.
import path from 'node:path';
import { criarMotor } from '../engine/motor.js';
import { efeitoPorId } from '../engine/efeitos.js';
import { eventoValido, TIPOS } from '../shared/tipos-de-evento.js';
import { MSG } from '../shared/mensagens-ws.js';
import { criarSimulador } from './fontes/simulador.js';
import { escreverAtomico, carimboDeHora } from './persistencia.js';
import { info, erro } from './log.js';

const INTERVALO_MS = 100;
const LIMIAR_AGRUPAR_POR_TICK = 20; // 200 eventos por segundo
const JANELA_METRICAS = 50;          // últimos 5 s

export function criarJogo({ config, gifts, avisosDeConfig = [], pastaDados, difundir = () => {}, temClientes = () => true, relogio = { agora: () => performance.now() } }) {
  const motor = criarMotor({ config, gifts, relogio });
  const fila = [];
  const recebidosPorSegundo = [];
  const duracoes = [];
  const atrasos = [];
  let agrupados = 0;
  let descartados = 0;
  let maxFila = 0;
  let overlayFps = null;
  let overlayFpsEm = 0;
  let timer = null;
  let ultimoTickReal = null;
  let ultimoRelatorio = null;

  const simulador = criarSimulador({ emitir: (ev) => enfileirar(ev), palavras: config.lados });

  function enfileirar(ev) {
    if (!eventoValido(ev)) { descartados += 1; return false; }
    fila.push(ev);
    recebidosPorSegundo.push(relogio.agora());
    maxFila = Math.max(maxFila, fila.length);
    return true;
  }

  /** Acima de 200 eventos por segundo: junta as curtidas da mesma pessoa em um único evento. */
  function agruparSePreciso() {
    if (fila.length <= LIMIAR_AGRUPAR_POR_TICK) return;
    const antes = fila.length;
    const porPessoa = new Map();
    const saida = [];
    for (const ev of fila) {
      if (ev.tipo === TIPOS.LIKE) {
        const k = ev.usuario.id;
        const ja = porPessoa.get(k);
        if (ja) { ja.quantidade += Number(ev.quantidade); ja.total = ev.total ?? ja.total; continue; }
        const copia = { ...ev, quantidade: Number(ev.quantidade) };
        porPessoa.set(k, copia);
        saida.push(copia);
      } else saida.push(ev);
    }
    fila.length = 0;
    fila.push(...saida);
    agrupados += antes - saida.length;
  }

  function ciclo() {
    const t0 = performance.now();
    const real = relogio.agora();
    if (ultimoTickReal !== null) {
      atrasos.push(Math.max(0, real - ultimoTickReal - INTERVALO_MS));
      if (atrasos.length > JANELA_METRICAS) atrasos.shift();
    }
    ultimoTickReal = real;
    try {
      agruparSePreciso();
      const lote = fila.splice(0, fila.length);
      for (const ev of lote) motor.processarEvento(ev);
      motor.tick();
      if (temClientes()) difundir({ tipo: MSG.ESTADO, ...motor.estado() });
      for (const e of motor.drenarEventos()) {
        if (e.nome === 'fim-rodada') info(`Rodada ${e.registro.n} terminou: ${e.registro.vencedor ?? 'empate'} (${e.registro.como})`);
        if (temClientes()) difundir({ tipo: MSG.EVENTO, ...e });
      }
    } catch (e) {
      erro('Falha no ciclo do jogo:', e);
    }
    duracoes.push(performance.now() - t0);
    if (duracoes.length > JANELA_METRICAS) duracoes.shift();
    while (recebidosPorSegundo.length && real - recebidosPorSegundo[0] > 1000) recebidosPorSegundo.shift();
  }

  const media = (lista) => (lista.length ? lista.reduce((s, x) => s + x, 0) / lista.length : 0);
  const arred = (n) => Math.round(n * 10) / 10;

  function metricas() {
    const mem = process.memoryUsage();
    return {
      tickMedioMs: arred(media(duracoes)), tickMaxMs: arred(Math.max(0, ...duracoes)),
      atrasoMedioMs: arred(media(atrasos)), atrasoMaxMs: arred(Math.max(0, ...atrasos)),
      fila: fila.length, filaMax: maxFila, eventosPorSegundo: recebidosPorSegundo.length,
      agrupados, descartados, pessoas: motor.pessoas(),
      memoriaMB: { rss: Math.round(mem.rss / 1048576), heap: Math.round(mem.heapUsed / 1048576) },
      overlayFps: overlayFpsEm && relogio.agora() - overlayFpsEm < 6000 ? overlayFps : null,
      simulador: simulador.estado(),
    };
  }

  function salvarRelatorio(rel) {
    try {
      const arquivo = path.join(pastaDados, 'relatorios', `${carimboDeHora()}.json`);
      escreverAtomico(arquivo, JSON.stringify(rel, null, 2));
      info('Relatório salvo em ' + arquivo);
      return arquivo;
    } catch (e) { erro('Não consegui salvar o relatório:', e); return null; }
  }

  const COMANDOS = {
    iniciar: () => motor.iniciar(),
    pausar: () => motor.pausar(),
    retomar: () => motor.retomar(),
    proxima: () => motor.proximaRodada(),
    reiniciar: () => motor.reiniciarRodada(),
    zerar: () => motor.zerarPlacar(),
  };

  return {
    motor, simulador, config, gifts, avisosDeConfig,
    enfileirar,
    iniciarLoop() {
      if (timer) return;
      ultimoTickReal = null;
      timer = setInterval(ciclo, INTERVALO_MS);
      timer.unref?.();
    },
    pararLoop() { if (timer) { clearInterval(timer); timer = null; } simulador.parar(); },
    /** Um ciclo manual (testes). */
    ciclo,
    comando(nome) {
      if (nome === 'encerrar') {
        simulador.parar();
        const rel = motor.encerrar();
        ultimoRelatorio = { ...rel, arquivo: salvarRelatorio(rel) };
        return { ok: true, relatorio: ultimoRelatorio };
      }
      const f = COMANDOS[nome];
      if (!f) return { ok: false, erro: 'Comando desconhecido.' };
      const ok = f();
      return { ok: ok !== false };
    },
    get ultimoRelatorio() { return ultimoRelatorio; },
    metricas,
    registrarFpsDoOverlay(fps) {
      const n = Number(fps);
      if (Number.isFinite(n) && n >= 0 && n <= 1000) { overlayFps = Math.round(n); overlayFpsEm = relogio.agora(); }
    },
    /** Legenda de presentes (pares por efeito) para o overlay e o painel. */
    legenda() {
      return Object.entries(gifts.efeitos).map(([id, d]) => ({ efeito: id, nomeEfeito: efeitoPorId(id)?.nome ?? id, lula: d.lula ?? null, flavio: d.flavio ?? null }));
    },
  };
}

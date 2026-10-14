// Servidor da Fase 0: serve /overlay e /painel (vazios/diagnóstico), WebSocket e a API de diagnóstico.
// Escuta só em 127.0.0.1. Roda no Node 20+ (testes) e no Node embutido do app (Node 18).
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { configurarLog, info, erro, ultimasLinhas } from './log.js';
import { criarBatimento } from './batimento.js';
import { resolverPastaDados, testarGravacao, recursosDoNode, infoDoNode } from './recursos.js';
import { avaliarEngines } from './versoes.js';
import { testarConector, STATUS } from './conector-teste.js';
import { criarConfiguracao } from './configuracao.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_NODEJS = path.resolve(AQUI, '..', '..');
const PASTA_WEB = path.resolve(AQUI, '..', 'web');

function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch (_) { return null; }
}

/** Candidatos do conector: vêm do build-info.json (gerado no build) ou, no computador, do pacote instalado. */
function lerCandidatos() {
  const info = lerJson(path.join(RAIZ_NODEJS, 'build-info.json'));
  if (info?.candidatos?.length) return { candidatos: info.candidatos, nativos: info.nativos ?? [], geradoEm: info.geradoEm ?? null, origem: 'build-info.json' };
  const pkg = lerJson(path.join(RAIZ_NODEJS, 'node_modules', 'tiktok-live-connector', 'package.json'));
  if (pkg) {
    return {
      candidatos: [{ nome: 'tiktok-live-connector', pacote: 'tiktok-live-connector', versao: pkg.version, enginesNode: pkg.engines?.node ?? null }],
      nativos: [], geradoEm: null, origem: 'node_modules (desenvolvimento)',
    };
  }
  return { candidatos: [], nativos: [], geradoEm: null, origem: 'nenhum conector instalado' };
}

export async function iniciarServidor({ portaInicial = 3000, tentativas = 11, host = '127.0.0.1' } = {}) {
  const dados = resolverPastaDados();
  configurarLog(path.join(dados.caminho, 'logs'));
  info(`Servidor iniciando. Node ${process.version}, pasta de dados: ${dados.caminho} (${dados.origem})`);

  const erros = []; // erros não tratados (guardados para o diagnóstico)
  const registrarErro = (tipo, e) => {
    erro(tipo, e);
    erros.push({ em: new Date().toISOString(), tipo, mensagem: String(e?.stack || e?.message || e).split('\n').slice(0, 4).join(' | ') });
    if (erros.length > 20) erros.shift();
  };
  process.on('uncaughtException', (e) => registrarErro('uncaughtException', e));
  process.on('unhandledRejection', (e) => registrarErro('unhandledRejection', e));

  const batimento = criarBatimento();
  batimento.iniciar();

  // avisos do app (pausa/retomada) vindos do módulo bridge, quando existir
  const ponte = globalThis.__PUXA_PONTE__;
  try {
    ponte?.app?.on?.('pause', (trava) => { batimento.registrarEventoApp('pause'); try { trava?.release?.(); } catch (_) {} });
    ponte?.app?.on?.('resume', () => batimento.registrarEventoApp('resume'));
  } catch (e) { registrarErro('bridge.app.on', e); }

  const conectores = lerCandidatos();
  const escrita = testarGravacao(dados.caminho);
  const config = criarConfiguracao(dados.caminho);
  const resultadosConector = {}; // por candidato
  let testando = false;

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4kb' }));

  // A página de abertura (origem http://localhost) descobre a porta chamando este endereço.
  app.get('/api/ping', (_req, res) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
    res.json({ app: 'puxa-brasil', fase: 0, node: process.version });
  });

  const enviarPagina = (arquivo) => (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(PASTA_WEB, arquivo, 'index.html'));
  };
  app.get('/', (_req, res) => res.redirect('/painel'));
  app.get('/painel', enviarPagina('painel'));
  app.get('/overlay', enviarPagina('overlay'));

  const servidor = http.createServer(app);
  const wss = new WebSocketServer({ server: servidor, path: '/ws' });
  let numeroBatida = 0;
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ tipo: 'ola', fase: 0, node: process.version }));
    ws.on('message', (m) => {
      try { if (JSON.parse(String(m)).tipo === 'ping') ws.send(JSON.stringify({ tipo: 'pong', t: Date.now() })); } catch (_) { /* ignora */ }
    });
    ws.on('error', () => {});
  });
  const emissor = setInterval(() => {
    numeroBatida += 1;
    const msg = JSON.stringify({ tipo: 'batida', n: numeroBatida, clientes: wss.clients.size });
    for (const c of wss.clients) { if (c.readyState === 1) c.send(msg); }
  }, 1000);
  emissor.unref?.();

  let portaEscolhida = null;

  function montarDiagnostico() {
    const mem = process.memoryUsage();
    const candidatos = conectores.candidatos.map((c) => ({
      ...c,
      engines: avaliarEngines(process.version, c.enginesNode),
      ultimoTeste: resultadosConector[c.nome] ?? null,
    }));
    return {
      fase: 0,
      agora: new Date().toISOString(),
      porta: portaEscolhida,
      node: infoDoNode(),
      recursos: recursosDoNode(),
      pastaDados: { ...dados, ...escrita },
      uptimeS: Math.round(process.uptime()),
      memoriaMB: { rss: Math.round(mem.rss / 1048576), heapUsado: Math.round(mem.heapUsed / 1048576) },
      euler: config.resumoEuler(),
      conectores: { origem: conectores.origem, geradoEm: conectores.geradoEm, candidatos, nativos: conectores.nativos },
      batimento: batimento.estado(),
      websocket: { clientes: wss.clients.size },
      ponteDisponivel: Boolean(ponte),
      errosNaoTratados: erros,
      logRecente: ultimasLinhas(25),
    };
  }
  app.get('/api/diagnostico', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json(montarDiagnostico()); });

  // Chave opcional do Euler Stream. A chave inteira nunca sai do aparelho nem volta para a tela: só o final.
  app.get('/api/config/euler', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json(config.resumoEuler()); });
  app.post('/api/config/euler', (req, res) => {
    try {
      config.salvarChaveEuler(req.body?.chave ?? '');
      info(config.resumoEuler().configurada ? 'Chave do Euler salva.' : 'Chave do Euler removida.');
      res.json(config.resumoEuler());
    } catch (e) {
      res.status(400).json({ erro: e?.code === 'CHAVE_INVALIDA' ? e.message : 'Não consegui salvar a chave: ' + (e?.message || e) });
    }
  });

  app.post('/api/zerar-medicao', (_req, res) => { batimento.zerarMedicao(); res.json({ ok: true }); });

  app.post('/api/testar-conector', async (req, res) => {
    const bruto = String(req.body?.usuario ?? '').trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9._]{1,40}$/.test(bruto)) {
      return res.status(400).json({ erro: 'Digite o @ sem espaços (letras, números, ponto e sublinhado).' });
    }
    if (testando) return res.status(409).json({ erro: 'Já existe um teste rodando. Aguarde terminar.' });
    const pedidos = req.body?.candidato && req.body.candidato !== 'todos'
      ? conectores.candidatos.filter((c) => c.nome === req.body.candidato)
      : conectores.candidatos;
    if (!pedidos.length) return res.status(404).json({ erro: 'Nenhum conector instalado para testar.' });
    testando = true;
    try {
      const resultados = [];
      for (const c of pedidos) {
        info(`Testando conector ${c.nome} (${c.versao}) com @${bruto}${config.chaveEuler() ? ' (com chave do Euler)' : ''}`);
        const r = await testarConector({ candidato: c.nome, usuario: bruto, infoCandidato: c, chaveEuler: config.chaveEuler() });
        resultadosConector[c.nome] = r;
        info(`Resultado ${c.nome}: ${r.status} — ${r.resumo}`);
        resultados.push(r);
      }
      res.json({ resultados });
    } catch (e) {
      registrarErro('testar-conector', e);
      res.status(500).json({ erro: 'Falha inesperada no teste: ' + (e?.message || e) });
    } finally {
      testando = false;
    }
  });

  // escolhe a primeira porta livre a partir de 3000
  await new Promise((resolve, reject) => {
    let tentativa = 0;
    const tentar = () => {
      const porta = portaInicial + tentativa;
      const aoFalhar = (e) => {
        servidor.removeListener('listening', aoOuvir);
        if (e.code === 'EADDRINUSE' && tentativa + 1 < tentativas) { tentativa += 1; tentar(); } else reject(e);
      };
      const aoOuvir = () => { servidor.removeListener('error', aoFalhar); portaEscolhida = porta; resolve(); };
      servidor.once('error', aoFalhar);
      servidor.once('listening', aoOuvir);
      servidor.listen(porta, host);
    };
    tentar();
  });
  info(`Servidor ouvindo em http://${host}:${portaEscolhida}`);
  try { ponte?.channel?.post?.('porta', portaEscolhida); } catch (_) { /* opcional */ }

  return {
    porta: portaEscolhida,
    montarDiagnostico,
    parar: () => new Promise((resolve) => {
      clearInterval(emissor);
      batimento.parar();
      for (const c of wss.clients) c.terminate();
      wss.close(() => servidor.close(() => resolve()));
    }),
  };
}

export { STATUS };

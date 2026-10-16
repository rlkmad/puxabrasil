// Fonte "Simulador": gera eventos falsos para testar o jogo sem estar ao vivo (seção 8 do prompt).
// Todos os eventos saem com origem "simulador", então o overlay mostra a faixa "MODO TESTE".
// Usuários são fictícios, com avatar de iniciais coloridas desenhado pelo overlay (nunca fotos reais).
import { TIPOS, ORIGENS } from '../../shared/tipos-de-evento.js';

const NOMES = ['ana', 'bia', 'caio', 'duda', 'edu', 'fabi', 'gabi', 'hugo', 'iara', 'joao', 'kaka', 'lia', 'malu', 'nando', 'olivia', 'paulo', 'rafa', 'sol', 'tati', 'vini'];
const SUFIXOS = ['torcida', 'fan', 'oficial', 'live', 'game', 'br', 'top', 'show', 'zz', 'real'];

/** Presentes do Simulador: a tabela padrão, mais alguns fora da tabela, com valor por unidade. */
export const PRESENTES_SIMULADOR = Object.freeze([
  { nome: 'Rosa', valor: 1 }, { nome: 'Rosa branca', valor: 1 },
  { nome: 'Heart Me', valor: 1 }, { nome: 'Bom jogo (GG)', valor: 1 },
  { nome: 'Fogos de artifício', valor: 5 }, { nome: 'Coração com os dedos', valor: 5 },
  { nome: 'Presente 10', valor: 10 }, { nome: 'Presente 50', valor: 50 }, { nome: 'Presente 100', valor: 100 },
  { nome: 'Presente 500', valor: 500 }, { nome: 'Presente 1000', valor: 1000 },
]);

export function criarSimulador({ emitir, palavras, aleatorio = Math.random, setTimer = setTimeout, limparTimer = clearTimeout, setIntervalo = setInterval, limparIntervalo = clearInterval }) {
  let proximo = 1;
  const multidao = [];
  const fixos = new Map();
  let liveFalsa = null; // { porMinuto, timer, vies }
  let carga = null;     // { intervalo, fimEm, enviados }
  let contador = 0;

  const escolher = (lista) => lista[Math.floor(aleatorio() * lista.length)];

  function novoUsuario() {
    const n = proximo++;
    const uid = `${escolher(NOMES)}_${escolher(SUFIXOS)}${n}`;
    return { id: `sim-${n}`, uniqueId: uid, nickname: uid.replace(/_/g, ' '), avatarUrl: null };
  }

  /** Usuário fictício com nome escolhido pelo streamer ("teste1"...), sempre o mesmo para o mesmo nome. */
  function usuarioFixo(nome) {
    const limpo = String(nome ?? '').trim().replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30) || 'teste1';
    let u = fixos.get(limpo);
    if (!u) { u = { id: `simf-${limpo}`, uniqueId: limpo, nickname: limpo, avatarUrl: null }; fixos.set(limpo, u); }
    return u;
  }

  function sorteado() {
    if (!multidao.length) criarMultidao(200);
    return escolher(multidao);
  }

  function criarMultidao(qtd) {
    const n = Math.max(1, Math.min(2000, Math.floor(Number(qtd) || 0)));
    for (let i = 0; i < n; i++) multidao.push(novoUsuario());
    return multidao.length;
  }

  const base = (tipo, usuario) => ({ tipo, usuario, origem: ORIGENS.SIMULADOR, idMensagem: `sim-${++contador}` });

  function palavraDoLado(lado) {
    return escolher(palavras[lado].palavras);
  }

  const api = {
    nome: 'simulador',
    iniciar() { /* o Simulador só emite quando o streamer pede; ligar/desligar fica em ligarLiveFalsa */ },
    parar() { api.desligarLiveFalsa(); api.desligarCarga(); },
    ativa() { return Boolean(liveFalsa || carga); },

    usuarioFixo,
    criarMultidao,
    tamanhoDaMultidao: () => multidao.length,
    presentes: () => PRESENTES_SIMULADOR,

    comentar(lado, usuario, texto) {
      const u = usuario ?? sorteado();
      emitir({ ...base(TIPOS.CHAT, u), texto: texto ?? palavraDoLado(lado) });
    },
    presente(nome, valor, quantidade = 1, usuario, { sequencia = false, fimSequencia = false } = {}) {
      const u = usuario ?? sorteado();
      emitir({ ...base(TIPOS.GIFT, u), giftId: `sim-${nome}`, nome, valorMoedas: Number(valor), quantidade: Math.max(1, Math.floor(Number(quantidade) || 1)), sequencia, fimSequencia });
    },
    curtidas(qtd, usuario) {
      const u = usuario ?? sorteado();
      const q = Math.max(1, Math.floor(Number(qtd) || 1));
      emitir({ ...base(TIPOS.LIKE, u), quantidade: q, total: q });
    },
    follow(usuario) { emitir(base(TIPOS.FOLLOW, usuario ?? sorteado())); },
    share(usuario) { emitir(base(TIPOS.SHARE, usuario ?? sorteado())); },

    /** Curtidas em lote: várias pessoas da multidão curtindo ao mesmo tempo. */
    curtidasEmLote(qtdPessoas = 20, curtidasPorPessoa = 5) {
      for (let i = 0; i < qtdPessoas; i++) api.curtidas(curtidasPorPessoa, sorteado());
    },

    /** Live falsa: eventos aleatórios numa taxa por minuto, com o "vento" mudando de lado de vez em quando. */
    ligarLiveFalsa(porMinuto = 120) {
      api.desligarLiveFalsa();
      const taxa = Math.max(1, Math.min(6000, Number(porMinuto) || 120));
      liveFalsa = { porMinuto: taxa, timer: null, vies: 0.5, mudouEm: 0 };
      sorteado();
      const passo = () => {
        if (!liveFalsa) return;
        liveFalsa.mudouEm += 1;
        if (liveFalsa.mudouEm % 40 === 0) liveFalsa.vies = 0.15 + aleatorio() * 0.7; // o público muda de ideia
        const lado = aleatorio() < liveFalsa.vies ? 'lula' : 'flavio';
        const r = aleatorio();
        if (r < 0.45) api.comentar(lado);
        else if (r < 0.60) {
          const nomesDoLado = lado === 'lula' ? ['Rosa', 'Heart Me', 'Fogos de artifício'] : ['Rosa branca', 'Bom jogo (GG)', 'Coração com os dedos'];
          const nome = aleatorio() < 0.9 ? escolher(nomesDoLado) : escolher(PRESENTES_SIMULADOR).nome;
          const dado = PRESENTES_SIMULADOR.find((p) => p.nome === nome);
          api.presente(nome, dado.valor, 1 + Math.floor(aleatorio() * 3));
        } else if (r < 0.90) api.curtidas(1 + Math.floor(aleatorio() * 8));
        else if (r < 0.95) api.follow();
        else api.share();
        const espera = (-Math.log(1 - aleatorio()) * 60000) / liveFalsa.porMinuto; // chegada aleatória (exponencial)
        liveFalsa.timer = setTimer(passo, Math.max(5, espera));
      };
      liveFalsa.timer = setTimer(passo, 50);
      return taxa;
    },
    desligarLiveFalsa() {
      if (liveFalsa) { limparTimer(liveFalsa.timer); liveFalsa = null; }
    },

    /** Teste de carga: 20 comentários por segundo e 200 curtidas por segundo por 60 s. */
    ligarCarga(duracaoS = 60, agoraMs = () => Date.now()) {
      api.desligarCarga();
      sorteado();
      carga = { fimEm: agoraMs() + duracaoS * 1000, enviados: 0, intervalo: null };
      carga.intervalo = setIntervalo(() => {
        if (!carga) return;
        if (agoraMs() >= carga.fimEm) { api.desligarCarga(); return; }
        // por passo de 100 ms: 2 comentários e 20 curtidas
        for (let i = 0; i < 2; i++) api.comentar(aleatorio() < 0.5 ? 'lula' : 'flavio', sorteado(), undefined);
        for (let i = 0; i < 20; i++) api.curtidas(1, sorteado());
        carga.enviados += 22;
      }, 100);
    },
    desligarCarga() {
      if (carga) { limparIntervalo(carga.intervalo); carga = null; }
    },

    estado() {
      return {
        liveFalsa: liveFalsa ? { porMinuto: liveFalsa.porMinuto } : null,
        carga: carga ? { enviados: carga.enviados, restanteS: Math.max(0, Math.round((carga.fimEm - Date.now()) / 1000)) } : null,
        multidao: multidao.length,
      };
    },
  };
  return api;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { classificarErro, testarConector, STATUS } from '../src/server/conector-teste.js';

const erro = (nome, mensagem, codigo) => Object.assign(new Error(mensagem), { name: nome, ...(codigo ? { code: codigo } : {}) });

test('classificarErro separa incompatível, offline, rede e limite', () => {
  assert.equal(classificarErro(erro('SyntaxError', 'Unexpected token')), 'incompativel');
  assert.equal(classificarErro(erro('Error', 'Cannot find module x', 'ERR_MODULE_NOT_FOUND')), 'incompativel');
  assert.equal(classificarErro(erro('Error', 'x', 'ERR_REQUIRE_ESM')), 'incompativel');
  assert.equal(classificarErro(erro('UserOfflineError', 'The requested user isn\'t online :(')), 'offline');
  assert.equal(classificarErro(erro('Error', "The requested user isn't online")), 'offline');
  assert.equal(classificarErro(erro('Error', 'getaddrinfo ENOTFOUND www.tiktok.com')), 'rede');
  assert.equal(classificarErro(erro('Error', 'fetch failed')), 'rede');
  assert.equal(classificarErro(erro('Error', 'Request failed with status code 429 rate limit')), 'limite');
  assert.equal(classificarErro(erro('TypeError', 'foo is not a function')), 'incompativel');
  assert.equal(classificarErro(erro('Error', 'algo estranho')), 'desconhecido');
});

class ConexaoFalsa {
  constructor(usuario, comportamento) { this.usuario = usuario; this.c = comportamento; this.ouvintes = {}; this.desconectou = false; }
  on(nome, fn) { (this.ouvintes[nome] ||= []).push(fn); }
  async connect() {
    if (this.c.erro) throw this.c.erro;
    if (this.c.evento) setTimeout(() => (this.ouvintes[this.c.evento] || []).forEach((f) => f({})), 5);
    return { roomId: '1' };
  }
  async disconnect() { this.desconectou = true; }
}
const modulo = (comportamento, estilo = 'novo') => {
  const Classe = class extends ConexaoFalsa { constructor(u) { super(u, comportamento); modulo.ultima = this; } };
  return estilo === 'novo' ? { TikTokLiveConnection: Classe } : { WebcastPushConnection: Classe };
};
const rapido = { esperaEventoMs: 30, timeoutConectarMs: 500 };

test('falha ao importar (erro de sintaxe) = REPROVADO', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => { throw erro('SyntaxError', 'Unexpected token ?.') } });
  assert.equal(r.status, STATUS.REPROVADO);
  assert.equal(r.etapa, 'carregar');
  assert.equal(r.erro.nome, 'SyntaxError');
});

test('módulo sem classe de conexão = REPROVADO', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => ({}) });
  assert.equal(r.status, STATUS.REPROVADO);
});

test('usuário offline = APROVADO (API nova)', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => modulo({ erro: erro('UserOfflineError', "isn't online") }) });
  assert.equal(r.status, STATUS.APROVADO);
  assert.match(r.api, /nova/);
});

test('usuário offline = APROVADO (API antiga, via default)', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => ({ default: modulo({ erro: erro('Error', 'user is offline') }, 'antigo') }) });
  assert.equal(r.status, STATUS.APROVADO);
  assert.match(r.api, /antiga/);
});

test('conectou e recebeu evento = APROVADO, e desconecta', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => modulo({ evento: 'chat' }) });
  assert.equal(r.status, STATUS.APROVADO);
  assert.equal(r.evento, 'chat');
  assert.equal(modulo.ultima.desconectou, true);
});

test('conectou sem evento = APROVADO com aviso', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => modulo({}) });
  assert.equal(r.status, STATUS.APROVADO);
  assert.equal(r.evento, null);
  assert.match(r.resumo, /nenhum evento/);
});

test('sem internet = INCONCLUSIVO (não reprova o conector)', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => modulo({ erro: erro('Error', 'getaddrinfo ENOTFOUND', 'ENOTFOUND') }) });
  assert.equal(r.status, STATUS.INCONCLUSIVO);
});

test('limite do serviço de assinatura = INCONCLUSIVO', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => modulo({ erro: erro('Error', 'Too many requests (429)') }) });
  assert.equal(r.status, STATUS.INCONCLUSIVO);
});

test('TypeError de recurso ausente ao conectar = REPROVADO', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => modulo({ erro: erro('TypeError', 'AbortSignal.timeout is not a function') }) });
  assert.equal(r.status, STATUS.REPROVADO);
});

test('conexão que nunca responde estoura o limite = INCONCLUSIVO', async () => {
  const Trava = class { on() {} connect() { return new Promise(() => {}); } disconnect() { return Promise.resolve(); } };
  const r = await testarConector({ candidato: 'x', usuario: 'abc', esperaEventoMs: 10, timeoutConectarMs: 50, importador: async () => ({ TikTokLiveConnection: Trava }) });
  assert.equal(r.status, STATUS.INCONCLUSIVO);
});

test('compara o Node com o engines do candidato', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', versaoNode: 'v18.20.4', infoCandidato: { versao: '2.5.0', enginesNode: '>=20.0.0' }, ...rapido, importador: async () => modulo({ evento: 'chat' }) });
  assert.equal(r.engines.ok, false);
  assert.equal(r.versaoConector, '2.5.0');
});

// ---- Ajuste 0.1: erros de assinatura / usuário inexistente e envio da chave do Euler ----
const MSG_ASSINATURA = 'Failed to sign request: Failed to sign request: Request failed with status code 403; URL: https://webcast.tiktok.com/webcast/im/fetch/?aid=1988&app_language=en-US';
const MSG_USUARIO = 'Failed to retrieve room_id from page source. API Error 19881007 (user_not_found)';

test('classificarErro: assinatura (403 do serviço) e usuário inexistente', () => {
  assert.equal(classificarErro(erro('SignatureError', MSG_ASSINATURA)), 'assinatura');
  assert.equal(classificarErro(erro('Error', 'Failed to sign request: boom')), 'assinatura');
  assert.equal(classificarErro(erro('Error', MSG_USUARIO)), 'usuario');
  // continua distinguindo rede de verdade
  assert.equal(classificarErro(erro('Error', 'getaddrinfo ENOTFOUND www.tiktok.com')), 'rede');
});

test('user_not_found = INCONCLUSIVO com mensagem clara (não "erro que não reconheci")', async () => {
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => modulo({ erro: erro('Error', MSG_USUARIO) }, 'antigo') });
  assert.equal(r.status, STATUS.INCONCLUSIVO);
  assert.match(r.resumo, /não encontrou o perfil @abc/);
});

test('403 de assinatura sem chave sugere cadastrar a chave; com chave pede o relatório', async () => {
  const imp = async () => modulo({ erro: erro('SignatureError', MSG_ASSINATURA) }, 'antigo');
  const sem = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: imp });
  assert.equal(sem.status, STATUS.INCONCLUSIVO);
  assert.match(sem.resumo, /sem chave/);
  assert.equal(sem.usouChave, false);
  const com = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: imp, chaveEuler: 'euler_SEGREDO12345' });
  assert.match(com.resumo, /mesmo com a chave/);
  assert.equal(com.usouChave, true);
});

test('API antiga recebe a chave em signProviderOptions; API nova em signApiKey; sem chave não passa opções', async () => {
  const capturas = [];
  const fabrica = (estilo) => {
    const Classe = class { constructor(u, opcoes) { capturas.push({ estilo, opcoes }); } on() {} async connect() { return {}; } async disconnect() {} };
    return estilo === 'novo' ? { TikTokLiveConnection: Classe } : { WebcastPushConnection: Classe };
  };
  await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => fabrica('antigo'), chaveEuler: 'euler_ABCDEFGH' });
  await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => fabrica('novo'), chaveEuler: 'euler_ABCDEFGH' });
  await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, importador: async () => fabrica('antigo') });
  assert.deepEqual(capturas[0].opcoes, { signProviderOptions: { headers: { 'x-api-key': 'euler_ABCDEFGH' }, params: { apiKey: 'euler_ABCDEFGH' } } });
  assert.deepEqual(capturas[1].opcoes, { signApiKey: 'euler_ABCDEFGH' });
  assert.equal(capturas[2].opcoes, undefined);
});

test('a chave nunca aparece no resultado, mesmo se vier dentro do erro', async () => {
  const chave = 'euler_SEGREDO12345';
  const e = erro('SignatureError', `Failed to sign request: x-api-key: ${chave} recusado ${chave}`);
  e.response = { status: 403, data: { message: `chave ${chave} inválida` } };
  e.config = { url: 'https://tiktok.eulerstream.com/webcast/sign_url?apiKey=' + chave };
  e.stack = `SignatureError: ${chave}\n    at x`;
  const r = await testarConector({ candidato: 'x', usuario: 'abc', ...rapido, chaveEuler: chave, importador: async () => modulo({ erro: e }, 'antigo') });
  const texto = JSON.stringify(r);
  assert.ok(!texto.includes(chave), 'a chave vazou: ' + texto);
  assert.match(r.erro.detalhes, /HTTP 403/);
  assert.match(r.erro.detalhes, /tiktok\.eulerstream\.com/);
});

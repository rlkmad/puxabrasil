import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulador } from '../src/server/fontes/simulador.js';
import { validarConfig } from '../src/engine/config.js';
import { eventoValido } from '../src/shared/tipos-de-evento.js';

const { config } = validarConfig(undefined);

function criar(extra = {}) {
  const emitidos = [];
  const timers = [];
  const sim = criarSimulador({
    emitir: (e) => emitidos.push(e), palavras: config.lados, aleatorio: (() => { let n = 7; return () => (n = (n * 16807) % 2147483647) / 2147483647; })(),
    setTimer: (f, ms) => { timers.push({ f, ms }); return timers.length; }, limparTimer: () => {},
    setIntervalo: () => 1, limparIntervalo: () => {}, ...extra,
  });
  return { sim, emitidos, timers };
}

test('todo evento do simulador é válido e tem origem "simulador"', () => {
  const { sim, emitidos } = criar();
  sim.criarMultidao(10);
  sim.comentar('lula'); sim.comentar('flavio'); sim.presente('Rosa', 1, 3); sim.curtidas(5); sim.follow(); sim.share(); sim.curtidasEmLote(3, 2);
  assert.ok(emitidos.length >= 9);
  for (const e of emitidos) { assert.ok(eventoValido(e), JSON.stringify(e)); assert.equal(e.origem, 'simulador'); }
});

test('comentário de cada lado usa uma palavra daquele lado', () => {
  const { sim, emitidos } = criar();
  sim.criarMultidao(5);
  for (let i = 0; i < 30; i++) sim.comentar('lula');
  for (let i = 0; i < 30; i++) sim.comentar('flavio');
  const normal = (t) => String(t).toLowerCase();
  assert.ok(emitidos.slice(0, 30).every((e) => config.lados.lula.palavras.map(normal).includes(normal(e.texto))));
  assert.ok(emitidos.slice(30).every((e) => config.lados.flavio.palavras.map(normal).includes(normal(e.texto))));
});

test('usuário fixo é sempre o mesmo para o mesmo nome e vem limpo', () => {
  const { sim } = criar();
  const a = sim.usuarioFixo('@Teste 1!'); const b = sim.usuarioFixo('Teste1');
  assert.equal(a.id, b.id);
  assert.equal(a.uniqueId, 'Teste1');
  assert.equal(sim.usuarioFixo('').uniqueId, 'teste1');
});

test('multidão limita o tamanho e nunca usa foto real', () => {
  const { sim } = criar();
  assert.equal(sim.criarMultidao(5000), 2000);
  const { emitidos, sim: s2 } = criar();
  s2.criarMultidao(3); s2.comentar('lula');
  assert.equal(emitidos[0].usuario.avatarUrl, null);
});

test('live falsa liga, agenda a próxima chegada e desliga', () => {
  const { sim, timers } = criar();
  assert.equal(sim.estado().liveFalsa, null);
  sim.ligarLiveFalsa(120);
  assert.equal(sim.estado().liveFalsa.porMinuto, 120);
  assert.ok(sim.ativa());
  timers[0].f();                    // dispara um passo
  assert.ok(timers.length >= 2);    // e agenda o seguinte
  sim.desligarLiveFalsa();
  assert.equal(sim.estado().liveFalsa, null);
});

test('taxa da live falsa é limitada', () => {
  const { sim } = criar();
  assert.equal(sim.ligarLiveFalsa(999999), 6000);
  sim.parar();
  assert.equal(sim.ativa(), false);
});

test('teste de carga manda 20 comentários e 200 curtidas por segundo (por passo de 100 ms: 2 e 20)', () => {
  let passo; let agora = 0;
  const { sim, emitidos } = criar({ setIntervalo: (f) => { passo = f; return 1; } });
  sim.ligarCarga(60, () => agora);
  for (let i = 0; i < 10; i++) { agora += 100; passo(); }  // 1 s
  const chats = emitidos.filter((e) => e.tipo === 'chat').length;
  const likes = emitidos.filter((e) => e.tipo === 'like').length;
  assert.equal(chats, 20);
  assert.equal(likes, 200);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { criar, rodar, ate, chat, presente, curtidas, seguir, compartilhar, FASES } from './lib/util.js';

test('ciclo completo: Abertura, Disputa, Reta final, Morte súbita (empate), Resultado e a próxima rodada sozinha', () => {
  const ctx = criar();
  ctx.motor.iniciar();
  const fases = rodar(ctx, 300_000); // 5 min sem ninguém tocar em nada
  const sequencia = ['abertura', 'disputa', 'reta-final', 'morte-subita', 'resultado'];
  assert.deepEqual(fases.slice(0, 5), sequencia, 'primeira rodada na ordem certa');
  assert.deepEqual(fases.slice(5, 10), ['abertura', 'disputa', 'reta-final', 'morte-subita', 'resultado'], 'a segunda rodada começa sozinha');
  assert.ok(ctx.motor.rodadas.length >= 2);
  assert.equal(ctx.motor.rodadas[0].como, 'empate');
  assert.equal(ctx.motor.rodadas[0].vencedor, null);
  assert.equal(ctx.motor.estado().placar.live.empates >= 2, true);
});

test('as durações seguem o padrão: 5 + 90 + 15 (+10 se empate) + 10 segundos', () => {
  const ctx = criar();
  ctx.motor.iniciar();
  rodar(ctx, 4900); assert.equal(ctx.motor.fase, 'abertura');
  rodar(ctx, 200); assert.equal(ctx.motor.fase, 'disputa');
  rodar(ctx, 89_700); assert.equal(ctx.motor.fase, 'disputa');
  rodar(ctx, 200); assert.equal(ctx.motor.fase, 'reta-final');
  rodar(ctx, 15_000); assert.equal(ctx.motor.fase, 'morte-subita');
  rodar(ctx, 10_100); assert.equal(ctx.motor.fase, 'resultado');
});

test('quem passa a bandeira para o seu lado vence no fim do tempo (sem nocaute)', () => {
  const ctx = criar({ corda: { meiaVidaS: 120 } });
  ate(ctx, 'disputa');
  // time Flávio puxa um pouco ao longo de toda a rodada, sem chegar ao nocaute
  ctx.motor.processarEvento(presente('f1', 'Rosa branca', 1, 13)); // 39 pontos: a bandeira vai a ~86 e fica
  rodar(ctx, 20_000);
  assert.ok(ctx.motor.posicao > 60 && ctx.motor.posicao < 92, 'P=' + ctx.motor.posicao);
  rodar(ctx, 200_000);
  const r = ctx.motor.rodadas[0];
  assert.equal(r.vencedor, 'flavio');
  assert.equal(r.como, 'tempo');
  assert.equal(ctx.motor.estado().placar.live.flavio >= 1, true);
});

test('nocaute: bandeira 2 s na linha pula direto para o Resultado', () => {
  const ctx = criar({ corda: { meiaVidaS: 120 } });
  ate(ctx, 'disputa');
  for (let i = 0; i < 10; i++) ctx.motor.processarEvento(presente(`l${i}`, 'Rosa', 1, 100)); // muita força para o Lula
  const antes = ctx.motor.rodadas.length;
  const fases = rodar(ctx, 30_000);
  assert.ok(fases.includes('resultado'), 'chegou ao Resultado cedo: ' + fases.join(','));
  assert.equal(ctx.motor.rodadas[antes].como, 'nocaute');
  assert.equal(ctx.motor.rodadas[antes].vencedor, 'lula');
  assert.ok(ctx.motor.rodadas[antes].duracaoMs < 60_000, 'terminou antes do fim do tempo');
});

test('morte súbita decide pelo lado do centro; empate exato não dá vitória', () => {
  const ctx = criar({ corda: { meiaVidaS: 120 } });
  ate(ctx, 'reta-final');
  // empate na entrada da morte súbita (bandeira no centro), depois o Flávio puxa um pouco
  rodar(ctx, 15_100);
  assert.equal(ctx.motor.fase, 'morte-subita');
  ctx.motor.processarEvento(presente('f1', 'Rosa branca', 1, 5));
  rodar(ctx, 11_000);
  const r = ctx.motor.rodadas[0];
  assert.equal(r.como, 'morte-subita');
  assert.equal(r.vencedor, 'flavio');
});

test('Reta final vale pontos em dobro, mas fora do jogo (Abertura) não conta ponto', () => {
  const ctx = criar();
  ctx.motor.iniciar();
  ctx.motor.processarEvento(chat(1, 'lula')); // Abertura: só escolhe o lado
  assert.equal(ctx.motor.estado().placar.rodada.lula, 0);
  ate(ctx, 'disputa');
  rodar(ctx, 2000);
  ctx.motor.processarEvento(chat(2, 'lula'));
  assert.equal(ctx.motor.estado().placar.rodada.lula, 1);
  rodar(ctx, 90_000);
  assert.equal(ctx.motor.fase, 'reta-final');
  ctx.motor.processarEvento(chat(3, 'lula'));
  assert.equal(ctx.motor.estado().placar.rodada.lula, 3, '1 (disputa) + 2 (reta final)');
});

test('o total de multiplicadores nunca passa de x6 e a Reta final dobra por cima', () => {
  const ctx = criar({ retaFinal: { multiplicador: 6 }, multiplicadorMaximo: 6 });
  ate(ctx, 'reta-final');
  ctx.motor.processarEvento(chat(1, 'lula'));
  assert.equal(ctx.motor.estado().placar.rodada.lula, 6);
});

test('Torcida Zebra: o time de trás ganha +20% nos pontos e o aviso sai', () => {
  const ctx = criar({ corda: { meiaVidaS: 120, nocauteLimite: 1 }, zebra: { tempoS: 1 } });
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(presente('f1', 'Rosa branca', 1, 13)); // 39 pontos para o Flávio
  rodar(ctx, 6000);
  assert.ok(ctx.motor.posicao > 80, 'P=' + ctx.motor.posicao);
  assert.equal(ctx.motor.estado().corda.zebra, 'lula');
  const antes = ctx.motor.estado().placar.rodada.lula;
  ctx.motor.processarEvento(chat('l1', 'lula'));
  const ganho = ctx.motor.estado().placar.rodada.lula - antes;
  assert.ok(Math.abs(ganho - 1.2) < 0.001, 'ganho ' + ganho);
  assert.ok([...ctx.todosEventos, ...ctx.motor.drenarEventos()].some((e) => e.nome === 'zebra' && e.lado === 'lula'));
});

test('Zebra desligada: nenhum bônus', () => {
  const ctx = criar({ corda: { meiaVidaS: 120, nocauteLimite: 1 }, zebra: { tempoS: 1, ativa: false } });
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(presente('f1', 'Rosa branca', 1, 13));
  rodar(ctx, 6000);
  assert.equal(ctx.motor.estado().corda.zebra, null);
});

test('Barra da Virada: curtidas de quem não escolheu lado enchem a barra e ajudam quem perde', () => {
  const ctx = criar({ corda: { meiaVidaS: 120 }, barraVirada: { meta: 100, impulso: 40 } });
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(presente('f1', 'Rosa branca', 1, 10)); // Flávio na frente
  rodar(ctx, 3000);
  const antes = ctx.motor.estado().placar.rodada.lula;
  ctx.motor.processarEvento(curtidas('neutro1', 60));
  assert.equal(ctx.motor.estado().barra.valor, 60);
  ctx.motor.processarEvento(curtidas('neutro2', 50));
  assert.equal(ctx.motor.estado().barra.valor, 10, 'encheu e recomeçou');
  assert.equal(ctx.motor.estado().placar.rodada.lula - antes, 40, 'impulso de 40 pontos para quem perde');
  assert.ok(ctx.motor.drenarEventos().some((e) => e.nome === 'barra-cheia' && e.lado === 'lula'));
});

test('presente de quem não tem lado vai para a Barra e pede para comentar', () => {
  const ctx = criar();
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(presente('x', 'Leão', 10, 1, { uniqueId: 'fulano' })); // fora da tabela, sem lado
  const e = ctx.motor.estado();
  assert.equal(e.placar.rodada.lula + e.placar.rodada.flavio, 0);
  assert.ok(e.barra.valor > 0);
  assert.match(e.feed.at(-1).texto, /@fulano .*comente LULA ou FLÁVIO para escolher seu lado/);
});

test('linhas do feed são frases geradas pelo jogo, no formato do prompt', () => {
  const ctx = criar();
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat('a', 'LULAAAA!!', { uniqueId: 'lucasffrwn' }));
  ctx.motor.processarEvento(presente('b', 'Rosa', 1, 5, { uniqueId: 'mariana776' }));
  ctx.motor.processarEvento(presente('c', 'Rosa branca', 1, 3, { uniqueId: 'hinatagnn' }));
  ctx.motor.processarEvento(chat('d', 'bolsonaro', { uniqueId: 'thiagofrnd' }));
  const textos = ctx.motor.estado().feed.map((f) => f.texto);
  assert.deepEqual(textos, [
    '@lucasffrwn comentou: LULA +1',
    '@mariana776 enviou Rosa ×5 → apoio ao Lula +15',
    '@hinatagnn enviou Rosa branca ×3 → apoio ao Flávio +9',
    '@thiagofrnd comentou: BOLSONARO +1',
  ]);
});

test('o overlay nunca recebe o texto livre do comentário', () => {
  const ctx = criar();
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat('a', 'lula vai ganhar com certeza SEGREDO-ABC-123'));
  const json = JSON.stringify(ctx.motor.estado());
  assert.ok(!json.includes('SEGREDO-ABC-123') && !json.toLowerCase().includes('vai ganhar'));
});

test('o feed mostra no máximo 6 linhas e cada linha some depois de 8 s', () => {
  const ctx = criar({ limites: { comentarioIntervaloS: 0 } });
  ate(ctx, 'disputa');
  for (let i = 0; i < 10; i++) ctx.motor.processarEvento(chat(`u${i}`, 'lula'));
  assert.equal(ctx.motor.estado().feed.length, 6);
  rodar(ctx, 8100);
  assert.equal(ctx.motor.estado().feed.length, 0);
});

test('mostra no máximo 24 apoiadores por lado e conta o resto como "+N"', () => {
  const ctx = criar();
  ate(ctx, 'disputa');
  for (let i = 0; i < 40; i++) ctx.motor.processarEvento(chat(`u${i}`, 'lula'));
  const e = ctx.motor.estado();
  assert.equal(e.apoiadores.lula.length, 24);
  assert.equal(e.apoiadores.extra.lula, 16);
  assert.equal(e.placar.apoiadores.lula, 40);
});

test('Capitão da Torcida: quem tem mais pontos do time na rodada', () => {
  const ctx = criar();
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat('a', 'lula', { uniqueId: 'pequeno' }));
  ctx.motor.processarEvento(presente('b', 'Rosa', 1, 4, { uniqueId: 'grande' }));
  const c = ctx.motor.estado().capitaes;
  assert.equal(c.lula.uid, 'grande');
  assert.equal(c.flavio, null);
});

test('novo seguidor vale 15 uma vez; compartilhamento vale 20 a cada 5 min', () => {
  const ctx = criar();
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat('a', 'lula'));
  const base = ctx.motor.estado().placar.rodada.lula;
  ctx.motor.processarEvento(seguir('a')); ctx.motor.processarEvento(seguir('a'));
  assert.equal(ctx.motor.estado().placar.rodada.lula - base, 15);
  ctx.motor.processarEvento(compartilhar('a')); ctx.motor.processarEvento(compartilhar('a'));
  assert.equal(ctx.motor.estado().placar.rodada.lula - base, 35);
  rodar(ctx, 100); // continua dentro dos 5 min
  ctx.motor.processarEvento(compartilhar('a'));
  assert.equal(ctx.motor.estado().placar.rodada.lula - base, 35);
});

test('pausar congela o relógio; retomar continua de onde parou', () => {
  const ctx = criar();
  ate(ctx, 'disputa');
  rodar(ctx, 10_000);
  const antes = ctx.motor.estado().fase.restanteMs;
  ctx.motor.pausar();
  rodar(ctx, 60_000);
  assert.equal(ctx.motor.fase, 'disputa');
  assert.equal(ctx.motor.estado().fase.restanteMs, antes);
  assert.equal(ctx.motor.processarEvento(chat(1, 'lula')), false, 'evento durante a pausa é ignorado');
  ctx.motor.retomar();
  rodar(ctx, 1000);
  assert.ok(Math.abs(ctx.motor.estado().fase.restanteMs - (antes - 1000)) <= 100);
});

test('se o ciclo atrasar, o relógio real manda e nenhuma fase é pulada', () => {
  const ctx = criar();
  ctx.motor.iniciar();
  const vistas = [];
  const coletar = () => { for (const e of ctx.motor.drenarEventos()) if (e.nome === 'fase') vistas.push(e.fase); };
  coletar();
  ctx.relogio.avancar(400_000); // o celular engasgou por mais de 6 minutos
  for (let i = 0; i < 12; i++) { ctx.motor.tick(); coletar(); ctx.relogio.avancar(100); }
  assert.deepEqual(vistas.slice(0, 5), ['abertura', 'disputa', 'reta-final', 'morte-subita', 'resultado']);
});

test('a física anda no máximo 1 s por ciclo (um atraso não joga a bandeira de uma vez)', () => {
  const ctx = criar({ corda: { meiaVidaS: 120 } });
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(presente('f1', 'Rosa branca', 1, 20));
  ctx.relogio.avancar(60_000);
  ctx.motor.tick();
  assert.ok(ctx.motor.posicao - 50 <= 8.01, 'P=' + ctx.motor.posicao);
});

test('comandos: próxima rodada, reiniciar rodada, zerar placar e encerrar com relatório', () => {
  const ctx = criar({ corda: { meiaVidaS: 120 } });
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat('a', 'lula'));
  assert.equal(ctx.motor.rodadaAtual, 1);
  ctx.motor.proximaRodada();
  assert.equal(ctx.motor.rodadaAtual, 2);
  assert.equal(ctx.motor.fase, 'abertura');
  assert.equal(ctx.motor.estado().placar.rodada.lula, 0);
  ctx.motor.reiniciarRodada();
  assert.equal(ctx.motor.rodadaAtual, 2);
  ctx.motor.zerarPlacar();
  assert.deepEqual(ctx.motor.estado().placar.live, { lula: 0, flavio: 0, empates: 0 });
  const rel = ctx.motor.encerrar();
  assert.equal(ctx.motor.status, 'encerrado');
  assert.equal(ctx.motor.fase, 'parado');
  assert.ok(rel.geradoEm && Array.isArray(rel.topUsuarios));
  assert.equal(rel.modoTeste, true);
  rodar(ctx, 300_000);
  assert.equal(ctx.motor.fase, 'parado', 'depois de Encerrar live o ciclo não continua');
});

test('antes de iniciar o jogo, eventos são ignorados', () => {
  const ctx = criar();
  assert.equal(ctx.motor.processarEvento(chat(1, 'lula')), false);
  assert.equal(ctx.motor.estado().sessao.status, 'parado');
});

test('eventos duplicados (mesmo idMensagem) são descartados', () => {
  const ctx = criar({ limites: { comentarioIntervaloS: 0, comentarioRepetidoS: 0 } });
  ate(ctx, 'disputa');
  const ev = { ...chat(1, 'lula'), idMensagem: 'm-1' };
  assert.equal(ctx.motor.processarEvento(ev), true);
  assert.equal(ctx.motor.processarEvento(ev), false);
  assert.equal(ctx.motor.estado().placar.rodada.lula, 1);
});

test('"MODO TESTE" fica marcado quando há evento de simulador ou replay', () => {
  const ctx = criar();
  ate(ctx, 'disputa');
  assert.equal(ctx.motor.estado().sessao.modoTeste, false);
  ctx.motor.processarEvento(chat(1, 'lula'));
  assert.equal(ctx.motor.estado().sessao.modoTeste, true);
  const real = criar(); ate(real, 'disputa');
  real.motor.processarEvento({ ...chat(1, 'lula'), origem: 'ao-vivo' });
  assert.equal(real.motor.estado().sessao.modoTeste, false);
});

test('a bandeira desliza de volta ao centro na Abertura da próxima rodada', () => {
  const ctx = criar({ corda: { meiaVidaS: 120 } });
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(presente('f1', 'Rosa branca', 1, 15));
  rodar(ctx, 8000);
  assert.ok(ctx.motor.posicao > 70);
  ctx.motor.proximaRodada();
  rodar(ctx, 4900);
  assert.ok(Math.abs(ctx.motor.posicao - 50) < 3, 'P=' + ctx.motor.posicao);
});

test('presente fora da tabela vira o efeito da faixa e vale para o lado atual da pessoa', () => {
  const ctx = criar();
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat('a', 'flavio'));
  const antes = ctx.motor.estado().placar.rodada.flavio;
  ctx.motor.processarEvento(presente('a', 'Leão', 10, 2)); // Trio Elétrico: 4 pontos por moeda, 20 moedas
  assert.equal(ctx.motor.estado().placar.rodada.flavio - antes, 80);
  assert.equal(ctx.motor.estado().placar.moedas.flavio, 20);
});

test('o presente da tabela sempre vale para o lado do presente, mesmo para quem estava no outro lado', () => {
  const ctx = criar();
  ate(ctx, 'disputa');
  ctx.motor.processarEvento(chat('a', 'lula'));
  ctx.motor.processarEvento(presente('a', 'Rosa branca', 1, 2));
  const e = ctx.motor.estado();
  assert.equal(e.placar.rodada.flavio, 6);
  assert.equal(e.placar.rodada.lula, 1);
});

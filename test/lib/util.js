// Ajudantes dos testes do motor (não é um teste). Fica em test/lib para o executor não tratar como teste.
import { criarMotor, FASES } from '../../src/engine/motor.js';
import { validarConfig } from '../../src/engine/config.js';
import { validarGifts } from '../../src/engine/efeitos.js';

export function relogioFalso(inicio = 1000) {
  let t = inicio;
  return { agora: () => t, avancar: (ms) => { t += ms; }, define: (v) => { t = v; } };
}

/** Cria um motor com relógio falso. "mudar" altera a configuração (objeto parcial, mesclado em profundidade). */
export function criar(mudar = {}, giftsBrutos) {
  const mesclar = (a, b) => {
    for (const [k, v] of Object.entries(b)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) { a[k] = mesclar(a[k] ?? {}, v); } else a[k] = v;
    }
    return a;
  };
  const { config, avisos } = validarConfig(mesclar({}, mudar));
  if (avisos.length) throw new Error('configuração de teste inválida: ' + avisos.join(' | '));
  const { gifts } = validarGifts(giftsBrutos);
  const relogio = relogioFalso();
  const motor = criarMotor({ config, gifts, relogio, relogioParede: () => 1_700_000_000_000 + relogio.agora() });
  return { motor, relogio, config, todosEventos: [] };
}

/** Avança o relógio em passos de 100 ms (como o servidor) e chama tick() a cada passo. */
export function rodar(ctx, ms, passo = 100) {
  const fases = [];
  for (let gasto = 0; gasto < ms; gasto += passo) {
    ctx.relogio.avancar(Math.min(passo, ms - gasto));
    ctx.motor.tick();
    for (const e of ctx.motor.drenarEventos()) { ctx.todosEventos.push(e); if (e.nome === 'fase') fases.push(e.fase); }
  }
  return fases;
}

export const usuario = (id, extra = {}) => ({ id: String(id), uniqueId: extra.uniqueId ?? `user${id}`, nickname: extra.nickname ?? `User ${id}`, avatarUrl: null });
export const chat = (id, texto, extra = {}) => ({ tipo: 'chat', usuario: usuario(id, extra), texto, origem: 'simulador' });
export const presente = (id, nome, valorMoedas, quantidade = 1, extra = {}) => ({
  tipo: 'gift', usuario: usuario(id, extra), giftId: extra.giftId ?? nome, nome, valorMoedas, quantidade,
  sequencia: Boolean(extra.sequencia), fimSequencia: Boolean(extra.fimSequencia), origem: 'simulador',
});
export const curtidas = (id, quantidade, extra = {}) => ({ tipo: 'like', usuario: usuario(id, extra), quantidade, total: quantidade, origem: 'simulador' });
export const seguir = (id, extra = {}) => ({ tipo: 'follow', usuario: usuario(id, extra), origem: 'simulador' });
export const compartilhar = (id, extra = {}) => ({ tipo: 'share', usuario: usuario(id, extra), origem: 'simulador' });

/** Inicia o jogo e anda até a fase pedida. */
export function ate(ctx, nomeFase) {
  ctx.motor.iniciar();
  let guarda = 0;
  while (ctx.motor.fase !== nomeFase && guarda++ < 5000) rodar(ctx, 100);
  if (ctx.motor.fase !== nomeFase) throw new Error('não chegou na fase ' + nomeFase);
}
export { FASES };

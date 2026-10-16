// Formato interno único dos eventos. Toda fonte (Simulador, Replay, TikTokAoVivo) entrega neste formato.
//
// usuario: { id, uniqueId (o @), nickname, avatarUrl }
// chat:      { tipo, usuario, texto }
// gift:      { tipo, usuario, giftId, nome, valorMoedas (de UMA unidade), quantidade, sequencia, fimSequencia }
// like:      { tipo, usuario, quantidade (curtidas novas), total }
// follow / share / join / subscribe: { tipo, usuario }
// viewers:   { tipo, numero }
// streamEnd: { tipo }
// Em todos: origem = 'simulador' | 'replay' | 'ao-vivo', e idMensagem (opcional, para descartar duplicados).
export const TIPOS = Object.freeze({
  CHAT: 'chat', GIFT: 'gift', LIKE: 'like', FOLLOW: 'follow', SHARE: 'share',
  JOIN: 'join', VIEWERS: 'viewers', SUBSCRIBE: 'subscribe', STREAM_END: 'streamEnd',
});
export const ORIGENS = Object.freeze({ SIMULADOR: 'simulador', REPLAY: 'replay', AO_VIVO: 'ao-vivo' });

const TIPOS_VALIDOS = new Set(Object.values(TIPOS));

/** Confere o mínimo para o motor não quebrar com um evento malformado. */
export function eventoValido(e) {
  if (!e || typeof e !== 'object' || !TIPOS_VALIDOS.has(e.tipo)) return false;
  if (e.tipo === TIPOS.VIEWERS || e.tipo === TIPOS.STREAM_END) return true;
  if (!e.usuario || e.usuario.id === undefined || e.usuario.id === null || e.usuario.id === '') return false;
  if (e.tipo === TIPOS.CHAT) return typeof e.texto === 'string';
  if (e.tipo === TIPOS.GIFT) return Number(e.quantidade) > 0 && Number(e.valorMoedas) >= 0;
  if (e.tipo === TIPOS.LIKE) return Number(e.quantidade) > 0;
  return true;
}

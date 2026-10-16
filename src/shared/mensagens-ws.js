// Tipos de mensagem do WebSocket local (/ws).
export const MSG = Object.freeze({
  OLA: 'ola',            // servidor -> cliente, ao conectar
  BATIDA: 'batida',      // servidor -> cliente, 1 por segundo (diagnóstico)
  ESTADO: 'estado',      // servidor -> cliente, 10 por segundo: estado completo do jogo
  EVENTO: 'evento',      // servidor -> cliente: evento discreto (fase, fim de rodada, zebra...)
  PING: 'ping',          // cliente -> servidor
  PONG: 'pong',
  FPS: 'fps',            // overlay -> servidor: quadros por segundo medidos
});

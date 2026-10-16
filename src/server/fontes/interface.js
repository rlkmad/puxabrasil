// Interface FonteDeEventos (seção 8 do prompt). O motor do jogo nunca fala direto com a biblioteca do TikTok:
// toda fonte entrega eventos já no formato interno (src/shared/tipos-de-evento.js).
//
// Uma fonte tem:
//   nome            texto curto ("simulador", "replay", "tiktok-ao-vivo")
//   iniciar(emitir) começa a produzir eventos chamando emitir(evento)
//   parar()         para de produzir
//   ativa()         true enquanto estiver produzindo
//
// Implementações: Simulador (Fase 1). TikTokAoVivo e Replay entram na Fase 2.
export const METODOS_DA_FONTE = Object.freeze(['iniciar', 'parar', 'ativa']);

export function ehFonteValida(f) {
  return Boolean(f) && typeof f.nome === 'string' && METODOS_DA_FONTE.every((m) => typeof f[m] === 'function');
}

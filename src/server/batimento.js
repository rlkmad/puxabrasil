// Mede se o Node embutido ficou "congelado" (por exemplo, com o app em segundo plano).
// A cada 1 s anota quanto tempo passou de verdade (relógio monotônico). Se passou muito
// mais que 1 s, o Node ficou parado nesse intervalo.

const INTERVALO_MS = 1000;
const LIMIAR_PAUSA_MS = 2500;

export function criarBatimento() {
  let ultimo = process.hrtime.bigint();
  let timer = null;
  const estado = {
    iniciouEm: new Date().toISOString(),
    medidoDesdeEm: new Date().toISOString(),
    batidas: 0,
    maiorPausaMs: 0,
    pausas: [],            // { em, duracaoMs }
    eventosApp: [],        // { em, tipo } : "pause" e "resume" que o app avisa
  };

  function bater() {
    const agora = process.hrtime.bigint();
    const passouMs = Number(agora - ultimo) / 1e6;
    ultimo = agora;
    estado.batidas += 1;
    const atraso = Math.max(0, passouMs - INTERVALO_MS);
    if (atraso > estado.maiorPausaMs) estado.maiorPausaMs = Math.round(atraso);
    if (atraso >= LIMIAR_PAUSA_MS) {
      estado.pausas.push({ em: new Date().toISOString(), duracaoMs: Math.round(atraso) });
      if (estado.pausas.length > 20) estado.pausas.shift();
    }
  }

  return {
    iniciar() { if (!timer) { ultimo = process.hrtime.bigint(); timer = setInterval(bater, INTERVALO_MS); timer.unref?.(); } },
    parar() { clearInterval(timer); timer = null; },
    registrarEventoApp(tipo) {
      estado.eventosApp.push({ em: new Date().toISOString(), tipo });
      if (estado.eventosApp.length > 40) estado.eventosApp.shift();
    },
    zerarMedicao() {
      estado.medidoDesdeEm = new Date().toISOString();
      estado.batidas = 0;
      estado.maiorPausaMs = 0;
      estado.pausas = [];
      estado.eventosApp = [];
      ultimo = process.hrtime.bigint();
    },
    estado: () => ({ ...estado, limiarPausaMs: LIMIAR_PAUSA_MS }),
    _bater: bater, // para testes
  };
}

// Tradução de um pedido do painel (aba Simulador) em chamadas ao Simulador.
/** Traduz um pedido do painel (aba Simulador) em chamadas ao Simulador. */
export function executarSimulador(jogo, pedido) {
  const sim = jogo.simulador;
  const usuario = pedido.usuario ? sim.usuarioFixo(pedido.usuario) : undefined;
  const lado = pedido.lado === 'flavio' ? 'flavio' : 'lula';
  const vezes = Math.max(1, Math.min(200, Math.floor(Number(pedido.vezes) || 1)));
  switch (pedido.acao) {
    case 'comentar': for (let i = 0; i < vezes; i++) sim.comentar(lado, usuario); break;
    case 'presente': {
      const quantidade = Math.max(1, Math.min(9999, Math.floor(Number(pedido.quantidade) || 1)));
      const valor = Number(pedido.valor);
      if (!pedido.nome || !(valor >= 0)) throw new Error('Informe o nome e o valor do presente.');
      sim.presente(String(pedido.nome).slice(0, 40), valor, quantidade, usuario, { sequencia: Boolean(pedido.sequencia), fimSequencia: Boolean(pedido.fimSequencia) });
      break;
    }
    case 'curtidas': sim.curtidas(Number(pedido.quantidade) || 10, usuario); break;
    case 'curtidas-em-lote': sim.curtidasEmLote(20, 5); break;
    case 'follow': sim.follow(usuario); break;
    case 'share': sim.share(usuario); break;
    case 'multidao': sim.criarMultidao(Number(pedido.quantidade) || 200); break;
    case 'live-falsa': if (pedido.ligar === false) sim.desligarLiveFalsa(); else sim.ligarLiveFalsa(Number(pedido.porMinuto) || 120); break;
    case 'carga': if (pedido.ligar === false) sim.desligarCarga(); else sim.ligarCarga(60); break;
    case 'parar': sim.parar(); break;
    default: throw new Error('Ação do simulador desconhecida.');
  }
  return { ok: true, simulador: sim.estado() };
}

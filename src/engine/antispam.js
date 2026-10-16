// Anti-spam e justiça por pessoa (seção 4 do prompt). Tudo em milissegundos do relógio do motor.
// Presentes não passam por aqui: não têm limite.

export function criarAntispam(limites) {
  const por = new Map(); // id -> estado da pessoa

  const de = (id) => {
    let p = por.get(id);
    if (!p) {
      p = { ultimoTexto: null, ultimoTextoEm: -Infinity, ultimoContadoEm: -Infinity, ladoMudouEm: -Infinity, seguiu: false, ultimoShareEm: -Infinity, janelas: { comentario: [], curtida: [] } };
      por.set(id, p);
    }
    return p;
  };

  return {
    /** Mesmo texto igual da mesma pessoa em menos de N segundos: ignorar. Sempre registra o texto. */
    repetido(id, textoNormalizado, agora) {
      const p = de(id);
      const igual = p.ultimoTexto === textoNormalizado && agora - p.ultimoTextoEm < limites.comentarioRepetidoS * 1000;
      p.ultimoTexto = textoNormalizado;
      p.ultimoTextoEm = agora;
      return igual;
    },
    /** Intervalo mínimo entre comentários que contam. */
    intervaloOk(id, agora) {
      return agora - de(id).ultimoContadoEm >= limites.comentarioIntervaloS * 1000;
    },
    marcarContado(id, agora) { de(id).ultimoContadoEm = agora; },
    /** Trocar de lado por comentário só a cada N segundos. */
    trocaOk(id, agora) { return agora - de(id).ladoMudouEm >= limites.trocaDeLadoS * 1000; },
    marcarLado(id, agora) { de(id).ladoMudouEm = agora; },
    /**
     * Reserva pontos na janela de 60 s ('comentario' ou 'curtida').
     * Devolve quantos pontos foram concedidos (pode ser menos que o pedido, ou 0).
     */
    reservar(id, tipo, pontos, agora) {
      const maxMin = tipo === 'comentario' ? limites.comentarioPontosPorMin : limites.curtidaPontosPorMin;
      const janela = de(id).janelas[tipo];
      while (janela.length && agora - janela[0].t >= 60000) janela.shift();
      const usado = janela.reduce((s, x) => s + x.p, 0);
      const concedido = Math.max(0, Math.min(pontos, maxMin - usado));
      if (concedido > 0) janela.push({ t: agora, p: concedido });
      return concedido;
    },
    /** Novo seguidor conta uma vez por pessoa por live. */
    primeiroSeguir(id) {
      const p = de(id);
      if (p.seguiu) return false;
      p.seguiu = true;
      return true;
    },
    /** Compartilhamento: uma vez a cada N segundos por pessoa. */
    compartilharOk(id, agora) {
      const p = de(id);
      if (agora - p.ultimoShareEm < limites.compartilhamentoIntervaloS * 1000) return false;
      p.ultimoShareEm = agora;
      return true;
    },
    limpar() { por.clear(); },
    tamanho() { return por.size; },
  };
}

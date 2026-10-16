// Presentes em sequência (ponto crítico, seção 8 do prompt).
// A sequência chega várias vezes enquanto a quantidade sobe, e uma última vez com o fim marcado.
// Contar tudo duplicaria os pontos. Algoritmo:
//  1. chave = pessoa + giftId; guarda a última quantidade vista;
//  2. unidades novas = quantidade atual - última; se a atual for menor (nova sequência), unidades = atual;
//  3. aplica na hora;
//  4. ao terminar a sequência, apaga a chave. Presentes que não são sequência contam uma vez.

export function criarSequencias() {
  const ultima = new Map();
  return {
    /** Recebe um evento de presente e devolve quantas unidades NOVAS ele representa. */
    unidadesNovas(ev) {
      const q = Math.floor(Number(ev.quantidade));
      if (!(q > 0)) return 0;
      if (!ev.sequencia) return q;
      const chave = `${ev.usuario.id}|${ev.giftId ?? ev.nome}`;
      const anterior = ultima.get(chave);
      const novas = anterior === undefined || q < anterior ? q : q - anterior;
      if (ev.fimSequencia) ultima.delete(chave);
      else ultima.set(chave, q);
      return novas;
    },
    abertas() { return ultima.size; },
    limpar() { ultima.clear(); },
  };
}

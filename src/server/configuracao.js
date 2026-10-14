// Configurações locais do app (hoje: só a chave opcional do Euler Stream, o serviço que assina as requisições).
// A chave fica num arquivo na pasta de dados privada do app. Nunca vai para o log, para o relatório nem para o
// zip: o diagnóstico mostra só se existe e os 4 últimos caracteres.
import fs from 'node:fs';
import path from 'node:path';

const NOME_ARQUIVO = 'config.json';

export function criarConfiguracao(pastaDados, env = process.env) {
  const arquivo = path.join(pastaDados, NOME_ARQUIVO);

  const ler = () => {
    try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')) ?? {}; } catch (_) { return {}; }
  };

  const gravar = (dados) => {
    fs.mkdirSync(pastaDados, { recursive: true });
    const tmp = arquivo + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(dados), { mode: 0o600 });
    fs.renameSync(tmp, arquivo);
  };

  /** Chave do Euler: a salva no app tem prioridade sobre a variável EULER_API_KEY. */
  const chaveEuler = () => {
    const salva = String(ler().eulerApiKey ?? '').trim();
    if (salva) return salva;
    return String(env.EULER_API_KEY ?? '').trim() || null;
  };

  return {
    chaveEuler,
    salvarChaveEuler(valor) {
      const limpa = String(valor ?? '').trim();
      if (limpa && !/^[\w.\-]{8,200}$/.test(limpa)) {
        const e = new Error('A chave tem caracteres inválidos ou é curta demais. Cole só a chave, sem espaços.');
        e.code = 'CHAVE_INVALIDA';
        throw e;
      }
      const dados = ler();
      if (limpa) dados.eulerApiKey = limpa; else delete dados.eulerApiKey;
      gravar(dados);
    },
    /** Resumo seguro para mostrar na tela e no relatório. */
    resumoEuler() {
      const k = chaveEuler();
      return { configurada: Boolean(k), final: k ? k.slice(-4) : null, origem: !k ? null : String(ler().eulerApiKey ?? '').trim() ? 'app' : 'EULER_API_KEY' };
    },
  };
}

// Textos fixos que não podem ser editados nem escondidos (seção 11 do prompt).
export const AVISO_LEGAL = 'Jogo de entretenimento. Não é pesquisa eleitoral nem propaganda de campanha.';
export const LADOS = Object.freeze(['lula', 'flavio']);
export const outroLado = (lado) => (lado === 'lula' ? 'flavio' : 'lula');

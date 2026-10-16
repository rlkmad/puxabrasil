import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AVISO_LEGAL } from '../src/shared/textos.js';
import { PADROES } from '../src/engine/config.js';

// Seção 11 do prompt: palavras que não podem aparecer na interface, exceto na nota legal fixa.
const PROIBIDAS = /\b(voto|votos|votar|urna|urnas|elei[cç][aã]o|elei[cç][oõ]es|pesquisa|pesquisas|enquete|enquetes|previs[aã]o|previs[oõ]es)\b/i;
const RAIZ = new URL('..', import.meta.url).pathname;

function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivos(p) : [p];
  });
}

test('telas (painel e overlay) não usam vocabulário proibido fora da nota legal', () => {
  const alvos = [...arquivos(path.join(RAIZ, 'src/web')), path.join(RAIZ, 'web-bootstrap/index.html')];
  for (const f of alvos) {
    const texto = fs.readFileSync(f, 'utf8').split(AVISO_LEGAL).join('');
    const m = PROIBIDAS.exec(texto);
    assert.equal(m, null, `${path.relative(RAIZ, f)} contém "${m && m[0]}"`);
  }
});

test('textos do jogo (avisos, feed, nomes) não usam vocabulário proibido', () => {
  const textos = [PADROES.nomeDoJogo, ...PADROES.avisos];
  for (const t of textos) assert.equal(PROIBIDAS.exec(t), null, t);
  const motor = fs.readFileSync(path.join(RAIZ, 'src/engine/motor.js'), 'utf8');
  const literais = motor.match(/`[^`]*`|'[^']*'/g) ?? [];
  for (const l of literais) assert.equal(PROIBIDAS.exec(l), null, l);
});

test('a nota legal fixa existe e é a do prompt', () => {
  assert.equal(AVISO_LEGAL, 'Jogo de entretenimento. Não é pesquisa eleitoral nem propaganda de campanha.');
});

test('o overlay nunca desenha o texto livre de comentário (usa só o feed pronto do jogo)', () => {
  const js = fs.readFileSync(path.join(RAIZ, 'src/web/overlay/overlay.js'), 'utf8');
  assert.ok(!/\.comentario\b|\.textoLivre\b|msg\.texto\b/.test(js));
});

// Proteções contra o que o Node embutido (Node.js for Mobile, sem ICU garantido) não suporta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { semAcento, EMOJI, EMOJI_TODOS } from '../src/engine/texto-seguro.js';
import { palavrasDoTexto, detectarLado } from '../src/engine/palavras.js';
import { validarConfig } from '../src/engine/config.js';

const RAIZ = new URL('..', import.meta.url).pathname;
const arquivos = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(path.join(d, e.name)) : [path.join(d, e.name)]));

test('o código do servidor não usa \\p{...}, normalize(), Intl nem toLocale*', () => {
  const proibido = /\\p\{|\.normalize\(|\bIntl\b|toLocale\w*\(|localeCompare\(/;
  for (const f of ['src/server', 'src/engine', 'src/shared'].flatMap((d) => arquivos(path.join(RAIZ, d))).filter((f) => f.endsWith('.js'))) {
    const linhas = fs.readFileSync(f, 'utf8').split('\n');
    linhas.forEach((l, i) => {
      if (l.trim().startsWith('//') || l.trim().startsWith('*')) return;
      // recursos.js só TESTA a presença de ICU, dentro de um try/catch
      if (f.endsWith('recursos.js')) return;
      assert.ok(!proibido.test(l), `${path.relative(RAIZ, f)}:${i + 1} usa recurso que depende de ICU: ${l.trim()}`);
    });
  }
});

test('semAcento dá o mesmo resultado do NFD para o português', () => {
  for (const t of ['AÇÃO', 'Flávio', 'é ü ñ', 'Bom jogo (GG)', 'Coração com os dedos', 'Fogos de artifício', 'LULAAAA', 'Ônibus à vista', 'ÀÁÂÃÄ ÈÉÊË ÌÍÎÏ ÒÓÔÕÖ ÙÚÛÜ Ç']) {
    assert.equal(semAcento(t), t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(), t);
  }
  assert.equal(semAcento('á'), 'a'); // acento já decomposto
});

test('as duas tabelas de acentos têm o mesmo tamanho', async () => {
  const fonte = fs.readFileSync(path.join(RAIZ, 'src/engine/texto-seguro.js'), 'utf8');
  const de = /const DE = '([^']+)'/.exec(fonte)[1];
  const para = /const PARA = '([^']+)'/.exec(fonte)[1];
  assert.equal([...de].length, para.length);
});

test('emojis dos lados são reconhecidos sem \\p{}', () => {
  for (const e of ['🔴', '🟢', '🟡', '❤️', '👏']) assert.ok(EMOJI.test(e), e);
  assert.equal('lula 🔴🔴 ok'.replace(EMOJI_TODOS, ' ').replace(/\s+/g, ' '), 'lula ok');
  assert.ok(!EMOJI.test('lula 13'));
});

test('detecção de lado continua igual (acentos, repetidas, emoji)', () => {
  const { config } = validarConfig(undefined);
  assert.equal(detectarLado('LULAAAA!!!', config.lados).lado, 'lula');
  assert.equal(detectarLado('Flávio presidente', config.lados).lado, 'flavio');
  assert.equal(detectarLado('🟢', config.lados).lado, 'flavio');
  assert.equal(detectarLado('🔴', config.lados).lado, 'lula');
  assert.deepEqual(palavrasDoTexto('Ação, já!'), ['acao', 'ja']);
});

test('se o servidor falhar ao iniciar, um servidor de emergência mostra o erro exato', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'puxa-emerg-'));
  fs.mkdirSync(path.join(pasta, 'src/server'), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, 'nodejs-project/main.js'), path.join(pasta, 'main.js'));
  fs.writeFileSync(path.join(pasta, 'src/package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(pasta, 'src/server/iniciar.js'), "throw new SyntaxError('Invalid property name in character class');\n");
  const filho = spawn(process.execPath, ['main.js'], { cwd: pasta, stdio: 'ignore' });
  try {
    let achou = null;
    for (let tentativa = 0; tentativa < 40 && !achou; tentativa++) {
      await new Promise((r) => setTimeout(r, 150));
      for (let porta = 3000; porta <= 3010 && !achou; porta++) {
        try {
          const r = await fetch(`http://127.0.0.1:${porta}/api/ping`, { signal: AbortSignal.timeout(300) });
          const j = await r.json();
          if (j.fase === 'erro-de-inicio') achou = porta;
        } catch (_) { /* próxima porta */ }
      }
    }
    assert.ok(achou, 'o servidor de emergência não respondeu');
    const html = await (await fetch(`http://127.0.0.1:${achou}/painel`)).text();
    assert.match(html, /Invalid property name in character class/);
    assert.match(html, /Copiar erro/);
  } finally {
    filho.kill();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const POLY = path.resolve(AQUI, '..', 'src', 'server', 'polifills.js');

test('sem crypto global (como no Node 18), o polyfill cria crypto.randomUUID e getRandomValues', () => {
  const codigo = `
    delete globalThis.crypto;
    const m = await import(${JSON.stringify('file://' + POLY)});
    const u = globalThis.crypto.randomUUID();
    const a = globalThis.crypto.getRandomValues(new Uint8Array(8));
    console.log(JSON.stringify({ aplicados: m.POLYFILLS_APLICADOS, uuid: /^[0-9a-f-]{36}$/.test(u), tam: a.length }));
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', codigo], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout.trim()), { aplicados: ['crypto'], uuid: true, tam: 8 });
});

// Monta a pasta www/ que o Capacitor copia para dentro do APK:
//   www/index.html        página de abertura (acha a porta e abre o painel)
//   www/nodejs/           projeto do Node embutido (main.js, src/, node_modules)
//   www/nodejs/build-info.json   versões dos candidatos do conector e módulos nativos encontrados
//
// Uso: node scripts/preparar-build.js [--sem-npm]   (--sem-npm só para testar a montagem sem internet)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { procurarNativos } from './lib/nativos.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(raiz, 'www');
const nodejs = path.join(www, 'nodejs');
const semNpm = process.argv.includes('--sem-npm');

const copiar = (de, para) => fs.cpSync(de, para, { recursive: true });

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(nodejs, { recursive: true });

copiar(path.join(raiz, 'web-bootstrap', 'index.html'), path.join(www, 'index.html'));
copiar(path.join(raiz, 'nodejs-project', 'package.json'), path.join(nodejs, 'package.json'));
copiar(path.join(raiz, 'nodejs-project', 'main.js'), path.join(nodejs, 'main.js'));
copiar(path.join(raiz, 'src'), path.join(nodejs, 'src'));
// dentro do app o código do servidor é ES module
copiar(path.join(raiz, 'nodejs-project', 'src-package.json'), path.join(nodejs, 'src', 'package.json'));

if (!semNpm) {
  console.log('Instalando dependências do Node embutido (sem módulos opcionais/nativos)…');
  execSync('npm install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund', { cwd: nodejs, stdio: 'inherit' });
  // guarda o package-lock gerado para fixar as versões nas próximas compilações
  const lock = path.join(nodejs, 'package-lock.json');
  if (fs.existsSync(lock)) copiar(lock, path.join(raiz, 'nodejs-package-lock.gerado.json'));
}

const lerJson = (a) => { try { return JSON.parse(fs.readFileSync(a, 'utf8')); } catch (_) { return null; } };
const candidatos = ['conector-novo', 'conector-antigo'].map((nome) => {
  const pkg = lerJson(path.join(nodejs, 'node_modules', nome, 'package.json'));
  return {
    nome,
    pacote: pkg?.name ?? 'tiktok-live-connector',
    versao: pkg?.version ?? null,
    enginesNode: pkg?.engines?.node ?? null,
    instalado: Boolean(pkg),
  };
});

const nativos = procurarNativos(path.join(nodejs, 'node_modules'));
const info = { geradoEm: new Date().toISOString(), candidatos, nativos };
fs.writeFileSync(path.join(nodejs, 'build-info.json'), JSON.stringify(info, null, 2));

// resumo para o log do GitHub
console.log('\n=== Resumo da preparação ===');
for (const c of candidatos) console.log(`${c.nome}: ${c.pacote}@${c.versao ?? '(não instalado)'} · exige Node ${c.enginesNode ?? 'não declara'}`);
console.log(nativos.length ? 'Módulos nativos: ' + nativos.map((n) => `${n.pacote} [${n.motivos.join('; ')}]`).join(' | ') : 'Módulos nativos: nenhum');
const arquivos = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? arquivos(path.join(d, e.name)) : 1), 0);
console.log(`Arquivos em www/nodejs: ${arquivos(nodejs)}`);

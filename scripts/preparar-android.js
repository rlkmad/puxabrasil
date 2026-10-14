// Roda DEPOIS de "npx cap add android" e ANTES de "npx cap sync android".
// Copia o serviço em primeiro plano, a ponte nativa, a configuração de rede e a chave de assinatura fixa
// para o projeto Android gerado, e ajusta AndroidManifest.xml e build.gradle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchManifest, patchBuildGradle } from './lib/android-patch.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extras = path.join(raiz, 'android-extras');
const app = path.join(raiz, 'android', 'app');
const principal = path.join(app, 'src', 'main');
if (!fs.existsSync(principal)) throw new Error('android/app/src/main não existe. Rode "npx cap add android" antes.');

const pacote = path.join(principal, 'java', 'br', 'puxabrasil', 'app');
fs.mkdirSync(pacote, { recursive: true });
for (const f of ['PuxaService.java', 'PuxaBridge.java', 'MainActivity.java']) {
  fs.copyFileSync(path.join(extras, 'java', f), path.join(pacote, f));
}
fs.cpSync(path.join(extras, 'res'), path.join(principal, 'res'), { recursive: true });

const manifesto = path.join(principal, 'AndroidManifest.xml');
fs.writeFileSync(manifesto, patchManifest(fs.readFileSync(manifesto, 'utf8')));

fs.copyFileSync(path.join(extras, 'puxa-brasil.keystore'), path.join(app, 'puxa-brasil.keystore'));
fs.copyFileSync(path.join(extras, 'puxa-signing.gradle'), path.join(app, 'puxa-signing.gradle'));

const gradle = ['build.gradle', 'build.gradle.kts'].map((n) => path.join(app, n)).find((p) => fs.existsSync(p));
if (!gradle || gradle.endsWith('.kts')) throw new Error('build.gradle (Groovy) do app não encontrado; o formato do Capacitor mudou. Veja o README.');
const versionCode = Number(process.env.GITHUB_RUN_NUMBER || 1);
fs.writeFileSync(gradle, patchBuildGradle(fs.readFileSync(gradle, 'utf8'), { versionCode }));

// se o Capacitor gerou outro MainActivity (outro pacote), avisa
const velho = path.join(principal, 'java');
const encontrados = [];
(function varrer(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) varrer(p); else if (e.name === 'MainActivity.java') encontrados.push(p); } })(velho);
if (encontrados.length !== 1) console.warn('ATENÇÃO: MainActivity.java encontrado em', encontrados.length, 'lugares:', encontrados);

console.log('Projeto Android preparado (versionCode ' + versionCode + ').');

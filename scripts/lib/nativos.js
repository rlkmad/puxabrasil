// Procura módulos nativos (que costumam não existir no Node embutido) dentro de node_modules.
import fs from 'node:fs';
import path from 'node:path';

function lerJson(arq) {
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch (_) { return null; }
}

function* pacotes(raiz) {
  if (!fs.existsSync(raiz)) return;
  for (const nome of fs.readdirSync(raiz)) {
    if (nome.startsWith('.')) continue;
    const dir = path.join(raiz, nome);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (nome.startsWith('@')) {
      for (const sub of fs.readdirSync(dir)) {
        const d2 = path.join(dir, sub);
        if (fs.statSync(d2).isDirectory()) yield { nome: `${nome}/${sub}`, dir: d2 };
      }
    } else {
      yield { nome, dir };
    }
  }
}

function temArquivoNode(dir, profundidade = 0) {
  if (profundidade > 3) return null;
  let itens;
  try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return null; }
  for (const it of itens) {
    if (it.name === 'node_modules') continue;
    if (it.isFile() && it.name.endsWith('.node')) return path.join(dir, it.name);
    if (it.isDirectory()) {
      const achou = temArquivoNode(path.join(dir, it.name), profundidade + 1);
      if (achou) return achou;
    }
  }
  return null;
}

/** Devolve [{ pacote, motivos: [...] }] para cada pacote que parece nativo. Considera node_modules de 1 nível. */
export function procurarNativos(pastaNodeModules) {
  const achados = [];
  for (const { nome, dir } of pacotes(pastaNodeModules)) {
    const pkg = lerJson(path.join(dir, 'package.json')) || {};
    const motivos = [];
    if (pkg.gypfile === true) motivos.push('gypfile');
    if (fs.existsSync(path.join(dir, 'binding.gyp'))) motivos.push('binding.gyp');
    const instalar = String(pkg.scripts?.install ?? '') + ' ' + String(pkg.scripts?.preinstall ?? '');
    if (/node-gyp|prebuild-install|node-pre-gyp|cmake-js/.test(instalar)) motivos.push('script de instalação compila código nativo');
    const arquivo = temArquivoNode(dir);
    if (arquivo) motivos.push('contém ' + path.relative(dir, arquivo));
    if (motivos.length) achados.push({ pacote: nome, versao: pkg.version ?? null, motivos });
  }
  return achados.sort((a, b) => a.pacote.localeCompare(b.pacote));
}

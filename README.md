# Puxa Brasil — Fase 0 (esqueleto e teste do Node embutido)

Jogo interativo para live do TikTok, em app Android. **Esta é a Fase 0**: ainda não existe jogo.
O objetivo é só provar, no seu celular, que as três peças difíceis funcionam:

1. o **Node.js embutido** no app roda e serve as telas;
2. o **conector do TikTok** carrega e conecta dentro desse Node;
3. o **serviço em primeiro plano** mantém tudo vivo com o app em segundo plano.

Se algo falhar aqui, é melhor descobrir agora do que depois de construir o jogo inteiro.

---

## 1. Passo a passo para gerar o APK

### 1.1 Conta e repositório no GitHub

1. Crie uma conta grátis em github.com (se ainda não tiver).
2. Toque em **+ → New repository**. Nome sugerido: `puxa-brasil`.
3. Escolha **Private** (privado). Isso é importante: o projeto leva dentro a chave que assina o app (veja a seção 6).
4. Crie o repositório.

### 1.2 Enviar os arquivos

1. Extraia o `puxa-brasil.zip`. Este projeto tem **35 arquivos** (o GitHub aceita até 100 por envio pelo site; **confirmar** o limite atual).
2. No repositório, toque em **Add file → Upload files** e envie **todas as pastas e arquivos**, inclusive a pasta oculta `.github` (ela contém o gerador do APK).
   - No celular, algumas galerias de arquivos escondem pastas que começam com ponto. Se a `.github` não aparecer, envie pelo computador, ou crie o arquivo `.github/workflows/build-apk.yml` direto no GitHub: **Add file → Create new file**, digite o caminho completo no nome e cole o conteúdo.
3. Toque em **Commit changes**.

### 1.3 Gerar o APK

1. Abra a aba **Actions**. Se o GitHub perguntar, permita os workflows.
2. Escolha **Gerar APK** na lista da esquerda e toque em **Run workflow → Run workflow**.
   (Ele também roda sozinho a cada envio de arquivos.)
3. Espere. A primeira vez costuma levar **de 10 a 20 minutos** (confirmar no seu caso).
4. Quando ficar verde, abra a execução e, no fim da página, em **Artifacts**, baixe **puxa-brasil-apk**.
   O GitHub entrega um `.zip`: extraia e dentro está o `puxa-brasil.apk`.
5. Se ficar **vermelho**: abra a execução, toque no passo que falhou, copie as últimas linhas do erro e me envie.

### 1.4 Instalar no celular

1. Abra o `puxa-brasil.apk` pelo gerenciador de arquivos ou pelo navegador.
2. O Android vai pedir para permitir **instalar apps de fontes desconhecidas** para o app que você usou. Permita só para ele. (O caminho do menu muda de fabricante para fabricante: **confirmar no seu aparelho**.)
3. Instale e abra. Permita as **notificações** quando o app pedir.

---

## 2. Teste da Fase 0 no celular

Ao abrir, o app mostra uma tela de abertura e, em alguns segundos, o **Diagnóstico**.

1. **Leia o quadro "Conector do TikTok × Node embutido".** Cada candidato mostra a versão do conector, o Node que ele exige e se o Node do app atende. *(Eu já espero ver "NÃO ATENDE" no candidato novo; veja a seção 5.)*
2. **Toque em "Testar todos"** com o @ de qualquer perfil (sem o @). Se o perfil estiver ao vivo, melhor. Se não estiver, "usuário offline" também conta como aprovado.
3. Anote o resultado de cada candidato: **APROVADO**, **REPROVADO** ou **INCONCLUSIVO** (inconclusivo = sem internet ou serviço de assinatura limitado; tente de novo em alguns minutos).
4. Confira a seção **Aparelho**: serviço em primeiro plano deve estar **ATIVO**. A notificação "Puxa Brasil rodando" deve aparecer.
5. Toque em **Abrir ajuste de bateria** e tire o app da otimização de bateria (cada fabricante tem um menu diferente).
6. Toque em **Zerar medição** na seção **Segundo plano**. Mande o app para segundo plano (abra o TikTok, por exemplo) e **espere 10 minutos**. Depois volte ao Puxa Brasil.
7. Veja se o servidor ficou parado: **"Maior pausa"** deve ficar abaixo de 2,5 s. Se houve pausa grande, o Android congelou o Node.
8. Toque em **Copiar relatório** e cole na conversa comigo.

### Critério de aceite da Fase 0

- APK gerado e instalável;
- o Node e o conector carregam sem erro (**evento recebido ou "usuário offline" vale**);
- o app e o servidor continuam vivos depois de 10 min em segundo plano;
- se o conector **não** carregar, o relatório mostra o erro exato e seguimos pelo plano B, **sem** ir para a Fase 1.

---

## 3. Erros comuns

| O que aparece | O que fazer |
| --- | --- |
| Tela de abertura fica rodando e depois diz "o servidor do app não respondeu" | Feche o app (deslize para fora) e abra de novo. Se repetir, mande a mensagem para mim; o Node embutido pode não ter iniciado. |
| "Conflito de assinatura" ao instalar por cima de outra versão | A outra versão foi assinada com outra chave. Desinstale a antiga (os dados dela somem) e instale esta. Daqui para frente, a chave fixa evita isso. |
| Teste do conector "INCONCLUSIVO" | Sem internet ou o serviço de assinatura limitou o pedido. Troque de Wi-Fi para dados (ou o contrário) e espere alguns minutos. |
| Workflow vermelho no passo "Testes" | Algum teste automático falhou. Copie o trecho do erro e me envie. |
| Workflow vermelho no passo do Gradle | Copie o trecho do erro. As versões do Capacitor, do plugin do Node e do Android mudam com frequência; o ajuste costuma ser pequeno. |
| Notificação não aparece | Permita as notificações do app nas configurações do Android. O serviço continua rodando mesmo sem a notificação visível, mas o ideal é permitir. |

---

## 4. O que foi verificado e o que não foi

**Verificado (nos testes automáticos, no computador/integração contínua):**
comparação de versões do Node, classificação de erros do conector (aprovado, reprovado, inconclusivo), medição de pausas do servidor, busca por módulos nativos, ajustes do `AndroidManifest.xml` e do `build.gradle` (sem duplicar nada, só as permissões da lista do prompt). O teste de fumaça do servidor roda no GitHub (Node 18 e 22), onde express e ws são instalados.

**Não verificado — confirmar no seu aparelho:**

- instalação do APK e abertura do app;
- se o Node embutido inicia e o servidor responde;
- se o conector carrega no Node 18 do app e conecta a um @ real;
- serviço em primeiro plano ativo, notificação, estado após 10 min em segundo plano;
- versão real do Android System WebView e do Android no seu aparelho;
- que o Gradle monta o APK com as versões atuais (o primeiro build pode pedir um ajuste).

Nada disso foi marcado como testado. O código foi escrito sem acesso a um celular físico.

---

## 5. Decisões tomadas

**Casca Android: Capacitor 8 + plugin `@capawesome/capacitor-nodejs`.**
É o caminho de preferência do prompt. A documentação do plugin (consultada em 14/10/2026) diz que ele roda **Node 18.20.4**, a versão mais nova disponível no Node.js for Mobile Apps, é compatível com Capacitor 8 e tem build com páginas de 16 KB (exigência de aparelhos novos). O plugin mais antigo (`hampoelz/capacitor-nodejs`) roda Node 18.17 e as notas de versão que li citam o Capacitor 5. Capacitor 8 exige Node 22 e Java 21 no build, e `minSdk` 24 (Android 7.0). O mínimo real exigido pelo Node embutido: **confirmar no seu aparelho**.

**Achado importante: o conector novo provavelmente não roda no Node 18.**
A versão atual do `tiktok-live-connector` (2.5.0, ramo de desenvolvimento no GitHub) declara `engines.node >= 20.0.0` e usa a biblioteca `got` 15. O Node embutido é 18.20.4. Pelo prompt, o plano B (a) é usar uma versão anterior do conector. Por isso a Fase 0 instala **dois candidatos** e testa os dois:

- `conector-novo` = `tiktok-live-connector@^2` (API `TikTokLiveConnection`);
- `conector-antigo` = `tiktok-live-connector@1.2.3` (API `WebcastPushConnection`, última da linha 1.x listada nas versões oficiais).

O diagnóstico diz qual funciona de verdade. Se **nenhum** funcionar, seguimos pelos planos (b), (c) e (d) do prompt.

**Outras decisões simples:**

- O projeto Android **não vem pronto no .zip**: o GitHub o gera na hora (`npx cap add android`) e o script `scripts/preparar-android.js` aplica serviço, ponte nativa, rede e assinatura. Assim o .zip fica pequeno (35 arquivos) e não depende de arquivos gerados que eu não consigo testar aqui.
- **Sem `package-lock.json`**: não consegui gerar offline. O workflow usa `npm install` (e não `npm ci`) e devolve o arquivo `nodejs-package-lock.gerado.json` junto com o APK, para fixarmos as versões depois.
- **Descoberta da porta**: a página de abertura procura o servidor nas portas 3000 a 3010 (endereço `/api/ping`). Mais simples que depender da mensagem do plugin; o servidor escuta só em `127.0.0.1`.
- **Serviço em primeiro plano do tipo `specialUse`**: no Android 15, os tipos `dataSync` e `mediaProcessing` têm limite de tempo; `specialUse` não tem, e serve para lives de mais de 2 horas (**confirmar na sua versão do Android**). Neste momento o serviço roda sempre que o app está aberto; na Fase 1 passa a seguir o estado da live.
- **Permissões**: só internet, estado da rede, serviço em primeiro plano (comum e `specialUse`), notificações e manter o aparelho acordado. A tela de ajuste de bateria é aberta pelo ajuste geral do Android, sem permissão extra.
- **Persistência**: pasta de dados do app, fornecida pelo plugin (`app.datadir()`); o diagnóstico mostra o caminho e prova que dá para gravar.
- **Tráfego sem criptografia** liberado só para `127.0.0.1` e `localhost` (arquivo `network_security_config.xml`).
- **Testes** no Node 18 e no 22 (o prompt pede 20 ou mais novo; usei 18 também porque é o Node que roda dentro do app).
- Versões das ações do GitHub (`checkout@v4`, `setup-node@v4`, `setup-java@v4`, `upload-artifact@v4`): **confirmar** se há versão mais nova recomendada.

---

## 6. Chave de assinatura (leia)

O arquivo `android-extras/puxa-brasil.keystore` assina todas as versões do app, para o Android aceitar atualizar por cima sem apagar dados. A senha está escrita em `android-extras/puxa-signing.gradle` (uso pessoal, fora da Play Store).

- Mantenha o repositório **privado**. Quem tiver a chave pode criar um app que o Android aceite como atualização do seu.
- **Faça uma cópia da chave** e guarde fora do GitHub. Quem perder a chave não consegue mais atualizar o app por cima: só desinstalando e instalando de novo, com perda dos dados.

---

## 7. Avisos

- O conector usa uma biblioteca **não oficial**: pode parar de funcionar sem aviso e não tem garantia do TikTok. A assinatura das requisições é feita por um serviço de terceiros (Euler Stream), com limite grátis.
- Nunca informe senha, `sessionid` ou cookies do TikTok. Para ler uma live pública isso não é necessário e coloca sua conta em risco. O app não pede nada disso.
- O APK é instalado fora da Play Store: o Android mostra avisos de "fonte desconhecida" e a atualização depende da chave guardada.
- Leia as Diretrizes da Comunidade e as regras de LIVE do TikTok vigentes, e confira as regras e os requisitos da conta para transmitir a tela do celular ou usar o modo de jogo na sua versão do app (**confirmar na sua versão**).
- O tema do jogo é político e a live acontece em período eleitoral: confira com um profissional as regras vigentes, especialmente sobre propaganda e conteúdo gerado por IA.

---

## 8. Para quem desenvolve

```
npm install --prefix .deps --no-audit express@^4 ws@^8 && ln -s .deps/node_modules node_modules   # só express e ws
npm test        # testes (node --test); o do servidor é pulado se express/ws faltarem
npm run dev     # servidor no computador: http://127.0.0.1:3000/painel
```

Estrutura da Fase 0:

```
.github/workflows/build-apk.yml   gera o APK (testes → Capacitor → Gradle)
capacitor.config.json             app, plugin do Node, navegação só para 127.0.0.1
android-extras/                   serviço em primeiro plano, ponte nativa, rede, chave fixa
nodejs-project/                   package.json e main.js do Node embutido
web-bootstrap/                    página de abertura (acha a porta do servidor)
scripts/                          preparar-build.js, preparar-android.js, lib/
src/server/                       servidor, teste do conector, batimento, log
src/web/                          painel (diagnóstico) e overlay vazio
test/                             testes automatizados
```

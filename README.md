# Puxa Brasil — Fase 1 (motor do jogo, Simulador e Modo Live)

Jogo de cabo de guerra para live do TikTok, em app Android: **Lula × Flávio**. O público puxa a bandeira comentando,
mandando presentes e curtindo. Tudo roda dentro do celular do streamer (Node.js embutido no app).

**Fase 1 entrega:** o motor completo do jogo (corda, rodadas, fases, anti-spam, palavras que escolhem o lado, Torcida Zebra,
Barra da Virada, presentes), o **Simulador** no painel (para testar sem estar ao vivo), o **Modo Live** com uma tela do jogo
simples (corda, bandeira, placar, tempo, apoiadores com iniciais, legenda de presentes, feed e avisos) e testes automáticos
que **bloqueiam o APK** se falharem.

**Ainda não existe** (próximas fases): ligação com a live real do TikTok no jogo (o conector foi aprovado na Fase 0, mas o jogo ainda
só recebe eventos do Simulador), efeitos visuais completos dos presentes, sons, ranking, gráficos, edição das regras pelo painel,
acesso por outro aparelho.

---

## 1. Atualizar o projeto no GitHub e gerar o APK

Se você já tem o repositório da Fase 0, **substitua os arquivos pelos da Fase 1** (o zip é o projeto inteiro):

**Pelo Codespace (recomendado):** envie o `puxa-brasil-fase1.zip` para o Codespace, e no terminal:

```
unzip -o puxa-brasil-fase1.zip -d /tmp/fase1
rsync -a --delete --exclude .git --exclude node_modules /tmp/fase1/puxa-brasil/ ./
git add -A && git commit -m "Fase 1" && git push
```

(`--delete` apaga arquivos antigos que não existem mais, como a antiga referência ao conector 1.2.3.)

Depois: aba **Actions → Gerar APK** (roda sozinho a cada envio). Primeiro rodam os **testes** (Node 18 e 22); se algum falhar, o APK
**não é gerado**. Quando ficar verde, baixe **puxa-brasil-apk** em *Artifacts*, **extraia o .zip** e instale o `puxa-brasil.apk` por cima
da versão anterior (a chave de assinatura é a mesma, então os dados ficam).

Primeira vez do zero? Veja o passo a passo da Fase 0 abaixo (seção 6).

---

## 2. Teste da Fase 1 no celular

Abra o app. Ele abre no **Painel**, com três abas: **Jogo**, **Simulador** e **Diagnóstico** (a mesma da Fase 0).

1. Aba **Jogo** → toque em **Iniciar jogo**. A situação passa a "Rodando", fase "abertura" (5 s) e depois "disputa".
2. Aba **Simulador** → toque em **Criar multidão (200)** e depois em **Ligar live falsa** (120 eventos por minuto).
3. Volte à aba **Jogo**: placar, bandeira, apoiadores e "Últimas ações" mexem sozinhos.
4. Toque em **Entrar no Modo Live**. O jogo ocupa a tela inteira, sem menus. Confira a faixa amarela **MODO TESTE** e a nota legal embaixo.
5. Assista a **3 rodadas seguidas** (cada uma tem cerca de 2 min: abertura, disputa, reta final, resultado). As rodadas se repetem sozinhas.
6. Aperte **Voltar** do Android: deve aparecer "Sair do Modo Live?". Escolha "Continuar no jogo". (O gesto escondido de saída é **tocar e segurar 2 s com dois dedos**.)
7. Saia do Modo Live e, na aba **Jogo**, toque em **Encerrar live** → confirme. Aparece o relatório e as rodadas param.
8. Teste manual do que o motor deve respeitar (aba Simulador):
   - **Sequência de presente**: digite um usuário (ex.: `teste1`), escolha *Rosa* e toque em **Testar sequência 1→2→3→5→5**. A rodada deve ganhar pontos de **5 unidades** (15 pontos, sem somar os valores parciais).
   - **Palavras**: *Comentar LULA* e *Comentar FLÁVIO* entram na corda de cada lado; o mesmo usuário comentando de novo em menos de 1,5 s é ignorado.
9. Opcional: **Teste de carga (60 s)** e olhe, na aba Jogo, "Atraso do motor", "Memória" e "Quadros por segundo do jogo" (este só aparece com a tela do jogo aberta, ou seja, em outra aba/aparelho; no Modo Live o painel não está visível).

### Critério de aceite da Fase 1

- `npm test` passa (inclui simetria entre os lados e a sequência de presentes);
- as rodadas se repetem sozinhas até **Encerrar live**;
- o APK só é gerado se os testes passarem.

---

## 3. O que foi verificado e o que não foi

**Verificado no computador (testes automáticos, 116 testes, Node 18 e 22 no GitHub):**
motor do jogo (fases e durações, posição da bandeira, nocaute, empate e morte súbita, Torcida Zebra, Barra da Virada, reta final e teto
do multiplicador), **simetria** (rodar o mesmo roteiro com os lados trocados dá o mesmo resultado espelhado), **sequência de presentes**,
anti-spam, palavras (acentos, letras repetidas, emojis), validação da configuração, simulador, ciclo do jogo e relatório, vocabulário
proibido na interface, e o servidor de verdade (HTTP + WebSocket). A tela do jogo e o painel foram abertos num Chromium de teste, com o
motor real, em duas proporções de tela. O código Java novo (Modo Live) compila contra definições simplificadas das classes do Android.

**Não verificado — confirmar no seu aparelho:**

- Modo Live em tela cheia (barras escondidas, tela sempre acesa, área do recorte/"notch" preenchida);
- botão Voltar pedindo confirmação e o gesto de dois dedos por 2 s;
- fluidez do jogo (quadros por segundo) e consumo de bateria numa live longa;
- como a tela do jogo aparece **transmitida** pelo TikTok (cortes e faixas pretas) — o guia `?calibrar=1` existe, mas a calibração é sua;
- teste de carga rodando no próprio celular;
- o Gradle e o APK com as novas peças (primeiro build da Fase 1 pode pedir um ajuste).

Nada disso foi marcado como testado. O código foi escrito sem acesso a um celular físico.

---

## 4. Decisões tomadas

**Conectores.** Mantidos só `conector-2-0` (`tiktok-live-connector@2.0.1`, principal) e `conector-2-1` (`2.1.0`, reserva): os dois foram **aprovados com eventos reais** no seu
aparelho. O `1.2.3` foi removido (endereço de assinatura antigo, erro 403) e a linha `2.2+` descartada (exige Node 20). A chave do Euler Stream continua só no aparelho.

**Corda.** Posição P de 0 (base do Lula) a 100 (base do Flávio). A força de cada lado decai com meia-vida de 10 s; o alvo é
`50 + 50 × (F_flávio − F_lula) / (F_flávio + F_lula + piso)` (piso 15, evita que 2 ou 3 pessoas decidam sozinhas) e a bandeira caminha até o alvo
com suavização e no máximo 8 unidades por segundo. Nocaute: P ≤ 8 ou ≥ 92 por 2 s. Empate: P entre 49 e 51 no fim do tempo → morte súbita de 10 s com pontos em dobro.
Só **Lula** e **Flávio** existem no código como lados; nada trata um deles de forma especial (o teste de simetria garante isso).

**Pontuação.** Comentário 1, curtida 0,1, seguir 15 (uma vez por pessoa), compartilhar 20 (no máximo 1 a cada 5 min), assinante 50 (desligado por padrão);
presentes por tabela de efeitos (Fase 1 aplica só os **pontos** do efeito; os efeitos visuais e de duração entram na Fase 3). A abertura (5 s) **não pontua**.
Multiplicador da fase (reta final ×2, morte súbita ×2) e teto total ×6.

**Presente.** O lado vem da tabela de presentes (Rosa = Lula, Rosa branca = Flávio, etc.); presente fora da tabela vai para o lado **atual da pessoa**; sem lado, alimenta a Barra da Virada.
**Sequência:** o jogo conta só as unidades novas (1→2→3→5→5 = 5 unidades), nunca soma os valores parciais.

**Anti-spam.** Mínimo de 1,5 s entre ações da mesma pessoa; no máximo 60 pontos por minuto por comentários e 20 por curtidas; comentário igual repetido em menos de 5 s é ignorado
(a janela se renova a cada tentativa repetida, então spam contínuo não conta); comentário com palavras dos dois lados é ignorado; troca de lado no máximo a cada 20 s.
Acima de 200 eventos por segundo, as curtidas da mesma pessoa são juntadas em um evento só.

**Torcida Zebra / Barra da Virada.** Se um time fica mais de 5 s com a bandeira a mais de 30 unidades do centro, o outro ganha +20% nos pontos até a bandeira voltar a menos de 10.
A Barra da Virada enche com curtidas de quem ainda não tem lado (meta 300) e, cheia, dá um empurrão de +40 ao time que está perdendo.

**Configuração.** Padrões em `config/game.json` e `config/gifts.json`. O app valida tudo: valor inválido volta ao padrão e aparece como aviso na aba Jogo (nunca derruba o app).
Os valores editáveis no painel entram na Fase 2.

**Tela do jogo (overlay).** Nesta fase usa **Canvas 2D** simples (tela lógica 1080×1920, escalada, zona segura do TikTok respeitada), sem biblioteca. O PixiJS pedido no prompt
entra com os efeitos da Fase 3, onde faz diferença. Apoiadores aparecem com **iniciais** (sem fotos). O overlay **nunca mostra texto livre de comentário**: só frases geradas pelo jogo.

**Modo Live.** O painel abre `/overlay?live=1` na mesma WebView; o app esconde as barras do sistema, mantém a tela acesa e preenche sob o recorte. O botão Voltar pede confirmação
(janela do Android); o gesto escondido é dois dedos por 2 s. Os botões da notificação (Pausar/Retomar/Encerrar) ficam para a próxima fase.

**Teste e segurança.** Eventos do Simulador carregam a origem "simulador" e ligam a faixa **MODO TESTE**. O Simulador usa usuários fictícios (nunca fotos reais).
A nota legal ("Jogo de entretenimento. Não é pesquisa eleitoral nem propaganda de campanha.") é fixa e sempre visível; fora dela, a interface não usa as palavras proibidas (há teste automático).

**Outras (da Fase 0, mantidas).** Capacitor 8 + `@capawesome/capacitor-nodejs` (Node 18.20.4 embutido); projeto Android gerado no GitHub; sem `package-lock.json` (o workflow devolve
`nodejs-package-lock.gerado.json`); a página de abertura acha o servidor nas portas 3000–3010; serviço em primeiro plano `specialUse`; tráfego sem criptografia só para 127.0.0.1;
testes no Node 18 e 22.

---

## 5. Relatório da live

**Encerrar live** salva um arquivo `AAAA-MMDD_HHMM.json` em `relatorios/` (dentro da pasta de dados do app) e mostra o resumo na aba Jogo: rodadas, placar da live, moedas, pessoas, mais ativos.

---

## 6. Gerar o APK pela primeira vez (resumo da Fase 0)

1. Repositório **privado** no GitHub (o projeto leva a chave de assinatura).
2. Envie todas as pastas e arquivos, inclusive a pasta oculta `.github`.
3. **Actions → Gerar APK → Run workflow**. Na primeira vez leva de 10 a 20 minutos.
4. Baixe **puxa-brasil-apk** em *Artifacts*, extraia o `.zip` e instale o `.apk` (permitir "fontes desconhecidas" só para o app que você usou — **confirmar no seu aparelho**).

### Erros comuns

| O que aparece | O que fazer |
| --- | --- |
| Workflow vermelho no passo "Testes" | Algum teste falhou: copie o trecho do erro e me envie. O APK não é gerado enquanto isso. |
| Workflow vermelho no Gradle | Copie o trecho do erro. As versões do Capacitor/Android mudam com frequência; o ajuste costuma ser pequeno. |
| "Conflito de assinatura" ao instalar | A versão instalada foi assinada com outra chave: desinstale a antiga (os dados somem) e instale esta. |
| Tela de abertura diz "o servidor do app não respondeu" | Feche o app (deslize para fora) e abra de novo; se repetir, me mande a mensagem. |
| Teste do conector "INCONCLUSIVO" (aba Diagnóstico) | Sem internet ou serviço de assinatura limitado; confira a chave do Euler Stream e tente de novo. |

---

## 7. Chave de assinatura (leia)

`android-extras/puxa-brasil.keystore` assina todas as versões do app (a senha está em `android-extras/puxa-signing.gradle`, uso pessoal, fora da Play Store).
Mantenha o repositório **privado** e **guarde uma cópia da chave** fora do GitHub: sem ela não dá para atualizar o app por cima.

---

## 8. Avisos

- O conector do TikTok é **não oficial**: pode parar de funcionar sem aviso. A assinatura das requisições é feita por um serviço de terceiros (Euler Stream), com limite grátis.
  **Nunca cole a chave dele em conversas, no GitHub ou em arquivos do projeto**; só no campo do app (aba Diagnóstico).
- Nunca informe senha, `sessionid` ou cookies do TikTok. O app não pede nada disso.
- Leia as regras de LIVE e as Diretrizes da Comunidade do TikTok vigentes, e confira os requisitos para transmitir a tela do celular na sua versão do app (**confirmar na sua versão**).
- O tema do jogo é político e a live acontece em período eleitoral: confira com um profissional as regras vigentes, em especial sobre propaganda e conteúdo gerado por IA.

---

## 9. Para quem desenvolve

```
npm install --prefix .deps --no-audit express@^4 ws@^8 && ln -s .deps/node_modules node_modules   # só express e ws
npm test        # node --test (o teste do servidor é pulado se express/ws faltarem)
npm run dev     # servidor no computador: http://127.0.0.1:3000/painel  (tela do jogo: /overlay)
```

```
.github/workflows/build-apk.yml   testes (Node 18 e 22) → Capacitor → Gradle → APK
config/                           game.json (regras) e gifts.json (tabela de presentes)
android-extras/                   serviço em primeiro plano, ponte nativa (Modo Live), rede, chave fixa
src/engine/                       motor do jogo, palavras, anti-spam, sequência, efeitos (puros, testáveis)
src/server/                       servidor, jogo (ciclo de 100 ms), fontes de eventos (simulador), conector de teste
src/shared/                       formato de evento, mensagens do WebSocket, textos fixos
src/web/painel, src/web/overlay   painel (Jogo, Simulador, Diagnóstico) e tela do jogo
test/                             testes automatizados
```

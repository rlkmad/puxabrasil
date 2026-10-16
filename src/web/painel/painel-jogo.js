// Painel · abas Jogo e Simulador (Fase 1). A aba Diagnóstico continua no próprio index.html.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NATIVO = window.PuxaNativo || null;
  var estado = null, metricas = null, conf = null;
  var abaAtual = 'jogo';

  // ---------- abas ----------
  function abrirAba(nome) {
    abaAtual = nome;
    ['jogo', 'sim', 'diag'].forEach(function (a) {
      $('aba-' + a).hidden = a !== nome;
      $('tab-' + a).setAttribute('aria-selected', String(a === nome));
    });
    try { sessionStorage.setItem('puxa-aba', nome); } catch (e) { /* ignora */ }
    if (nome === 'jogo') desenharJogo();
  }
  Array.prototype.forEach.call(document.querySelectorAll('nav.abas button'), function (b) {
    b.addEventListener('click', function () { abrirAba(b.getAttribute('data-aba')); });
  });

  // ---------- utilitários ----------
  function post(url, corpo) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) })
      .then(function (r) { return r.json().then(function (j) { j.__ok = r.ok; return j; }); });
  }
  function el(tag, classe, txt) { var e = document.createElement(tag); if (classe) e.className = classe; if (txt != null) e.textContent = txt; return e; }
  function pts(n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  var NOMES_FASE = { parado: 'parado', abertura: 'abertura', disputa: 'disputa', 'reta-final': 'reta final', 'morte-subita': 'morte súbita', resultado: 'resultado da rodada' };
  var NOMES_STATUS = { parado: 'Parado (aguardando início)', rodando: 'Rodando', pausado: 'Pausado', encerrado: 'Encerrado' };
  function linha(dl, rotulo, valor, classe) {
    dl.appendChild(el('dt', null, rotulo));
    dl.appendChild(el('dd', classe || null, valor == null ? '—' : String(valor)));
  }

  // ---------- aba Jogo (estrutura) ----------
  $('aba-jogo').innerHTML =
    '<section><h2>Controle do jogo</h2>' +
    '<dl id="j-status"></dl>' +
    '<div class="grade">' +
    '<button class="cheio" id="b-iniciar" type="button">Iniciar jogo</button>' +
    '<button id="b-pausar" type="button">Pausar</button>' +
    '<button id="b-proxima" type="button">Próxima rodada</button>' +
    '<button id="b-reiniciar" type="button">Reiniciar rodada</button>' +
    '<button id="b-zerar" type="button">Zerar placar da live</button>' +
    '<button class="perigo" id="b-encerrar" type="button">Encerrar live</button>' +
    '</div>' +
    '<div class="grade"><button class="cheio" id="b-modo-live" type="button">Entrar no Modo Live</button>' +
    '<button id="b-abrir-overlay" type="button">Abrir tela do jogo</button></div>' +
    '<p class="pequeno" id="j-msg" aria-live="polite"></p></section>' +

    '<section><h2>Corda agora</h2>' +
    '<div class="placar"><div class="time lula"><div class="nome" id="j-nome-l">LULA</div><div class="num" id="j-pts-l">0</div><div class="pequeno" id="j-ap-l"></div></div>' +
    '<div class="meio">diferença<b id="j-dif">0</b>placar da live<b id="j-live">0 × 0</b></div>' +
    '<div class="time flavio"><div class="nome" id="j-nome-f">FLÁVIO</div><div class="num" id="j-pts-f">0</div><div class="pequeno" id="j-ap-f"></div></div></div>' +
    '<div class="corda" role="img" aria-label="Posição da bandeira"><i id="j-bandeira" style="left:50%"></i></div>' +
    '<div class="corda-rotulos"><span id="j-rot-l">Base Lula · força 50%</span><span id="j-rot-f">força 50% · Base Flávio</span></div>' +
    '<p class="pequeno" id="j-barra"></p></section>' +

    '<section><h2>Últimas ações</h2><ul class="feed-painel" id="j-feed"></ul></section>' +

    '<section><h2>Desempenho</h2><dl id="j-metricas"></dl>' +
    '<p class="pequeno">O atraso do motor é o tempo entre o evento chegar e ser contado. Os quadros por segundo do jogo aparecem quando a tela do Modo Live está aberta.</p></section>' +

    '<section id="j-relatorio-sec" hidden><h2>Relatório da última live</h2><dl id="j-relatorio"></dl></section>' +

    '<section><h2>Avisos</h2><p class="pequeno" id="j-avisos-config">Sem avisos de configuração.</p>' +
    '<p class="pequeno" id="j-legal"></p></section>' +

    '<dialog id="dlg-encerrar"><form method="dialog"><h2>Encerrar a live?</h2><p>O jogo para, o relatório é salvo e as rodadas deixam de se repetir.</p>' +
    '<div class="linha"><button value="cancelar" type="submit">Continuar jogando</button><button class="perigo" value="ok" type="submit">Encerrar live</button></div></form></dialog>';

  function desenharJogo() {
    if (abaAtual !== 'jogo' || !estado) return;
    var e = estado;
    var dl = $('j-status'); dl.replaceChildren();
    linha(dl, 'Situação', NOMES_STATUS[e.sessao.status] || e.sessao.status);
    linha(dl, 'Rodada', e.sessao.rodada || '—');
    linha(dl, 'Fase', NOMES_FASE[e.fase.nome] || e.fase.nome);
    linha(dl, 'Tempo', e.sessao.status === 'rodando' || e.sessao.status === 'pausado' ? mmss(e.fase.contagemMs) : '—');
    if (e.sessao.modoTeste) { var dd = el('dd'); dd.appendChild(el('span', 'faixa', 'MODO TESTE')); dl.appendChild(el('dt', null, 'Eventos')); dl.appendChild(dd); }
    var st = e.sessao.status;
    var ativo = st === 'rodando' || st === 'pausado';
    $('b-iniciar').disabled = ativo;
    $('b-pausar').textContent = st === 'pausado' ? 'Retomar' : 'Pausar';
    $('b-pausar').disabled = !ativo;
    $('b-proxima').disabled = !ativo;
    $('b-reiniciar').disabled = !ativo;
    $('b-encerrar').disabled = !ativo;

    $('j-nome-l').textContent = e.lados.lula.toUpperCase(); $('j-nome-f').textContent = e.lados.flavio.toUpperCase();
    $('j-pts-l').textContent = pts(e.placar.rodada.lula); $('j-pts-f').textContent = pts(e.placar.rodada.flavio);
    $('j-ap-l').textContent = e.placar.apoiadores.lula + ' apoiadores · ' + e.corda.percentual.lula + '%';
    $('j-ap-f').textContent = e.placar.apoiadores.flavio + ' apoiadores · ' + e.corda.percentual.flavio + '%';
    $('j-dif').textContent = pts(e.placar.diferenca);
    $('j-live').textContent = e.placar.live.lula + ' × ' + e.placar.live.flavio + (e.placar.live.empates ? ' (' + e.placar.live.empates + ' emp.)' : '');
    $('j-bandeira').style.left = e.corda.P + '%';
    $('j-rot-l').textContent = 'Base ' + e.lados.lula + ' · força ' + e.corda.percentual.lula + '%';
    $('j-rot-f').textContent = 'força ' + e.corda.percentual.flavio + '% · Base ' + e.lados.flavio;
    $('j-barra').textContent = (e.barra.ativa ? 'Barra da Virada ' + e.barra.valor + '/' + e.barra.meta + '. ' : '') +
      (e.corda.zebra ? 'Torcida Zebra ativa para ' + e.lados[e.corda.zebra] + '. ' : '') +
      (e.corda.nocauteMs > 0 ? 'Bandeira na linha: nocaute em andamento.' : '');

    var ul = $('j-feed'); ul.replaceChildren();
    (e.feed || []).slice().sort(function (a, b) { return a.idadeMs - b.idadeMs; }).forEach(function (f) { ul.appendChild(el('li', f.lado, f.texto)); });
    if (!ul.children.length) ul.appendChild(el('li', null, 'Nada por enquanto.'));
  }

  function desenharMetricas() {
    if (!metricas) return;
    var m = metricas;
    var sd = $('sim-status');
    if (sd) sd.textContent = 'Multidão: ' + m.simulador.multidao + ' · Live falsa: ' + (m.simulador.liveFalsa ? 'ligada' : 'desligada') + ' · Carga: ' + (m.simulador.carga ? 'rodando' : 'desligada');
    if (abaAtual !== 'jogo') return;
    var dl = $('j-metricas'); dl.replaceChildren();
    linha(dl, 'Eventos por segundo', m.eventosPorSegundo);
    linha(dl, 'Atraso do motor', m.atrasoMedioMs + ' ms (máx. ' + m.atrasoMaxMs + ' ms)', m.atrasoMaxMs > 200 ? 'alerta' : null);
    linha(dl, 'Ciclo do jogo', m.tickMedioMs + ' ms (máx. ' + m.tickMaxMs + ' ms)');
    linha(dl, 'Fila de eventos', m.fila + ' (máx. ' + m.filaMax + ')');
    linha(dl, 'Curtidas agrupadas', m.agrupados);
    linha(dl, 'Pessoas na live', m.pessoas);
    linha(dl, 'Memória do servidor', m.memoriaMB.rss + ' MB (heap ' + m.memoriaMB.heap + ' MB)');
    linha(dl, 'Quadros por segundo do jogo', m.overlayFps == null ? 'tela do jogo fechada' : m.overlayFps + ' fps', m.overlayFps != null && m.overlayFps < 24 ? 'alerta' : null);
  }

  function mostrarRelatorio(r) {
    if (!r) return;
    $('j-relatorio-sec').hidden = false;
    var dl = $('j-relatorio'); dl.replaceChildren();
    linha(dl, 'Rodadas jogadas', r.rodadas);
    linha(dl, 'Placar da live', 'Lula ' + r.placar.lula + ' × ' + r.placar.flavio + ' Flávio (empates: ' + r.placar.empates + ')');
    linha(dl, 'Melhor sequência de vitórias', r.melhorSequencia);
    linha(dl, 'Pessoas que jogaram', r.pessoas);
    linha(dl, 'Moedas', 'Lula ' + r.moedas.lula + ' · Flávio ' + r.moedas.flavio);
    linha(dl, 'Duração', Math.round(r.duracaoMs / 60000) + ' min');
    if (r.arquivo) linha(dl, 'Arquivo salvo', r.arquivo);
    if (r.topUsuarios && r.topUsuarios.length) linha(dl, 'Mais ativos', r.topUsuarios.slice(0, 5).map(function (u) { return '@' + (u.uid || u.nome); }).join(', '));
    if (r.modoTeste) linha(dl, 'Aviso', 'Esta sessão teve eventos simulados (MODO TESTE).');
  }

  // ---------- comandos ----------
  function mensagem(t) { $('j-msg').textContent = t; }
  function comando(nome, ok) {
    return post('/api/jogo/comando', { comando: nome }).then(function (r) {
      if (!r.__ok) mensagem(r.erro || 'O servidor recusou o comando.');
      else if (nome === 'encerrar' && r.relatorio) { mostrarRelatorio(r.relatorio); mensagem('Live encerrada e relatório salvo.'); }
      else mensagem(ok || '');
      return r;
    }).catch(function () { mensagem('Não consegui falar com o servidor do app.'); });
  }
  $('b-iniciar').onclick = function () { comando('iniciar', 'Jogo iniciado: as rodadas se repetem sozinhas até Encerrar live.'); };
  $('b-pausar').onclick = function () { comando(estado && estado.sessao.status === 'pausado' ? 'retomar' : 'pausar'); };
  $('b-proxima').onclick = function () { comando('proxima'); };
  $('b-reiniciar').onclick = function () { comando('reiniciar'); };
  $('b-zerar').onclick = function () { if (confirm('Zerar o placar da live (rodadas ganhas)?')) comando('zerar', 'Placar da live zerado.'); };
  $('b-encerrar').onclick = function () { var d = $('dlg-encerrar'); if (d.showModal) d.showModal(); else if (confirm('Encerrar a live?')) comando('encerrar'); };
  $('dlg-encerrar').addEventListener('close', function () { if ($('dlg-encerrar').returnValue === 'ok') comando('encerrar'); });
  $('b-modo-live').onclick = function () {
    if (!NATIVO) { window.open('/overlay', '_blank'); mensagem('Fora do app, a tela do jogo abre em outra aba.'); return; }
    location.href = '/overlay?live=1';
  };
  $('b-abrir-overlay').onclick = function () { window.open('/overlay', '_blank'); };

  // ---------- aba Simulador ----------
  $('aba-sim').innerHTML =
    '<section><h2>Simulador</h2><p class="pequeno">Gera eventos de mentira para testar o jogo sem estar ao vivo. Tudo o que vem daqui aparece na tela do jogo com a faixa MODO TESTE.</p>' +
    '<p class="pequeno" id="sim-status">Multidão: 0 · Live falsa: desligada · Carga: desligada</p>' +
    '<label class="campo" for="sim-usuario">Usuário fictício (vazio = alguém da multidão)</label>' +
    '<input id="sim-usuario" type="text" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="ex.: teste1">' +
    '<p class="pequeno" id="sim-msg" aria-live="polite"></p></section>' +

    '<section><h2>Comentários</h2><label class="campo" for="sim-vezes">Quantos de uma vez</label>' +
    '<select id="sim-vezes"><option>1</option><option>5</option><option>20</option><option>50</option></select>' +
    '<div class="grade"><button class="lula" id="sim-com-l" type="button">Comentar LULA</button><button class="flavio" id="sim-com-f" type="button">Comentar FLÁVIO</button></div>' +
    '<p class="pequeno">Com um usuário fixo, o limite de intervalo entre comentários vale e ignora os repetidos (como na live de verdade).</p></section>' +

    '<section><h2>Presentes</h2><label class="campo" for="sim-presente">Presente</label><select id="sim-presente"></select>' +
    '<label class="campo" for="sim-qtd-presente">Quantidade</label><input id="sim-qtd-presente" type="number" min="1" max="9999" value="1" inputmode="numeric">' +
    '<div class="grade"><button class="cheio" id="sim-enviar-presente" type="button">Enviar presente</button>' +
    '<button id="sim-sequencia" type="button">Testar sequência 1→2→3→5→5</button></div>' +
    '<p class="pequeno">A sequência simula um presente que repete: o jogo deve contar só 5 unidades no total, sem somar os valores parciais.</p></section>' +

    '<section><h2>Curtidas, seguir e compartilhar</h2>' +
    '<div class="grade tres"><button id="sim-curtir10" type="button">10 curtidas</button><button id="sim-curtir100" type="button">100 curtidas</button><button id="sim-lote" type="button">Lote (20 pessoas)</button></div>' +
    '<div class="grade"><button id="sim-follow" type="button">Seguir</button><button id="sim-share" type="button">Compartilhar</button></div></section>' +

    '<section><h2>Multidão e ensaio</h2>' +
    '<div class="grade"><button id="sim-multidao" type="button">Criar multidão (200)</button><button class="perigo" id="sim-parar" type="button">Parar tudo</button></div>' +
    '<label class="campo" for="sim-taxa">Live falsa: eventos por minuto</label><input id="sim-taxa" type="number" min="1" max="6000" value="120" inputmode="numeric">' +
    '<div class="grade"><button class="cheio" id="sim-live-on" type="button">Ligar live falsa</button><button id="sim-live-off" type="button">Desligar</button></div>' +
    '<div class="grade"><button id="sim-carga" type="button">Teste de carga (60 s)</button></div>' +
    '<p class="pequeno">Carga: 20 comentários e 200 curtidas por segundo durante 60 s. Veja o atraso do motor e os quadros por segundo na aba Jogo.</p></section>';

  function simMsg(t) { $('sim-msg').textContent = t; }
  function sim(pedido, ok) {
    var u = $('sim-usuario').value.trim();
    if (u) pedido.usuario = u;
    return post('/api/simulador', pedido).then(function (r) {
      simMsg(r.__ok ? (ok || 'Enviado.') : (r.erro || 'O simulador recusou o pedido.'));
      return r;
    }).catch(function () { simMsg('Não consegui falar com o servidor do app.'); });
  }
  $('sim-com-l').onclick = function () { sim({ acao: 'comentar', lado: 'lula', vezes: Number($('sim-vezes').value) }, 'Comentário LULA enviado.'); };
  $('sim-com-f').onclick = function () { sim({ acao: 'comentar', lado: 'flavio', vezes: Number($('sim-vezes').value) }, 'Comentário FLÁVIO enviado.'); };
  function presenteEscolhido() {
    var nome = $('sim-presente').value;
    var item = ((conf && conf.presentesDoSimulador) || []).filter(function (p) { return p.nome === nome; })[0];
    return item ? { nome: item.nome, valor: item.valor } : null;
  }
  $('sim-enviar-presente').onclick = function () {
    var p = presenteEscolhido(); if (!p) { simMsg('Escolha um presente.'); return; }
    sim({ acao: 'presente', nome: p.nome, valor: p.valor, quantidade: Number($('sim-qtd-presente').value) || 1 }, 'Presente enviado.');
  };
  $('sim-sequencia').onclick = function () {
    var p = presenteEscolhido(); if (!p) { simMsg('Escolha um presente.'); return; }
    if (!$('sim-usuario').value.trim()) $('sim-usuario').value = 'teste1';
    var passos = [1, 2, 3, 5, 5], i = 0;
    simMsg('Enviando a sequência…');
    (function proximo() {
      if (i >= passos.length) { simMsg('Sequência enviada: deve contar 5 unidades no total.'); return; }
      var ultimo = i === passos.length - 1;
      sim({ acao: 'presente', nome: p.nome, valor: p.valor, quantidade: passos[i], sequencia: true, fimSequencia: ultimo }, 'Passo ' + (i + 1) + ' de 5 enviado.')
        .then(function () { i++; setTimeout(proximo, 350); });
    })();
  };
  $('sim-curtir10').onclick = function () { sim({ acao: 'curtidas', quantidade: 10 }, '10 curtidas enviadas.'); };
  $('sim-curtir100').onclick = function () { sim({ acao: 'curtidas', quantidade: 100 }, '100 curtidas enviadas.'); };
  $('sim-lote').onclick = function () { sim({ acao: 'curtidas-em-lote' }, 'Lote de curtidas enviado.'); };
  $('sim-follow').onclick = function () { sim({ acao: 'follow' }, 'Seguir enviado.'); };
  $('sim-share').onclick = function () { sim({ acao: 'share' }, 'Compartilhamento enviado.'); };
  $('sim-multidao').onclick = function () { sim({ acao: 'multidao', quantidade: 200 }, 'Multidão de 200 criada.'); };
  $('sim-live-on').onclick = function () { sim({ acao: 'live-falsa', ligar: true, porMinuto: Number($('sim-taxa').value) || 120 }, 'Live falsa ligada.'); };
  $('sim-live-off').onclick = function () { sim({ acao: 'live-falsa', ligar: false }, 'Live falsa desligada.'); };
  $('sim-carga').onclick = function () { sim({ acao: 'carga', ligar: true }, 'Teste de carga rodando por 60 s.'); };
  $('sim-parar').onclick = function () { sim({ acao: 'parar' }, 'Live falsa e carga paradas.'); };

  // ---------- dados do servidor ----------
  function carregarConfig() {
    return fetch('/api/jogo/config', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) {
      conf = c;
      var sel = $('sim-presente');
      if (!sel.children.length) {
        (c.presentesDoSimulador || []).forEach(function (p) {
          var o = el('option', null, p.nome + ' (' + p.valor + (p.valor === 1 ? ' moeda' : ' moedas') + ')');
          o.value = p.nome; sel.appendChild(o);
        });
      }
      $('j-legal').textContent = c.avisoLegal || '';
      $('j-avisos-config').textContent = c.avisos && c.avisos.length ? c.avisos.join(' ') : 'Sem avisos de configuração.';
    }).catch(function () { setTimeout(carregarConfig, 3000); });
  }

  function atualizarMetricas() {
    if (document.visibilityState !== 'visible' || abaAtual === 'diag') return;
    fetch('/api/jogo/metricas', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (m) { metricas = m; desenharMetricas(); }).catch(function () {});
  }
  setInterval(atualizarMetricas, 1000);

  var sock = null, tent = 0, ultimoDesenho = 0;
  function conectar() {
    try { sock = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { setTimeout(conectar, 2000); return; }
    sock.onopen = function () { tent = 0; $('topo-conexao').replaceChildren(el('span', 'selo ok', 'CONECTADO')); carregarConfig(); };
    sock.onmessage = function (ev) {
      var msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.tipo === 'estado') {
        estado = msg;
        var agora = Date.now();
        // a tela do painel atualiza a cada 1 s e só quando está visível
        if (agora - ultimoDesenho >= 1000 && document.visibilityState === 'visible') { ultimoDesenho = agora; desenharJogo(); }
      } else if (msg.tipo === 'evento' && msg.nome === 'fim-rodada') { ultimoDesenho = 0; }
    };
    sock.onclose = function () { $('topo-conexao').replaceChildren(el('span', 'selo alerta', 'RECONECTANDO…')); setTimeout(conectar, Math.min(5000, 1000 + tent++ * 500)); };
    sock.onerror = function () { try { sock.close(); } catch (e) { /* ignora */ } };
  }
  conectar();
  fetch('/api/jogo/estado', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (e) { estado = e; desenharJogo(); }).catch(function () {});
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { carregarConfig(); desenharJogo(); } });

  var inicial = 'jogo';
  try { inicial = sessionStorage.getItem('puxa-aba') || 'jogo'; } catch (e) { /* ignora */ }
  abrirAba(['jogo', 'sim', 'diag'].indexOf(inicial) >= 0 ? inicial : 'jogo');
  carregarConfig();
})();

// Overlay do jogo (Fase 1: versão simples em Canvas 2D).
// Tela lógica 1080×1920, escalada para o aparelho; fundo preenche as sobras. Só desenha o estado recebido do servidor.
// Nunca mostra texto livre de comentário: o feed vem pronto do jogo.
(function () {
  'use strict';

  var W = 1080, H = 1920;
  var COR = {
    lula: { base: '#D0021B', real: '#FF4B4B', esc: '#7A0010', texto: '#ffffff' },
    flavio: { base: '#009C3B', real: '#FFDF00', esc: '#00582A', texto: '#ffffff' },
  };
  var NAVY = '#0B1B3A';
  var BASE_X = { lula: 130, flavio: 950 };   // linhas de base (P = 0 e P = 100)
  var CORDA_Y = 790;
  var ZONA = { x0: 40, x1: 1040, y0: 220, y1: 1480 };
  var ehCalibrar = /[?&]calibrar=1/.test(location.search);
  var ehLive = /[?&]live=1/.test(location.search);
  var iniCalibrar = Date.now();

  var tela = document.getElementById('tela');
  var ctx = tela.getContext('2d');
  var cw = 0, ch = 0, dpr = 1, esc = 1, ox = 0, oy = 0;

  function ajustarTela() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth; ch = window.innerHeight;
    tela.width = Math.round(cw * dpr); tela.height = Math.round(ch * dpr);
    esc = Math.min(cw / W, ch / H);
    ox = (cw - W * esc) / 2; oy = (ch - H * esc) / 2;
  }
  window.addEventListener('resize', ajustarTela);
  ajustarTela();

  // ---------- dados do servidor ----------
  var est = null;           // último estado
  var conf = { legenda: [], efeitos: [], avisoLegal: 'Jogo de entretenimento. Não é pesquisa eleitoral nem propaganda de campanha.' };
  var conectado = false;
  var destaques = [];       // faixas de presentes grandes { lado, texto, ate }
  var avisoDeNocaute = 0;
  var flagP = 50;           // posição suavizada da bandeira
  var posApoiador = {};     // id -> { x, y }
  var nomesEfeitos = {};

  function carregarConfig() {
    fetch('/api/jogo/config', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) {
      conf.legenda = c.legenda || [];
      conf.avisoLegal = c.avisoLegal || conf.avisoLegal;
      (c.efeitos || []).forEach(function (e) { nomesEfeitos[e.id] = e.nome; });
    }).catch(function () { setTimeout(carregarConfig, 3000); });
  }
  carregarConfig();

  var ws = null, tentativas = 0;
  function conectarWs() {
    try { ws = new WebSocket('ws://' + location.host + '/ws'); } catch (e) { setTimeout(conectarWs, 2000); return; }
    ws.onopen = function () { conectado = true; tentativas = 0; carregarConfig(); };
    ws.onclose = function () { conectado = false; setTimeout(conectarWs, Math.min(5000, 800 + tentativas++ * 500)); };
    ws.onerror = function () { try { ws.close(); } catch (e) { /* ignora */ } };
    ws.onmessage = function (m) {
      var msg; try { msg = JSON.parse(m.data); } catch (e) { return; }
      if (msg.tipo === 'estado') est = msg;
      else if (msg.tipo === 'evento') aoEvento(msg);
    };
  }
  conectarWs();

  function aoEvento(e) {
    if (e.nome === 'presente' && e.moedas >= 50) {
      var nome = nomesEfeitos[e.efeito] || 'Presente';
      destaques.push({ lado: e.lado, texto: nome.toUpperCase() + ' · ' + e.moedas + ' moedas', quem: '@' + e.uid, ate: Date.now() + 3000, ini: Date.now() });
      if (destaques.length > 3) destaques.shift();
    } else if (e.nome === 'nocaute') {
      avisoDeNocaute = Date.now() + 2500;
    } else if (e.nome === 'zebra') {
      destaques.push({ lado: e.lado, texto: 'TORCIDA ZEBRA!', quem: '', ate: Date.now() + 3000, ini: Date.now() });
    } else if (e.nome === 'barra-cheia') {
      destaques.push({ lado: e.lado, texto: 'BARRA DA VIRADA CHEIA!', quem: '', ate: Date.now() + 3000, ini: Date.now() });
    }
  }

  // ---------- utilitários de desenho ----------
  function fonte(px, peso) { return (peso || 800) + ' ' + px + 'px system-ui, "Segoe UI", Roboto, sans-serif'; }
  function texto(t, x, y, px, cor, alinha, peso, contorno) {
    ctx.font = fonte(px, peso);
    ctx.textAlign = alinha || 'left';
    ctx.textBaseline = 'alphabetic';
    if (contorno !== 0) {
      ctx.lineJoin = 'round'; ctx.lineWidth = contorno || Math.max(4, px / 9); ctx.strokeStyle = NAVY;
      ctx.strokeText(t, x, y);
    }
    ctx.fillStyle = cor || '#fff';
    ctx.fillText(t, x, y);
  }
  function caixa(x, y, w, h, r, cor, borda, larguraBorda) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else { ctx.rect(x, y, w, h); }
    if (cor) { ctx.fillStyle = cor; ctx.fill(); }
    if (borda) { ctx.lineWidth = larguraBorda || 4; ctx.strokeStyle = borda; ctx.stroke(); }
  }
  function disco(x, y, r, cor, borda) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = cor; ctx.fill();
    if (borda) { ctx.lineWidth = Math.max(3, r / 6); ctx.strokeStyle = borda; ctx.stroke(); }
  }
  function iniciais(nome) {
    var s = String(nome || '?').replace(/^@/, '').replace(/[^A-Za-zÀ-ÿ0-9]+/g, ' ').trim();
    if (!s) return '?';
    var partes = s.split(' ');
    var a = partes[0].charAt(0);
    var b = partes.length > 1 ? partes[1].charAt(0) : (partes[0].charAt(1) || '');
    return (a + b).toUpperCase();
  }
  function mmss(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }
  function nomeLado(l) { return String((est && est.lados && est.lados[l]) || (l === 'lula' ? 'Lula' : 'Flávio')).toUpperCase(); }
  function pts(n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); }

  // ---------- cenas ----------
  function fundo(t) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2d86e0'); g.addColorStop(0.30, '#9fd3ff'); g.addColorStop(0.405, '#cfeaff');
    g.addColorStop(0.406, '#3f9b3a'); g.addColorStop(0.6, '#2b7a31'); g.addColorStop(1, '#1d5a27');
    ctx.fillStyle = g;
    ctx.fillRect(-ox / esc - 2, -oy / esc - 2, cw / esc + 4, ch / esc + 4);
    // nuvens simples
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (var i = 0; i < 3; i++) {
      var cx = ((t / 60 + i * 420) % 1500) - 200, cy = 640 + i * 38;
      ctx.beginPath(); ctx.ellipse(cx, cy, 90, 26, 0, 0, Math.PI * 2); ctx.ellipse(cx + 60, cy - 14, 60, 24, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function cabecalho(t) {
    texto('PUXA BRASIL', 40, 268, 46, '#FFDF00', 'left', 900);
    texto('Rodada ' + est.sessao.rodada, 40, 318, 34, '#fff', 'left', 800);
    var f = est.fase, nome = f.nome, tempo = '--:--', corTempo = '#fff', rotulo = '';
    if (nome === 'abertura') { tempo = String(Math.max(0, Math.ceil(f.restanteMs / 1000))); rotulo = 'PREPARAR'; }
    else if (nome === 'disputa') { tempo = mmss(f.contagemMs); rotulo = 'DISPUTA'; }
    else if (nome === 'reta-final') { tempo = mmss(f.contagemMs); rotulo = 'RETA FINAL ×' + f.multiplicador; corTempo = Math.floor(t / 400) % 2 ? '#FF4B4B' : '#fff'; }
    else if (nome === 'morte-subita') { tempo = mmss(f.restanteMs); rotulo = 'MORTE SÚBITA ×' + f.multiplicador; corTempo = '#FFDF00'; }
    else if (nome === 'resultado') { tempo = '00:00'; rotulo = 'FIM DA RODADA'; }
    texto(tempo, 540, 332, 124, corTempo, 'center', 900, 12);
    if (rotulo) texto(rotulo, 1040, 268, 32, '#fff', 'right', 800);
    if (f.multiplicador > 1 && nome !== 'reta-final' && nome !== 'morte-subita') texto('×' + f.multiplicador + ' pontos', 1040, 312, 30, '#FFDF00', 'right', 800);
  }

  function placar(t) {
    ['lula', 'flavio'].forEach(function (l) {
      var x = l === 'lula' ? 40 : 640, w = 400, y = 352, h = 216;
      var c = COR[l];
      caixa(x, y, w, h, 22, 'rgba(11,27,58,.9)', c.base, 6);
      caixa(x, y, w, 52, 20, c.base);
      texto(nomeLado(l), x + 20, y + 40, 40, l === 'lula' ? '#fff' : '#FFDF00', 'left', 900, 0);
      var frente = est.corda.naFrente === l;
      if (frente) { caixa(x + w - 170, y + 8, 158, 36, 18, '#FFDF00'); texto('NA FRENTE', x + w - 91, y + 35, 24, NAVY, 'center', 900, 0); }
      texto(pts(est.placar.rodada[l]), x + w / 2, y + 128, 78, '#fff', 'center', 900, 8);
      texto('FORÇA ' + est.corda.percentual[l] + '%', x + 20, y + 186, 28, c.real, 'left', 800, 0);
      texto(est.placar.apoiadores[l] + ' apoiadores', x + w - 20, y + 186, 28, '#fff', 'right', 700, 0);
    });
    // centro
    caixa(450, 352, 180, 216, 18, 'rgba(11,27,58,.9)', '#ffffff55', 3);
    texto('DIFERENÇA', 540, 392, 22, '#aebbd6', 'center', 800, 0);
    texto(pts(est.placar.diferenca), 540, 448, 48, '#fff', 'center', 900, 6);
    texto('PLACAR DA LIVE', 540, 494, 19, '#aebbd6', 'center', 800, 0);
    texto(est.placar.live.lula + ' × ' + est.placar.live.flavio, 540, 548, 46, '#fff', 'center', 900, 6);
  }

  function posicaoBandeira() { return BASE_X.lula + (flagP / 100) * (BASE_X.flavio - BASE_X.lula); }

  function apoiador(a, lado, alvoX, alvoY, raio, t, dourado) {
    var pos = posApoiador[a.id];
    var origemX = lado === 'lula' ? 40 : 1040;
    if (!pos) { pos = posApoiador[a.id] = { x: origemX, y: CORDA_Y, usado: true }; }
    pos.x += (alvoX - pos.x) * 0.12; pos.y += (alvoY - pos.y) * 0.12;
    pos.usado = true;
    var puxar = Math.sin(t / 130 + a.id.length * 1.7) * 3;
    var dir = lado === 'lula' ? -1 : 1;
    var x = pos.x + dir * Math.abs(puxar), y = pos.y;
    // braço até a corda
    ctx.lineWidth = 5; ctx.strokeStyle = COR[lado].esc;
    ctx.beginPath(); ctx.moveTo(x, y + raio * 0.6); ctx.lineTo(x - dir * raio * 0.6, CORDA_Y); ctx.stroke();
    disco(x, y, raio, COR[lado].base, a.dourado || dourado ? '#FFD84A' : (lado === 'flavio' ? '#FFDF00' : '#fff'));
    texto(iniciais(a.uid || a.nome), x, y + raio * 0.36, raio * 0.95, '#fff', 'center', 900, 0);
  }

  function arena(t) {
    var fx = posicaoBandeira();
    // linhas de base
    ['lula', 'flavio'].forEach(function (l) {
      var x = BASE_X[l];
      var g = ctx.createLinearGradient(l === 'lula' ? 40 : 1040, 0, x, 0);
      g.addColorStop(0, COR[l].base + 'cc'); g.addColorStop(1, COR[l].base + '22');
      ctx.fillStyle = g; ctx.fillRect(Math.min(x, l === 'lula' ? 40 : 1040), 668, Math.abs((l === 'lula' ? 40 : 1040) - x), 250);
      ctx.fillStyle = l === 'lula' ? '#fff' : '#FFDF00'; ctx.fillRect(x - 4, 668, 8, 250);
      texto('BASE ' + nomeLado(l), l === 'lula' ? 40 : 1040, 930, 22, '#fff', l === 'lula' ? 'left' : 'right', 800, 5);
    });
    // linha do meio
    ctx.setLineDash([14, 12]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.moveTo(540, 690); ctx.lineTo(540, 900); ctx.stroke(); ctx.setLineDash([]);
    // corda
    ctx.lineCap = 'round';
    ctx.lineWidth = 18; ctx.strokeStyle = '#5b3a1a'; ctx.beginPath(); ctx.moveTo(90, CORDA_Y); ctx.lineTo(990, CORDA_Y); ctx.stroke();
    ctx.lineWidth = 12; ctx.strokeStyle = '#c99a5b'; ctx.beginPath(); ctx.moveTo(90, CORDA_Y); ctx.lineTo(990, CORDA_Y); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#8a5a2b'; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(90, CORDA_Y); ctx.lineTo(990, CORDA_Y); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineCap = 'butt';

    // apoiadores
    for (var k in posApoiador) if (posApoiador[k] && posApoiador[k].usado) posApoiador[k].usado = false;
    ['lula', 'flavio'].forEach(function (l) {
      var lista = est.apoiadores[l] || [];
      var dir = l === 'lula' ? -1 : 1;
      var inicio = fx + dir * (l === 'lula' ? 56 : 96);
      var fim = BASE_X[l] + (l === 'lula' ? 70 : -70);
      var colunas = Math.max(1, Math.ceil(Math.max(0, lista.length - 1) / 2));
      var passo = Math.min(40, Math.abs(fim - inicio) / Math.max(1, colunas));
      for (var i = 1; i < lista.length; i++) {
        var col = Math.floor((i - 1) / 2), linha = (i - 1) % 2;
        apoiador(lista[i], l, inicio + dir * col * passo, linha ? CORDA_Y + 62 : CORDA_Y - 62, 19, t);
      }
      if (lista[0]) {
        var cx = l === 'lula' ? 92 : 988;
        apoiador(lista[0], l, cx, CORDA_Y - 4, 40, t, true);
        texto('CAPITÃO', cx, CORDA_Y + 74, 20, '#fff', 'center', 800, 5);
      }
      var extra = (est.apoiadores.extra && est.apoiadores.extra[l]) || 0;
      if (extra > 0) { caixa((l === 'lula' ? 40 : 940), 850, 100, 40, 20, 'rgba(11,27,58,.9)', COR[l].real, 3); texto('+' + extra, (l === 'lula' ? 90 : 990), 880, 28, '#fff', 'center', 900, 0); }
    });
    for (var id in posApoiador) if (posApoiador[id] && posApoiador[id].usado === false) delete posApoiador[id];

    // bandeira (tremor perto da linha)
    var perto = Math.max(0, Math.abs(flagP - 50) - 30) / 20;
    var tremor = Math.sin(t / 35) * 5 * Math.min(1, perto);
    var bx = fx + tremor;
    ctx.lineWidth = 8; ctx.strokeStyle = '#3a2a14'; ctx.beginPath(); ctx.moveTo(bx, CORDA_Y + 40); ctx.lineTo(bx, 690); ctx.stroke();
    var onda = Math.sin(t / 220) * 8;
    ctx.beginPath(); ctx.moveTo(bx, 694); ctx.quadraticCurveTo(bx + 40, 690 + onda, bx + 78, 716); ctx.quadraticCurveTo(bx + 40, 746 - onda, bx, 742); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = NAVY; ctx.stroke();
    disco(bx, CORDA_Y, 14, '#FFDF00', NAVY);

    // barra da virada
    if (est.barra.ativa) {
      var bw = 640, bxx = 220, by = 944;
      caixa(bxx, by, bw, 32, 16, 'rgba(11,27,58,.9)', '#FFDF00', 3);
      var frac = Math.max(0, Math.min(1, est.barra.valor / est.barra.meta));
      if (frac > 0) caixa(bxx + 3, by + 3, (bw - 6) * frac, 26, 13, '#FFDF00');
      texto('BARRA DA VIRADA ' + est.barra.valor + '/' + est.barra.meta, 540, by + 25, 22, '#fff', 'center', 900, 5);
    }
    // avisos de arena
    if (est.sessao.modoTeste) { caixa(40, 590, 330, 40, 20, '#FFDF00'); texto('MODO TESTE · eventos simulados', 205, 618, 20, NAVY, 'center', 900, 0); }
    if (est.corda.zebra) texto('TORCIDA ZEBRA · ' + nomeLado(est.corda.zebra), 540, 640, 30, COR[est.corda.zebra].real, 'center', 900);
    if (est.corda.nocauteMs > 0 || Date.now() < avisoDeNocaute) texto('NOCAUTE!', 540, 700, 56, '#FF4B4B', 'center', 900, 8);
  }

  function legenda() {
    var y = 1012, h = 246;
    ['lula', 'flavio'].forEach(function (l) {
      var x = l === 'lula' ? 40 : 550, w = 490;
      caixa(x, y, w, h, 18, 'rgba(11,27,58,.88)', COR[l].base, 4);
      texto('PRESENTES · ' + nomeLado(l), x + 18, y + 40, 28, COR[l].real, 'left', 900, 0);
      var linhas = 0;
      conf.legenda.forEach(function (e) {
        var d = e[l]; if (!d || linhas >= 5) return;
        var yy = y + 84 + linhas * 40;
        disco(x + 34, yy - 9, 14, COR[l].base, '#fff');
        var rotuloMoedas = d.moedas + (d.moedas === 1 ? ' moeda' : ' moedas');
        ctx.font = fonte(22, 700);
        var larguraMoedas = ctx.measureText(rotuloMoedas).width;
        var tam = 27;
        ctx.font = fonte(tam, 800);
        while (tam > 17 && ctx.measureText(d.nome).width > (w - 60 - 18 - larguraMoedas - 14)) { tam -= 1; ctx.font = fonte(tam, 800); }
        texto(d.nome, x + 60, yy, tam, '#fff', 'left', 800, 0);
        texto(rotuloMoedas, x + w - 18, yy, 22, '#cfd9ee', 'right', 700, 0);
        linhas++;
      });
      if (!linhas) texto('Presentes em breve', x + 18, y + 90, 26, '#aebbd6', 'left', 700, 0);
    });
  }

  function feed() {
    var itens = (est.feed || []).slice().sort(function (a, b) { return b.idadeMs - a.idadeMs; }).slice(-6);
    var y0 = 1294;
    itens.forEach(function (it, i) {
      var y = y0 + i * 27;
      var alfa = it.idadeMs > 7000 ? Math.max(0, (8000 - it.idadeMs) / 1000) : 1;
      ctx.globalAlpha = alfa;
      disco(54, y - 8, 11, COR[it.lado] ? COR[it.lado].base : '#777', '#fff');
      texto(it.texto, 78, y, 24, '#fff', 'left', 700, 5);
      ctx.globalAlpha = 1;
    });
  }

  function avisos() {
    caixa(40, 1442, 1000, 38, 12, 'rgba(11,27,58,.85)');
    var a = est.aviso || '';
    texto(a, 540, 1466, 22, '#FFDF00', 'center', 800, 0);
  }
  function notaLegal() {
    texto(conf.avisoLegal, 540, 1500, 17, 'rgba(255,255,255,.8)', 'center', 600, 3);
  }

  function destaquesCentro(t) {
    var agora = Date.now();
    destaques = destaques.filter(function (d) { return d.ate > agora; });
    destaques.forEach(function (d, i) {
      var vida = (agora - d.ini) / 3000;
      var a = vida < 0.1 ? vida / 0.1 : vida > 0.85 ? (1 - vida) / 0.15 : 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      var y = 610 + i * 70;
      caixa(140, y, 800, 60, 30, COR[d.lado] ? COR[d.lado].base : NAVY, '#fff', 4);
      texto(d.texto + (d.quem ? '  ' + d.quem : ''), 540, y + 42, 32, '#fff', 'center', 900, 0);
      ctx.globalAlpha = 1;
    });
    void t;
  }

  function resultado() {
    var r = est.resultado;
    caixa(90, 610, 900, 380, 26, 'rgba(11,27,58,.94)', r && r.vencedor ? COR[r.vencedor].real : '#fff', 6);
    var titulo = !r ? 'FIM DA RODADA' : r.vencedor ? nomeLado(r.vencedor) + ' VENCEU!' : 'EMPATE!';
    texto(titulo, 540, 700, 70, r && r.vencedor ? COR[r.vencedor].real : '#fff', 'center', 900, 8);
    if (r) {
      var como = r.como === 'nocaute' ? 'por NOCAUTE' : r.como === 'morte-subita' ? 'na MORTE SÚBITA' : r.como === 'empate' ? 'sem desempate' : 'no tempo';
      texto('Rodada ' + r.n + ' · ' + como, 540, 756, 34, '#fff', 'center', 800, 0);
      texto(nomeLado('lula') + ' ' + pts(r.pontos.lula) + '  ×  ' + pts(r.pontos.flavio) + ' ' + nomeLado('flavio'), 540, 826, 42, '#fff', 'center', 900, 0);
      var cap = r.capitaes && r.capitaes[r.vencedor || 'lula'];
      if (r.vencedor && cap) texto('Capitão: @' + cap.uid + ' · ' + pts(cap.pts) + ' pontos', 540, 884, 30, '#FFDF00', 'center', 800, 0);
    }
    texto('Placar da Live  ' + est.placar.live.lula + ' × ' + est.placar.live.flavio, 540, 936, 32, '#cfd9ee', 'center', 800, 0);
    texto('Próxima rodada em ' + Math.max(0, Math.ceil(est.fase.restanteMs / 1000)) + ' s', 540, 972, 26, '#aebbd6', 'center', 700, 0);
  }

  function mensagemCentral(titulo, sub) {
    caixa(120, 700, 840, 200, 26, 'rgba(11,27,58,.92)', '#fff', 4);
    texto(titulo, 540, 790, 56, '#fff', 'center', 900, 6);
    if (sub) texto(sub, 540, 850, 32, '#cfd9ee', 'center', 700, 0);
  }

  function calibrar() {
    if (Date.now() - iniCalibrar > 10000) return;
    ctx.save();
    ctx.lineWidth = 4; ctx.strokeStyle = '#ff00ff'; ctx.strokeRect(0, 0, W, H);
    ctx.strokeStyle = '#00ffff'; ctx.strokeRect(ZONA.x0, ZONA.y0, ZONA.x1 - ZONA.x0, ZONA.y1 - ZONA.y0);
    ctx.font = fonte(22, 700); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    for (var y = 0; y <= H; y += 100) { ctx.fillStyle = '#ffffffaa'; ctx.fillRect(0, y, 60, 2); ctx.fillStyle = '#fff'; ctx.fillText('y ' + y, 66, y + 8); }
    ctx.restore();
    texto('CALIBRAÇÃO · moldura 9:16 (rosa) e zona segura (azul)', 540, 200, 28, '#fff', 'center', 800);
  }

  // ---------- laço de desenho ----------
  var quadros = 0, ultimoFps = performance.now(), ultimoQuadro = performance.now();
  function desenhar(agoraMs) {
    var t = agoraMs;
    var dt = Math.min(0.25, (agoraMs - ultimoQuadro) / 1000); ultimoQuadro = agoraMs;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(dpr * esc, 0, 0, dpr * esc, dpr * ox, dpr * oy);
    fundo(t);
    if (!est) {
      mensagemCentral('Aguardando a live começar…', conectado ? '' : 'conectando ao servidor…');
    } else {
      flagP += (est.corda.P - flagP) * Math.min(1, dt * 9);
      cabecalho(t); placar(t); arena(t); legenda(); feed(); avisos(); notaLegal();
      destaquesCentro(t);
      var st = est.sessao.status, fase = est.fase.nome;
      if (st === 'rodando' && fase === 'resultado') resultado();
      else if (st === 'rodando' && fase === 'abertura') mensagemCentral('PREPARAR!', 'Comente ' + nomeLado('lula') + ' ou ' + nomeLado('flavio') + ' e entre na corda');
      else if (st === 'pausado') mensagemCentral('JOGO PAUSADO', 'já voltamos');
      else if (st === 'parado') mensagemCentral('Aguardando a live começar…', '');
      else if (st === 'encerrado') mensagemCentral('LIVE ENCERRADA', 'Placar final ' + est.placar.live.lula + ' × ' + est.placar.live.flavio);
      if (!conectado) { caixa(340, 1400, 400, 36, 18, '#FFDF00'); texto('Reconectando…', 540, 1427, 24, NAVY, 'center', 900, 0); }
    }
    if (ehCalibrar) calibrar();
    quadros++;
    if (agoraMs - ultimoFps >= 5000) {
      var fps = Math.round(quadros * 1000 / (agoraMs - ultimoFps));
      quadros = 0; ultimoFps = agoraMs;
      if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify({ tipo: 'fps', fps: fps })); } catch (e) { /* ignora */ } }
    }
    requestAnimationFrame(desenhar);
  }
  requestAnimationFrame(desenhar);

  // ---------- Modo Live: tela acesa, imersivo, gesto de saída ----------
  var nativo = window.PuxaNativo;
  function chamarNativo(nome, arg) { try { if (nativo && typeof nativo[nome] === 'function') nativo[nome](arg); } catch (e) { /* ignora */ } }
  if (ehLive) chamarNativo('modoLive', true);
  window.addEventListener('pagehide', function () { if (ehLive) chamarNativo('modoLive', false); });
  var trava = null;
  function pedirTravaDeTela() {
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (t) { trava = t; }).catch(function () {}); } catch (e) { /* ignora */ }
  }
  pedirTravaDeTela();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') pedirTravaDeTela(); });

  var timerSaida = null;
  function sair() {
    if (ehLive) chamarNativo('modoLive', false);
    location.href = '/painel';
  }
  window.__puxaSair = sair;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length >= 2 && !timerSaida) timerSaida = setTimeout(function () { timerSaida = null; sair(); }, 2000);
  }, { passive: true });
  function cancelarSaida() { if (timerSaida) { clearTimeout(timerSaida); timerSaida = null; } }
  document.addEventListener('touchend', function (e) { if (e.touches.length < 2) cancelarSaida(); }, { passive: true });
  document.addEventListener('touchcancel', cancelarSaida, { passive: true });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
})();

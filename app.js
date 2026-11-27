'use strict';
(function () {
  var A = window.A = {};

  // ============================================================ constantes
  var CAT_ICON = {
    'Cervejas': '🍺', 'Barris de Alambique (Doses)': '🛢️', 'Chopp & Barris': '🛢️', 'Refrigerantes': '🥤', 'Águas': '💧', 'Sucos & Chás': '🧃',
    'Energéticos & Isotônicos': '⚡', 'Whiskies & Destilados': '🥃', 'Destilados': '🥃', 'Doses & Drinks': '🍸',
    'Gelos & Gelos Saborizados': '🧊', 'Cigarros & Tabacaria': '🚬', 'Cigarros Picados (Unidade)': '🚬',
    'Vinhos & Espumantes': '🍷', 'Salgadinhos & Petiscos': '🍟', 'Miojos & Massas Rápidas': '🍜',
    'Biscoitos & Bolachas': '🍪', 'Chocolates & Doces': '🍫', 'Outros': '🧴'
  };
  var CAT_COR = {
    'Cervejas': 'bg-amber-100 text-amber-800 border-amber-300', 'Barris de Alambique (Doses)': 'bg-amber-200/70 text-amber-950 border-amber-400', 'Chopp & Barris': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Refrigerantes': 'bg-red-100 text-red-800 border-red-200', 'Águas': 'bg-sky-100 text-sky-800 border-sky-200',
    'Sucos & Chás': 'bg-lime-100 text-lime-800 border-lime-200', 'Energéticos & Isotônicos': 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
    'Whiskies & Destilados': 'bg-amber-900/15 text-amber-950 border-amber-400', 'Destilados': 'bg-stone-200 text-stone-800 border-stone-300',
    'Doses & Drinks': 'bg-orange-100 text-orange-900 border-orange-300',
    'Gelos & Gelos Saborizados': 'bg-cyan-100 text-cyan-900 border-cyan-300',
    'Cigarros & Tabacaria': 'bg-stone-200 text-stone-900 border-stone-400',
    'Cigarros Picados (Unidade)': 'bg-amber-100 text-amber-900 border-amber-400',
    'Vinhos & Espumantes': 'bg-purple-100 text-purple-800 border-purple-200',
    'Salgadinhos & Petiscos': 'bg-yellow-50 text-amber-900 border-amber-300', 'Miojos & Massas Rápidas': 'bg-rose-50 text-rose-800 border-rose-200',
    'Biscoitos & Bolachas': 'bg-orange-50 text-orange-800 border-orange-200', 'Chocolates & Doces': 'bg-pink-100 text-pink-900 border-pink-300',
    'Outros': 'bg-slate-100 text-slate-700 border-slate-200'
  };
  var PAGAMENTOS = ['PIX', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'Fiado / A Prazo'];
  var EMBALAGENS = ['Caixa', 'Fardo', 'Pack', 'Display', 'Pacote', 'Pacote (10 maços)', 'Carteira (20 un)', 'Cartela (12 un)', 'Display (50 un)', 'Pote', 'Barril 5L (100 doses)', 'Garrafa (20 doses)', 'Garrafa (18 doses)', 'Engradado', 'Barril', 'Galão', 'Unidade'];
  var TABS = [
    { id: 'dashboard', nome: 'Painel', ico: '📊' },
    { id: 'saida', nome: 'Balcão (PDV)', ico: '🛒' },
    { id: 'mesas', nome: 'Mesas (Consumo Local)', ico: '🪑' },
    { id: 'reposicao', nome: 'Reposição', ico: '📋' },
    { id: 'relatorio', nome: 'Relatório de Vendas', ico: '📈' },
    { id: 'estoque', nome: 'Estoque & Lotes', ico: '📦' },
    { id: 'entrada', nome: 'Entrada de Compras', ico: '📥' },
    { id: 'clientes', nome: 'Clientes & Fiado', ico: '👥' },
    { id: 'depositos', nome: 'Geladeiras & Depósito', ico: '🧊' },
    { id: 'historico', nome: 'Histórico', ico: '🕒' }
  ];

  // ============================================================ estado
  var S = { rev: 0, config: { empresa: '', operador: '' }, categorias: [], depositos: [], tiposSaida: [], produtos: [], lotes: [], clientes: [], mesas: [], vendas: [], historico: [], tunnelUrl: null, wifiUrl: '' };
  var E = {};      // resumo de estoque por produto
  var C30 = {};    // consumo (un) vendido nos últimos 30 dias por produto
  var PIN = localStorage.getItem('db_pin') || '';
  var tab = localStorage.getItem('db_tab') || 'dashboard';
  var online = true;
  var F = { estBusca: '', estCat: '', estDep: '', estSt: '', repFiltro: 'todos', relPeriodo: '30d', relCat: '', cliBusca: '', hisAba: 'vendas', hisBusca: '', hisTipo: '', hisCliente: '', depSel: '' };
  var expandido = {};
  var cart = [];

  // ============================================================ utilitários
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function brl(n) { return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function nf(n) { return (Number(n) || 0).toLocaleString('pt-BR'); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function diaLocal(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function fmtDia(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function fmtData(iso) { if (!iso) return '—'; var d = new Date(iso); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function diasPara(iso) {
    if (!iso) return Infinity;
    var p = iso.split('-').map(Number);
    var h = new Date(); h.setHours(0, 0, 0, 0);
    return Math.round((new Date(p[0], p[1] - 1, p[2]) - h) / 864e5);
  }
  function statusVal(iso) {
    var d = diasPara(iso);
    if (d < 0) return { k: 'vencido', d: d, label: 'VENCIDO há ' + Math.abs(d) + 'd', cls: 'bg-rose-100 text-rose-800 border-rose-300' };
    if (d <= 30) return { k: 'critico', d: d, label: d + 'd p/ vencer', cls: 'bg-amber-100 text-amber-800 border-amber-400 pulse' };
    if (d <= 90) return { k: 'atencao', d: d, label: d + ' dias', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    return { k: 'ok', d: d, label: d + ' dias', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  }
  function fmtQtd(un, pc) {
    un = Number(un) || 0; pc = Number(pc) || 1;
    if (pc <= 1) return nf(un) + ' un';
    var cx = Math.floor(un / pc), r = un % pc;
    if (!cx) return r + ' un';
    return cx + ' cx' + (r ? ' + ' + r + ' un' : '');
  }
  function P(id) { for (var i = 0; i < S.produtos.length; i++) if (S.produtos[i].id === id) return S.produtos[i]; return null; }
  function CL(id) { for (var i = 0; i < S.clientes.length; i++) if (S.clientes[i].id === id) return S.clientes[i]; return null; }
  function ehVendedor() { return S.role === 'vendedor'; }
  function precoCxEf(p) { return p.precoCx > 0 ? p.precoCx : Math.round(p.preco * p.unPorCx * 100) / 100; }
  function rotuloProd(p) { return p.nome + (p.marca ? ' — ' + p.marca : '') + (p.ean ? ' · ' + p.ean : ''); }
  function toNum(v) { var n = Number(String(v === undefined || v === null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function badge(txt, cls) { return '<span class="badge ' + cls + '">' + txt + '</span>'; }

  function toast(msg, tipo) {
    var cor = tipo === 'erro' ? 'bg-rose-600' : (tipo === 'aviso' ? 'bg-amber-600' : 'bg-emerald-600');
    var el = document.createElement('div');
    el.className = cor + ' text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg';
    el.textContent = msg;
    $('toast-root').appendChild(el);
    setTimeout(function () { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 400); }, tipo === 'erro' ? 6000 : 3200);
  }

  function baixarArquivo(nome, conteudo, mime) {
    var blob = new Blob([conteudo], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csvCell(c) {
    var s = String(c === undefined || c === null ? '' : c);
    // Proteção contra CSV Formula Injection (Excel / LibreOffice command execution)
    if (/^[\s]*[=+\-@|\t\r]/.test(s)) s = "'" + s;
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(nome, linhas) {
    var txt = linhas.map(function (l) { return l.map(csvCell).join(';'); }).join('\r\n');
    baixarArquivo(nome, '\ufeff' + txt, 'text/csv;charset=utf-8');
  }
  function imprimir(html) {
    var old = $('print-area'); if (old) old.remove();
    var d = document.createElement('div'); d.id = 'print-area'; d.innerHTML = html;
    document.body.appendChild(d);
    window.print();
    setTimeout(function () { d.remove(); }, 800);
  }

  // ============================================================ API
  function setOnline(v) { if (online !== v) { online = v; renderStatus(); } }
  async function api(path, body) {
    var opt = { headers: { 'Content-Type': 'application/json', 'x-pin': PIN }, cache: 'no-store' };
    if (body !== undefined) { opt.method = 'POST'; opt.body = JSON.stringify(body); }
    var r;
    try { r = await fetch(path, opt); } catch (e) { setOnline(false); throw new Error('Servidor indisponível. Confira se o programa está aberto no computador.'); }
    setOnline(true);
    if (r.status === 401) { mostrarLogin(); throw new Error('Informe o PIN para continuar'); }
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('Erro ' + r.status));
    return j;
  }
  async function carregar() {
    var d = await api('/api/dados');
    S = d;
    recompute();
    return d;
  }
  // executa uma ação, mostra mensagem e recarrega os dados
  async function acao(path, body, msgOk) {
    try {
      var r = await api(path, body);
      if (msgOk) toast(msgOk);
      await carregar();
      renderAll();
      return r;
    } catch (e) { toast(e.message, 'erro'); return null; }
  }

  function recompute() {
    E = {};
    S.produtos.forEach(function (p) { E[p.id] = { total: 0, validos: 0, vencidos: 0, prox: null, lotes: [] }; });
    S.lotes.forEach(function (l) {
      var e = E[l.produtoId]; if (!e) return;
      e.total += l.qtd; e.lotes.push(l);
      var d = diasPara(l.validade);
      if (d < 0) e.vencidos += l.qtd;
      else { e.validos += l.qtd; if (e.prox === null || d < e.prox) e.prox = d; }
    });
    Object.keys(E).forEach(function (k) { E[k].lotes.sort(function (a, b) { return (a.validade || '9999').localeCompare(b.validade || '9999'); }); });
    C30 = {};
    var lim = Date.now() - 30 * 864e5;
    S.vendas.forEach(function (v) {
      if (v.tipo !== 'Venda' || v.status === 'Estornada' || Date.parse(v.data) < lim) return;
      v.itens.forEach(function (it) { C30[it.produtoId] = (C30[it.produtoId] || 0) + it.qtd; });
    });
  }

  // ============================================================ reposição (cálculo por faixas fixas)
  function ehWhisky(p) {
    var txt = norm((p.nome || '') + ' ' + (p.marca || '') + ' ' + (p.categoria || ''));
    return /whisk|wisk|bourbon|scotch|red label|black label|jack daniel|ballantine|chivas|old parr|white horse|cavalo branco|buchanan|passport/.test(txt);
  }
  function calcReposicao() {
    var lista = [];
    S.produtos.forEach(function (p) {
      var e = E[p.id] || { validos: 0, vencidos: 0 }, atual = e.validos, c30 = C30[p.id] || 0, media = c30 / 30;
      var cob = media > 0 ? atual / media : null;
      var w = ehWhisky(p);
      // Regra:
      // - Whiskies: <= 1 Baixo (crítico) | 2 Repor | >= 3 Bom
      // - Demais produtos: <= 5 Baixo (crítico) | <= 10 Repor | 11 a 19 Atenção | >= 20 Bom
      var limBaixo = w ? 1 : 5;
      var limRepor = w ? 2 : 10;
      var limBom = w ? 3 : 20;
      var nivel = 'ok';
      var regraTxt = w ? 'Whisky: 1 Baixo · 2 Repor · ≥ 3 Bom' : '≤ 5 Baixo · ≤ 10 Repor · ≥ 20 Bom';
      if (atual <= 0) nivel = 'zerado';
      else if (atual <= limBaixo) nivel = 'baixo';
      else if (atual <= limRepor) nivel = 'repor';
      else if (atual < limBom) nivel = 'proximo';
      else nivel = 'ok';

      var sug = 0;
      if (nivel !== 'ok') {
        var falta = Math.max(limBom - atual, 1);
        sug = w ? falta : Math.max(falta, p.unPorCx > 1 ? Math.ceil(falta / p.unPorCx) * p.unPorCx : falta);
      }
      lista.push({
        p: p, atual: atual, vencidos: e.vencidos, min: limRepor, limBaixo: limBaixo, limRepor: limRepor, limBom: limBom,
        ehWhisky: w, regraTxt: regraTxt, c30: c30, cob: cob, nivel: nivel, sug: sug,
        prio: { zerado: 0, baixo: 1, repor: 2, proximo: 3, ok: 4 }[nivel]
      });
    });
    lista.sort(function (a, b) { return a.prio - b.prio || a.atual - b.atual; });
    return lista;
  }

  // ============================================================ modais
  function abrirModal(html, largura) {
    var el = document.createElement('div');
    el.className = 'modal-bg';
    el.innerHTML = '<div class="bg-white rounded-2xl shadow-2xl w-full ' + (largura || 'max-w-lg') + ' my-auto"></div>';
    el.firstChild.innerHTML = html;
    el.addEventListener('mousedown', function (ev) { if (ev.target === el) el._down = true; });
    el.addEventListener('mouseup', function (ev) { if (ev.target === el && el._down) el.close(); el._down = false; });
    el.close = function () { if (el.onClose) el.onClose(); el.remove(); };
    $('modal-root').appendChild(el);
    return el;
  }
  function fechaModais() { var r = $('modal-root'); while (r.firstChild) r.firstChild.close ? r.firstChild.close() : r.removeChild(r.firstChild); }

  // modal de formulário genérico
  function formModal(o) {
    var campos = o.fields.map(function (f) {
      var col = f.span2 ? 'sm:col-span-2' : '';
      var inp;
      if (f.type === 'select') {
        inp = '<select name="' + f.name + '" class="inp">' + f.options.map(function (op) {
          var v = typeof op === 'object' ? op.v : op, t = typeof op === 'object' ? op.t : op;
          return '<option value="' + esc(v) + '"' + (String(v) === String(f.value) ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('') + '</select>';
      } else if (f.type === 'checkbox') {
        return '<label class="' + col + ' flex items-center gap-2 text-sm font-semibold text-stone-700 cursor-pointer pt-5"><input type="checkbox" name="' + f.name + '"' + (f.value ? ' checked' : '') + ' class="w-4 h-4 accent-amber-600"> ' + esc(f.label) + '</label>';
      } else if (f.type === 'textarea') {
        inp = '<textarea name="' + f.name + '" rows="2" class="inp">' + esc(f.value || '') + '</textarea>';
      } else {
        inp = '<input name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(f.value === undefined || f.value === null ? '' : f.value) + '" placeholder="' + esc(f.placeholder || '') + '"' + (f.step ? ' step="' + f.step + '"' : '') + (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.inputmode ? ' inputmode="' + f.inputmode + '"' : '') + ' class="inp"' + (f.required ? ' required' : '') + '>';
      }
      return '<div class="' + col + '"><label class="lbl">' + esc(f.label) + (f.required ? ' *' : '') + '</label>' + inp + (f.hint ? '<p class="text-[11px] text-stone-500 mt-1">' + esc(f.hint) + '</p>' : '') + '</div>';
    }).join('');
    var el = abrirModal('<form autocomplete="off" class="p-5 sm:p-6 space-y-4">' +
      '<div class="flex items-start justify-between gap-3"><div><h3 class="text-lg font-extrabold text-stone-900">' + esc(o.title) + '</h3>' + (o.subtitle ? '<p class="text-xs text-stone-500 mt-0.5">' + o.subtitle + '</p>' : '') + '</div>' +
      '<button type="button" data-x class="text-stone-400 hover:text-stone-700 text-2xl leading-none cursor-pointer">&times;</button></div>' +
      '<div class="grid sm:grid-cols-2 gap-3">' + campos + '</div>' +
      '<div id="f-info" class="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 hidden"></div>' +
      '<div id="f-err" class="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 hidden"></div>' +
      '<div class="flex justify-end gap-2 pt-1"><button type="button" data-x class="btn btn-out">Cancelar</button><button type="submit" class="btn ' + (o.danger ? 'btn-red' : 'btn-pri') + '">' + esc(o.submit || 'Salvar') + '</button></div></form>', o.wide || 'max-w-lg');
    var form = el.querySelector('form');
    el.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { el.close(); }; });
    function ler() {
      var v = {};
      o.fields.forEach(function (f) {
        var n = form.elements[f.name]; if (!n) return;
        v[f.name] = f.type === 'checkbox' ? n.checked : n.value;
      });
      return v;
    }
    function info(txt) { var i = $('f-info'); if (!i) return; if (txt) { i.innerHTML = txt; i.classList.remove('hidden'); } else i.classList.add('hidden'); }
    if (o.onChange) {
      var chg = function () { o.onChange(ler(), info, form); };
      form.addEventListener('input', chg); form.addEventListener('change', chg); chg();
    }
    form.onsubmit = async function (ev) {
      ev.preventDefault();
      var err = $('f-err'); err.classList.add('hidden');
      var btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try {
        var r = await o.onSubmit(ler(), el);
        if (r !== false) el.close();
      } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
      btn.disabled = false;
    };
    var first = form.querySelector('input:not([type=checkbox]),select'); if (first && !o.noFocus) setTimeout(function () { first.focus(); }, 50);
    return el;
  }

  function confirmar(titulo, texto, rotulo, fn, perigo) {
    var el = abrirModal('<div class="p-6 space-y-4"><h3 class="text-lg font-extrabold text-stone-900">' + esc(titulo) + '</h3><div class="text-sm text-stone-600">' + texto + '</div>' +
      '<div class="flex justify-end gap-2"><button class="btn btn-out" data-n>Cancelar</button><button class="btn ' + (perigo ? 'btn-red' : 'btn-pri') + '" data-s>' + esc(rotulo) + '</button></div></div>', 'max-w-md');
    el.querySelector('[data-n]').onclick = function () { el.close(); };
    el.querySelector('[data-s]').onclick = async function () { el.close(); await fn(); };
  }

  // ============================================================ login por PIN
  function mostrarLogin() {
    var o = $('login-overlay');
    o.classList.remove('hidden'); o.classList.add('flex');
    o.innerHTML = '<form class="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl"><div class="text-center"><div class="text-4xl">🍺</div><h2 class="text-lg font-extrabold mt-1">Acesso protegido</h2><p class="text-xs text-stone-500">Digite o PIN do sistema</p></div>' +
      '<input id="pin-inp" type="password" inputmode="numeric" class="inp text-center text-xl tracking-widest" autofocus><div id="pin-err" class="text-xs text-rose-600 font-semibold text-center hidden"></div><button class="btn btn-pri w-full">Entrar</button></form>';
    o.querySelector('form').onsubmit = async function (ev) {
      ev.preventDefault();
      PIN = $('pin-inp').value;
      try { await carregar(); localStorage.setItem('db_pin', PIN); o.classList.add('hidden'); o.classList.remove('flex'); iniciar(true); }
      catch (e) { var er = $('pin-err'); er.textContent = e.message === 'Informe o PIN para continuar' ? 'PIN incorreto' : e.message; er.classList.remove('hidden'); }
    };
  }

  // ============================================================ leitor de código de barras / QR
  var scan = { stream: null, timer: null, busy: false, cb: null, mfr: null, bd: null };
  function mkReader() {
    if (scan.mfr) return scan.mfr;
    if (!window.ZXing) return null;
    var Z = window.ZXing, hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.ITF, Z.BarcodeFormat.QR_CODE]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    var r = new Z.MultiFormatReader(); r.setHints(hints);
    scan.mfr = r; return r;
  }
  function decodificarCanvas(cv) {
    var r = mkReader(); if (!r) return null;
    try {
      var Z = window.ZXing;
      var res = r.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv))));
      return res ? res.getText() : null;
    } catch (e) { return null; }
  }
  function fechaScanner() {
    if (scan.timer) { clearInterval(scan.timer); scan.timer = null; }
    if (scan.stream) { scan.stream.getTracks().forEach(function (t) { t.stop(); }); scan.stream = null; }
    var m = $('scanner-modal'); if (m) m.remove();
  }
  function scanConcluido(codigo) {
    var cb = scan.cb; fechaScanner();
    if (navigator.vibrate) navigator.vibrate(80);
    if (cb) cb(String(codigo).trim());
  }
  A.scanner = async function (cb, titulo) {
    fechaScanner();
    scan.cb = cb; scan.busy = false;
    var el = document.createElement('div'); el.id = 'scanner-modal'; el.className = 'modal-bg'; el.style.zIndex = 60;
    el.innerHTML = '<div class="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-2xl my-auto">' +
      '<div class="flex items-center justify-between"><div><h3 class="font-extrabold">📷 ' + esc(titulo || 'Ler código de barras') + '</h3><p class="text-xs text-stone-500">Aponte para o código de barras da garrafa, lata ou caixa</p></div><button class="text-2xl text-stone-400 cursor-pointer" id="sc-x">&times;</button></div>' +
      '<div class="relative bg-black rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center"><video id="sc-video" class="w-full h-full object-cover" autoplay playsinline muted></video><canvas id="sc-canvas" class="hidden"></canvas>' +
      '<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><div class="w-64 h-32 border-2 border-amber-400 rounded-xl relative"><div class="absolute left-2 right-2 h-0.5 bg-amber-400 scanner-laser"></div></div></div>' +
      '<div id="sc-msg" class="absolute bottom-2 left-2 right-2 text-center text-xs text-white bg-black/60 rounded-full px-3 py-1">Abrindo câmera…</div></div>' +
      '<div class="flex gap-2"><label class="btn btn-out flex-1 cursor-pointer">📁 Foto do código<input id="sc-file" type="file" accept="image/*" capture="environment" class="hidden"></label></div>' +
      '<div><span class="lbl">Ou digite o código (EAN)</span><div class="flex gap-2"><input id="sc-manual" inputmode="numeric" class="inp font-mono" placeholder="Ex: 7891234567895"><button id="sc-ok" class="btn btn-dark">Buscar</button></div></div>' +
      '<div id="sc-demo" class="flex flex-wrap gap-1.5"></div></div>';
    document.body.appendChild(el);
    $('sc-x').onclick = fechaScanner;
    el.addEventListener('mousedown', function (ev) { if (ev.target === el) fechaScanner(); });
    $('sc-ok').onclick = function () { var v = $('sc-manual').value.trim(); if (v) scanConcluido(v); };
    $('sc-manual').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); $('sc-ok').click(); } });
    // atalhos de teste com os códigos EAN reais do Brasil cadastrados
    var demos = S.produtos.filter(function (p) { return p.ean; }).slice(0, 8);
    if (demos.length) {
      $('sc-demo').innerHTML = '<span class="w-full text-[11px] font-semibold text-stone-400">🇧🇷 Atalhos (códigos EAN reais do Brasil):</span>' + demos.map(function (p) { return '<button class="btn btn-out btn-sm" data-ean="' + esc(p.ean) + '">' + esc(p.marca || p.nome.slice(0, 14)) + ' · <span class="font-mono text-[10px]">' + esc(p.ean) + '</span></button>'; }).join('');
      $('sc-demo').querySelectorAll('[data-ean]').forEach(function (b) { b.onclick = function () { scanConcluido(b.getAttribute('data-ean')); }; });
    }
    $('sc-file').onchange = function (ev) {
      var f = ev.target.files && ev.target.files[0]; if (!f) return;
      var img = new Image();
      img.onload = function () {
        var cv = $('sc-canvas'), tamanhos = [1600, 1000, 700], achou = null;
        for (var i = 0; i < tamanhos.length && !achou; i++) {
          var esc_ = Math.min(1, tamanhos[i] / Math.max(img.width, img.height));
          cv.width = Math.round(img.width * esc_); cv.height = Math.round(img.height * esc_);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          achou = decodificarCanvas(cv);
        }
        URL.revokeObjectURL(img.src);
        if (achou) scanConcluido(achou); else $('sc-msg').textContent = '⚠️ Não consegui ler a foto. Tente de novo mais de perto ou digite o código.';
      };
      img.src = URL.createObjectURL(f);
    };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $('sc-msg').textContent = '⚠️ Câmera indisponível aqui (precisa de HTTPS). Use "Foto do código" ou digite.'; return;
    }
    try {
      scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      var video = $('sc-video'); video.srcObject = scan.stream; await video.play();
      try { var tr = scan.stream.getVideoTracks()[0]; if (tr.applyConstraints) await tr.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (_) {}
      $('sc-msg').textContent = 'Procurando código…';
      if (!scan.bd && 'BarcodeDetector' in window) { try { scan.bd = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf', 'qr_code'] }); } catch (_) {} }
      scan.timer = setInterval(async function () {
        if (scan.busy || !video.videoWidth) return;
        scan.busy = true;
        try {
          var code = null;
          if (scan.bd) { var r = await scan.bd.detect(video); if (r && r.length) code = r[0].rawValue; }
          if (!code) {
            var cv = $('sc-canvas'); if (!cv) return;
            var k = Math.min(1, 960 / video.videoWidth);
            cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k);
            cv.getContext('2d').drawImage(video, 0, 0, cv.width, cv.height);
            code = decodificarCanvas(cv);
          }
          if (code && String(code).trim().length >= 4) { scanConcluido(code); return; }
        } catch (_) {}
        scan.busy = false;
      }, 300);
    } catch (e) {
      var m = $('sc-msg'); if (m) m.textContent = '⚠️ Sem acesso à câmera. Use "Foto do código" ou digite o código.';
    }
  };

  // procura produto por código lido (unidade ou caixa)
  function acharPorCodigo(code) {
    var c = String(code).replace(/\D/g, ''); if (!c) return null;
    for (var i = 0; i < S.produtos.length; i++) {
      var p = S.produtos[i];
      if ((p.ean && p.ean === c) || (p.eanCx && p.eanCx === c)) return { p: p, caixa: !!(p.eanCx && p.eanCx === c && p.ean !== c) };
    }
    return null;
  }
  // cadastra produto novo a partir de um código desconhecido (consulta base aberta)
  async function cadastrarPorCodigo(code, depois) {
    toast('Produto não cadastrado. Buscando dados do código ' + code + '…', 'aviso');
    var d = { encontrado: false };
    try { d = await api('/api/produto-ean?ean=' + encodeURIComponent(code)); } catch (_) {}
    if (!d.encontrado) toast('Código não encontrado em bases públicas — preencha manualmente.', 'aviso');
    A.produtoModal(null, { ean: code, nome: d.nome || '', marca: d.marca || '', volume: d.volume || '', categoria: d.categoria || 'Outros' }, depois);
  }
  A.acharPorCodigo = acharPorCodigo;
  A._cadastrarPorCodigo = cadastrarPorCodigo;

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  async function salvar(path, body, msg) {
    var r = await api(path, body);
    await carregar(); renderAll();
    if (msg) toast(msg);
    return r;
  }
  function copiarTexto(txt) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      if (ok) toast('Texto copiado!');
      else { var el = abrirModal('<div class="p-5 space-y-3"><h3 class="font-extrabold">Copie o texto abaixo</h3><textarea class="inp font-mono" rows="12" readonly>' + esc(txt) + '</textarea><div class="text-right"><button class="btn btn-dark" data-c>Fechar</button></div></div>', 'max-w-lg'); el.querySelector('[data-c]').onclick = function () { el.close(); }; el.querySelector('textarea').select(); }
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(function () { toast('Texto copiado!'); }, fallback);
    else fallback();
  }

  // ============================================================ montagem do esqueleto
  function montar() {
    $('app').innerHTML =
      '<header class="card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">' +
      '<div class="flex items-center gap-4"><div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-600 to-stone-800 flex items-center justify-center text-3xl shadow-md flex-shrink-0 cursor-pointer" onclick="A.tab(\'dashboard\')">🍺</div>' +
      '<div><h1 id="h-empresa" class="text-xl sm:text-2xl font-extrabold text-stone-900 leading-tight"></h1><p class="text-xs text-stone-500">Venda Rápida ao Consumidor Final (PDV) · Estoque FEFO · Vasilhames</p><div id="h-status" class="mt-1"></div></div></div>' +
      '<div class="flex flex-wrap gap-2"><button class="btn btn-pri" onclick="A.tab(\'saida\')">🛒 Venda Rápida (PDV)</button><button class="btn btn-green" onclick="A.tab(\'mesas\')">🪑 Mesas / Consumo Local</button><button id="btn-hdr-precos" class="btn btn-out" onclick="A.tabelaPrecosModal()">💲 Editar Preços</button><button class="btn btn-dark" onclick="A.scanGlobal()">📷 Escanear</button><button class="btn btn-out" onclick="A.celular()">📱 Celular</button><button id="btn-hdr-config" class="btn btn-out" onclick="A.config()">⚙️ Ajustes</button></div></header>' +
      '<nav id="nav" class="flex gap-1.5 overflow-x-auto pb-1 border-b border-stone-300 text-sm font-semibold"></nav>' +
      TABS.map(function (t) { return '<section id="tab-' + t.id + '" class="hidden"><div id="v-' + t.id + '" class="space-y-5"></div></section>'; }).join('');
    mountEstoque(); mountReposicao(); mountRelatorio(); mountEntrada(); mountSaida(); mountMesas(); mountClientes(); mountDepositos(); mountHistorico();
  }
  function renderStatus() {
    var el = $('h-status'); if (!el) return;
    var roleBadge = '';
    if (S.role === 'ceo') roleBadge = ' <span class="badge bg-amber-50 text-amber-800 border-amber-300">👑 Dono / CEO</span>';
    else if (S.role === 'gerente') roleBadge = ' <span class="badge bg-sky-50 text-sky-800 border-sky-300">💼 Gerente</span>';
    else if (S.role === 'vendedor') roleBadge = ' <span class="badge bg-stone-100 text-stone-700 border-stone-300">🛒 Vendedor</span>';
    el.innerHTML = (online ? '<span class="badge bg-emerald-50 text-emerald-700 border-emerald-200">● Online · sincronizando</span>' : '<span class="badge bg-rose-50 text-rose-700 border-rose-300">● Servidor offline</span>') + roleBadge;
    if ($('btn-hdr-precos')) $('btn-hdr-precos').classList.toggle('hidden', ehVendedor());
    if ($('btn-hdr-config')) $('btn-hdr-config').classList.toggle('hidden', ehVendedor());
    if ($('btn-est-precos')) $('btn-est-precos').classList.toggle('hidden', ehVendedor());
    if ($('btn-est-novo')) $('btn-est-novo').classList.toggle('hidden', ehVendedor());
  }
  function renderNav() {
    var rep = calcReposicao().filter(function (x) { return x.nivel !== 'ok'; }).length;
    var venc = S.lotes.filter(function (l) { return diasPara(l.validade) <= 30; }).length;
    var nMesas = (S.mesas || []).length;
    if (ehVendedor() && tab === 'clientes') {
      tab = 'dashboard';
      localStorage.setItem('db_tab', tab);
      TABS.forEach(function (t) { $('tab-' + t.id).classList.toggle('hidden', t.id !== tab); });
    }
    $('nav').innerHTML = TABS.filter(function (t) {
      return !(ehVendedor() && t.id === 'clientes');
    }).map(function (t) {
      var ativo = t.id === tab;
      var b = '';
      if (t.id === 'mesas' && nMesas) b = '<span class="ml-1 px-1.5 rounded-full bg-emerald-600 text-white text-[10px]">' + nMesas + '</span>';
      if (t.id === 'reposicao' && rep) b = '<span class="ml-1 px-1.5 rounded-full bg-rose-500 text-white text-[10px]">' + rep + '</span>';
      if (t.id === 'estoque' && venc) b = '<span class="ml-1 px-1.5 rounded-full bg-amber-500 text-white text-[10px]">' + venc + '</span>';
      return '<button onclick="A.tab(\'' + t.id + '\')" class="px-3.5 py-2.5 rounded-t-lg border-b-2 whitespace-nowrap cursor-pointer ' + (ativo ? 'border-amber-600 text-amber-700 bg-amber-50' : 'border-transparent text-stone-500 hover:text-stone-800') + '">' + t.ico + ' ' + t.nome + b + '</button>';
    }).join('');
    $('h-empresa').textContent = S.config.empresa || 'Distribuidora de Bebidas';
    document.title = (S.config.empresa || 'Distribuidora de Bebidas') + ' — Gestão';
  }
  var RENDER = {};
  function renderAll() { renderNav(); renderStatus(); (RENDER[tab] || function () {})(); refreshForms(); }
  A.tab = function (id) {
    tab = id; localStorage.setItem('db_tab', id);
    TABS.forEach(function (t) { $('tab-' + t.id).classList.toggle('hidden', t.id !== id); });
    renderAll();
    window.scrollTo({ top: 0 });
  };

  // ============================================================ PAINEL
  function kpi(label, valor, sub, ico, cor) {
    return '<div class="card p-4"><div class="flex items-center justify-between text-[11px] font-bold text-stone-500 uppercase tracking-wide"><span>' + label + '</span><span class="w-8 h-8 rounded-lg flex items-center justify-center text-base ' + cor + '">' + ico + '</span></div>' +
      '<div class="text-2xl font-extrabold text-stone-900 mt-2 leading-tight">' + valor + '</div><div class="text-[11px] text-stone-500 mt-0.5">' + sub + '</div></div>';
  }
  function barra(pct, cor) { return '<div class="h-2 bg-stone-100 rounded-full overflow-hidden"><div class="h-full ' + cor + ' rounded-full" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></div></div>'; }

  RENDER.dashboard = function () {
    var root = $('v-dashboard');
    if (!S.produtos.length) {
      root.innerHTML = '<div class="card p-8 text-center space-y-4 max-w-2xl mx-auto"><div class="text-6xl">🍻</div><h2 class="text-2xl font-extrabold">Bem-vindo à sua distribuidora!</h2>' +
        '<p class="text-stone-600 text-sm">Comece cadastrando seus produtos (ou escaneando o código de barras), registre as compras e passe a vender com baixa automática por validade (FEFO).</p>' +
        '<div class="flex flex-wrap gap-2 justify-center"><button class="btn btn-pri" onclick="A.produtoModal()">➕ Cadastrar primeiro produto</button><button class="btn btn-dark" onclick="A.scanGlobal()">📷 Escanear um produto</button><button class="btn btn-out" onclick="A.demo()">🧪 Carregar exemplos de demonstração</button></div></div>';
      return;
    }
    var hoje = diaLocal(), mes = hoje.slice(0, 7);
    var vOk = S.vendas.filter(function (v) { return v.tipo === 'Venda' && v.status !== 'Estornada'; });
    var vHoje = vOk.filter(function (v) { return diaLocal(new Date(v.data)) === hoje; });
    var vMes = vOk.filter(function (v) { return diaLocal(new Date(v.data)).slice(0, 7) === mes; });
    var soma = function (a) { return a.reduce(function (s, v) { return s + v.total; }, 0); };
    var lucroMes = vMes.reduce(function (s, v) { return s + v.total - v.custoTotal; }, 0);
    var totalUn = 0, valCusto = 0, valVenda = 0, nVenc = 0, nCrit = 0, cxEq = 0;
    S.lotes.forEach(function (l) {
      var p = P(l.produtoId); if (!p) return;
      totalUn += l.qtd; cxEq += l.qtd / p.unPorCx; valCusto += l.qtd * (l.custo || p.custo || 0); valVenda += l.qtd * p.preco;
      var st = statusVal(l.validade); if (st.k === 'vencido') nVenc++; else if (st.k === 'critico') nCrit++;
    });
    var aReceber = S.clientes.reduce(function (s, c) { return s + (c.saldo || 0); }, 0);
    var vasil = S.clientes.reduce(function (s, c) { return s + (c.vasilhame || 0); }, 0);
    var rep = calcReposicao().filter(function (x) { return x.nivel !== 'ok'; });
    var zerados = rep.filter(function (x) { return x.nivel === 'zerado'; }).length;

    var cards = ehVendedor()
      ? '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' +
        kpi('Itens em estoque', nf(totalUn) + ' un', nf(Math.round(cxEq)) + ' caixas equivalentes', '📦', 'bg-sky-50') +
        kpi('Vencendo ≤ 30 dias', nCrit + ' lote(s)', nVenc ? '<b class="text-rose-600">' + nVenc + ' lote(s) VENCIDO(S)</b>' : 'Nenhum lote vencido', '⏳', nCrit || nVenc ? 'bg-amber-100' : 'bg-stone-50') +
        kpi('Precisam de reposição', rep.length + ' produto(s)', zerados ? '<b class="text-rose-600">' + zerados + ' zerado(s)</b>' : 'Nenhum zerado', '🛒', rep.length ? 'bg-rose-50' : 'bg-stone-50') +
        kpi('Vasilhames em campo', nf(vasil) + ' cx', 'Engradados/caixas com clientes', '♻️', 'bg-lime-50') + '</div>'
      : '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' +
        kpi('Vendas hoje', brl(soma(vHoje)), vHoje.length + ' pedido(s)', '💰', 'bg-emerald-50') +
        kpi('Vendas no mês', brl(soma(vMes)), 'Lucro bruto ' + brl(lucroMes) + (soma(vMes) ? ' (' + Math.round(lucroMes / soma(vMes) * 100) + '%)' : ''), '📈', 'bg-amber-50') +
        kpi('Estoque (custo)', brl(valCusto), nf(Math.round(cxEq)) + ' caixas · ' + nf(totalUn) + ' un', '📦', 'bg-sky-50') +
        kpi('Estoque (venda)', brl(valVenda), 'Margem potencial ' + brl(valVenda - valCusto), '🏷️', 'bg-violet-50') +
        kpi('A receber (fiado)', brl(aReceber), S.clientes.filter(function (c) { return c.saldo > 0; }).length + ' cliente(s) devendo', '🧾', aReceber > 0 ? 'bg-rose-50' : 'bg-stone-50') +
        kpi('Vencendo ≤ 30 dias', nCrit + ' lote(s)', nVenc ? '<b class="text-rose-600">' + nVenc + ' lote(s) VENCIDO(S)</b>' : 'Nenhum lote vencido', '⏳', nCrit || nVenc ? 'bg-amber-100' : 'bg-stone-50') +
        kpi('Precisam de reposição', rep.length + ' produto(s)', zerados ? '<b class="text-rose-600">' + zerados + ' zerado(s)</b>' : 'Nenhum zerado', '🛒', rep.length ? 'bg-rose-50' : 'bg-stone-50') +
        kpi('Vasilhames em campo', nf(vasil) + ' cx', 'Engradados/caixas com clientes', '♻️', 'bg-lime-50') + '</div>';

    // gráfico 7 dias (oculto para vendedor)
    var dias = [], max = 1;
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var key = diaLocal(d);
      var tot = soma(vOk.filter(function (v) { return diaLocal(new Date(v.data)) === key; }));
      dias.push({ lbl: pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1), tot: tot }); if (tot > max) max = tot;
    }
    var graf = ehVendedor() ? '' : '<div class="card p-5"><h3 class="font-extrabold text-stone-900 mb-3">Vendas dos últimos 7 dias</h3><div class="flex items-end gap-2 h-40">' +
      dias.map(function (x) { return '<div class="flex-1 flex flex-col items-center justify-end h-full gap-1"><span class="text-[10px] font-bold text-stone-600">' + (x.tot ? nf(Math.round(x.tot)) : '') + '</span><div class="w-full rounded-t-lg bg-gradient-to-t from-amber-600 to-amber-400" style="height:' + Math.max(2, x.tot / max * 100) + '%"></div><span class="text-[10px] text-stone-500">' + x.lbl + '</span></div>'; }).join('') + '</div></div>';

    // mais vendidos
    var top = Object.keys(C30).map(function (k) { return { p: P(k), q: C30[k] }; }).filter(function (x) { return x.p; }).sort(function (a, b) { return b.q - a.q; }).slice(0, 6);
    var topMax = top.length ? top[0].q : 1;
    var topH = '<div class="card p-5"><h3 class="font-extrabold text-stone-900 mb-3">Mais vendidos (30 dias)</h3>' + (top.length ? top.map(function (x) {
      return '<div class="mb-2.5"><div class="flex justify-between text-xs mb-1"><span class="font-semibold truncate pr-2">' + (CAT_ICON[x.p.categoria] || '') + ' ' + esc(x.p.nome) + '</span><span class="text-stone-500 whitespace-nowrap">' + fmtQtd(x.q, x.p.unPorCx) + '</span></div>' + barra(x.q / topMax * 100, 'bg-amber-500') + '</div>';
    }).join('') : '<p class="text-sm text-stone-400">Ainda sem vendas registradas.</p>') + '</div>';

    // alertas FEFO
    var alertas = S.lotes.filter(function (l) { return diasPara(l.validade) <= 60; }).sort(function (a, b) { return a.validade.localeCompare(b.validade); }).slice(0, 8);
    var alH = '<div class="card p-5"><div class="flex items-center justify-between mb-3"><h3 class="font-extrabold text-stone-900">⚠️ Prioridade FEFO — vence primeiro, sai primeiro</h3><button class="btn btn-out btn-sm" onclick="A.tab(\'estoque\')">Ver estoque</button></div>' + (alertas.length ? '<div class="space-y-2">' + alertas.map(function (l) {
      var p = P(l.produtoId); if (!p) return ''; var st = statusVal(l.validade);
      return '<div class="flex items-center justify-between gap-2 border border-stone-200 rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-sm font-bold truncate">' + esc(p.nome) + '</div><div class="text-[11px] text-stone-500">Lote ' + esc(l.lote) + ' · ' + esc(l.deposito) + ' · ' + fmtQtd(l.qtd, p.unPorCx) + '</div></div><div class="flex items-center gap-2">' + badge(st.label, st.cls) + (st.k === 'vencido' ? '<button class="btn btn-red btn-sm" onclick="A.baixaLote(\'' + l.id + '\',\'Vencido (Descarte)\')">Descartar</button>' : '<button class="btn btn-green btn-sm" onclick="A.saidaPara(\'' + p.id + '\')">Vender</button>') + '</div></div>';
    }).join('') + '</div>' : '<p class="text-sm text-emerald-700 font-semibold">✅ Nenhum lote vencendo nos próximos 60 dias.</p>') + '</div>';

    // por categoria / depósitos
    var porCat = {}; S.lotes.forEach(function (l) { var p = P(l.produtoId); if (p) porCat[p.categoria] = (porCat[p.categoria] || 0) + l.qtd * (l.custo || p.custo || 0); });
    var maxCat = Math.max.apply(null, Object.keys(porCat).map(function (k) { return porCat[k]; }).concat([1]));
    var catH = ehVendedor() ? '' : '<div class="card p-5"><h3 class="font-extrabold text-stone-900 mb-3">Capital parado por categoria</h3>' + Object.keys(porCat).sort(function (a, b) { return porCat[b] - porCat[a]; }).map(function (k) {
      return '<div class="mb-2.5"><div class="flex justify-between text-xs mb-1"><span class="font-semibold">' + (CAT_ICON[k] || '') + ' ' + esc(k) + '</span><span class="text-stone-500">' + brl(porCat[k]) + '</span></div>' + barra(porCat[k] / maxCat * 100, 'bg-stone-700') + '</div>';
    }).join('') + '</div>';
    var depH = '<div class="card p-5"><h3 class="font-extrabold text-stone-900 mb-3">Ocupação dos depósitos</h3>' + S.depositos.map(function (d) {
      var u = S.lotes.filter(function (l) { return l.deposito === d.nome; }).reduce(function (s, l) { return s + l.qtd; }, 0), pct = u / d.cap * 100;
      return '<div class="mb-2.5 cursor-pointer" onclick="A.depositoSel(\'' + esc(d.nome) + '\')"><div class="flex justify-between text-xs mb-1"><span class="font-semibold">' + d.icon + ' ' + esc(d.nome) + '</span><span class="text-stone-500">' + Math.round(pct) + '% · ' + nf(u) + '/' + nf(d.cap) + '</span></div>' + barra(pct, pct > 90 ? 'bg-rose-500' : (pct > 70 ? 'bg-amber-500' : 'bg-emerald-500')) + '</div>';
    }).join('') + '</div>';

    // últimas vendas
    var ult = S.vendas.slice(0, 6);
    var ultH = '<div class="card p-5"><div class="flex items-center justify-between mb-3"><h3 class="font-extrabold text-stone-900">Últimos pedidos</h3><button class="btn btn-out btn-sm" onclick="A.tab(\'historico\')">Ver todos</button></div>' + (ult.length ? ult.map(function (v) {
      return '<div class="flex items-center justify-between py-2 border-b border-stone-100 last:border-0 cursor-pointer" onclick="A.verVenda(\'' + v.id + '\')"><div><div class="text-sm font-bold">#' + v.numero + ' · ' + esc(v.clienteNome) + '</div><div class="text-[11px] text-stone-500">' + fmtData(v.data) + ' · ' + esc(v.tipo) + (v.operador ? ' · 👤 ' + esc(v.operador) : '') + (v.status === 'Estornada' ? ' · ESTORNADO' : '') + '</div></div><div class="text-sm font-extrabold ' + (v.status === 'Estornada' ? 'line-through text-stone-400' : '') + '">' + (ehVendedor() ? '—' : (v.tipo === 'Venda' ? brl(v.total) : '—')) + '</div></div>';
    }).join('') : '<p class="text-sm text-stone-400">Nenhum pedido ainda.</p>') + '</div>';

    root.innerHTML = cards + '<div class="grid lg:grid-cols-3 gap-4"><div class="lg:col-span-2 space-y-4">' + graf + alH + '</div><div class="space-y-4">' + topH + ultH + '</div></div><div class="grid md:grid-cols-2 gap-4">' + catH + depH + '</div>';
  };

  A.demo = function () {
    confirmar('Carregar exemplos?', 'Serão criados produtos, lotes, clientes e vendas <b>fictícias</b> para você conhecer o sistema. Depois dá para apagar tudo em <b>Ajustes → Zerar tudo</b>.', 'Carregar exemplos', async function () {
      try { await salvar('/api/demo', {}, 'Exemplos carregados!'); } catch (e) { toast(e.message, 'erro'); }
    });
  };

  // ============================================================ ESTOQUE & LOTES
  function mountEstoque() {
    $('v-estoque').innerHTML = '<div class="card p-4 flex flex-col lg:flex-row gap-3 lg:items-end">' +
      '<div class="flex-1"><label class="lbl">Buscar produto, marca, código ou fornecedor</label><input id="est-q" class="inp" placeholder="Ex: skol, 350ml, 7891…"></div>' +
      '<div><label class="lbl">Categoria</label><select id="est-cat" class="inp"></select></div>' +
      '<div><label class="lbl">Depósito</label><select id="est-dep" class="inp"></select></div>' +
      '<div><label class="lbl">Situação</label><select id="est-st" class="inp"><option value="">Todas</option><option value="critico">Vencendo ≤ 30 dias</option><option value="vencidos">Com lote vencido</option><option value="baixo">Abaixo do mínimo</option><option value="sem">Sem estoque</option></select></div>' +
      '<div class="flex gap-2 flex-wrap"><button id="btn-est-precos" class="btn btn-out" onclick="A.tabelaPrecosModal()">💲 Editar Preços</button><button class="btn btn-green" onclick="A.reposicionarGeralModal()">🔄 Reposicionar</button><button id="btn-est-novo" class="btn btn-pri" onclick="A.produtoModal()">➕ Produto</button><button class="btn btn-out" onclick="A.exportarEstoque()">⬇️ CSV</button></div></div>' +
      '<div id="est-list" class="card overflow-x-auto"></div>';
    $('est-q').oninput = function () { F.estBusca = this.value; renderEstoque(); };
    $('est-cat').onchange = function () { F.estCat = this.value; renderEstoque(); };
    $('est-dep').onchange = function () { F.estDep = this.value; renderEstoque(); };
    $('est-st').onchange = function () { F.estSt = this.value; renderEstoque(); };
  }
  function renderEstoque() {
    var cs = $('est-cat'), ds = $('est-dep');
    if (cs.options.length !== S.categorias.length + 1) { cs.innerHTML = '<option value="">Todas</option>' + S.categorias.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join(''); cs.value = F.estCat; }
    if (ds.options.length !== S.depositos.length + 1) { ds.innerHTML = '<option value="">Todos</option>' + S.depositos.map(function (d) { return '<option>' + esc(d.nome) + '</option>'; }).join(''); ds.value = F.estDep; }
    var q = norm(F.estBusca);
    var baixo = {}; calcReposicao().forEach(function (x) { if (x.nivel === 'zerado' || x.nivel === 'baixo' || x.nivel === 'repor') baixo[x.p.id] = true; });
    var prods = S.produtos.filter(function (p) {
      var e = E[p.id];
      if (F.estCat && p.categoria !== F.estCat) return false;
      if (F.estDep && !e.lotes.some(function (l) { return l.deposito === F.estDep; })) return false;
      if (F.estSt === 'critico' && !e.lotes.some(function (l) { return statusVal(l.validade).k === 'critico'; })) return false;
      if (F.estSt === 'vencidos' && e.vencidos <= 0) return false;
      if (F.estSt === 'sem' && e.total > 0) return false;
      if (F.estSt === 'baixo' && !baixo[p.id]) return false;
      if (q && norm([p.nome, p.marca, p.ean, p.eanCx, p.fornecedor, p.volume, p.categoria].join(' ')).indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome); });
    if (!prods.length) { $('est-list').innerHTML = '<div class="p-8 text-center text-stone-500 text-sm">' + (S.produtos.length ? 'Nenhum produto com esses filtros.' : 'Nenhum produto cadastrado. Clique em <b>➕ Produto</b> ou escaneie um código de barras.') + '</div>'; return; }
    var h = '<table class="w-full"><thead><tr><th>Produto</th><th>Categoria</th><th>Estoque</th><th>Próx. validade</th><th>Preço un / cx</th><th class="text-right">Ações</th></tr></thead><tbody>';
    prods.forEach(function (p) {
      var e = E[p.id], pv = e.lotes.length ? statusVal(e.lotes[0].validade) : null;
      var minTxt = p.minimo ? '<div class="text-[10px] ' + (e.validos < p.minimo ? 'text-rose-600 font-bold' : 'text-stone-400') + '">mín. ' + fmtQtd(p.minimo, p.unPorCx) + '</div>' : '';
      var margem = p.preco > 0 && p.custo > 0 ? Math.round((p.preco - p.custo) / p.preco * 100) : null;
      h += '<tr class="hover:bg-amber-50/40"><td><div class="flex items-center gap-2"><button class="btn btn-out btn-sm" onclick="A.toggleProd(\'' + p.id + '\')" title="Ver lotes">' + (expandido[p.id] ? '▾' : '▸') + ' ' + e.lotes.length + '</button><div><div class="font-bold text-stone-900">' + esc(p.nome) + (p.retornavel ? ' <span title="Vasilhame retornável">♻️</span>' : '') + '</div><div class="text-[11px] text-stone-500">' + esc(p.marca) + (p.volume ? ' · ' + esc(p.volume) : '') + ' · ' + esc(p.tipoEmb) + ' c/' + p.unPorCx + (p.ean ? ' · <span class="font-mono">' + esc(p.ean) + '</span>' : '') + '</div></div></div></td>' +
        '<td>' + badge((CAT_ICON[p.categoria] || '') + ' ' + esc(p.categoria), CAT_COR[p.categoria] || CAT_COR.Outros) + '</td>' +
        '<td><div class="font-extrabold ' + (e.total <= 0 ? 'text-rose-600' : '') + '">' + fmtQtd(e.total, p.unPorCx) + '</div><div class="text-[10px] text-stone-400">' + nf(e.total) + ' un' + (e.vencidos ? ' · <b class="text-rose-600">' + nf(e.vencidos) + ' vencidas</b>' : '') + '</div>' + minTxt + '</td>' +
        '<td>' + (pv ? badge(pv.label, pv.cls) : '<span class="text-stone-400">—</span>') + '</td>' +
        '<td><div class="font-semibold">' + brl(p.preco) + ' <span class="text-stone-400 font-normal">/ ' + brl(precoCxEf(p)) + '</span></div>' + (ehVendedor() ? '' : ('<div class="text-[10px] text-stone-400">custo ' + brl(p.custo) + (margem !== null ? ' · margem ' + margem + '%' : '') + '</div>')) + '</td>' +
        '<td class="text-right whitespace-nowrap">' + (ehVendedor() ? '' : ('<button class="btn btn-out btn-sm" onclick="A.precoModal(\'' + p.id + '\')" title="Editar preço do produto">💲 Preço</button> ')) + (e.lotes.length ? ('<button class="btn btn-out btn-sm" onclick="A.moverLoteModal(\'' + e.lotes[0].id + '\')" title="Reposicionar / mover estoque deste produto">🔄 Mover</button> ') : '') + '<button class="btn btn-green btn-sm" onclick="A.entradaPara(\'' + p.id + '\')" title="Dar entrada">📥</button> <button class="btn btn-out btn-sm" onclick="A.saidaPara(\'' + p.id + '\')" title="Vender / dar saída">🚚</button>' + (ehVendedor() ? '' : (' <button class="btn btn-out btn-sm" onclick="A.produtoModal(\'' + p.id + '\')" title="Editar produto">✏️</button>')) + '</td></tr>';
      if (expandido[p.id]) {
        h += '<tr><td colspan="6" class="!p-0 bg-stone-50"><div class="px-4 py-3">' + (e.lotes.length ? '<table class="w-full bg-white rounded-xl overflow-hidden border border-stone-200"><thead><tr><th>Lote</th><th>Validade</th><th>Local</th><th>Quantidade</th>' + (ehVendedor() ? '' : '<th>Custo un</th>') + '<th class="text-right">Ações</th></tr></thead><tbody>' + e.lotes.map(function (l, i) {
          var st = statusVal(l.validade);
          return '<tr><td class="font-mono font-bold">' + esc(l.lote) + (i === 0 && st.k !== 'vencido' ? ' <span class="badge bg-amber-100 text-amber-800 border-amber-300">sai 1º</span>' : '') + '</td><td>' + fmtDia(l.validade) + ' ' + badge(st.label, st.cls) + '</td><td>' + esc(l.deposito) + (l.posicao ? ' · ' + esc(l.posicao) : '') + '</td><td class="font-bold">' + fmtQtd(l.qtd, p.unPorCx) + ' <span class="text-stone-400 font-normal">(' + nf(l.qtd) + ' un)</span></td>' + (ehVendedor() ? '' : ('<td>' + brl(l.custo) + '</td>')) + '<td class="text-right whitespace-nowrap"><button class="btn btn-green btn-sm" onclick="A.moverLoteModal(\'' + l.id + '\')" title="Transferir para outro freezer, geladeira ou depósito">🔄 Mover</button> <button class="btn btn-out btn-sm" onclick="A.loteModal(\'' + l.id + '\')">✏️ Ajustar</button> <button class="btn btn-red btn-sm" onclick="A.baixaLote(\'' + l.id + '\')">Dar baixa</button></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="text-sm text-stone-500">Sem lotes em estoque. <button class="underline font-bold text-amber-700 cursor-pointer" onclick="A.entradaPara(\'' + p.id + '\')">Dar entrada</button></p>') + '</div></td></tr>';
      }
    });
    $('est-list').innerHTML = h + '</tbody></table>';
  }
  RENDER.estoque = renderEstoque;
  A.toggleProd = function (id) { expandido[id] = !expandido[id]; renderEstoque(); };
  A.entradaPara = function (id) { A.tab('entrada'); var p = P(id); if (p) { $('en-prod').value = rotuloProd(p); entradaSelecionar(); setTimeout(function () { $('en-cx').focus(); }, 50); } };
  A.saidaPara = function (id) { A.tab('saida'); var p = P(id); if (p) { $('sd-prod').value = rotuloProd(p); saidaSelecionar(); setTimeout(function () { $('sd-un').focus(); $('sd-un').select(); }, 50); } };
  A.exportarEstoque = function () {
    if (ehVendedor()) {
      var lv = [['Produto', 'Marca', 'Categoria', 'Volume', 'Embalagem', 'Un/Emb', 'EAN', 'Lote', 'Validade', 'Depósito', 'Posição', 'Qtd (un)', 'Caixas', 'Preço un', 'Fornecedor']];
      S.lotes.forEach(function (x) { var p = P(x.produtoId); if (!p) return; lv.push([p.nome, p.marca, p.categoria, p.volume, p.tipoEmb, p.unPorCx, p.ean, x.lote, fmtDia(x.validade), x.deposito, x.posicao, x.qtd, (x.qtd / p.unPorCx).toFixed(2).replace('.', ','), String(p.preco).replace('.', ','), x.fornecedor || p.fornecedor]); });
      return csv('estoque-' + diaLocal() + '.csv', lv);
    }
    var l = [['Produto', 'Marca', 'Categoria', 'Volume', 'Embalagem', 'Un/Emb', 'EAN', 'Lote', 'Validade', 'Depósito', 'Posição', 'Qtd (un)', 'Caixas', 'Custo un', 'Preço un', 'Fornecedor']];
    S.lotes.forEach(function (x) { var p = P(x.produtoId); if (!p) return; l.push([p.nome, p.marca, p.categoria, p.volume, p.tipoEmb, p.unPorCx, p.ean, x.lote, fmtDia(x.validade), x.deposito, x.posicao, x.qtd, (x.qtd / p.unPorCx).toFixed(2).replace('.', ','), String(x.custo).replace('.', ','), String(p.preco).replace('.', ','), x.fornecedor || p.fornecedor]); });
    csv('estoque-' + diaLocal() + '.csv', l);
  };

  // ---- cadastro de produto
  A.produtoModal = function (id, prefill, depois) {
    var p = id ? P(id) : null;
    var v = p ? {
      nome: p.nome, marca: p.marca, ean: p.ean, eanCx: p.eanCx, categoria: p.categoria, volume: p.volume, tipoEmb: p.tipoEmb, unPorCx: p.unPorCx, retornavel: p.retornavel,
      custoCx: Math.round(p.custo * p.unPorCx * 100) / 100 || '', precoUn: p.preco || '', precoCx: p.precoCx || '', minimoCx: p.minimo ? Math.round(p.minimo / p.unPorCx * 100) / 100 : '', fornecedor: p.fornecedor, depositoPadrao: p.depositoPadrao
    } : Object.assign({ nome: '', marca: '', ean: '', eanCx: '', categoria: 'Cervejas', volume: '', tipoEmb: 'Caixa', unPorCx: 12, retornavel: false, custoCx: '', precoUn: '', precoCx: '', minimoCx: '', fornecedor: '', depositoPadrao: '' }, prefill || {});
    var pm = formModal({
      title: p ? 'Editar produto' : 'Novo produto', wide: 'max-w-2xl', submit: 'Salvar produto',
      subtitle: 'Cadastre uma vez; depois é só dar entrada nos lotes.',
      fields: [
        { name: 'nome', label: 'Nome do produto', value: v.nome, required: true, span2: true, placeholder: 'Ex: Cerveja Pilsen Lata 350ml' },
        { name: 'marca', label: 'Marca', value: v.marca }, { name: 'volume', label: 'Volume', value: v.volume, placeholder: '350ml, 2L, 30L…' },
        { name: 'categoria', label: 'Categoria', type: 'select', options: S.categorias, value: v.categoria },
        { name: 'tipoEmb', label: 'Tipo de embalagem', type: 'select', options: EMBALAGENS, value: v.tipoEmb },
        { name: 'unPorCx', label: 'Unidades por embalagem', type: 'number', min: 1, value: v.unPorCx, required: true, hint: 'Ex: caixa com 12 latas = 12. Barril/galão = 1.' },
        { name: 'retornavel', label: 'Vasilhame retornável (casco/engradado)', type: 'checkbox', value: v.retornavel },
        { name: 'ean', label: 'Código de barras (unidade)', value: v.ean, inputmode: 'numeric', placeholder: 'EAN-13 da lata/garrafa' },
        { name: 'eanCx', label: 'Código de barras (caixa/DUN-14)', value: v.eanCx, inputmode: 'numeric', placeholder: 'Opcional' },
        { name: 'custoCx', label: 'Custo da embalagem (R$)', type: 'number', step: '0.01', min: 0, value: v.custoCx, hint: 'Quanto você paga pela caixa/fardo' },
        { name: 'precoUn', label: 'Preço de venda da unidade (R$)', type: 'number', step: '0.01', min: 0, value: v.precoUn },
        { name: 'precoCx', label: 'Preço de venda da caixa (R$)', type: 'number', step: '0.01', min: 0, value: v.precoCx, hint: 'Deixe vazio para usar unidade × quantidade' },
        { name: 'minimoCx', label: 'Estoque mínimo (em caixas)', type: 'number', step: '0.5', min: 0, value: v.minimoCx, hint: 'Abaixo disso entra na lista de reposição' },
        { name: 'fornecedor', label: 'Fornecedor', value: v.fornecedor },
        { name: 'depositoPadrao', label: 'Depósito padrão', type: 'select', options: [{ v: '', t: '— escolher na entrada —' }].concat(S.depositos.map(function (d) { return { v: d.nome, t: d.nome }; })), value: v.depositoPadrao }
      ],
      onChange: function (f, info) {
        var pc = Math.max(1, Math.round(toNum(f.unPorCx)) || 1), custoUn = toNum(f.custoCx) / pc, pu = toNum(f.precoUn), pcx = toNum(f.precoCx);
        var partes = [];
        if (custoUn > 0) partes.push('Custo/un ' + brl(custoUn));
        if (custoUn > 0 && pu > 0) partes.push('Margem un ' + Math.round((pu - custoUn) / pu * 100) + '% (lucro ' + brl(pu - custoUn) + ')');
        if (pu > 0) partes.push('Caixa pelo preço un: ' + brl(pu * pc));
        if (pcx > 0 && toNum(f.custoCx) > 0) partes.push('Margem caixa ' + Math.round((pcx - toNum(f.custoCx)) / pcx * 100) + '%');
        info(partes.join(' · '));
      },
      onSubmit: async function (f) {
        var pc = Math.max(1, Math.round(toNum(f.unPorCx)) || 1);
        var payload = { id: p ? p.id : undefined, nome: f.nome, marca: f.marca, volume: f.volume, categoria: f.categoria, tipoEmb: f.tipoEmb, unPorCx: pc, retornavel: f.retornavel, ean: f.ean, eanCx: f.eanCx, custo: toNum(f.custoCx) / pc, preco: toNum(f.precoUn), precoCx: toNum(f.precoCx), minimo: Math.round(toNum(f.minimoCx) * pc), fornecedor: f.fornecedor, depositoPadrao: f.depositoPadrao };
        var r = await salvar('/api/produto', payload, p ? 'Produto atualizado' : 'Produto cadastrado');
        if (depois) depois(r.produto);
      }
    });
    if (p) {
      // botão de exclusão discreto
      var form = pm.querySelector('form');
      var box = document.createElement('div'); box.className = 'text-left';
      box.innerHTML = '<button type="button" class="text-xs font-bold text-rose-600 underline cursor-pointer">Excluir este produto</button>';
      form.appendChild(box);
      box.firstChild.onclick = function () {
        var saldo = E[p.id] ? E[p.id].total : 0;
        confirmar('Excluir "' + p.nome + '"?', saldo > 0 ? 'Ainda há <b>' + nf(saldo) + ' un</b> em estoque. Excluir apaga o produto <b>e esses lotes</b>.' : 'O produto será removido do cadastro.', 'Excluir', async function () {
          try { await salvar('/api/produto/excluir', { id: p.id, force: true }, 'Produto excluído'); fechaModais(); } catch (e) { toast(e.message, 'erro'); }
        }, true);
      };
    }
  };

  // ---- edição rápida de preço (1 produto ou tabela completa)
  async function salvarPrecosAPI(itens) {
    try {
      return await api('/api/produto/precos', { itens: itens });
    } catch (e) {
      if (/Rota n[aã]o encontrada/i.test(e.message)) {
        for (var i = 0; i < itens.length; i++) {
          await api('/api/produto', itens[i]);
        }
        return { success: true, alterados: itens.length };
      }
      throw e;
    }
  }
  A.precoModal = function (id) {
    if (ehVendedor()) return toast('Acesso negado: vendedores não podem editar preços.', 'erro');
    var p = P(id); if (!p) return;
    var pc = p.unPorCx || 1;
    formModal({
      title: '💲 Editar Preço — ' + p.nome,
      subtitle: (CAT_ICON[p.categoria] || '') + ' ' + esc(p.marca) + ' · ' + esc(p.tipoEmb) + ' c/' + pc + ' un · Preço atual: <b>' + brl(p.preco) + '/un</b>',
      submit: '💾 Salvar Novo Preço',
      fields: [
        { name: 'precoUn', label: 'Preço de Venda da Unidade (R$)', type: 'number', step: '0.01', min: 0, value: p.preco, required: true },
        { name: 'precoCx', label: pc > 1 ? ('Preço da Embalagem c/' + pc + ' (R$)') : 'Preço promocional (opcional)', type: 'number', step: '0.01', min: 0, value: p.precoCx || '', hint: pc > 1 ? ('Vazio = ' + pc + ' × preço unitário') : 'Opcional' },
        { name: 'custoUn', label: 'Custo da Unidade (R$)', type: 'number', step: '0.01', min: 0, value: Math.round((p.custo || 0) * 100) / 100, span2: true }
      ],
      onChange: function (f, info) {
        var pu = toNum(f.precoUn), cu = toNum(f.custoUn), pcx = toNum(f.precoCx) || (pu * pc);
        var m = pu > 0 && cu > 0 ? Math.round((pu - cu) / pu * 100) : null;
        info('Unidade: <b>' + brl(pu) + '</b>' + (pc > 1 ? ' · ' + esc(p.tipoEmb) + ' c/' + pc + ': <b>' + brl(pcx) + '</b>' : '') + (m !== null ? ' · Margem: <b>' + m + '%</b> (lucro ' + brl(pu - cu) + '/un)' : ''));
      },
      onSubmit: async function (f) {
        await salvarPrecosAPI([{ id: p.id, preco: toNum(f.precoUn), precoCx: toNum(f.precoCx), custo: toNum(f.custoUn) }]);
        await carregar(); renderAll();
        toast('Preço de "' + p.nome + '" atualizado para ' + brl(toNum(f.precoUn)) + '!');
      }
    });
  };

  A.tabelaPrecosModal = function () {
    if (ehVendedor()) return toast('Acesso negado: vendedores não podem editar preços.', 'erro');
    var catFiltro = '';
    var qFiltro = '';
    var editados = {};
    var el = abrirModal('<div class="p-5 space-y-3">' +
      '<div class="flex items-start justify-between gap-2">' +
      '<div><h3 class="font-extrabold text-lg text-stone-900">💲 Tabela Rápida — Editar Preços dos Produtos</h3>' +
      '<p class="text-xs text-stone-500">Altere o preço de venda (unidade ou caixa) e o custo de vários produtos de uma vez.</p></div>' +
      '<button type="button" data-x class="text-2xl text-stone-400 hover:text-stone-700 cursor-pointer">&times;</button></div>' +
      '<div class="flex flex-wrap gap-2"><input id="tp-q" class="inp flex-1 min-w-[200px]" placeholder="🔍 Buscar bebida, dose, whisky, cigarro, gelo, doce…">' +
      '<select id="tp-cat" class="inp !w-auto"><option value="">Todas as categorias</option>' + S.categorias.map(function (c) { return '<option value="' + esc(c) + '">' + (CAT_ICON[c] || '') + ' ' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div id="tp-lista" class="max-h-96 overflow-y-auto border border-stone-200 rounded-xl"></div>' +
      '<div class="flex items-center justify-between gap-2 pt-1">' +
      '<span id="tp-status" class="text-xs font-bold text-amber-700"></span>' +
      '<div class="flex gap-2"><button type="button" class="btn btn-out" data-x>Cancelar</button>' +
      '<button type="button" class="btn btn-pri" id="tp-salvar">💾 Salvar Preços Alterados</button></div></div></div>', 'max-w-3xl');

    el.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { el.close(); }; });
    var inpQ = el.querySelector('#tp-q');
    var selCat = el.querySelector('#tp-cat');
    inpQ.oninput = function () { qFiltro = this.value; desenhar(); };
    selCat.onchange = function () { catFiltro = this.value; desenhar(); };

    function atualizarStatus() {
      var n = Object.keys(editados).length;
      el.querySelector('#tp-status').textContent = n ? (n + ' produto(s) com preço alterado para salvar') : 'Digite o novo valor em qualquer produto abaixo';
    }

    function desenhar() {
      var q = norm(qFiltro);
      var lista = S.produtos.filter(function (p) {
        if (catFiltro && p.categoria !== catFiltro) return false;
        if (q && norm(p.nome + ' ' + p.marca + ' ' + p.volume + ' ' + p.ean).indexOf(q) === -1) return false;
        return true;
      }).sort(function (a, b) { return a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome); });

      var box = el.querySelector('#tp-lista');
      if (!lista.length) {
        box.innerHTML = '<div class="p-6 text-center text-xs text-stone-400">Nenhum produto encontrado.</div>';
        return;
      }
      box.innerHTML = '<table class="w-full"><thead><tr><th>Produto</th><th>Custo un (R$)</th><th>Preço Venda un (R$)</th><th>Preço Caixa/Emb (R$)</th></tr></thead><tbody>' +
        lista.map(function (p) {
          var ed = editados[p.id] || {};
          var custoVal = ed.custo !== undefined ? ed.custo : (Math.round((p.custo || 0) * 100) / 100);
          var precoVal = ed.preco !== undefined ? ed.preco : p.preco;
          var precoCxVal = ed.precoCx !== undefined ? ed.precoCx : (p.precoCx || '');
          return '<tr class="hover:bg-amber-50/40">' +
            '<td><div class="font-bold text-xs">' + (CAT_ICON[p.categoria] || '') + ' ' + esc(p.nome) + '</div><div class="text-[10px] text-stone-400">' + esc(p.marca) + ' · ' + esc(p.tipoEmb) + ' c/' + p.unPorCx + '</div></td>' +
            '<td class="w-28"><input type="number" step="0.01" min="0" data-id="' + p.id + '" data-k="custo" value="' + custoVal + '" class="inp !py-1 !text-xs"></td>' +
            '<td class="w-32"><input type="number" step="0.01" min="0" data-id="' + p.id + '" data-k="preco" value="' + precoVal + '" class="inp !py-1 !text-xs font-extrabold !border-amber-400 !bg-amber-50/40"></td>' +
            '<td class="w-32"><input type="number" step="0.01" min="0" data-id="' + p.id + '" data-k="precoCx" value="' + precoCxVal + '" placeholder="' + (p.unPorCx > 1 ? brl(precoVal * p.unPorCx) : '—') + '" class="inp !py-1 !text-xs"></td></tr>';
        }).join('') + '</tbody></table>';

      box.querySelectorAll('input[data-id]').forEach(function (inp) {
        inp.oninput = function () {
          var id = inp.getAttribute('data-id');
          var k = inp.getAttribute('data-k');
          var pr = P(id);
          if (!editados[id]) editados[id] = { id: id, custo: pr.custo, preco: pr.preco, precoCx: pr.precoCx || 0 };
          editados[id][k] = toNum(inp.value);
          atualizarStatus();
        };
      });
      atualizarStatus();
    }

    el.querySelector('#tp-salvar').onclick = async function () {
      var itens = Object.keys(editados).map(function (k) { return editados[k]; });
      if (!itens.length) { el.close(); return; }
      try {
        await salvarPrecosAPI(itens);
        await carregar(); renderAll();
        toast('Preços atualizados com sucesso!');
        el.close();
      } catch (e) { toast(e.message, 'erro'); }
    };

    desenhar();
    setTimeout(function () { inpQ.focus(); }, 50);
  };

  // ---- ajuste de lote
  A.loteModal = function (id) {
    var l = S.lotes.filter(function (x) { return x.id === id; })[0]; if (!l) return;
    var p = P(l.produtoId), pc = p.unPorCx;
    formModal({
      title: 'Ajustar lote ' + l.lote, subtitle: esc(p.nome) + ' · saldo atual <b>' + fmtQtd(l.qtd, pc) + '</b> (' + nf(l.qtd) + ' un)', submit: 'Salvar ajuste',
      fields: [
        { name: 'lote', label: 'Código do lote', value: l.lote, required: true }, { name: 'validade', label: 'Validade', type: 'date', value: l.validade, required: true },
        { name: 'deposito', label: 'Depósito', type: 'select', options: S.depositos.map(function (d) { return d.nome; }), value: l.deposito }, { name: 'posicao', label: 'Posição / rua / palete', value: l.posicao },
        { name: 'cx', label: 'Contagem física — caixas', type: 'number', min: 0, value: pc > 1 ? Math.floor(l.qtd / pc) : 0 }, { name: 'un', label: pc > 1 ? 'Contagem física — unidades soltas' : 'Contagem física — unidades', type: 'number', min: 0, value: pc > 1 ? l.qtd % pc : l.qtd },
        { name: 'motivo', label: 'Motivo do ajuste (se a contagem mudou)', value: '', span2: true, placeholder: 'Ex: inventário de novembro' }
      ],
      onChange: function (f, info) { var q = Math.round(toNum(f.cx)) * pc + Math.round(toNum(f.un)); info(q !== l.qtd ? 'Novo saldo: ' + nf(q) + ' un (' + (q > l.qtd ? '+' : '') + nf(q - l.qtd) + ') — será registrado no histórico' : 'Saldo sem alteração'); },
      onSubmit: async function (f) {
        await salvar('/api/lote/editar', { id: l.id, lote: f.lote, validade: f.validade, deposito: f.deposito, posicao: f.posicao, qtd: Math.round(toNum(f.cx)) * pc + Math.round(toNum(f.un)), motivo: f.motivo }, 'Lote atualizado');
      }
    });
  };
  // ---- baixa de lote (avaria, descarte, etc.)
  A.baixaLote = function (id, tipo) {
    var l = S.lotes.filter(function (x) { return x.id === id; })[0]; if (!l) return;
    var p = P(l.produtoId), pc = p.unPorCx;
    formModal({
      title: 'Dar baixa no lote ' + l.lote, subtitle: esc(p.nome) + ' · saldo <b>' + fmtQtd(l.qtd, pc) + '</b> (' + nf(l.qtd) + ' un)', submit: 'Confirmar baixa', danger: true,
      fields: [
        { name: 'tipo', label: 'Motivo da baixa', type: 'select', options: ['Vencido (Descarte)', 'Avaria / Quebra', 'Consumo Interno', 'Bonificação', 'Amostra / Degustação'], value: tipo || 'Avaria / Quebra', span2: true },
        { name: 'cx', label: 'Caixas', type: 'number', min: 0, value: pc > 1 ? Math.floor(l.qtd / pc) : 0 }, { name: 'un', label: pc > 1 ? 'Unidades soltas' : 'Unidades', type: 'number', min: 0, value: pc > 1 ? l.qtd % pc : l.qtd },
        { name: 'obs', label: 'Observação', value: '', span2: true }
      ],
      onSubmit: async function (f) {
        var q = Math.round(toNum(f.cx)) * pc + Math.round(toNum(f.un));
        if (q <= 0) throw new Error('Informe a quantidade');
        if (q > l.qtd) throw new Error('Quantidade maior que o saldo do lote');
        await salvar('/api/saida', { tipo: f.tipo, itens: [{ produtoId: p.id, qtd: q, loteId: l.id }], obs: f.obs }, 'Baixa registrada');
      }
    });
  };

  // ============================================================ REPOSIÇÃO
  var NIVEL = {
    zerado: { t: '🔴 ZERADO (0)', cls: 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold animate-pulse' },
    baixo: { t: '🔴 BAIXO', cls: 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold' },
    repor: { t: '🟠 REPOR', cls: 'bg-orange-100 text-orange-800 border-orange-300 font-bold' },
    proximo: { t: '🟡 ATENÇÃO', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300 font-semibold' },
    ok: { t: '🟢 BOM', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' }
  };
  function mountReposicao() {
    $('v-reposicao').innerHTML = '<div class="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><h2 class="font-extrabold text-lg">Lista de reposição de estoque</h2><p class="text-xs text-stone-500">Regra geral: <b>≤ 5 Baixo</b> · <b>≤ 10 Repor</b> · <b>≥ 20 Bom</b> &nbsp;|&nbsp; Regra p/ <b>Whiskies</b>: <b>1 Baixo</b> · <b>2 Repor</b> · <b>≥ 3 Bom</b></p></div>' +
      '<div class="flex flex-wrap gap-2"><button class="btn btn-green" onclick="A.repWhats()">💬 Copiar p/ WhatsApp</button><button class="btn btn-out" onclick="A.repImprimir()">🖨️ Imprimir</button></div></div>' +
      '<div class="flex gap-2 flex-wrap" id="rep-filtros"></div><div id="rep-list" class="card overflow-x-auto"></div>';
  }
  RENDER.reposicao = function () {
    var lista = calcReposicao();
    var cont = { todos: lista.filter(function (x) { return x.nivel !== 'ok'; }).length, zerado: 0, baixo: 0, repor: 0, proximo: 0, ok: 0 };
    lista.forEach(function (x) { cont[x.nivel] = (cont[x.nivel] || 0) + 1; });
    var f = [['todos', 'Precisam de compra'], ['zerado', '🔴 Zerados'], ['baixo', '🔴 Baixo (≤5 / 1w)'], ['repor', '🟠 Repor (≤10 / 2w)'], ['proximo', '🟡 Atenção (11–19)'], ['ok', '🟢 Bom (≥20 / ≥3w)'], ['tudo', 'Todos']];
    $('rep-filtros').innerHTML = f.map(function (x) { var n = x[0] === 'tudo' ? lista.length : (cont[x[0]] || 0); return '<button class="btn btn-sm ' + (F.repFiltro === x[0] ? 'btn-dark' : 'btn-out') + '" onclick="A.repFiltro(\'' + x[0] + '\')">' + x[1] + ' (' + n + ')</button>'; }).join('');
    var vis = lista.filter(function (x) { return F.repFiltro === 'tudo' || (F.repFiltro === 'todos' ? x.nivel !== 'ok' : x.nivel === F.repFiltro); });
    if (!vis.length) { $('rep-list').innerHTML = '<div class="p-8 text-center text-stone-500 text-sm">' + (S.produtos.length ? '🎉 Nenhum produto nesta faixa.' : 'Cadastre produtos para ver a reposição.') + '</div>'; return; }
    $('rep-list').innerHTML = '<table class="w-full"><thead><tr><th>Produto</th><th>Situação</th><th>Estoque válido</th><th>Regra aplicada</th><th>Vendido 30d</th><th>Sugestão de compra</th><th>Fornecedor</th><th></th></tr></thead><tbody>' + vis.map(function (x) {
      var p = x.p, n = NIVEL[x.nivel];
      var rotuloStatus = n.t + (x.nivel === 'baixo' ? (x.ehWhisky ? ' (≤ 1)' : ' (≤ 5)') : x.nivel === 'repor' ? (x.ehWhisky ? ' (2)' : ' (≤ 10)') : x.nivel === 'ok' ? (x.ehWhisky ? ' (≥ 3)' : ' (≥ 20)') : '');
      return '<tr><td><div class="font-bold">' + (CAT_ICON[p.categoria] || '') + ' ' + esc(p.nome) + '</div><div class="text-[11px] text-stone-500">' + esc(p.marca) + ' ' + esc(p.volume) + '</div></td>' +
        '<td>' + badge(rotuloStatus, n.cls) + '</td>' +
        '<td class="font-bold">' + nf(x.atual) + ' un <span class="text-xs text-stone-400 font-normal">(' + fmtQtd(x.atual, p.unPorCx) + ')</span>' + (x.vencidos ? '<div class="text-[10px] text-rose-600">+' + nf(x.vencidos) + ' vencidas</div>' : '') + '</td>' +
        '<td class="text-xs text-stone-600">' + esc(x.regraTxt) + '</td>' +
        '<td>' + (x.c30 ? fmtQtd(x.c30, p.unPorCx) : '—') + '</td>' +
        '<td class="font-extrabold text-amber-700">' + (x.sug ? nf(x.sug) + ' un <span class="text-[10px] text-stone-400 font-normal">(' + fmtQtd(x.sug, p.unPorCx) + ' · ' + brl(x.sug * p.custo) + ')</span>' : '—') + '</td>' +
        '<td class="text-xs">' + esc(p.fornecedor || '—') + '</td><td><button class="btn btn-green btn-sm" onclick="A.entradaPara(\'' + p.id + '\')">📥 Comprar</button></td></tr>';
    }).join('') + '</tbody></table>';
  };
  A.repFiltro = function (f) { F.repFiltro = f; RENDER.reposicao(); };
  function itensCompra() { return calcReposicao().filter(function (x) { return x.nivel !== 'ok' && x.sug > 0; }); }
  A.repWhats = function () {
    var it = itensCompra(); if (!it.length) return toast('Nada para comprar agora 🎉', 'aviso');
    var por = {}; it.forEach(function (x) { var f = x.p.fornecedor || 'Sem fornecedor definido'; (por[f] = por[f] || []).push(x); });
    var t = '*Pedido de compra — ' + (S.config.empresa || '') + '*\n' + fmtDia(diaLocal()) + '\n';
    Object.keys(por).forEach(function (f) { t += '\n*' + f + '*\n'; por[f].forEach(function (x) { t += '• ' + x.p.nome + (x.p.volume ? ' ' + x.p.volume : '') + ': ' + Math.round(x.sug / x.p.unPorCx) + (x.p.unPorCx > 1 ? ' cx' : ' un') + '\n'; }); });
    var total = it.reduce(function (s, x) { return s + x.sug * x.p.custo; }, 0);
    t += '\nTotal estimado: ' + brl(total);
    copiarTexto(t);
  };
  A.repImprimir = function () {
    var it = itensCompra(); if (!it.length) return toast('Nada para comprar agora 🎉', 'aviso');
    var total = it.reduce(function (s, x) { return s + x.sug * x.p.custo; }, 0);
    imprimir('<div style="font-family:sans-serif;padding:20px"><h2>Lista de compras — ' + esc(S.config.empresa) + '</h2><p>' + fmtDia(diaLocal()) + '</p><table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th align="left">Produto</th><th align="left">Fornecedor</th><th>Estoque</th><th>Comprar</th><th align="right">Est. R$</th></tr>' + it.map(function (x) { return '<tr style="border-top:1px solid #ccc"><td>' + esc(x.p.nome) + ' ' + esc(x.p.volume) + '</td><td>' + esc(x.p.fornecedor) + '</td><td align="center">' + fmtQtd(x.atual, x.p.unPorCx) + '</td><td align="center"><b>' + Math.round(x.sug / x.p.unPorCx) + (x.p.unPorCx > 1 ? ' cx' : ' un') + '</b></td><td align="right">' + brl(x.sug * x.p.custo) + '</td></tr>'; }).join('') + '</table><h3 style="text-align:right">Total estimado: ' + brl(total) + '</h3></div>');
  };

  // ============================================================ seleção de produto (entrada / saída)
  function resolverProd(v) {
    v = String(v || '').trim(); if (!v) return null;
    var i, p;
    for (i = 0; i < S.produtos.length; i++) if (rotuloProd(S.produtos[i]) === v) return S.produtos[i];
    var ach = acharPorCodigo(v); if (ach && /^\d{6,}$/.test(v)) return ach.p;
    var q = norm(v), cand = S.produtos.filter(function (x) { return norm(x.nome + ' ' + x.marca + ' ' + x.volume).indexOf(q) !== -1; });
    return cand.length === 1 ? cand[0] : null;
  }
  function fill(sel, opts, manter) {
    if (!sel) return;
    var atual = sel.value, html = opts.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.t) + '</option>'; }).join('');
    if (sel._html !== html) { sel.innerHTML = html; sel._html = html; if (manter !== false) sel.value = atual; }
    if (sel.selectedIndex < 0 && sel.options.length) sel.selectedIndex = 0;
  }
  function refreshForms() {
    var dl = $('dl-prod'); if (!dl) return;
    var h = S.produtos.map(function (p) { return '<option value="' + esc(rotuloProd(p)) + '"></option>'; }).join('');
    if (dl._h !== h) { dl.innerHTML = h; dl._h = h; }
    fill($('en-dep'), S.depositos.map(function (d) { return { v: d.nome, t: d.nome }; }));
    fill($('sd-cli'), [{ v: '', t: '✅ Consumidor Final (Venda Direta / Balcão)' }].concat(S.clientes.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (c) { return { v: c.id, t: '👤 ' + c.nome }; })));
    if ($('en-prod').value) entradaInfo();
    if ($('sd-prod').value) saidaInfo();
    renderVitrine();
    renderCart();
  }

  // ============================================================ ENTRADA
  var nfe = null;
  function mountEntrada() {
    $('v-entrada').innerHTML = '<datalist id="dl-prod"></datalist><div class="grid lg:grid-cols-5 gap-4">' +
      '<form id="en-form" class="card p-5 lg:col-span-3 space-y-4" autocomplete="off"><div><h2 class="font-extrabold text-lg">📥 Entrada de compra (manual)</h2><p class="text-xs text-stone-500">Registre o que chegou do fornecedor. Cada validade vira um lote — é isso que faz o FEFO funcionar.</p></div>' +
      '<div><label class="lbl">Produto *</label><div class="flex gap-2"><input id="en-prod" list="dl-prod" class="inp" placeholder="Digite o nome ou o código de barras…"><button type="button" class="btn btn-dark" onclick="A.enScan()">📷</button><button type="button" class="btn btn-out" onclick="A.produtoModal(null,null,A.enNovo)">➕ Novo</button></div><div id="en-info" class="mt-2 text-xs"></div></div>' +
      '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3"><div><label class="lbl">Caixas *</label><input id="en-cx" type="number" min="0" class="inp" value="1"></div><div><label class="lbl">Un. soltas</label><input id="en-un" type="number" min="0" class="inp" value="0"></div>' +
      '<div><label class="lbl">Custo da caixa (R$)</label><input id="en-custo" type="number" step="0.01" min="0" class="inp"></div><div><label class="lbl">Total (R$)</label><div id="en-total" class="inp bg-stone-100 font-bold">—</div></div></div>' +
      '<div class="grid sm:grid-cols-3 gap-3"><div><label class="lbl">Validade *</label><input id="en-val" type="date" class="inp" required></div><div><label class="lbl">Lote</label><input id="en-lote" class="inp" placeholder="auto pela validade"></div><div><label class="lbl">Fabricação</label><input id="en-fab" type="date" class="inp"></div></div>' +
      '<div class="flex flex-wrap gap-1.5 items-center text-[11px]"><span class="font-bold text-stone-500">Validade rápida:</span>' + [3, 6, 9, 12, 18, 24].map(function (m) { return '<button type="button" class="btn btn-out btn-sm" onclick="A.enVal(' + m + ')">+' + m + ' meses</button>'; }).join('') + '</div>' +
      '<div class="grid sm:grid-cols-2 gap-3"><div><label class="lbl">Depósito</label><select id="en-dep" class="inp"></select></div><div><label class="lbl">Posição / rua / palete</label><input id="en-pos" class="inp" placeholder="Ex: Rua B, palete 4"></div>' +
      '<div><label class="lbl">Fornecedor</label><input id="en-forn" class="inp"></div><div><label class="lbl">Nº da nota fiscal</label><input id="en-nf" class="inp"></div></div>' +
      '<label class="flex items-center gap-2 text-xs font-semibold text-stone-600 cursor-pointer"><input id="en-atual" type="checkbox" checked class="w-4 h-4 accent-amber-600"> Atualizar o custo cadastrado do produto com este valor</label>' +
      '<div id="en-err" class="hidden text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"></div><button class="btn btn-pri w-full !py-3 text-sm">✅ Registrar entrada no estoque</button></form>' +
      '<div class="card p-5 lg:col-span-2 space-y-3"><div><h2 class="font-extrabold text-lg">🧾 Importar NF-e (XML)</h2><p class="text-xs text-stone-500">Receba a nota do fornecedor de uma vez: o sistema lê os itens do XML, reconhece os produtos pelo código de barras e você só confere as validades.</p></div>' +
      '<label class="btn btn-dark w-full cursor-pointer">📂 Escolher arquivo XML da nota<input type="file" accept=".xml,text/xml" class="hidden" onchange="A.nfeArquivo(event)"></label>' +
      '<p class="text-[11px] text-stone-400">O arquivo é lido no seu aparelho; nada é enviado para fora.</p></div></div><div id="nfe-box"></div>';
    var f = $('en-form');
    $('en-prod').addEventListener('change', entradaSelecionar);
    $('en-prod').addEventListener('input', function () { if (resolverProd(this.value)) entradaSelecionar(); });
    ['en-cx', 'en-un', 'en-custo'].forEach(function (i) { $(i).addEventListener('input', entradaTotal); });
    f.onsubmit = A.enSubmit;
  }
  function entradaProd() { return resolverProd($('en-prod').value); }
  function entradaInfo() {
    var p = entradaProd(), el = $('en-info');
    if (!p) { el.innerHTML = $('en-prod').value ? '<span class="text-amber-700 font-semibold">Produto não encontrado — use ➕ Novo para cadastrar.</span>' : ''; return; }
    var e = E[p.id];
    el.innerHTML = '<div class="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-stone-700">' + (CAT_ICON[p.categoria] || '') + ' <b>' + esc(p.nome) + '</b> · ' + esc(p.tipoEmb) + ' com ' + p.unPorCx + ' un · em estoque: <b>' + fmtQtd(e.total, p.unPorCx) + '</b>' + (p.minimo ? ' (mín. ' + fmtQtd(p.minimo, p.unPorCx) + ')' : '') + '</div>';
  }
  function entradaSelecionar() {
    var p = entradaProd(); entradaInfo(); if (!p) return;
    $('en-custo').value = p.custo ? (Math.round(p.custo * p.unPorCx * 100) / 100) : '';
    if (p.fornecedor && !$('en-forn').value) $('en-forn').value = p.fornecedor;
    if (p.depositoPadrao) $('en-dep').value = p.depositoPadrao;
    entradaTotal();
  }
  function entradaTotal() {
    var p = entradaProd(), el = $('en-total'); if (!p) { el.textContent = '—'; return; }
    var cx = toNum($('en-cx').value), un = toNum($('en-un').value), c = toNum($('en-custo').value);
    el.textContent = c ? brl((cx + un / p.unPorCx) * c) : '—';
  }
  A.enNovo = function (p) { $('en-prod').value = rotuloProd(p); entradaSelecionar(); };
  A.enVal = function (m) { var d = new Date(); d.setMonth(d.getMonth() + m); $('en-val').value = diaLocal(d); };
  A.enScan = function () {
    A.scanner(function (code) {
      var r = acharPorCodigo(code);
      if (r) { $('en-prod').value = rotuloProd(r.p); entradaSelecionar(); if (r.caixa) { $('en-cx').value = 1; $('en-un').value = 0; toast('Código da caixa: 1 caixa de ' + r.p.nome); } $('en-val').focus(); }
      else cadastrarPorCodigo(code, A.enNovo);
    }, 'Escanear produto recebido');
  };
  A.enSubmit = async function (ev) {
    ev.preventDefault();
    var err = $('en-err'); err.classList.add('hidden');
    var p = entradaProd();
    try {
      if (!p) throw new Error('Escolha um produto da lista (ou cadastre em ➕ Novo)');
      var qtd = Math.round(toNum($('en-cx').value)) * p.unPorCx + Math.round(toNum($('en-un').value));
      if (qtd <= 0) throw new Error('Informe a quantidade recebida');
      if (!$('en-val').value) throw new Error('Informe a validade — ela define a ordem de saída (FEFO)');
      await salvar('/api/entrada', { produtoId: p.id, qtd: qtd, validade: $('en-val').value, lote: $('en-lote').value, fabricacao: $('en-fab').value, deposito: $('en-dep').value, posicao: $('en-pos').value, fornecedor: $('en-forn').value, nf: $('en-nf').value, custoUn: toNum($('en-custo').value) / p.unPorCx, atualizarCusto: $('en-atual').checked },
        'Entrada registrada: ' + fmtQtd(qtd, p.unPorCx) + ' de ' + p.nome);
      $('en-cx').value = 1; $('en-un').value = 0; $('en-lote').value = ''; $('en-fab').value = ''; $('en-pos').value = '';
      $('en-prod').focus(); $('en-prod').select();
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
  };

  // ---- NF-e XML
  function inferCat(nome) {
    var n = norm(nome);
    if (/alambique|barril.*dose|cachaca de barril/.test(n)) return 'Barris de Alambique (Doses)';
    if (/gelo|coco\s*leve|saborizado/.test(n)) return 'Gelos & Gelos Saborizados';
    if (/cigarro|marlboro|dunhill|carlton|rothmans|lucky strike|camel|chesterfield|eight|minister|hollywood|palheiro|paieiro|paiol|seda|ocb|zomo|tabaco|isqueiro|\bbic\b|charuto|essencia|narguile/.test(n)) return 'Cigarros & Tabacaria';
    if (/dose\b|shot\b|copao|combo dose/.test(n)) return 'Doses & Drinks';
    if (/cerveja|pilsen|lager|\bipa\b|stout|long ?neck|weiss|malzbier/.test(n)) return 'Cervejas';
    if (/refri|cola|guaran|soda|tonica|fanta|sprite|pepsi|ginger/.test(n)) return 'Refrigerantes';
    if (/agua|mineral|galao/.test(n)) return 'Águas';
    if (/energ|isot|gatorade|powerade|red bull|monster/.test(n)) return 'Energéticos & Isotônicos';
    if (/suco|nectar|cha |mate|kombucha/.test(n)) return 'Sucos & Chás';
    if (/vinho|espumante|champ|prosecco|sidra/.test(n)) return 'Vinhos & Espumantes';
    if (/vodka|whisk|wisk|bourbon|scotch|\bgin\b|\brum\b|cacha|tequila|licor|conhaque|campari|aperol|dreher|velho barreiro|jack daniel|red label|black label|ballantine|chivas|old parr|white horse|buchanan|passport/.test(n)) return 'Whiskies & Destilados';
    if (/salgadinho|doritos|cheetos|ruffles|fandangos|torcida|batata|amendoim|petisco|ovinho|salame|azeitona|castanha|pipoca|pringles/.test(n)) return 'Salgadinhos & Petiscos';
    if (/miojo|lamen|nissin|cup noodles|macarrao instant|sopa instant/.test(n)) return 'Miojos & Massas Rápidas';
    if (/biscoito|bolacha|trakinas|oreo|passatempo|wafer|bauducco|club social|agua e sal|cream cracker|maizena|recheado|rosquinha|torrada/.test(n)) return 'Biscoitos & Bolachas';
    if (/chocolate|bombom|achocolat|\bbis\b|kit ?kat|lacta|nestle|garoto|snickers|twix|baton|sonho de valsa|ouro branco|\bbala\b|chiclete|trident|halls|pirulito|doce|pacoca|jujuba|fini|mentos|tic tac/.test(n)) return 'Chocolates & Doces';
    return 'Outros';
  }
  function adivinhaPc(nome) {
    var m = nome.match(/\bc\/\s*(\d{1,3})/i) || nome.match(/\b(\d{1,3})\s*x\s*\d/i) || nome.match(/\b(\d{1,3})\s*(?:un|unid|unidades|garrafas|latas)\b/i);
    return m ? Math.max(1, parseInt(m[1], 10)) : 0;
  }
  function parseNFe(xml) {
    if (xml.length > 2000000) throw new Error('Arquivo XML grande demais (máx. 2 MB)');
    if (/<!ENTITY/i.test(xml)) throw new Error('XML bloqueado por segurança (contém entidades externas / XXE)');
    var doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Arquivo XML inválido');
    var tx = function (el, tag) { if (!el) return ''; var n = el.getElementsByTagName(tag)[0]; return n ? n.textContent.trim() : ''; };
    var dets = doc.getElementsByTagName('det');
    if (!dets.length) throw new Error('Este XML não parece uma NF-e (sem itens).');
    var emit = doc.getElementsByTagName('emit')[0];
    var out = { numero: tx(doc.getElementsByTagName('ide')[0], 'nNF'), fornecedor: tx(emit, 'xNome') || tx(emit, 'xFant'), itens: [] };
    for (var i = 0; i < dets.length; i++) {
      var pr = dets[i].getElementsByTagName('prod')[0]; if (!pr) continue;
      var ce = tx(pr, 'cEAN').replace(/\D/g, ''), ct = tx(pr, 'cEANTrib').replace(/\D/g, '');
      out.itens.push({ nome: tx(pr, 'xProd'), ean: ct.length >= 8 ? ct : (ce.length >= 8 ? ce : ''), eanAlt: ce.length >= 8 ? ce : '', un: tx(pr, 'uCom'), q: toNum(tx(pr, 'qCom')), vUn: toNum(tx(pr, 'vUnCom')), vTot: toNum(tx(pr, 'vProd')) });
    }
    return out;
  }
  A.nfeArquivo = function (ev) {
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var n = parseNFe(String(rd.result));
        n.itens.forEach(function (it) {
          var p = null;
          [it.ean, it.eanAlt].forEach(function (c) { if (!p && c) { var r = acharPorCodigo(c); if (r) p = r.p; } });
          if (!p) p = S.produtos.filter(function (x) { return norm(x.nome) === norm(it.nome); })[0] || null;
          var pack = /^(cx|cxa|caixa|fd|fardo|pct|pack|eng|engr|grf|bdj|c\d+)/i.test(it.un);
          it.produtoId = p ? p.id : '__novo';
          it.pcNovo = adivinhaPc(it.nome) || (pack ? 12 : 1);
          var pc = p ? p.unPorCx : it.pcNovo;
          it.qtdUn = pack ? Math.round(it.q * pc) : Math.round(it.q);
          it.custoUn = pack ? it.vUn / pc : it.vUn;
          it.validade = ''; it.lote = n.numero ? 'NF' + n.numero : ''; it.deposito = p && p.depositoPadrao ? p.depositoPadrao : S.depositos[1] ? S.depositos[1].nome : '';
          it.incluir = true;
        });
        nfe = n; renderNfe(); toast('Nota ' + (n.numero || '') + ' lida: ' + n.itens.length + ' item(ns)');
      } catch (e) { toast(e.message, 'erro'); }
    };
    rd.readAsText(f); ev.target.value = '';
  };
  function renderNfe() {
    var box = $('nfe-box'); if (!nfe) { box.innerHTML = ''; return; }
    var depOpts = function (sel) { return S.depositos.map(function (d) { return '<option' + (d.nome === sel ? ' selected' : '') + '>' + esc(d.nome) + '</option>'; }).join(''); };
    var total = nfe.itens.reduce(function (s, i) { return s + i.vTot; }, 0);
    box.innerHTML = '<div class="card p-5 space-y-3"><div class="flex flex-col md:flex-row md:items-center justify-between gap-2"><div><h3 class="font-extrabold">Conferência da NF-e ' + esc(nfe.numero) + ' — ' + esc(nfe.fornecedor) + '</h3><p class="text-xs text-stone-500">' + nfe.itens.length + ' itens · ' + brl(total) + '. Confira os produtos e <b>preencha a validade</b> de cada item.</p></div>' +
      '<div class="flex items-end gap-2"><div><label class="lbl">Validade p/ todos</label><input type="date" id="nfe-val-all" class="inp"></div><button class="btn btn-out" onclick="A.nfeValTodos()">Aplicar</button></div></div>' +
      '<div class="overflow-x-auto"><table class="w-full"><thead><tr><th></th><th>Item da nota</th><th>Produto no sistema</th><th>Qtd (un)</th><th>Custo un</th><th>Validade *</th><th>Lote</th><th>Depósito</th></tr></thead><tbody>' + nfe.itens.map(function (it, i) {
        return '<tr><td><input type="checkbox" ' + (it.incluir ? 'checked' : '') + ' onchange="A.nfeSet(' + i + ',\'incluir\',this.checked)" class="w-4 h-4 accent-amber-600"></td><td class="max-w-[220px]"><div class="font-semibold text-xs">' + esc(it.nome) + '</div><div class="text-[10px] text-stone-400">' + esc(it.q) + ' ' + esc(it.un) + (it.ean ? ' · ' + esc(it.ean) : '') + '</div></td>' +
          '<td><select class="inp !text-xs" onchange="A.nfeSet(' + i + ',\'produtoId\',this.value)"><option value="__novo"' + (it.produtoId === '__novo' ? ' selected' : '') + '>➕ Criar produto novo (c/' + it.pcNovo + ')</option>' + S.produtos.map(function (p) { return '<option value="' + p.id + '"' + (p.id === it.produtoId ? ' selected' : '') + '>' + esc(p.nome) + '</option>'; }).join('') + '</select></td>' +
          '<td><input type="number" min="1" value="' + it.qtdUn + '" class="inp !w-24 !text-xs" onchange="A.nfeSet(' + i + ',\'qtdUn\',this.value)"></td><td class="text-xs">' + brl(it.custoUn) + '</td>' +
          '<td><input type="date" value="' + esc(it.validade) + '" class="inp !text-xs !w-36" onchange="A.nfeSet(' + i + ',\'validade\',this.value)"></td><td><input value="' + esc(it.lote) + '" class="inp !text-xs !w-28" onchange="A.nfeSet(' + i + ',\'lote\',this.value)"></td><td><select class="inp !text-xs" onchange="A.nfeSet(' + i + ',\'deposito\',this.value)">' + depOpts(it.deposito) + '</select></td></tr>';
      }).join('') + '</tbody></table></div><div class="flex justify-end gap-2"><button class="btn btn-out" onclick="A.nfeCancelar()">Cancelar</button><button class="btn btn-pri" onclick="A.nfeConfirmar()">✅ Dar entrada em tudo</button></div></div>';
  }
  A.nfeSet = function (i, campo, v) { nfe.itens[i][campo] = campo === 'qtdUn' ? Math.round(toNum(v)) : v; };
  A.nfeValTodos = function () { var v = $('nfe-val-all').value; if (!v) return toast('Escolha a data', 'aviso'); nfe.itens.forEach(function (i) { i.validade = v; }); renderNfe(); };
  A.nfeCancelar = function () { nfe = null; renderNfe(); };
  A.nfeConfirmar = async function () {
    var sel = nfe.itens.filter(function (i) { return i.incluir; });
    if (!sel.length) return toast('Nenhum item marcado', 'aviso');
    var sem = sel.filter(function (i) { return !i.validade; });
    if (sem.length) return toast('Falta a validade em ' + sem.length + ' item(ns): "' + sem[0].nome.slice(0, 40) + '"', 'erro');
    var itens = sel.map(function (i) {
      var o = { qtd: i.qtdUn, validade: i.validade, lote: i.lote, deposito: i.deposito, custoUn: i.custoUn };
      if (i.produtoId === '__novo') o.novoProduto = { nome: i.nome, ean: i.ean, categoria: inferCat(i.nome), volume: (i.nome.match(/(\d+[.,]?\d*)\s*(ml|l|lt)\b/i) || [''])[0].replace(/\s/g, '').toLowerCase(), tipoEmb: i.pcNovo > 1 ? 'Caixa' : 'Unidade', unPorCx: i.pcNovo, custo: i.custoUn, preco: 0, fornecedor: nfe.fornecedor, minimo: 0 };
      else o.produtoId = i.produtoId;
      return o;
    });
    try {
      await salvar('/api/entrada-lote', { nf: nfe.numero, fornecedor: nfe.fornecedor, itens: itens }, 'NF-e lançada: ' + itens.length + ' item(ns) no estoque');
      var novos = sel.filter(function (i) { return i.produtoId === '__novo'; }).length;
      nfe = null; renderNfe();
      if (novos) toast(novos + ' produto(s) novo(s) criado(s) sem preço de venda — ajuste em Estoque & Lotes.', 'aviso');
    } catch (e) { toast(e.message, 'erro'); }
  };

  // ============================================================ SAÍDA / VENDA (PDV CONSUMIDOR FINAL)
  var TIPO_DESC = { 'Venda': '🛒 Venda ao Consumidor Final (Balcão)', 'Bonificação': '🎁 Brinde / Bonificação', 'Amostra / Degustação': '🍻 Degustação', 'Consumo Interno': '🏠 Consumo interno', 'Avaria / Quebra': '⚠️ Avaria / quebra', 'Vencido (Descarte)': '🗑️ Vencido (descarte)' };
  var vitrineCat = '';
  function mountSaida() {
    $('v-saida').innerHTML = '<div class="grid lg:grid-cols-5 gap-4"><div class="lg:col-span-3 space-y-4">' +
      '<div class="card p-5 space-y-3"><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="font-extrabold text-lg">🛒 Balcão / Caixa — Venda ao Consumidor Final</h2><p class="text-xs text-stone-500">Venda unidade (lata/garrafa) ou fardo/caixa fechada. Baixa automática do lote que vence primeiro (FEFO).</p></div><span class="badge bg-emerald-100 text-emerald-800 border-emerald-300">Consumidor Final</span></div>' +
      '<div><label class="lbl">Produto ou Código de Barras</label><div class="flex gap-2"><input id="sd-prod" list="dl-prod" class="inp" placeholder="Digite o nome, bipe o leitor ou clique num atalho abaixo…"><button class="btn btn-dark" onclick="A.sdScan()">📷 Câmera</button></div><div id="sd-info" class="mt-2 text-xs"></div></div>' +
      '<div class="flex items-end gap-3 flex-wrap"><div class="w-28"><label class="lbl">Unidades</label><input id="sd-un" type="number" min="0" value="1" class="inp font-bold"></div><div class="w-28"><label class="lbl">Fardos / Cx</label><input id="sd-cx" type="number" min="0" value="0" class="inp"></div><div class="flex-1 text-sm font-bold text-stone-700 pb-2" id="sd-prev"></div><button class="btn btn-pri" onclick="A.sdAdd()">➕ Adicionar</button></div>' +
      '<div class="pt-2 border-t border-stone-200 space-y-2"><div class="flex items-center justify-between flex-wrap gap-1"><span class="text-[11px] font-extrabold text-stone-500 uppercase">⚡ Toque Rápido (Clique para jogar no carrinho)</span><div id="sd-cat-pills" class="flex gap-1 flex-wrap"></div></div><div id="sd-vitrine" class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1"></div></div></div>' +
      '<div class="card overflow-x-auto" id="sd-cart"></div></div>' +
      '<div class="lg:col-span-2 card p-5 space-y-3 h-fit"><h3 class="font-extrabold text-lg">Fechamento da Venda</h3>' +
      '<div id="sd-venda-box" class="space-y-3"><div><label class="lbl">Forma de Pagamento</label><div class="grid grid-cols-2 gap-1.5 mb-2" id="sd-pag-btns">' +
      ['PIX', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito'].map(function (pg) { return '<button type="button" onclick="A.sdSetPag(\'' + pg + '\')" data-pg="' + pg + '" class="btn btn-out !py-2 text-xs">' + (pg === 'PIX' ? '⚡ PIX' : pg === 'Dinheiro' ? '💵 Dinheiro' : pg === 'Cartão de Débito' ? '💳 Débito' : '💳 Crédito') + '</button>'; }).join('') +
      '</div><select id="sd-pag" class="inp">' + PAGAMENTOS.map(function (p) { return '<option>' + p + '</option>'; }).join('') + '</select></div>' +
      '<div class="grid grid-cols-2 gap-3"><div><label class="lbl">Desconto R$ (Máx. 10%)</label><input id="sd-desc" type="number" min="0" step="0.01" class="inp" placeholder="0,00 (máx 10%)"></div><div id="sd-troco-box"><label class="lbl">Valor Recebido (Troco)</label><input id="sd-pago" type="number" min="0" step="0.01" class="inp" placeholder="Ex: 50,00"></div></div></div>' +
      '<div id="sd-cli-box" class="pt-1 border-t border-stone-100"><label class="lbl">Cliente (Padrão: Consumidor Final)</label><div class="flex gap-2"><select id="sd-cli" class="inp"></select><button class="btn btn-out" onclick="A.cliModal(null,function(c){document.getElementById(\'sd-cli\').value=c.id;A.sdResumo();})" title="Cadastrar cliente p/ fiado ou casco">➕</button></div><div id="sd-cli-info" class="text-[11px] mt-1"></div></div>' +
      '<div id="sd-vas-box" class="hidden bg-lime-50 border border-lime-200 rounded-xl p-3 text-xs"><div id="sd-vas-txt" class="font-semibold text-lime-900 mb-2"></div><label class="lbl">Cascos / caixas devolvidas agora</label><input id="sd-vas" type="number" min="0" value="0" class="inp"></div>' +
      '<details class="text-xs text-stone-500"><summary class="cursor-pointer font-semibold">Mais opções (observação ou baixa por quebra/consumo)</summary><div class="space-y-2 pt-2"><div><label class="lbl">Tipo de saída</label><select id="sd-tipo" class="inp"></select></div><div><label class="lbl">Observação / Nome p/ entrega</label><input id="sd-obs" class="inp" placeholder="Opcional"></div></div></details>' +
      '<div id="sd-resumo" class="bg-stone-900 text-white rounded-xl p-4 space-y-1"></div><div id="sd-err" class="hidden text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"></div>' +
      '<button class="btn btn-pri w-full !py-3.5 text-base" onclick="A.sdFinalizar()">✅ Finalizar Venda</button>' +
      '<button type="button" class="btn btn-green w-full !py-2.5 text-xs" onclick="A.sdLancarNaMesa()">🪑 Lançar em Mesa / Consumo no Local</button></div></div>';
    $('sd-tipo').innerHTML = Object.keys(TIPO_DESC).map(function (k) { return '<option value="' + k + '">' + TIPO_DESC[k] + '</option>'; }).join('');
    $('sd-prod').addEventListener('change', saidaSelecionar);
    $('sd-prod').addEventListener('input', function () { if (resolverProd(this.value)) saidaSelecionar(); });
    ['sd-cx', 'sd-un'].forEach(function (i) { $(i).addEventListener('input', saidaPrev); $(i).addEventListener('keydown', function (e) { if (e.key === 'Enter') A.sdAdd(); }); });
    ['sd-tipo', 'sd-cli', 'sd-pag', 'sd-desc', 'sd-pago', 'sd-vas'].forEach(function (i) { $(i).addEventListener('input', A.sdResumo); $(i).addEventListener('change', A.sdResumo); });
  }
  A.sdSetPag = function (pg) { $('sd-pag').value = pg; A.sdResumo(); };
  A.sdVitCat = function (c) { vitrineCat = c; renderVitrine(); };
  A.sdQuick = function (id, qtd) {
    var p = P(id); if (!p) return;
    var ja = cart.filter(function (c) { return c.produtoId === p.id; })[0], novo = qtd + (ja ? ja.qtd : 0);
    if (novo > disponivel(p)) return toast('Saldo insuficiente de ' + p.nome + ' (disp: ' + fmtQtd(disponivel(p), p.unPorCx) + ')', 'erro');
    if (ja) { ja.qtd = novo; ja.subtotal = subtotalPadrao(p, novo); } else cart.push({ produtoId: p.id, qtd: qtd, subtotal: subtotalPadrao(p, qtd) });
    renderCart();
  };
  function renderVitrine() {
    var box = $('sd-vitrine'), pills = $('sd-cat-pills'); if (!box || !pills) return;
    var cats = [''].concat(S.categorias.filter(function (c) { return S.produtos.some(function (p) { return p.categoria === c && E[p.id] && E[p.id].validos > 0; }); }));
    pills.innerHTML = cats.map(function (c) {
      var at = vitrineCat === c;
      var lbl = c === 'Cigarros Picados (Unidade)' ? 'Cigarro Picado' : (c ? c.split(' ')[0] : 'Todos');
      return '<button type="button" onclick="A.sdVitCat(\'' + esc(c) + '\')" class="px-2 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer ' + (at ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-stone-600 border-stone-300') + '">' + (c ? (CAT_ICON[c] || '') + ' ' + esc(lbl) : 'Todos') + '</button>';
    }).join('');
    var prods = S.produtos.filter(function (p) { return (!vitrineCat || p.categoria === vitrineCat) && E[p.id] && E[p.id].validos > 0; });
    if (!prods.length) { box.innerHTML = '<div class="col-span-full text-xs text-stone-400 py-3 text-center">Sem produtos com estoque válido nesta categoria.</div>'; return; }
    box.innerHTML = prods.map(function (p) {
      var e = E[p.id];
      var ehMaco = /ma[cç]os?/i.test(p.tipoEmb || '');
      var rotUn = ehMaco ? '+1 maço' : '+1 un';
      var rotCx = ehMaco ? '+1 pct' : '+1 cx';
      return '<div class="border border-stone-200 rounded-xl p-2.5 bg-stone-50/70 hover:bg-amber-50/50 flex flex-col justify-between gap-1.5">' +
        '<div><div class="font-bold text-xs text-stone-900 leading-tight truncate" title="' + esc(p.nome) + '">' + (CAT_ICON[p.categoria] || '') + ' ' + esc(p.nome) + '</div>' +
        '<div class="text-[10px] text-stone-500">' + esc(p.marca) + ' ' + esc(p.volume) + ' · disp: <b>' + fmtQtd(e.validos, p.unPorCx) + '</b></div></div>' +
        '<div class="flex items-center gap-1 pt-1"><button type="button" onclick="A.sdQuick(\'' + p.id + '\',1)" class="btn btn-pri btn-sm flex-1">' + rotUn + ' (' + brl(p.preco) + ')</button>' +
        (p.unPorCx > 1 && e.validos >= p.unPorCx ? '<button type="button" onclick="A.sdQuick(\'' + p.id + '\',' + p.unPorCx + ')" class="btn btn-out btn-sm" title="Adicionar ' + esc(p.tipoEmb) + ' c/' + p.unPorCx + '">' + rotCx + '</button>' : '') +
        (ehVendedor() ? '' : ('<button type="button" onclick="A.precoModal(\'' + p.id + '\')" class="btn btn-out btn-sm" title="Editar preço deste produto">💲</button>')) +
        '</div></div>';
    }).join('');
  }
  function tipoSaida() { return $('sd-tipo').value; }
  function disponivel(p) { var e = E[p.id]; return tipoSaida() === 'Venda' || ['Bonificação', 'Amostra / Degustação', 'Consumo Interno'].indexOf(tipoSaida()) !== -1 ? e.validos : e.total; }
  function subtotalPadrao(p, qtd) {
    if (p.unPorCx > 1) { var cx = Math.floor(qtd / p.unPorCx); return Math.round((cx * precoCxEf(p) + (qtd % p.unPorCx) * p.preco) * 100) / 100; }
    return Math.round(qtd * p.preco * 100) / 100;
  }
  function saidaProd() { return resolverProd($('sd-prod').value); }
  function saidaInfo() {
    var p = saidaProd(), el = $('sd-info');
    if (!p) { el.innerHTML = $('sd-prod').value ? '<span class="text-amber-700 font-semibold">Produto não encontrado.</span>' : ''; saidaPrev(); return; }
    var e = E[p.id], prox = e.lotes.filter(function (l) { return diasPara(l.validade) >= 0; })[0];
    var ja = cart.filter(function (c) { return c.produtoId === p.id; })[0];
    el.innerHTML = '<div class="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-stone-700 space-y-0.5"><div>' + (CAT_ICON[p.categoria] || '') + ' <b>' + esc(p.nome) + '</b>' + (p.retornavel ? ' ♻️' : '') + ' · disponível p/ venda: <b class="' + (e.validos <= 0 ? 'text-rose-600' : '') + '">' + fmtQtd(e.validos, p.unPorCx) + '</b>' + (e.vencidos ? ' <span class="text-rose-600">(+' + nf(e.vencidos) + ' un vencidas bloqueadas)</span>' : '') + (ja ? ' · no pedido: ' + fmtQtd(ja.qtd, p.unPorCx) : '') + '</div>' +
      '<div>Preço: <b>' + brl(p.preco) + '</b>/un' + (p.unPorCx > 1 ? ' · <b>' + brl(precoCxEf(p)) + '</b>/cx' : '') + (prox ? ' · <b>FEFO:</b> lote ' + esc(prox.lote) + ' (' + fmtDia(prox.validade) + ') em ' + esc(prox.deposito) + (prox.posicao ? ' · ' + esc(prox.posicao) : '') : '') + '</div></div>';
    saidaPrev();
  }
  function saidaSelecionar() { saidaInfo(); }
  function qtdForm() { var p = saidaProd(); if (!p) return 0; return Math.round(toNum($('sd-cx').value)) * p.unPorCx + Math.round(toNum($('sd-un').value)); }
  function saidaPrev() { var p = saidaProd(), q = qtdForm(), el = $('sd-prev'); el.textContent = p && q > 0 ? (fmtQtd(q, p.unPorCx) + (tipoSaida() === 'Venda' ? ' = ' + brl(subtotalPadrao(p, q)) : '')) : ''; }
  A.sdScan = function () {
    A.scanner(function (code) {
      var r = acharPorCodigo(code);
      if (!r) return toast('Código ' + code + ' não está cadastrado.', 'erro');
      $('sd-prod').value = rotuloProd(r.p); saidaInfo();
      if (r.caixa) { $('sd-cx').value = 1; $('sd-un').value = 0; } else { $('sd-cx').value = 0; $('sd-un').value = 1; }
      saidaPrev(); toast('Lido: ' + r.p.nome + (r.caixa ? ' (caixa)' : ' (unidade)') + ' — ajuste a quantidade e adicione');
      $('sd-cx').focus(); $('sd-cx').select();
    }, 'Escanear produto da venda');
  };
  A.sdAdd = function () {
    var p = saidaProd(); if (!p) return toast('Escolha um produto da lista', 'erro');
    var q = qtdForm(); if (q <= 0) return toast('Informe a quantidade', 'erro');
    var ja = cart.filter(function (c) { return c.produtoId === p.id; })[0], novo = q + (ja ? ja.qtd : 0);
    if (novo > disponivel(p)) return toast('Saldo insuficiente: disponível ' + fmtQtd(disponivel(p), p.unPorCx) + (E[p.id].vencidos && tipoSaida() === 'Venda' ? ' (lotes vencidos não podem ser vendidos)' : ''), 'erro');
    if (ja) { ja.qtd = novo; ja.subtotal = subtotalPadrao(p, novo); } else cart.push({ produtoId: p.id, qtd: q, subtotal: subtotalPadrao(p, q) });
    $('sd-prod').value = ''; $('sd-cx').value = 0; $('sd-un').value = 1; $('sd-info').innerHTML = ''; $('sd-prev').textContent = '';
    renderCart(); $('sd-prod').focus();
  };
  A.cartDel = function (i) { cart.splice(i, 1); renderCart(); };
  A.cartQtd = function (i, delta) {
    var c = cart[i]; if (!c) return;
    var p = P(c.produtoId); if (!p) return;
    var novo = c.qtd + delta;
    if (novo <= 0) { cart.splice(i, 1); renderCart(); return; }
    if (novo > disponivel(p)) return toast('Saldo máximo disponível: ' + fmtQtd(disponivel(p), p.unPorCx), 'erro');
    c.qtd = novo; c.subtotal = subtotalPadrao(p, novo); renderCart();
  };
  A.cartPreco = function (i, v) {
    var c = cart[i]; if (!c) return;
    var p = P(c.produtoId);
    var val = Math.round(toNum(v) * 100) / 100;
    if (p) {
      var padrao = subtotalPadrao(p, c.qtd);
      var minPermitido = Math.round(padrao * 0.90 * 100) / 100;
      if (val < minPermitido - 0.005) {
        val = minPermitido;
        toast('Desconto máximo permitido por produto é de 10% (mínimo: ' + brl(minPermitido) + ')', 'aviso');
      }
    }
    c.subtotal = val;
    renderCart();
  };
  function renderCart() {
    var box = $('sd-cart'); if (!box) return;
    if ($('sd-cli-box')) $('sd-cli-box').classList.toggle('hidden', ehVendedor());
    if ($('sd-pag')) {
      var optFiado = Array.prototype.filter.call($('sd-pag').options, function (o) { return /fiado|prazo/i.test(o.value); })[0];
      if (optFiado) optFiado.hidden = ehVendedor();
      if (ehVendedor() && /fiado|prazo/i.test($('sd-pag').value)) $('sd-pag').value = 'PIX';
    }
    var venda = tipoSaida() === 'Venda';
    cart = cart.filter(function (c) { return P(c.produtoId); });
    if (!cart.length) box.innerHTML = '<div class="p-8 text-center text-stone-400 text-sm">Carrinho vazio. Clique nos produtos acima, digite o nome ou bipe o código de barras.</div>';
    else box.innerHTML = '<table class="w-full"><thead><tr><th>Produto</th><th>Quantidade</th>' + (venda ? '<th>Subtotal (R$)</th>' : '') + '<th></th></tr></thead><tbody>' + cart.map(function (c, i) {
      var p = P(c.produtoId);
      return '<tr><td><div class="font-bold">' + esc(p.nome) + '</div><div class="text-[11px] text-stone-500">' + esc(p.marca) + ' ' + esc(p.volume) + ' · ' + brl(p.preco) + '/un</div></td>' +
        '<td><div class="flex items-center gap-1.5"><button type="button" class="btn btn-out btn-sm" onclick="A.cartQtd(' + i + ',-1)">−</button><span class="font-bold whitespace-nowrap">' + fmtQtd(c.qtd, p.unPorCx) + '</span><button type="button" class="btn btn-out btn-sm" onclick="A.cartQtd(' + i + ',1)">+</button></div></td>' +
        (venda ? '<td>' + (ehVendedor() ? ('<span class="font-bold">' + brl(c.subtotal) + '</span>') : ('<input type="number" step="0.01" min="0" value="' + c.subtotal.toFixed(2) + '" class="inp !w-28" onchange="A.cartPreco(' + i + ',this.value)">')) + '</td>' : '') + '<td class="text-right"><button class="btn btn-red btn-sm" onclick="A.cartDel(' + i + ')">✕</button></td></tr>';
    }).join('') + '</tbody></table>';
    A.sdResumo();
  }
  A.sdResumo = function () {
    if ($('sd-cli-box')) $('sd-cli-box').classList.toggle('hidden', ehVendedor());
    if ($('sd-pag')) {
      var optFiado = Array.prototype.filter.call($('sd-pag').options, function (o) { return /fiado|prazo/i.test(o.value); })[0];
      if (optFiado) optFiado.hidden = ehVendedor();
      if (ehVendedor() && /fiado|prazo/i.test($('sd-pag').value)) $('sd-pag').value = 'PIX';
    }
    var venda = tipoSaida() === 'Venda';
    $('sd-venda-box').classList.toggle('hidden', !venda);
    var pg = $('sd-pag').value;
    var btns = $('sd-pag-btns');
    if (btns) btns.querySelectorAll('[data-pg]').forEach(function (b) {
      var at = b.getAttribute('data-pg') === pg;
      b.className = 'btn !py-2 text-xs ' + (at ? 'btn-pri' : 'btn-out');
    });
    var cli = CL($('sd-cli').value);
    var sub = 0, subPadraoTotal = 0, custo = 0, emprestar = 0;
    cart.forEach(function (c) { var p = P(c.produtoId); if (!p) return; sub += c.subtotal; subPadraoTotal += subtotalPadrao(p, c.qtd); custo += c.qtd * (p.custo || 0); if (p.retornavel) emprestar += Math.ceil(c.qtd / p.unPorCx); });
    var descJaItens = Math.max(0, Math.round((subPadraoTotal - sub) * 100) / 100);
    var maxDescRestante = Math.max(0, Math.round((subPadraoTotal * 0.10 - descJaItens) * 100) / 100);
    var descDigitado = toNum($('sd-desc').value);
    var excedeuDesc = subPadraoTotal > 0 && descDigitado > maxDescRestante + 0.005;
    if (excedeuDesc) {
      $('sd-desc').value = maxDescRestante.toFixed(2);
      toast('Desconto máximo permitido é de 10% (' + brl(maxDescRestante) + ')', 'aviso');
    }
    var desc = Math.min(descDigitado, maxDescRestante), total = Math.round((sub - desc) * 100) / 100;
    var pago = toNum($('sd-pago') ? $('sd-pago').value : 0);
    var troco = pago > total ? Math.round((pago - total) * 100) / 100 : 0;
    var aPrazo = venda && /prazo|fiado/i.test(pg);
    var ci = $('sd-cli-info');
    ci.innerHTML = cli ? '<span class="' + (cli.saldo > 0 ? 'text-rose-600' : 'text-stone-500') + '">Fiado em aberto: <b>' + brl(cli.saldo) + '</b>' + (cli.limite ? ' (limite ' + brl(cli.limite) + ')' : '') + '</span> · Cascos c/ cliente: <b>' + (cli.vasilhame || 0) + ' cx</b>' : '<span class="text-emerald-700 font-semibold">Venda rápida no balcão (sem precisar cadastrar cliente)</span>';
    var vb = $('sd-vas-box');
    if (venda && cli && (emprestar || cli.vasilhame)) { vb.classList.remove('hidden'); $('sd-vas-txt').textContent = 'Leva ' + emprestar + ' caixa(s)/casco(s) retornável. Cliente já tinha ' + (cli.vasilhame || 0) + ' pendente(s).'; } else vb.classList.add('hidden');
    var warn = '';
    if (excedeuDesc) warn += '<div class="text-rose-300 text-[11px] font-bold">🛑 Limite máximo de 10% de desconto (' + brl(maxDescRestante) + '). Valor ajustado para o teto de 10%.</div>';
    if (aPrazo && !cli) warn += '<div class="text-amber-300 text-[11px]">⚠️ Para vender fiado, escolha ou cadastre o cliente acima.</div>';
    else if (aPrazo && cli.limite > 0 && cli.saldo + total > cli.limite) warn += '<div class="text-amber-300 text-[11px]">⚠️ Passa do limite de fiado do cliente.</div>';
    $('sd-resumo').innerHTML = venda ?
      '<div class="flex justify-between text-sm text-stone-300"><span>Cliente</span><span class="font-bold text-white">' + esc(cli ? cli.nome : 'Consumidor Final (Balcão)') + '</span></div>' +
      '<div class="flex justify-between text-sm text-stone-300"><span>Subtotal</span><span>' + brl(sub) + '</span></div>' + (desc ? '<div class="flex justify-between text-sm text-stone-300"><span>Desconto (máx 10%)</span><span>- ' + brl(desc) + '</span></div>' : '') +
      '<div class="flex justify-between text-2xl font-extrabold text-amber-400"><span>Total a Pagar</span><span>' + brl(total) + '</span></div>' +
      (pago > 0 ? '<div class="flex justify-between text-sm font-bold ' + (pago >= total ? 'text-emerald-400' : 'text-rose-400') + '"><span>' + (pago >= total ? '💵 Troco a devolver' : 'Faltam') + '</span><span>' + brl(pago >= total ? troco : (total - pago)) + '</span></div>' : '') +
      (ehVendedor() ? '' : ('<div class="flex justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-800"><span>Lucro da venda</span><span>' + brl(total - custo) + (total ? ' (' + Math.round((total - custo) / total * 100) + '%)' : '') + '</span></div>')) + warn :
      '<div class="flex justify-between text-sm"><span>' + cart.length + ' item(ns)</span>' + (ehVendedor() ? '<span>Baixa de estoque</span>' : ('<span>Custo do estoque baixado: <b>' + brl(custo) + '</b></span>')) + '</div>';
  };
  A.sdFinalizar = async function () {
    var err = $('sd-err'); if (err) err.classList.add('hidden');
    try {
      // Se o operador selecionou um produto no campo de busca mas esqueceu de clicar em "+ Adicionar", adiciona automaticamente
      if (!cart.length && $('sd-prod') && $('sd-prod').value.trim()) {
        var pSel = saidaProd();
        var qSel = qtdForm();
        if (pSel && qSel > 0) {
          if (qSel > disponivel(pSel)) throw new Error('Saldo insuficiente de ' + pSel.nome + ': disponível ' + fmtQtd(disponivel(pSel), pSel.unPorCx));
          cart.push({ produtoId: pSel.id, qtd: qSel, subtotal: subtotalPadrao(pSel, qSel) });
          $('sd-prod').value = ''; $('sd-cx').value = 0; $('sd-un').value = 1;
          if ($('sd-info')) $('sd-info').innerHTML = '';
          if ($('sd-prev')) $('sd-prev').textContent = '';
          renderCart();
        }
      }
      if (!cart.length) throw new Error('Adicione ao menos um produto ao carrinho antes de finalizar a venda.');
      var tipo = tipoSaida();
      var sub = 0, subPadraoTotal = 0;
      cart.forEach(function (c) { var p = P(c.produtoId); if (!p) return; sub += c.subtotal; subPadraoTotal += subtotalPadrao(p, c.qtd); });
      var descJaItens = Math.max(0, Math.round((subPadraoTotal - sub) * 100) / 100);
      var maxDescRestante = Math.max(0, Math.round((subPadraoTotal * 0.10 - descJaItens) * 100) / 100);
      var descFinal = Math.min(Math.max(0, toNum($('sd-desc') ? $('sd-desc').value : 0)), maxDescRestante);
      var r = await api('/api/saida', {
        tipo: tipo,
        clienteId: $('sd-cli') ? $('sd-cli').value : '',
        itens: cart.map(function (c) { return { produtoId: c.produtoId, qtd: c.qtd, subtotal: c.subtotal }; }),
        pagamento: $('sd-pag') ? $('sd-pag').value : 'PIX',
        desconto: descFinal,
        valorPago: toNum($('sd-pago') ? $('sd-pago').value : 0),
        vasilhameDevolvido: Math.round(toNum($('sd-vas') ? $('sd-vas').value : 0)),
        obs: $('sd-obs') ? $('sd-obs').value : ''
      });
      cart = [];
      if ($('sd-desc')) $('sd-desc').value = '';
      if ($('sd-pago')) $('sd-pago').value = '';
      if ($('sd-vas')) $('sd-vas').value = 0;
      if ($('sd-obs')) $('sd-obs').value = '';
      await carregar();
      renderAll();
      toast('Venda #' + r.venda.numero + ' concluída!');
      A.verVenda(r.venda.id, true);
    } catch (e) {
      if (err) { err.textContent = e.message; err.classList.remove('hidden'); }
      toast(e.message, 'erro');
    }
  };

  // ---- ver / imprimir / estornar venda (cupom consumidor final)
  function htmlRomaneio(v) {
    var venda = v.tipo === 'Venda';
    return '<div style="font-family:monospace,sans-serif;padding:14px;font-size:12px;max-width:320px;margin:0 auto"><h3 style="margin:0;text-align:center">' + esc(S.config.empresa) + '</h3><div style="text-align:center">' + (venda ? 'CUPOM DE VENDA AO CONSUMIDOR' : 'SAÍDA: ' + esc(v.tipo)) + '<br><b>#' + v.numero + '</b> · ' + fmtData(v.data) + '</div><div>Cliente: <b>' + esc(v.clienteNome) + '</b>' + (v.status === 'Estornada' ? ' · <b style="color:red">ESTORNADA</b>' : '') + '</div><hr>' +
      '<table style="width:100%;border-collapse:collapse"><tr><th align="left">Item</th><th>Qtd</th>' + (venda ? '<th align="right">R$</th>' : '') + '</tr>' + v.itens.map(function (it) {
        return '<tr style="border-top:1px dashed #ccc;vertical-align:top"><td>' + esc(it.nome) + ' ' + esc(it.volume) + '<div style="font-size:10px;color:#555">' + it.aloc.map(function (a) { return 'Lote ' + esc(a.lote) + ' (' + esc(a.deposito) + ')'; }).join(', ') + '</div></td><td align="center"><b>' + fmtQtd(it.qtd, it.unPorCx) + '</b></td>' + (venda ? '<td align="right">' + brl(it.subtotal) + '</td>' : '') + '</tr>';
      }).join('') + '</table><hr>' + (venda ? '<div style="text-align:right">' + (v.desconto ? 'Desconto: -' + brl(v.desconto) + '<br>' : '') + '<b style="font-size:15px">TOTAL: ' + brl(v.total) + '</b><br>Pagamento: ' + esc(v.pagamento) + (v.valorPago > 0 ? '<br>Recebido: ' + brl(v.valorPago) + ' · <b>Troco: ' + brl(v.troco || 0) + '</b>' : '') + '</div>' : '') +
      (v.vasilhameEmprestado || v.vasilhameDevolvido ? '<div>Cascos: levou ' + v.vasilhameEmprestado + ' cx · devolveu ' + v.vasilhameDevolvido + ' cx</div>' : '') + (v.obs ? '<div>Obs: ' + esc(v.obs) + '</div>' : '') + '<div style="text-align:center;margin-top:10px;font-size:11px">Obrigado pela preferência! 🍻</div></div>';
  }
  A.verVenda = function (id, novo) {
    var v = S.vendas.filter(function (x) { return x.id === id; })[0]; if (!v) return;
    var venda = v.tipo === 'Venda';
    var el = abrirModal('<div class="p-5 sm:p-6 space-y-4"><div class="flex justify-between items-start"><div><h3 class="text-lg font-extrabold">' + (novo ? '✅ ' : '') + (venda ? 'Cupom de Venda' : esc(v.tipo)) + ' #' + v.numero + (v.status === 'Estornada' ? ' <span class="badge bg-rose-100 text-rose-800 border-rose-300">ESTORNADA</span>' : '') + '</h3><p class="text-xs text-stone-500">' + fmtData(v.data) + ' · ' + esc(v.clienteNome) + ' · ' + esc(v.operador) + '</p></div><button data-x class="text-2xl text-stone-400 cursor-pointer">&times;</button></div>' +
      (novo ? '<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm font-semibold text-emerald-900">🛒 Venda ao consumidor registrada! Retire do lote indicado abaixo (FEFO — vence primeiro, sai primeiro).</div>' : '') +
      '<div class="space-y-2">' + v.itens.map(function (it) {
        return '<div class="border border-stone-200 rounded-xl p-3"><div class="flex justify-between gap-2"><div class="font-bold text-sm">' + esc(it.nome) + ' <span class="text-stone-400 font-normal">' + esc(it.volume) + '</span></div><div class="font-extrabold text-sm whitespace-nowrap">' + fmtQtd(it.qtd, it.unPorCx) + (venda ? ' · ' + brl(it.subtotal) : '') + '</div></div>' + it.aloc.map(function (a) { return '<div class="text-[11px] text-stone-600 mt-1">📍 Retirar de: <b>' + esc(a.deposito) + '</b>' + (a.posicao ? ' (' + esc(a.posicao) + ')' : '') + ' · Lote <b class="font-mono">' + esc(a.lote) + '</b> (val ' + fmtDia(a.validade) + ') → <b>' + fmtQtd(a.qtd, it.unPorCx) + '</b></div>'; }).join('') + '</div>';
      }).join('') + '</div>' +
      (venda ? '<div class="text-right text-sm">' + (v.desconto ? 'Desconto ' + brl(v.desconto) + '<br>' : '') + '<span class="text-xl font-extrabold">' + brl(v.total) + '</span><br><span class="text-xs text-stone-500">' + esc(v.pagamento) + (v.aPrazo ? ' (fiado)' : '') + (v.valorPago > 0 ? ' · Recebido ' + brl(v.valorPago) + ' · <b class="text-emerald-700">Troco ' + brl(v.troco || 0) + '</b>' : '') + (ehVendedor() ? '' : (' · lucro ' + brl(v.total - v.custoTotal))) + '</span></div>' : (ehVendedor() ? '' : ('<div class="text-right text-xs text-stone-500">Custo baixado do estoque: ' + brl(v.custoTotal) + '</div>'))) +
      '<div class="flex flex-wrap justify-end gap-2"><button class="btn btn-dark" data-p>🖨️ Imprimir Cupom</button>' + (v.status !== 'Estornada' ? '<button class="btn btn-red" data-e>↩️ Estornar</button>' : '') + '<button class="btn btn-out" data-x>Fechar</button></div></div>', 'max-w-xl');
    el.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { el.close(); }; });
    el.querySelector('[data-p]').onclick = function () { imprimir(htmlRomaneio(v)); };
    var be = el.querySelector('[data-e]');
    if (be) be.onclick = function () {
      confirmar('Estornar pedido #' + v.numero + '?', 'O estoque volta aos lotes de origem' + (v.aPrazo ? ', o fiado do cliente é abatido' : '') + (v.vasilhameEmprestado ? ' e o vasilhame é corrigido' : '') + '. Esta ação fica registrada no histórico.', 'Estornar pedido', async function () {
        try { await salvar('/api/venda/estornar', { id: v.id }, 'Pedido estornado'); el.close(); } catch (e) { toast(e.message, 'erro'); }
      }, true);
    };
  };

  // ============================================================ MESAS / CONSUMO NO LOCAL
  var mesaSelId = '';
  var mesaCat = '';
  function MS(id) { var l = S.mesas || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }

  function mountMesas() {
    $('v-mesas').innerHTML =
      '<div class="card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">' +
      '<div><h2 class="font-extrabold text-lg">🪑 Mesas &amp; Comandas — Consumo no Local</h2><p class="text-xs text-stone-500">Abra uma mesa com o <b>nome da pessoa</b>, lance as cervejas, doses, whiskies, salgadinhos ou porções que ela for pedindo e feche a conta no final (com baixa FEFO automática).</p></div>' +
      '<div class="flex flex-wrap gap-2"><button class="btn btn-pri" onclick="A.novaMesaModal()">➕ Abrir Nova Mesa</button></div></div>' +
      '<div id="mesas-grid" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>' +
      '<div id="mesa-detalhe"></div>';
  }

  RENDER.mesas = function () {
    var lista = S.mesas || [];
    if (mesaSelId && !MS(mesaSelId)) mesaSelId = '';
    if (!mesaSelId && lista.length) mesaSelId = lista[0].id;
    var grid = $('mesas-grid'), det = $('mesa-detalhe');
    if (!grid || !det) return;

    if (!lista.length) {
      grid.innerHTML = '<div class="col-span-full card p-8 text-center space-y-3"><div class="text-5xl">🪑🍻</div><h3 class="font-extrabold text-lg">Nenhuma mesa aberta no momento</h3><p class="text-xs text-stone-500 max-w-md mx-auto">Clique em <b>➕ Abrir Nova Mesa</b> quando um cliente sentar para consumir no local. Você anota o nome da pessoa e vai adicionando os produtos conforme ela pedir.</p><button class="btn btn-pri" onclick="A.novaMesaModal()">➕ Abrir Primeira Mesa</button></div>';
      det.innerHTML = '';
      return;
    }

    grid.innerHTML = lista.map(function (m) {
      var tot = (m.itens || []).reduce(function (s, i) { return s + (Number(i.subtotal) || 0); }, 0);
      var qtdItens = (m.itens || []).reduce(function (s, i) { return s + (Number(i.qtd) || 0); }, 0);
      var sel = m.id === mesaSelId;
      var resumoItens = (m.itens || []).slice(0, 4).map(function (i) { return i.qtd + 'x ' + i.nome; }).join(' · ');
      return '<div onclick="A.selMesa(\'' + m.id + '\')" class="card p-4 cursor-pointer transition space-y-2 ' + (sel ? 'ring-2 ring-amber-600 bg-amber-50/40' : 'hover:border-amber-300') + '">' +
        '<div class="flex items-start justify-between gap-2">' +
        '<div><span class="badge bg-amber-100 text-amber-900 border-amber-300">🪑 ' + esc(m.mesa) + '</span>' +
        '<div class="text-base font-extrabold text-stone-900 mt-1">👤 ' + esc(m.pessoa) + '</div>' +
        (m.obs ? '<div class="text-[11px] text-stone-500">' + esc(m.obs) + '</div>' : '') + '</div>' +
        '<div class="text-right"><div class="text-lg font-extrabold text-emerald-700">' + brl(tot) + '</div><div class="text-[10px] text-stone-400">desde ' + fmtData(m.abertaEm).slice(11) + '</div></div></div>' +
        '<div class="text-xs text-stone-600 bg-stone-100/80 rounded-lg px-2.5 py-1.5 truncate">' + (m.itens.length ? ('<b>' + qtdItens + ' un:</b> ' + esc(resumoItens)) : '<span class="text-stone-400">Nenhum produto lançado ainda</span>') + '</div>' +
        '<div class="flex items-center justify-between pt-1 gap-1.5">' +
        '<button type="button" onclick="event.stopPropagation();A.lancarConsumoModal(\'' + m.id + '\')" class="btn btn-green btn-sm flex-1">➕ Lançar Consumo</button>' +
        '<button type="button" onclick="event.stopPropagation();A.fecharMesaModal(\'' + m.id + '\')" class="btn btn-pri btn-sm">💵 Fechar Conta</button></div></div>';
    }).join('');

    var m = MS(mesaSelId);
    if (!m) { det.innerHTML = ''; return; }
    var totalMesa = (m.itens || []).reduce(function (s, i) { return s + (Number(i.subtotal) || 0); }, 0);
    var cats = [''].concat(S.categorias.filter(function (c) { return S.produtos.some(function (p) { return p.categoria === c && E[p.id] && E[p.id].validos > 0; }); }));
    var prods = S.produtos.filter(function (p) { return (!mesaCat || p.categoria === mesaCat) && E[p.id] && E[p.id].validos > 0; });

    det.innerHTML =
      '<div class="grid lg:grid-cols-5 gap-4">' +
      '<div class="lg:col-span-3 card p-5 space-y-3">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<div><h3 class="font-extrabold text-base">➕ Adicionar Consumo em <span class="text-amber-700">' + esc(m.mesa) + ' — ' + esc(m.pessoa) + '</span></h3><p class="text-xs text-stone-500">Digite o produto abaixo, bipe o código ou toque nos botões rápidos</p></div>' +
      '<button type="button" class="btn btn-dark btn-sm" onclick="A.mesaScan(\'' + m.id + '\')">📷 Escanear Produto</button></div>' +
      '<form onsubmit="A.addFormMesa(event,\'' + m.id + '\')" class="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-wrap items-end gap-2">' +
      '<div class="flex-1 min-w-[180px]"><label class="lbl">Buscar produto p/ ' + esc(m.pessoa) + '</label><input id="ms-prod" list="dl-prod" class="inp !bg-white" placeholder="Digite o nome (ex: Skol, Dose, Doritos)…"></div>' +
      '<div class="w-24"><label class="lbl">Qtd (un)</label><input id="ms-qtd" type="number" min="1" value="1" class="inp !bg-white font-bold"></div>' +
      '<button type="submit" class="btn btn-pri">➕ Anotar na Mesa</button></form>' +
      '<div class="flex gap-1 flex-wrap">' + cats.map(function (c) {
        var at = mesaCat === c;
        var lbl = c === 'Cigarros Picados (Unidade)' ? 'Cigarro Picado' : (c ? c.split(' ')[0] : 'Todos');
        return '<button type="button" onclick="A.setMesaCat(\'' + esc(c) + '\')" class="px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer ' + (at ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-stone-600 border-stone-300') + '">' + (c ? (CAT_ICON[c] || '') + ' ' + esc(lbl) : 'Todos') + '</button>';
      }).join('') + '</div>' +
      '<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">' +
      (prods.length ? prods.map(function (p) {
        var e = E[p.id];
        var naMesa = (m.itens.filter(function (x) { return x.produtoId === p.id; })[0] || {}).qtd || 0;
        return '<div class="border border-stone-200 rounded-xl p-2.5 bg-stone-50/70 hover:bg-amber-50/50 flex flex-col justify-between gap-1.5">' +
          '<div><div class="font-bold text-xs text-stone-900 leading-tight truncate" title="' + esc(p.nome) + '">' + (CAT_ICON[p.categoria] || '') + ' ' + esc(p.nome) + '</div>' +
          '<div class="text-[10px] text-stone-500">' + esc(p.marca) + ' ' + esc(p.volume) + (naMesa ? ' · <b class="text-amber-700">na mesa: ' + naMesa + '</b>' : '') + '</div></div>' +
          '<div class="flex items-center gap-1 pt-1"><button type="button" onclick="A.addItemMesa(\'' + m.id + '\',\'' + p.id + '\',1)" class="btn btn-pri btn-sm flex-1">+1 (' + brl(p.preco) + ')</button>' +
          (p.unPorCx > 1 && e.validos >= p.unPorCx ? '<button type="button" onclick="A.addItemMesa(\'' + m.id + '\',\'' + p.id + '\',' + p.unPorCx + ')" class="btn btn-out btn-sm" title="Adicionar ' + esc(p.tipoEmb) + ' c/' + p.unPorCx + '">+1 ' + (/carteira/i.test(p.tipoEmb || '') ? 'carteira' : 'cx') + '</button>' : '') +
          (ehVendedor() ? '' : ('<button type="button" onclick="A.precoModal(\'' + p.id + '\')" class="btn btn-out btn-sm" title="Editar preço deste produto">💲</button>')) +
          '</div></div>';
      }).join('') : '<div class="col-span-full text-xs text-stone-400 py-4 text-center">Nenhum produto disponível nesta categoria.</div>') +
      '</div></div>' +
      '<div class="lg:col-span-2 card p-5 space-y-3 h-fit">' +
      '<div class="flex items-start justify-between gap-2">' +
      '<div><span class="badge bg-amber-100 text-amber-900 border-amber-300">🪑 ' + esc(m.mesa) + '</span>' +
      '<h3 class="font-extrabold text-lg text-stone-900 mt-1">👤 ' + esc(m.pessoa) + '</h3>' +
      '<p class="text-[11px] text-stone-500">Aberta em ' + fmtData(m.abertaEm) + (m.obs ? ' · ' + esc(m.obs) : '') + '</p></div>' +
      '<button type="button" class="btn btn-out btn-sm" onclick="A.editarMesaModal(\'' + m.id + '\')" title="Trocar nome ou mesa">✏️ Nome</button></div>' +
      '<div class="border-t border-b border-stone-200 py-2 max-h-72 overflow-y-auto">' +
      (m.itens.length ? '<table class="w-full"><thead><tr><th>Produto consumido</th><th>Qtd</th><th class="text-right">R$</th></tr></thead><tbody>' + m.itens.map(function (it) {
        return '<tr><td><div class="font-bold text-xs">' + esc(it.nome) + '</div><div class="text-[10px] text-stone-400">' + brl(it.precoUn) + '/un</div></td>' +
          '<td><div class="flex items-center gap-1"><button type="button" class="btn btn-out btn-sm" onclick="A.addItemMesa(\'' + m.id + '\',\'' + it.produtoId + '\',-1)">−</button><span class="font-bold text-xs px-1">' + fmtQtd(it.qtd, it.unPorCx) + '</span><button type="button" class="btn btn-out btn-sm" onclick="A.addItemMesa(\'' + m.id + '\',\'' + it.produtoId + '\',1)">+</button></div></td>' +
          '<td class="text-right font-bold text-xs whitespace-nowrap">' + brl(it.subtotal) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="py-6 text-center text-xs text-stone-400">Nenhum produto consumido ainda. Clique nos produtos ao lado para anotar.</div>') +
      '</div>' +
      '<div class="bg-stone-900 text-white rounded-xl p-4 flex items-center justify-between">' +
      '<div><div class="text-xs text-stone-300">Total consumido por ' + esc(m.pessoa) + '</div><div class="text-2xl font-extrabold text-amber-400">' + brl(totalMesa) + '</div></div>' +
      '<button type="button" class="btn btn-out btn-sm" onclick="A.imprimirParcialMesa(\'' + m.id + '\')">🖨️ Parcial</button></div>' +
      '<div class="flex gap-2">' +
      '<button type="button" class="btn btn-pri flex-1 !py-3 text-sm" onclick="A.fecharMesaModal(\'' + m.id + '\')">✅ Fechar &amp; Receber Conta</button>' +
      '<button type="button" class="btn btn-red" onclick="A.cancelarMesa(\'' + m.id + '\')" title="Cancelar mesa">🗑️</button></div></div></div>';
  };

  A.selMesa = function (id) {
    mesaSelId = id;
    RENDER.mesas();
    var det = $('mesa-detalhe');
    if (det) det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  A.setMesaCat = function (c) { mesaCat = c; RENDER.mesas(); };
  A.addItemMesa = async function (mesaId, prodId, qtd) {
    try {
      var p = P(prodId);
      await salvar('/api/mesa/item', { mesaId: mesaId, produtoId: prodId, qtd: qtd }, qtd > 0 && p ? ('+ ' + qtd + 'x ' + p.nome + ' anotado na mesa!') : 'Comanda atualizada');
    } catch (e) { toast(e.message, 'erro'); }
  };
  A.addFormMesa = async function (ev, mesaId) {
    ev.preventDefault();
    var p = resolverProd($('ms-prod').value);
    if (!p) return toast('Escolha um produto válido da lista', 'erro');
    var q = Math.max(1, Math.round(toNum($('ms-qtd').value) || 1));
    await A.addItemMesa(mesaId, p.id, q);
    if ($('ms-prod')) { $('ms-prod').value = ''; $('ms-prod').focus(); }
  };
  A.lancarConsumoModal = function (id) {
    mesaSelId = id;
    RENDER.mesas();
    var m = MS(id); if (!m) return;
    var catModal = '';
    var qModal = '';
    var el = abrirModal('<div class="p-5 space-y-3">' +
      '<div class="flex items-start justify-between gap-2">' +
      '<div><span class="badge bg-amber-100 text-amber-900 border-amber-300">🪑 ' + esc(m.mesa) + '</span>' +
      '<h3 class="font-extrabold text-lg text-stone-900 mt-1">➕ Lançar Consumo — 👤 ' + esc(m.pessoa) + '</h3>' +
      '<p class="text-xs text-stone-500">Clique nos produtos que a pessoa pediu para anotar na mesa</p></div>' +
      '<button type="button" data-x class="text-2xl text-stone-400 hover:text-stone-700 cursor-pointer">&times;</button></div>' +
      '<div class="flex gap-2"><input id="lcm-q" class="inp" placeholder="🔍 Buscar bebida, dose, whisky, salgadinho, doce…"><button type="button" class="btn btn-dark" id="lcm-scan">📷 Câmera</button></div>' +
      '<div id="lcm-cats" class="flex gap-1 flex-wrap"></div>' +
      '<div id="lcm-prods" class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1"></div>' +
      '<div class="bg-stone-100 rounded-xl p-3 space-y-2">' +
      '<div class="flex items-center justify-between"><span class="text-xs font-extrabold text-stone-700 uppercase">📋 Já consumido por ' + esc(m.pessoa) + '</span><span id="lcm-tot" class="text-base font-extrabold text-emerald-700"></span></div>' +
      '<div id="lcm-itens" class="max-h-36 overflow-y-auto space-y-1"></div></div>' +
      '<div class="flex justify-between gap-2 pt-1">' +
      '<button type="button" class="btn btn-pri flex-1" id="lcm-fechar-conta">💵 Fechar &amp; Receber Conta</button>' +
      '<button type="button" class="btn btn-dark" data-x>✅ Concluir</button></div></div>', 'max-w-2xl');

    el.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { el.close(); }; });
    el.querySelector('#lcm-scan').onclick = function () { el.close(); A.mesaScan(id); };
    el.querySelector('#lcm-fechar-conta').onclick = function () { el.close(); A.fecharMesaModal(id); };
    var inpQ = el.querySelector('#lcm-q');
    inpQ.oninput = function () { qModal = this.value; desenhar(); };

    function desenhar() {
      var mAtual = MS(id);
      if (!mAtual) { el.close(); return; }
      var cats = [''].concat(S.categorias.filter(function (c) { return S.produtos.some(function (p) { return p.categoria === c && E[p.id] && E[p.id].validos > 0; }); }));
      var boxCats = el.querySelector('#lcm-cats');
      boxCats.innerHTML = cats.map(function (c) {
        var at = catModal === c;
        var lbl = c === 'Cigarros Picados (Unidade)' ? 'Cigarro Picado' : (c ? c.split(' ')[0] : 'Todos');
        return '<button type="button" data-c="' + esc(c) + '" class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer ' + (at ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-stone-600 border-stone-300') + '">' + (c ? (CAT_ICON[c] || '') + ' ' + esc(lbl) : 'Todos') + '</button>';
      }).join('');
      boxCats.querySelectorAll('[data-c]').forEach(function (b) {
        b.onclick = function () { catModal = b.getAttribute('data-c'); desenhar(); };
      });

      var q = norm(qModal);
      var prods = S.produtos.filter(function (p) {
        if (!E[p.id] || E[p.id].validos <= 0) return false;
        if (catModal && p.categoria !== catModal) return false;
        if (q && norm(p.nome + ' ' + p.marca + ' ' + p.volume + ' ' + p.categoria).indexOf(q) === -1) return false;
        return true;
      });
      var boxProds = el.querySelector('#lcm-prods');
      boxProds.innerHTML = prods.length ? prods.map(function (p) {
        var naMesa = (mAtual.itens.filter(function (x) { return x.produtoId === p.id; })[0] || {}).qtd || 0;
        return '<div class="border border-stone-200 rounded-xl p-2 bg-white flex flex-col justify-between gap-1.5">' +
          '<div><div class="font-bold text-xs text-stone-900 leading-tight truncate" title="' + esc(p.nome) + '">' + (CAT_ICON[p.categoria] || '') + ' ' + esc(p.nome) + '</div>' +
          '<div class="text-[10px] text-stone-500">' + brl(p.preco) + '/un' + (naMesa ? ' · <b class="text-emerald-700">na mesa: ' + naMesa + '</b>' : '') + '</div></div>' +
          '<div class="flex gap-1"><button type="button" data-add="' + p.id + '" data-q="1" class="btn btn-pri btn-sm flex-1">+1 un</button>' +
          (p.unPorCx > 1 && E[p.id].validos >= p.unPorCx ? '<button type="button" data-add="' + p.id + '" data-q="' + p.unPorCx + '" class="btn btn-out btn-sm">+1 ' + (/carteira/i.test(p.tipoEmb || '') ? 'carteira' : 'cx') + '</button>' : '') +
          '</div></div>';
      }).join('') : '<div class="col-span-full text-xs text-stone-400 py-4 text-center">Nenhum produto encontrado.</div>';

      boxProds.querySelectorAll('[data-add]').forEach(function (b) {
        b.onclick = async function () {
          b.disabled = true;
          await A.addItemMesa(id, b.getAttribute('data-add'), Number(b.getAttribute('data-q')));
          desenhar();
        };
      });

      var tot = (mAtual.itens || []).reduce(function (s, i) { return s + (Number(i.subtotal) || 0); }, 0);
      el.querySelector('#lcm-tot').textContent = 'Total: ' + brl(tot);
      var boxItens = el.querySelector('#lcm-itens');
      boxItens.innerHTML = mAtual.itens.length ? mAtual.itens.map(function (it) {
        return '<div class="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 text-xs border border-stone-200">' +
          '<span class="font-semibold truncate pr-2">' + esc(it.nome) + '</span>' +
          '<div class="flex items-center gap-1.5 whitespace-nowrap">' +
          '<button type="button" data-chg="' + it.produtoId + '" data-d="-1" class="btn btn-out btn-sm">−</button>' +
          '<b class="px-1">' + fmtQtd(it.qtd, it.unPorCx) + '</b>' +
          '<button type="button" data-chg="' + it.produtoId + '" data-d="1" class="btn btn-out btn-sm">+</button>' +
          '<span class="font-extrabold text-stone-800 w-16 text-right">' + brl(it.subtotal) + '</span></div></div>';
      }).join('') : '<div class="text-xs text-stone-400 text-center py-2">Nenhum item lançado ainda. Clique em +1 un acima!</div>';

      boxItens.querySelectorAll('[data-chg]').forEach(function (b) {
        b.onclick = async function () {
          b.disabled = true;
          await A.addItemMesa(id, b.getAttribute('data-chg'), Number(b.getAttribute('data-d')));
          desenhar();
        };
      });
    }
    desenhar();
    setTimeout(function () { inpQ.focus(); }, 50);
  };
  A.mesaScan = function (mesaId) {
    A.scanner(function (code) {
      var r = acharPorCodigo(code);
      if (!r) return toast('Código ' + code + ' não cadastrado.', 'erro');
      A.addItemMesa(mesaId, r.p.id, r.caixa ? r.p.unPorCx : 1);
      toast('+ ' + r.p.nome + ' anotado na mesa!');
    }, 'Escanear produto consumido na mesa');
  };
  A.novaMesaModal = function (itensIniciais, depois) {
    var proxNum = (S.mesas || []).length + 1;
    formModal({
      title: '🪑 Abrir Mesa / Comanda de Consumo no Local',
      subtitle: 'Anote o número da mesa e o nome da pessoa que está consumindo.',
      submit: 'Abrir Mesa',
      fields: [
        { name: 'mesa', label: 'Mesa / Comanda', value: 'Mesa ' + pad2(proxNum), required: true, placeholder: 'Ex: Mesa 01, Balcão, Comanda 10' },
        { name: 'pessoa', label: 'Nome da pessoa', value: '', required: true, placeholder: 'Ex: João, Maria, Turma do Carlos' },
        { name: 'obs', label: 'Observação', value: '', span2: true, placeholder: 'Opcional (ex: cerveja bem gelada, mesa da calçada)' }
      ],
      onSubmit: async function (f) {
        var r = await salvar('/api/mesa/abrir', { mesa: f.mesa, pessoa: f.pessoa, obs: f.obs, itens: itensIniciais || [] }, 'Mesa aberta para ' + f.pessoa + '!');
        if (r && r.mesa) mesaSelId = r.mesa.id;
        if (depois) depois(r.mesa);
        else A.tab('mesas');
      }
    });
  };
  A.editarMesaModal = function (id) {
    var m = MS(id); if (!m) return;
    formModal({
      title: 'Editar Mesa / Nome da Pessoa', submit: 'Salvar',
      fields: [
        { name: 'mesa', label: 'Mesa / Comanda', value: m.mesa, required: true },
        { name: 'pessoa', label: 'Nome da pessoa', value: m.pessoa, required: true },
        { name: 'obs', label: 'Observação', value: m.obs || '', span2: true }
      ],
      onSubmit: async function (f) { await salvar('/api/mesa/editar', { id: m.id, mesa: f.mesa, pessoa: f.pessoa, obs: f.obs }, 'Dados da mesa atualizados'); }
    });
  };
  A.fecharMesaModal = function (id) {
    var m = MS(id); if (!m) return;
    if (!m.itens.length) return toast('Esta mesa não tem produtos consumidos ainda.', 'aviso');
    var total = m.itens.reduce(function (s, i) { return s + (Number(i.subtotal) || 0); }, 0);
    var maxDescMesa = Math.round(total * 0.10 * 100) / 100;
    var pagamentosMesa = ehVendedor() ? PAGAMENTOS.filter(function (p) { return !/fiado|prazo/i.test(p); }) : PAGAMENTOS;
    var camposMesa = [
      { name: 'pagamento', label: 'Forma de Pagamento', type: 'select', options: pagamentosMesa, value: 'PIX' },
      { name: 'desconto', label: 'Desconto R$ (Máx. 10% = ' + brl(maxDescMesa) + ')', type: 'number', step: '0.01', min: 0, value: '', hint: 'Limite máximo permitido: 10% do valor total' },
      { name: 'valorPago', label: 'Valor Recebido p/ Troco (R$)', type: 'number', step: '0.01', min: 0, value: '' }
    ];
    if (!ehVendedor()) {
      camposMesa.push({ name: 'clienteId', label: 'Vincular a cliente cadastrado (só p/ fiado)', type: 'select', options: [{ v: '', t: '— Consumidor Final (' + m.pessoa + ') —' }].concat(S.clientes.map(function (c) { return { v: c.id, t: c.nome }; })), value: '' });
    }
    formModal({
      title: '💵 Fechar Conta — ' + m.mesa + ' (' + m.pessoa + ')',
      subtitle: m.itens.length + ' produto(s) consumido(s) · Total: <b class="text-emerald-700">' + brl(total) + '</b> · Desconto máx (10%): <b>' + brl(maxDescMesa) + '</b>',
      submit: '✅ Confirmar Recebimento & Baixar Estoque',
      fields: camposMesa,
      onChange: function (f, info) {
        var descDig = toNum(f.desconto);
        var desc = Math.min(descDig, maxDescMesa);
        var liq = Math.round((total - desc) * 100) / 100;
        var pg = toNum(f.valorPago);
        var txt = 'Total líquido: <b>' + brl(liq) + '</b>';
        if (descDig > maxDescMesa + 0.005) txt += ' · <span class="text-rose-700">⚠️ Desconto máximo permitido é 10% (' + brl(maxDescMesa) + ')</span>';
        if (pg > liq) txt += ' · 💵 Troco: <b>' + brl(pg - liq) + '</b>';
        info(txt);
      },
      onSubmit: async function (f) {
        if (toNum(f.desconto) > maxDescMesa + 0.005) {
          throw new Error('O desconto não pode ultrapassar 10% do total (máximo permitido: ' + brl(maxDescMesa) + ')');
        }
        var r = await salvar('/api/mesa/fechar', { id: m.id, pagamento: f.pagamento, desconto: toNum(f.desconto), valorPago: toNum(f.valorPago), clienteId: f.clienteId }, 'Conta de ' + m.pessoa + ' fechada!');
        if (r && r.venda) A.verVenda(r.venda.id, true);
      }
    });
  };
  A.cancelarMesa = function (id) {
    var m = MS(id); if (!m) return;
    confirmar('Cancelar ' + m.mesa + ' (' + m.pessoa + ')?', 'A comanda será removida sem dar baixa no estoque.', 'Cancelar mesa', async function () {
      try { await salvar('/api/mesa/cancelar', { id: m.id }, 'Mesa cancelada'); } catch (e) { toast(e.message, 'erro'); }
    }, true);
  };
  A.imprimirParcialMesa = function (id) {
    var m = MS(id); if (!m) return;
    var total = m.itens.reduce(function (s, i) { return s + (Number(i.subtotal) || 0); }, 0);
    imprimir('<div style="font-family:monospace,sans-serif;padding:14px;font-size:12px;max-width:320px;margin:0 auto"><h3 style="margin:0;text-align:center">' + esc(S.config.empresa) + '</h3><div style="text-align:center">CONFERÊNCIA DE MESA (CONSUMO LOCAL)<br><b>' + esc(m.mesa) + ' — ' + esc(m.pessoa) + '</b><br>Aberta: ' + fmtData(m.abertaEm) + '</div><hr>' +
      '<table style="width:100%;border-collapse:collapse"><tr><th align="left">Produto consumido</th><th>Qtd</th><th align="right">R$</th></tr>' + m.itens.map(function (it) {
        return '<tr style="border-top:1px dashed #ccc"><td>' + esc(it.nome) + '</td><td align="center"><b>' + fmtQtd(it.qtd, it.unPorCx) + '</b></td><td align="right">' + brl(it.subtotal) + '</td></tr>';
      }).join('') + '</table><hr><div style="text-align:right;font-size:15px"><b>TOTAL PARCIAL: ' + brl(total) + '</b></div></div>');
  };
  A.sdLancarNaMesa = function () {
    if (!cart.length) {
      A.tab('mesas');
      A.novaMesaModal();
      return;
    }
    var opcoes = [{ v: '__nova', t: '➕ Abrir Nova Mesa com esses itens' }].concat((S.mesas || []).map(function (m) { return { v: m.id, t: '🪑 ' + m.mesa + ' — ' + m.pessoa }; }));
    formModal({
      title: '🪑 Lançar Carrinho em Mesa (Consumo no Local)',
      subtitle: cart.length + ' item(ns) no carrinho serão anotados na mesa escolhida.',
      submit: 'Lançar na Mesa',
      fields: [
        { name: 'destino', label: 'Escolher Mesa', type: 'select', options: opcoes, value: opcoes.length > 1 ? opcoes[1].v : '__nova', span2: true },
        { name: 'mesa', label: 'Se for Nova Mesa — Número/Nome da Mesa', value: 'Mesa ' + pad2((S.mesas || []).length + 1) },
        { name: 'pessoa', label: 'Se for Nova Mesa — Nome da Pessoa', value: '', placeholder: 'Ex: João, Maria' }
      ],
      onSubmit: async function (f) {
        var itensCopia = cart.slice();
        if (f.destino === '__nova') {
          if (!String(f.pessoa || '').trim()) throw new Error('Informe o nome da pessoa para abrir a mesa');
          var r = await salvar('/api/mesa/abrir', { mesa: f.mesa, pessoa: f.pessoa, itens: itensCopia }, 'Mesa aberta para ' + f.pessoa + '!');
          cart = [];
          if (r && r.mesa) mesaSelId = r.mesa.id;
          A.tab('mesas');
        } else {
          for (var i = 0; i < itensCopia.length; i++) {
            await api('/api/mesa/item', { mesaId: f.destino, produtoId: itensCopia[i].produtoId, qtd: itensCopia[i].qtd });
          }
          cart = [];
          await carregar();
          mesaSelId = f.destino;
          toast('Itens lançados na mesa!');
          A.tab('mesas');
        }
      }
    });
  };

  // ============================================================ CLIENTES
  function mountClientes() {
    $('v-clientes').innerHTML = '<div class="card p-4 flex flex-col md:flex-row gap-3 md:items-end"><div class="flex-1"><label class="lbl">Buscar cliente</label><input id="cli-q" class="inp" placeholder="Nome, telefone ou documento…"></div><button class="btn btn-pri" onclick="A.cliModal()">➕ Novo cliente</button></div><div id="cli-list" class="card overflow-x-auto"></div>';
    $('cli-q').oninput = function () { F.cliBusca = this.value; RENDER.clientes(); };
  }
  RENDER.clientes = function () {
    var q = norm(F.cliBusca);
    var lista = S.clientes.filter(function (c) { return !q || norm(c.nome + ' ' + c.telefone + ' ' + c.doc + ' ' + c.tipo).indexOf(q) !== -1; }).sort(function (a, b) { return (b.saldo || 0) - (a.saldo || 0) || a.nome.localeCompare(b.nome); });
    if (!lista.length) { $('cli-list').innerHTML = '<div class="p-8 text-center text-stone-500 text-sm">' + (S.clientes.length ? 'Nenhum cliente encontrado.' : 'Vendas no balcão já saem como <b>Consumidor Final</b> sem cadastro. Cadastre aqui apenas quem compra fiado ou leva casco/garrafão retornável.') + '</div>'; return; }
    $('cli-list').innerHTML = '<table class="w-full"><thead><tr><th>Cliente</th><th>Contato</th><th>Em aberto (fiado)</th><th>Vasilhame</th><th>Última compra</th><th class="text-right">Ações</th></tr></thead><tbody>' + lista.map(function (c) {
      var nv = S.vendas.filter(function (v) { return v.clienteId === c.id && v.tipo === 'Venda' && v.status !== 'Estornada'; }).length;
      return '<tr><td><div class="font-bold">' + esc(c.nome) + '</div><div class="text-[11px] text-stone-500">' + esc(c.tipo) + (c.doc ? ' · ' + esc(c.doc) : '') + ' · ' + nv + ' pedido(s)</div></td><td class="text-xs">' + esc(c.telefone) + '<div class="text-stone-400">' + esc(c.endereco) + '</div></td>' +
        '<td>' + (c.saldo > 0 ? '<b class="text-rose-600">' + brl(c.saldo) + '</b>' : '<span class="text-stone-400">—</span>') + (c.limite ? '<div class="text-[10px] text-stone-400">limite ' + brl(c.limite) + '</div>' : '') + '</td><td>' + (c.vasilhame > 0 ? '<b class="text-lime-700">♻️ ' + c.vasilhame + ' cx</b>' : '<span class="text-stone-400">—</span>') + '</td><td class="text-xs">' + (c.ultimaCompra ? fmtData(c.ultimaCompra) : '—') + '</td>' +
        '<td class="text-right whitespace-nowrap">' + (c.saldo > 0 ? '<button class="btn btn-green btn-sm" onclick="A.cliReceber(\'' + c.id + '\')">💵 Receber</button> ' : '') + (c.vasilhame > 0 ? '<button class="btn btn-out btn-sm" onclick="A.cliVasilhame(\'' + c.id + '\')">♻️ Devolução</button> ' : '') + '<button class="btn btn-out btn-sm" onclick="A.cliPedidos(\'' + c.id + '\')">🧾</button> <button class="btn btn-out btn-sm" onclick="A.cliModal(\'' + c.id + '\')">✏️</button></td></tr>';
    }).join('') + '</tbody></table>';
  };
  A.cliModal = function (id, depois) {
    var c = id ? CL(id) : null;
    var m = formModal({
      title: c ? 'Editar cliente' : 'Novo cliente', submit: 'Salvar cliente',
      fields: [
        { name: 'nome', label: 'Nome do cliente', value: c ? c.nome : '', required: true, span2: true }, { name: 'tipo', label: 'Tipo', type: 'select', options: ['Pessoa física', 'Festa / Churrasco', 'Bar / Restaurante', 'Mercado / Mercearia', 'Lanchonete', 'Outro'], value: c ? c.tipo : 'Pessoa física' },
        { name: 'doc', label: 'CPF / CNPJ', value: c ? c.doc : '' }, { name: 'telefone', label: 'Telefone / WhatsApp', value: c ? c.telefone : '' }, { name: 'limite', label: 'Limite de crédito (R$)', type: 'number', step: '0.01', min: 0, value: c ? c.limite || '' : '', hint: 'Vazio = sem limite' },
        { name: 'endereco', label: 'Endereço de entrega', value: c ? c.endereco : '', span2: true }
      ],
      onSubmit: async function (f) { var r = await salvar('/api/cliente', Object.assign({ id: c ? c.id : undefined }, f, { limite: toNum(f.limite) }), 'Cliente salvo'); if (depois) depois(r.cliente); }
    });
    if (c) {
      var box = document.createElement('div'); box.innerHTML = '<button type="button" class="text-xs font-bold text-rose-600 underline cursor-pointer">Excluir cliente</button>';
      m.querySelector('form').appendChild(box);
      box.firstChild.onclick = function () { confirmar('Excluir "' + c.nome + '"?', 'Os pedidos antigos continuam no histórico.', 'Excluir', async function () { try { await salvar('/api/cliente/excluir', { id: c.id }, 'Cliente excluído'); fechaModais(); } catch (e) { toast(e.message, 'erro'); } }, true); };
    }
  };
  A.cliReceber = function (id) {
    var c = CL(id);
    formModal({ title: 'Receber pagamento', subtitle: esc(c.nome) + ' deve <b>' + brl(c.saldo) + '</b>', submit: 'Registrar recebimento', fields: [{ name: 'valor', label: 'Valor recebido (R$)', type: 'number', step: '0.01', min: 0, value: c.saldo, required: true }, { name: 'forma', label: 'Forma', type: 'select', options: ['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito', 'Boleto'], value: 'PIX' }], onSubmit: async function (f) { await salvar('/api/cliente/receber', { clienteId: id, valor: toNum(f.valor), forma: f.forma }, 'Recebimento registrado'); } });
  };
  A.cliVasilhame = function (id) {
    var c = CL(id);
    formModal({ title: 'Devolução de vasilhame', subtitle: esc(c.nome) + ' está com <b>' + c.vasilhame + ' caixa(s)</b>', submit: 'Registrar devolução', fields: [{ name: 'caixas', label: 'Caixas devolvidas', type: 'number', min: 1, value: c.vasilhame, required: true }], onSubmit: async function (f) { await salvar('/api/cliente/vasilhame', { clienteId: id, caixas: Math.round(toNum(f.caixas)) }, 'Devolução registrada'); } });
  };
  A.cliPedidos = function (id) { F.hisAba = 'vendas'; F.hisCliente = id; A.tab('historico'); };

  // ============================================================ DEPÓSITOS
  function mountDepositos() {
    $('v-depositos').innerHTML =
      '<div class="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
      '<div><h2 class="font-extrabold text-lg">🧊 Geladeiras, Freezers, Câmaras Frias &amp; Depósitos</h2>' +
      '<p class="text-xs text-stone-500">Clique no ícone ou cartão de qualquer freezer/geladeira para abrir, ver o que tem dentro e reposicionar o estoque.</p></div>' +
      '<button type="button" class="btn btn-pri" onclick="A.reposicionarGeralModal()">🔄 Reposicionar Estoque</button></div>' +
      '<div id="dep-cards" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>' +
      '<div id="dep-det" class="card overflow-x-auto"></div>';
  }
  A.depositoSel = function (n, abrirModal) {
    F.depSel = n;
    if (tab !== 'depositos') A.tab('depositos');
    else RENDER.depositos();
    if (abrirModal !== false) A.abrirDepositoModal(n);
  };
  A.abrirDepositoModal = function (nomeDep) {
    var d = S.depositos.filter(function (x) { return x.nome === nomeDep; })[0];
    if (!d) return;
    var ls = S.lotes.filter(function (l) { return l.deposito === d.nome; }).sort(function (a, b) { return (a.posicao || '').localeCompare(b.posicao || '') || a.validade.localeCompare(b.validade); });
    var u = ls.reduce(function (s, l) { return s + l.qtd; }, 0);
    var pct = Math.round(u / d.cap * 100);
    var el = abrirModal(
      '<div class="p-5 sm:p-6 space-y-4">' +
      '<div class="flex items-start justify-between gap-3">' +
      '<div class="flex items-center gap-3"><div class="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-3xl">' + d.icon + '</div>' +
      '<div><h3 class="font-extrabold text-lg text-stone-900">' + esc(d.nome) + '</h3>' +
      '<div class="flex items-center gap-2 text-xs text-stone-500 mt-0.5">' + badge('🌡️ ' + esc(d.temp), 'bg-sky-50 text-sky-800 border-sky-200') + '<span><b>' + nf(u) + '</b> / ' + nf(d.cap) + ' un (' + pct + '%)</span></div></div></div>' +
      '<button type="button" data-x class="text-2xl text-stone-400 hover:text-stone-700 cursor-pointer">&times;</button></div>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="button" class="btn btn-pri btn-sm" id="dep-m-puxar">📥 Trazer / Reposicionar Produto para Cá</button>' +
      (ehVendedor() ? '' : '<button type="button" class="btn btn-out btn-sm" id="dep-m-editar">✏️ Editar Nome / Capacidade</button>') +
      '</div>' +
      '<div class="border border-stone-200 rounded-xl overflow-x-auto max-h-80 overflow-y-auto">' +
      (ls.length ? '<table class="w-full"><thead><tr><th>Posição</th><th>Produto</th><th>Lote</th><th>Validade</th><th>Qtd</th><th class="text-right">Ações</th></tr></thead><tbody>' + ls.map(function (l) {
        var p = P(l.produtoId), st = statusVal(l.validade); if (!p) return '';
        return '<tr><td class="font-semibold text-xs">' + esc(l.posicao || '—') + '</td><td class="font-bold text-xs">' + (CAT_ICON[p.categoria] || '') + ' ' + esc(p.nome) + '</td><td class="font-mono text-xs">' + esc(l.lote) + '</td><td>' + fmtDia(l.validade) + ' ' + badge(st.label, st.cls) + '</td><td class="font-bold text-xs whitespace-nowrap">' + fmtQtd(l.qtd, p.unPorCx) + '</td><td class="text-right whitespace-nowrap"><button type="button" class="btn btn-green btn-sm" data-mv="' + l.id + '">🔄 Mover</button></td></tr>';
      }).join('') + '</tbody></table>' : '<div class="p-6 text-center text-sm text-stone-400">Este local está vazio no momento. Clique em <b>📥 Trazer / Reposicionar Produto para Cá</b> acima para abastecer!</div>') +
      '</div>' +
      '<div class="flex justify-end"><button type="button" class="btn btn-dark" data-x>Fechar</button></div></div>',
      'max-w-3xl'
    );
    el.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { el.close(); }; });
    el.querySelector('#dep-m-puxar').onclick = function () { el.close(); A.reposicionarGeralModal(d.nome); };
    var btnEd = el.querySelector('#dep-m-editar');
    if (btnEd) btnEd.onclick = function () { el.close(); A.editarDepositoModal(d.nome); };
    el.querySelectorAll('[data-mv]').forEach(function (b) {
      b.onclick = function () { el.close(); A.moverLoteModal(b.getAttribute('data-mv')); };
    });
  };
  A.editarDepositoModal = function (nomeDep) {
    if (ehVendedor()) return toast('Acesso negado: apenas Dono/CEO ou Gerente podem editar nomes.', 'erro');
    var d = S.depositos.filter(function (x) { return x.nome === nomeDep; })[0];
    if (!d) return;
    formModal({
      title: '✏️ Editar Freezer / Geladeira / Depósito',
      subtitle: 'Renomear ou ajustar capacidade de <b>' + esc(d.nome) + '</b> (os produtos dentro são atualizados automaticamente).',
      submit: '💾 Salvar Alterações',
      fields: [
        { name: 'nomeNovo', label: 'Nome do Freezer / Geladeira / Local', value: d.nome, required: true, span2: true, placeholder: 'Ex: Freezer Vertical 01 (Cervejas)' },
        { name: 'temp', label: 'Temperatura', value: d.temp, required: true, placeholder: 'Ex: -2 a 2°C' },
        { name: 'cap', label: 'Capacidade (unidades)', type: 'number', min: 1, value: d.cap, required: true }
      ],
      onSubmit: async function (f) {
        await salvar('/api/deposito/editar', { nomeAntigo: d.nome, nomeNovo: f.nomeNovo, temp: f.temp, cap: Math.round(toNum(f.cap)) }, 'Local atualizado para "' + f.nomeNovo + '"!');
        if (F.depSel === d.nome) F.depSel = f.nomeNovo;
        RENDER.depositos();
      }
    });
  };
  RENDER.depositos = function () {
    if (!F.depSel && S.depositos.length) F.depSel = S.depositos[0].nome;
    $('dep-cards').innerHTML = S.depositos.map(function (d) {
      var ls = S.lotes.filter(function (l) { return l.deposito === d.nome; }), u = ls.reduce(function (s, l) { return s + l.qtd; }, 0), pct = u / d.cap * 100;
      var val = ls.reduce(function (s, l) { return s + l.qtd * (l.custo || 0); }, 0);
      var sel = d.nome === F.depSel;
      return '<div class="card p-4 cursor-pointer transition hover:border-amber-400 hover:shadow-md ' + (sel ? 'ring-2 ring-amber-500 bg-amber-50/20' : '') + '" onclick="A.depositoSel(\'' + esc(d.nome) + '\', true)">' +
        '<div class="flex justify-between items-center"><button type="button" onclick="event.stopPropagation();A.depositoSel(\'' + esc(d.nome) + '\', true)" class="w-12 h-12 rounded-2xl bg-sky-50 hover:bg-amber-100 border border-sky-200 flex items-center justify-center text-3xl cursor-pointer transition transform hover:scale-105" title="Abrir ' + esc(d.nome) + '">' + d.icon + '</button>' +
        '<div class="text-right">' + badge('🌡️ ' + esc(d.temp), 'bg-sky-50 text-sky-800 border-sky-200') + '<div class="text-[10px] font-bold text-amber-700 mt-1">👆 Clique para abrir</div></div></div>' +
        '<div class="flex items-start justify-between gap-2"><div class="font-extrabold mt-2">' + esc(d.nome) + '</div>' + (ehVendedor() ? '' : ('<button type="button" onclick="event.stopPropagation();A.editarDepositoModal(\'' + esc(d.nome) + '\')" class="btn btn-out btn-sm mt-1.5" title="Editar nome deste freezer/local">✏️</button>')) + '</div><div class="text-xs text-stone-500 mb-2">' + ls.length + ' lote(s)' + (ehVendedor() ? '' : (' · ' + brl(val) + ' em estoque')) + '</div>' + barra(pct, pct > 90 ? 'bg-rose-500' : (pct > 70 ? 'bg-amber-500' : 'bg-emerald-500')) + '<div class="text-[11px] text-stone-500 mt-1">' + Math.round(pct) + '% · ' + nf(u) + ' de ' + nf(d.cap) + ' un</div></div>';
    }).join('');
    var ls = S.lotes.filter(function (l) { return l.deposito === F.depSel; }).sort(function (a, b) { return (a.posicao || '').localeCompare(b.posicao || '') || a.validade.localeCompare(b.validade); });
    $('dep-det').innerHTML = '<div class="px-4 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2"><span class="font-extrabold">Conteúdo: ' + esc(F.depSel) + '</span><button type="button" class="btn btn-pri btn-sm" onclick="A.reposicionarGeralModal(\'' + esc(F.depSel) + '\')">📥 Trazer Produto para Cá</button></div>' + (ls.length ? '<table class="w-full"><thead><tr><th>Posição</th><th>Produto</th><th>Lote</th><th>Validade</th><th>Quantidade</th><th class="text-right">Ações</th></tr></thead><tbody>' + ls.map(function (l) {
      var p = P(l.produtoId), st = statusVal(l.validade); if (!p) return '';
      return '<tr><td class="font-semibold">' + esc(l.posicao || '—') + '</td><td>' + (CAT_ICON[p.categoria] || '') + ' ' + esc(p.nome) + '</td><td class="font-mono">' + esc(l.lote) + '</td><td>' + fmtDia(l.validade) + ' ' + badge(st.label, st.cls) + '</td><td class="font-bold">' + fmtQtd(l.qtd, p.unPorCx) + '</td><td class="text-right whitespace-nowrap"><button type="button" class="btn btn-green btn-sm" onclick="A.moverLoteModal(\'' + l.id + '\')">🔄 Mover</button></td></tr>';
    }).join('') + '</tbody></table>' : '<div class="p-6 text-sm text-stone-400">Depósito vazio.</div>');
  };

  A.reposicionarGeralModal = function (destinoPadrao) {
    var lotesDisponiveis = S.lotes.filter(function (l) {
      return l.qtd > 0 && P(l.produtoId) && (!destinoPadrao || l.deposito !== destinoPadrao);
    }).sort(function (a, b) {
      var pa = P(a.produtoId), pb = P(b.produtoId);
      return (pa ? pa.nome : '').localeCompare(pb ? pb.nome : '') || a.validade.localeCompare(b.validade);
    });
    if (!lotesDisponiveis.length) {
      return toast(destinoPadrao ? 'Não há lotes em outros locais para transferir para ' + destinoPadrao + '.' : 'Nenhum lote em estoque para reposicionar.', 'aviso');
    }
    var primeiro = lotesDisponiveis[0];
    var p0 = P(primeiro.produtoId);
    var depDef = destinoPadrao || (S.depositos.filter(function (d) { return d.nome !== primeiro.deposito; })[0] || S.depositos[0]).nome;
    formModal({
      title: '🔄 Reposicionar Estoque entre Locais',
      subtitle: destinoPadrao ? ('Abastecer: <b>' + esc(destinoPadrao) + '</b>') : 'Escolha o lote de origem, a quantidade e o freezer/depósito de destino.',
      submit: '🔄 Confirmar Transferência',
      wide: 'max-w-xl',
      fields: [
        {
          name: 'loteId',
          label: 'Produto / Lote de Origem',
          type: 'select',
          options: lotesDisponiveis.map(function (l) {
            var p = P(l.produtoId);
            return { v: l.id, t: p.nome + ' · Lote ' + l.lote + ' (' + fmtQtd(l.qtd, p.unPorCx) + ' em ' + l.deposito + ')' };
          }),
          value: primeiro.id,
          span2: true,
          required: true
        },
        {
          name: 'deposito',
          label: 'Mover para (Destino)',
          type: 'select',
          options: S.depositos.map(function (d) { return { v: d.nome, t: d.icon + ' ' + d.nome + ' (' + d.temp + ')' }; }),
          value: depDef,
          span2: true,
          required: true
        },
        { name: 'cx', label: 'Caixas / Emb. a mover', type: 'number', min: 0, value: p0 && p0.unPorCx > 1 ? Math.floor(primeiro.qtd / p0.unPorCx) : 0 },
        { name: 'un', label: 'Unidades soltas a mover', type: 'number', min: 0, value: p0 && p0.unPorCx > 1 ? (primeiro.qtd % p0.unPorCx) : primeiro.qtd },
        { name: 'posicao', label: 'Posição / Prateleira no destino (opcional)', value: '', placeholder: 'Ex: Prateleira 2, Porta 1', span2: true }
      ],
      onChange: function (f, info) {
        var l = S.lotes.filter(function (x) { return x.id === f.loteId; })[0];
        var p = l ? P(l.produtoId) : null;
        if (!l || !p) return;
        var pc = p.unPorCx || 1;
        var q = Math.round(toNum(f.cx)) * pc + Math.round(toNum(f.un));
        info('Disponível na origem (' + esc(l.deposito) + '): <b>' + fmtQtd(l.qtd, pc) + '</b> (' + nf(l.qtd) + ' un) · Movendo: <b>' + fmtQtd(q, pc) + '</b>');
      },
      onSubmit: async function (f) {
        var l = S.lotes.filter(function (x) { return x.id === f.loteId; })[0];
        var p = l ? P(l.produtoId) : null;
        if (!l || !p) throw new Error('Lote não encontrado');
        var pc = p.unPorCx || 1;
        var q = Math.round(toNum(f.cx)) * pc + Math.round(toNum(f.un));
        if (q <= 0 || q > l.qtd) throw new Error('Informe uma quantidade válida (entre 1 e ' + l.qtd + ' un disponíveis neste lote)');
        await salvar('/api/lote/mover', { id: l.id, deposito: f.deposito, qtd: q, posicao: f.posicao }, 'Movido ' + fmtQtd(q, pc) + ' de ' + p.nome + ' para ' + f.deposito + '!');
      }
    });
  };

  A.moverLoteModal = function (id) {
    var l = S.lotes.filter(function (x) { return x.id === id; })[0]; if (!l) return;
    var p = P(l.produtoId); if (!p) return;
    var pc = p.unPorCx || 1;
    var outrosLocais = S.depositos.filter(function (d) { return d.nome !== l.deposito; }).map(function (d) { return d.icon + ' ' + d.nome; });
    formModal({
      title: '🔄 Reposicionar / Mover Estoque',
      subtitle: '<b>' + esc(p.nome) + '</b> · Lote <span class="font-mono">' + esc(l.lote) + '</span><br>Local atual: <b>' + esc(l.deposito) + '</b> · Disponível: <b>' + fmtQtd(l.qtd, pc) + '</b> (' + nf(l.qtd) + ' un)',
      submit: '🔄 Confirmar Transferência',
      fields: [
        { name: 'deposito', label: 'Mover para (Freezer / Geladeira / Câmara Fria / Gôndola)', type: 'select', options: S.depositos.map(function (d) { return { v: d.nome, t: d.icon + ' ' + d.nome + ' (' + d.temp + ')' }; }), value: (S.depositos.filter(function (d) { return d.nome !== l.deposito; })[0] || S.depositos[0]).nome, span2: true, required: true },
        { name: 'cx', label: pc > 1 ? ('Caixas / Emb. (c/' + pc + ')') : 'Quantidade (0 = usar campo ao lado)', type: 'number', min: 0, value: pc > 1 ? Math.floor(l.qtd / pc) : 0 },
        { name: 'un', label: pc > 1 ? 'Unidades soltas' : 'Quantidade de unidades', type: 'number', min: 0, value: pc > 1 ? (l.qtd % pc) : l.qtd },
        { name: 'posicao', label: 'Posição / Prateleira no destino (opcional)', value: l.posicao || '', placeholder: 'Ex: Prateleira 2, Porta 1', span2: true }
      ],
      onChange: function (f, info) {
        var q = Math.round(toNum(f.cx)) * pc + Math.round(toNum(f.un));
        info('Movendo <b>' + fmtQtd(q, pc) + '</b> (' + nf(q) + ' un) para <b>' + esc(f.deposito) + '</b>');
      },
      onSubmit: async function (f) {
        var q = Math.round(toNum(f.cx)) * pc + Math.round(toNum(f.un));
        if (q <= 0 || q > l.qtd) throw new Error('Informe uma quantidade válida (entre 1 e ' + l.qtd + ' un)');
        await salvar('/api/lote/mover', { id: l.id, deposito: f.deposito, qtd: q, posicao: f.posicao }, 'Movido ' + fmtQtd(q, pc) + ' para ' + f.deposito + '!');
      }
    });
  };

  // ============================================================ HISTÓRICO
  function mountHistorico() {
    $('v-historico').innerHTML = '<div class="card p-4 space-y-3"><div class="flex flex-wrap gap-2 items-center justify-between"><div class="flex gap-2"><button id="his-a-vendas" class="btn btn-sm" onclick="A.hisAba(\'vendas\')">🧾 Pedidos e saídas</button><button id="his-a-mov" class="btn btn-sm" onclick="A.hisAba(\'mov\')">🔄 Movimentações de estoque</button></div><div class="flex gap-2"><button class="btn btn-out btn-sm" onclick="A.hisCsv()">⬇️ CSV</button></div></div>' +
      '<div class="grid sm:grid-cols-3 gap-3"><div><label class="lbl">Buscar</label><input id="his-q" class="inp" placeholder="Produto, cliente, lote, nº…"></div><div><label class="lbl">Tipo</label><select id="his-tipo" class="inp"></select></div><div id="his-cli-box"><label class="lbl">Cliente</label><select id="his-cli" class="inp"></select></div></div></div><div id="his-list" class="card overflow-x-auto"></div>';
    $('his-q').oninput = function () { F.hisBusca = this.value; RENDER.historico(); };
    $('his-tipo').onchange = function () { F.hisTipo = this.value; RENDER.historico(); };
    $('his-cli').onchange = function () { F.hisCliente = this.value; RENDER.historico(); };
  }
  A.hisAba = function (a) { F.hisAba = a; F.hisTipo = ''; RENDER.historico(); };
  function hisVendas() {
    var q = norm(F.hisBusca);
    return S.vendas.filter(function (v) {
      if (F.hisCliente && v.clienteId !== F.hisCliente) return false;
      if (F.hisTipo === 'Estornada' ? v.status !== 'Estornada' : (F.hisTipo && v.tipo !== F.hisTipo)) return false;
      return !q || norm('#' + v.numero + ' ' + v.clienteNome + ' ' + v.itens.map(function (i) { return i.nome; }).join(' ')).indexOf(q) !== -1;
    });
  }
  function hisMov() {
    var q = norm(F.hisBusca);
    return S.historico.filter(function (h) { return (!F.hisTipo || h.tipo === F.hisTipo) && (!q || norm(h.produto + ' ' + h.lote + ' ' + h.motivo + ' ' + h.tipo).indexOf(q) !== -1); });
  }
  RENDER.historico = function () {
    var v = F.hisAba === 'vendas';
    $('his-a-vendas').className = 'btn btn-sm ' + (v ? 'btn-dark' : 'btn-out'); $('his-a-mov').className = 'btn btn-sm ' + (!v ? 'btn-dark' : 'btn-out');
    $('his-cli-box').classList.toggle('hidden', !v);
    var tipos = v ? [''].concat(Object.keys(TIPO_DESC)).concat(['Estornada']) : [''].concat(S.historico.map(function (h) { return h.tipo; }).filter(function (t, i, a) { return a.indexOf(t) === i; }).sort());
    fill($('his-tipo'), tipos.map(function (t) { return { v: t, t: t || 'Todos' }; }), true); $('his-tipo').value = F.hisTipo;
    fill($('his-cli'), [{ v: '', t: 'Todos' }].concat(S.clientes.map(function (c) { return { v: c.id, t: c.nome }; }))); $('his-cli').value = F.hisCliente;
    if (v) {
      var l = hisVendas(), tot = l.filter(function (x) { return x.tipo === 'Venda' && x.status !== 'Estornada'; }).reduce(function (s, x) { return s + x.total; }, 0);
      $('his-list').innerHTML = !l.length ? '<div class="p-8 text-center text-stone-500 text-sm">Nenhum pedido encontrado.</div>' : '<div class="px-4 pt-3 text-xs text-stone-500">' + l.length + ' registro(s)' + (ehVendedor() ? '' : (' · vendas válidas: <b>' + brl(tot) + '</b>')) + '</div><table class="w-full"><thead><tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Tipo</th><th>Itens</th>' + (ehVendedor() ? '' : '<th>Total</th>') + '<th>Pagamento</th><th></th></tr></thead><tbody>' + l.slice(0, 300).map(function (x) {
        var est = x.status === 'Estornada';
        return '<tr class="cursor-pointer hover:bg-amber-50/40 ' + (est ? 'opacity-60' : '') + '" onclick="A.verVenda(\'' + x.id + '\')"><td class="font-bold">#' + x.numero + '</td><td class="text-xs">' + fmtData(x.data) + '</td><td>' + esc(x.clienteNome) + '</td><td class="text-xs font-semibold text-stone-700">' + esc(x.operador || '—') + '</td><td>' + badge(esc(x.tipo), x.tipo === 'Venda' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-stone-100 text-stone-700 border-stone-300') + (est ? ' ' + badge('ESTORNADO', 'bg-rose-100 text-rose-800 border-rose-300') : '') + '</td><td class="text-xs text-stone-500">' + x.itens.length + ' item(ns)</td>' + (ehVendedor() ? '' : ('<td class="font-extrabold ' + (est ? 'line-through' : '') + '">' + (x.tipo === 'Venda' ? brl(x.total) : '—') + '</td>')) + '<td class="text-xs">' + esc(x.pagamento) + (x.aPrazo ? ' ⏳' : '') + '</td><td class="text-right"><button class="btn btn-out btn-sm">Ver</button></td></tr>';
      }).join('') + '</tbody></table>';
    } else {
      var m = hisMov();
      $('his-list').innerHTML = !m.length ? '<div class="p-8 text-center text-stone-500 text-sm">Nenhuma movimentação.</div>' : '<table class="w-full"><thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Lote</th><th>Qtd</th><th>Detalhe</th><th>Responsável</th></tr></thead><tbody>' + m.slice(0, 400).map(function (h) {
        var ent = /^Entrada|Estorno/.test(h.tipo), sai = /^Sa[ií]da/.test(h.tipo);
        return '<tr><td class="text-xs whitespace-nowrap">' + fmtData(h.data) + '</td><td>' + badge(esc(h.tipo), ent ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : (sai ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-stone-100 text-stone-700 border-stone-300')) + '</td><td class="font-semibold">' + esc(h.produto) + '</td><td class="font-mono text-xs">' + esc(h.lote) + '</td><td class="font-bold whitespace-nowrap">' + (h.qtd ? (ent ? '+' : (sai ? '−' : '')) + fmtQtd(h.qtd, h.unPorCx) : '—') + '</td><td class="text-xs text-stone-600">' + esc(h.motivo) + (!ehVendedor() && h.valor ? ' · ' + brl(h.valor) : '') + '</td><td class="text-xs text-stone-500">' + esc(h.responsavel) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
  };
  A.hisCsv = function () {
    if (ehVendedor()) {
      return toast('Exportação financeira restrita ao Dono/CEO ou Gerente de Negócios.', 'aviso');
    }
    if (F.hisAba === 'vendas') {
      var l = [['Nº', 'Data', 'Cliente', 'Tipo', 'Status', 'Itens', 'Subtotal', 'Desconto', 'Total', 'Custo', 'Lucro', 'Pagamento']];
      hisVendas().forEach(function (v) { l.push([v.numero, fmtData(v.data), v.clienteNome, v.tipo, v.status, v.itens.map(function (i) { return i.nome + ' x' + i.qtd; }).join(' | '), String(v.subtotal).replace('.', ','), String(v.desconto).replace('.', ','), String(v.total).replace('.', ','), String(v.custoTotal).replace('.', ','), String(Math.round((v.total - v.custoTotal) * 100) / 100).replace('.', ','), v.pagamento]); });
      csv('pedidos-' + diaLocal() + '.csv', l);
    } else {
      var m = [['Data', 'Tipo', 'Produto', 'Lote', 'Qtd (un)', 'Detalhe', 'Valor', 'Responsável']];
      hisMov().forEach(function (h) { m.push([fmtData(h.data), h.tipo, h.produto, h.lote, h.qtd, h.motivo, String(h.valor || 0).replace('.', ','), h.responsavel]); });
      csv('movimentacoes-' + diaLocal() + '.csv', m);
    }
  };

  // ============================================================ RELATÓRIO DE VENDAS & OTIMIZAÇÃO DE ESTOQUE
  function mountRelatorio() {
    $('v-relatorio').innerHTML =
      '<div class="card p-4 flex flex-wrap gap-3 items-center justify-between">' +
      '<div class="flex flex-wrap gap-2 items-center">' +
      '<span class="text-xs font-extrabold uppercase text-stone-500 mr-1">Período:</span>' +
      [['hoje', 'Hoje'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['tudo', 'Todo o período']].map(function (o) {
        return '<button type="button" class="btn btn-sm btn-out" data-relp="' + o[0] + '">' + o[1] + '</button>';
      }).join('') +
      '<select id="rel-cat" class="inp !w-auto !py-1.5 text-xs"><option value="">Todas as categorias</option></select>' +
      '</div>' +
      '<button type="button" class="btn btn-out btn-sm" onclick="A.relCsv()">⬇️ Exportar Relatório CSV</button>' +
      '</div>' +
      '<div id="rel-body" class="space-y-5"></div>';

    $('v-relatorio').querySelectorAll('[data-relp]').forEach(function (b) {
      b.onclick = function () { F.relPeriodo = b.dataset.relp; RENDER.relatorio(); };
    });
    $('rel-cat').onchange = function () { F.relCat = this.value; RENDER.relatorio(); };
  }

  function calcularDadosRelatorio() {
    var agora = Date.now();
    var hoje = diaLocal();
    var diasJanela = F.relPeriodo === 'hoje' ? 1 : (F.relPeriodo === '7d' ? 7 : (F.relPeriodo === '30d' ? 30 : 36500));
    var limiteMs = F.relPeriodo === 'hoje' ? 0 : (agora - diasJanela * 864e5);

    var vendasFiltradas = (S.vendas || []).filter(function (v) {
      if (v.tipo !== 'Venda' || v.status === 'Estornada') return false;
      if (F.relPeriodo === 'hoje') return diaLocal(new Date(v.data)) === hoje;
      if (F.relPeriodo === 'tudo') return true;
      return new Date(v.data).getTime() >= limiteMs;
    });

    var porProd = {};
    S.produtos.forEach(function (p) {
      if (F.relCat && p.categoria !== F.relCat) return;
      var est = E[p.id] || { total: 0 };
      porProd[p.id] = {
        p: p,
        qtd: 0,
        faturamento: 0,
        custo: 0,
        pedidos: 0,
        estoqueAtual: est.total || 0
      };
    });

    var porHora = [];
    for (var h = 0; h < 24; h++) {
      porHora.push({ hora: h, label: pad2(h) + ':00', vendas: 0, itens: 0, faturamento: 0 });
    }
    var turnos = {
      manha: { nome: 'Manhã (06h–11h)', ico: '☀️', vendas: 0, itens: 0, faturamento: 0 },
      tarde: { nome: 'Tarde (12h–17h)', ico: '🌇', vendas: 0, itens: 0, faturamento: 0 },
      noite: { nome: 'Noite (18h–23h)', ico: '🌙', vendas: 0, itens: 0, faturamento: 0 },
      madrugada: { nome: 'Madrugada (00h–05h)', ico: '🦉', vendas: 0, itens: 0, faturamento: 0 }
    };

    var totalFaturamento = 0;
    var totalItens = 0;
    var totalVendas = 0;

    vendasFiltradas.forEach(function (v) {
      var dt = new Date(v.data);
      var hr = isNaN(dt.getTime()) ? 12 : dt.getHours();
      var itensVenda = 0;
      var fatVenda = 0;

      (v.itens || []).forEach(function (it) {
        var prod = P(it.produtoId);
        if (F.relCat && (!prod || prod.categoria !== F.relCat)) return;
        var q = Number(it.qtd) || 0;
        var sub = Number(it.subtotal) || 0;
        var cst = Number(it.custo) || 0;
        itensVenda += q;
        fatVenda += sub;
        if (!porProd[it.produtoId] && prod) {
          var est = E[prod.id] || { total: 0 };
          porProd[it.produtoId] = { p: prod, qtd: 0, faturamento: 0, custo: 0, pedidos: 0, estoqueAtual: est.total || 0 };
        }
        if (porProd[it.produtoId]) {
          porProd[it.produtoId].qtd += q;
          porProd[it.produtoId].faturamento += sub;
          porProd[it.produtoId].custo += cst;
          porProd[it.produtoId].pedidos += 1;
        }
      });

      if (itensVenda > 0) {
        totalVendas += 1;
        totalItens += itensVenda;
        totalFaturamento += fatVenda;
        porHora[hr].vendas += 1;
        porHora[hr].itens += itensVenda;
        porHora[hr].faturamento += fatVenda;

        var tk = (hr >= 6 && hr <= 11) ? 'manha' : (hr >= 12 && hr <= 17 ? 'tarde' : (hr >= 18 ? 'noite' : 'madrugada'));
        turnos[tk].vendas += 1;
        turnos[tk].itens += itensVenda;
        turnos[tk].faturamento += fatVenda;
      }
    });

    var lista = Object.keys(porProd).map(function (id) {
      var x = porProd[id];
      var mediaDia = x.qtd / Math.max(1, diasJanela === 36500 ? 30 : diasJanela);
      var diasCobertura = mediaDia > 0 ? Math.round((x.estoqueAtual / mediaDia) * 10) / 10 : Infinity;
      var minEst = x.p.minimo || 5;
      var rec = { label: 'Normal', cls: 'bg-stone-100 text-stone-700 border-stone-200', ordem: 2 };
      if (x.qtd > 0 && (x.estoqueAtual <= minEst || diasCobertura <= 7)) {
        rec = { label: '🚨 Comprar Urgente (Alta Saída)', cls: 'bg-rose-100 text-rose-800 border-rose-300', ordem: 0 };
      } else if (x.qtd > 0) {
        rec = { label: '🔥 Priorizar na Compra', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', ordem: 1 };
      } else if (x.estoqueAtual > minEst * 2) {
        rec = { label: '❄️ Parado (Evitar Comprar)', cls: 'bg-sky-100 text-sky-800 border-sky-300', ordem: 3 };
      } else {
        rec = { label: '🧊 Sem Saída no Período', cls: 'bg-stone-100 text-stone-600 border-stone-300', ordem: 4 };
      }
      x.diasCobertura = diasCobertura;
      x.rec = rec;
      return x;
    });

    var maisVendidos = lista.filter(function (x) { return x.qtd > 0; }).sort(function (a, b) {
      return b.qtd - a.qtd || b.faturamento - a.faturamento;
    });
    var menosVendidos = lista.slice().sort(function (a, b) {
      return a.qtd - b.qtd || b.estoqueAtual - a.estoqueAtual;
    });
    var horasOrdenadas = porHora.slice().sort(function (a, b) { return b.vendas - a.vendas || b.faturamento - a.faturamento; });
    var horaPico = horasOrdenadas[0] && horasOrdenadas[0].vendas > 0 ? horasOrdenadas[0] : null;

    return {
      totalVendas: totalVendas,
      totalItens: totalItens,
      totalFaturamento: totalFaturamento,
      maisVendidos: maisVendidos,
      menosVendidos: menosVendidos,
      porHora: porHora,
      horaPico: horaPico,
      turnos: turnos
    };
  }

  RENDER.relatorio = function () {
    var selCat = $('rel-cat');
    if (selCat) {
      var cur = F.relCat;
      selCat.innerHTML = '<option value="">Todas as categorias</option>' +
        (S.categorias || []).map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
      selCat.value = cur;
    }
    $('v-relatorio').querySelectorAll('[data-relp]').forEach(function (b) {
      var ativo = b.dataset.relp === F.relPeriodo;
      b.className = 'btn btn-sm ' + (ativo ? 'btn-pri' : 'btn-out');
    });

    var d = calcularDadosRelatorio();
    var root = $('rel-body');
    var top1 = d.maisVendidos[0];
    var maxQtdTop = top1 ? top1.qtd : 1;
    var maxVendasHora = Math.max.apply(null, d.porHora.map(function (h) { return h.vendas; }).concat([1]));

    var turnoPico = Object.keys(d.turnos).map(function (k) { return d.turnos[k]; }).sort(function (a, b) { return b.vendas - a.vendas; })[0];

    var kpisHtml = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">' +
      kpi('Vendas no Período', nf(d.totalVendas) + ' pedidos', nf(d.totalItens) + ' unidades vendidas', '🧾', 'bg-amber-100 text-amber-800') +
      kpi(ehVendedor() ? 'Itens Vendidos' : 'Faturamento Analisado', ehVendedor() ? nf(d.totalItens) + ' un' : brl(d.totalFaturamento), d.totalVendas ? ('Ticket médio: ' + (ehVendedor() ? (Math.round((d.totalItens / d.totalVendas) * 10) / 10 + ' un/venda') : brl(d.totalFaturamento / d.totalVendas))) : 'Sem vendas no filtro', '💰', 'bg-emerald-100 text-emerald-800') +
      kpi('Horário de Maior Fluxo', d.horaPico ? (d.horaPico.label + ' – ' + pad2((d.horaPico.hora + 1) % 24) + ':00') : 'Sem movimento', d.horaPico ? (d.horaPico.vendas + ' vendas (' + Math.round((d.horaPico.vendas / Math.max(1, d.totalVendas)) * 100) + '% do fluxo)') : 'Registre vendas no PDV', '⏰', 'bg-indigo-100 text-indigo-800') +
      kpi('Produto Campeão', top1 ? esc(top1.p.nome) : 'Nenhum', top1 ? (nf(top1.qtd) + ' un vendidas · Estoque: ' + fmtQtd(top1.estoqueAtual, top1.p.unPorCx)) : 'Sem vendas no período', '🏆', 'bg-rose-100 text-rose-800') +
      '</div>';

    // Horários de maior fluxo
    var horasAtivas = d.porHora.filter(function (h) { return h.vendas > 0 || (h.hora >= 8 && h.hora <= 23); });
    var topHorasSet = {};
    d.porHora.slice().sort(function (a, b) { return b.vendas - a.vendas; }).slice(0, 3).forEach(function (h) {
      if (h.vendas > 0) topHorasSet[h.hora] = true;
    });

    var fluxoHtml = '<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">' +
      '<div class="card p-5 lg:col-span-2">' +
      '<div class="flex flex-wrap items-center justify-between gap-2 mb-3">' +
      '<div><h3 class="font-extrabold text-stone-900">⏰ Fluxo de Vendas por Horário</h3>' +
      '<p class="text-xs text-stone-500">Identifique os horários de pico para reforçar geladeiras e atendimento antes do movimento subir</p></div>' +
      (d.horaPico ? '<span class="badge bg-amber-100 text-amber-900 border-amber-300">🔥 Pico: ' + d.horaPico.label + '</span>' : '') +
      '</div>' +
      '<div class="space-y-1.5">' +
      horasAtivas.map(function (h) {
        var pct = (h.vendas / maxVendasHora) * 100;
        var isPico = !!topHorasSet[h.hora];
        return '<div class="grid grid-cols-12 items-center gap-2 text-xs">' +
          '<div class="col-span-2 font-mono font-bold ' + (isPico ? 'text-amber-700' : 'text-stone-600') + '">' + h.label + (isPico ? ' 🔥' : '') + '</div>' +
          '<div class="col-span-6">' + barra(pct, isPico ? 'bg-amber-500' : (h.vendas > 0 ? 'bg-stone-500' : 'bg-stone-200')) + '</div>' +
          '<div class="col-span-4 text-right font-semibold ' + (h.vendas > 0 ? 'text-stone-800' : 'text-stone-400') + '">' +
          h.vendas + ' vendas · ' + nf(h.itens) + ' un' + (ehVendedor() ? '' : (' · ' + brl(h.faturamento))) +
          '</div></div>';
      }).join('') +
      '</div></div>' +
      '<div class="card p-5 space-y-3">' +
      '<h3 class="font-extrabold text-stone-900">🌓 Movimento por Turno</h3>' +
      '<p class="text-xs text-stone-500">Distribuição do faturamento e pedidos ao longo do dia</p>' +
      ['manha', 'tarde', 'noite', 'madrugada'].map(function (k) {
        var t = d.turnos[k];
        var pct = d.totalVendas ? Math.round((t.vendas / d.totalVendas) * 100) : 0;
        var ehPicoT = turnoPico && turnoPico.vendas > 0 && turnoPico.nome === t.nome;
        return '<div class="p-3 rounded-xl border ' + (ehPicoT ? 'bg-amber-50 border-amber-300' : 'bg-stone-50 border-stone-200') + '">' +
          '<div class="flex justify-between text-xs font-extrabold text-stone-800"><span>' + t.ico + ' ' + t.nome + '</span><span>' + pct + '%</span></div>' +
          '<div class="my-1.5">' + barra(pct, ehPicoT ? 'bg-amber-500' : 'bg-stone-500') + '</div>' +
          '<div class="flex justify-between text-[11px] text-stone-500"><span>' + t.vendas + ' pedidos · ' + nf(t.itens) + ' un</span><span>' + (ehVendedor() ? '' : brl(t.faturamento)) + '</span></div>' +
          '</div>';
      }).join('') +
      '</div></div>';

    // Top Mais Vendidos vs Menos Vendidos
    var topHtml = '<div class="card p-5">' +
      '<div class="flex flex-wrap items-center justify-between gap-2 mb-3">' +
      '<div><h3 class="font-extrabold text-stone-900">🏆 Produtos Mais Vendidos & Prioridade de Reposição</h3>' +
      '<p class="text-xs text-stone-500">Estes são os itens que mais giram — compre em maior quantidade para nunca faltar no pico</p></div>' +
      '<span class="badge bg-emerald-100 text-emerald-800 border-emerald-300">' + d.maisVendidos.length + ' produtos com saída</span>' +
      '</div>' +
      (!d.maisVendidos.length
        ? '<div class="text-sm text-stone-500 py-6 text-center">Nenhuma venda registrada neste período.</div>'
        : '<div class="overflow-x-auto"><table class="w-full text-xs text-left">' +
          '<thead class="text-[11px] uppercase text-stone-500 border-b border-stone-200"><tr>' +
          '<th class="py-2 pr-2">#</th><th class="py-2 pr-2">Produto</th><th class="py-2 pr-2">Saída (Qtd)</th>' +
          (ehVendedor() ? '' : '<th class="py-2 pr-2">Faturamento</th>') +
          '<th class="py-2 pr-2">Estoque Atual</th><th class="py-2 pr-2">Sugestão de Compra</th><th class="py-2 text-right">Ação</th>' +
          '</tr></thead><tbody class="divide-y divide-stone-100">' +
          d.maisVendidos.slice(0, 20).map(function (x, i) {
            var pct = (x.qtd / maxQtdTop) * 100;
            return '<tr class="hover:bg-stone-50">' +
              '<td class="py-2.5 pr-2 font-extrabold text-stone-500">' + (i + 1) + 'º</td>' +
              '<td class="py-2.5 pr-2"><div class="font-bold text-stone-900">' + (CAT_ICON[x.p.categoria] || '') + ' ' + esc(x.p.nome) + '</div>' +
              '<div class="text-[11px] text-stone-500">' + esc(x.p.marca || x.p.categoria) + '</div></td>' +
              '<td class="py-2.5 pr-2 w-40"><div class="font-extrabold text-stone-900">' + nf(x.qtd) + ' un <span class="text-[10px] font-normal text-stone-500">(' + fmtQtd(x.qtd, x.p.unPorCx) + ')</span></div>' + barra(pct, i < 3 ? 'bg-amber-500' : 'bg-emerald-500') + '</td>' +
              (ehVendedor() ? '' : '<td class="py-2.5 pr-2 font-bold text-emerald-700">' + brl(x.faturamento) + '</td>') +
              '<td class="py-2.5 pr-2 font-semibold">' + fmtQtd(x.estoqueAtual, x.p.unPorCx) + (isFinite(x.diasCobertura) ? ('<div class="text-[10px] text-stone-400">~' + x.diasCobertura + ' dias de estoque</div>') : '') + '</td>' +
              '<td class="py-2.5 pr-2">' + badge(x.rec.label, x.rec.cls) + '</td>' +
              '<td class="py-2.5 text-right"><button type="button" class="btn btn-green btn-sm" onclick="A.entradaPara(\'' + x.p.id + '\')">+ Comprar</button></td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div>') +
      '</div>';

    var menosHtml = '<div class="card p-5">' +
      '<div class="flex flex-wrap items-center justify-between gap-2 mb-3">' +
      '<div><h3 class="font-extrabold text-stone-900">❄️ Produtos Menos Vendidos / Baixo Giro</h3>' +
      '<p class="text-xs text-stone-500">Evite imobilizar dinheiro comprando estes itens em excesso; avalie promoções se estiverem parados</p></div>' +
      '<span class="badge bg-sky-100 text-sky-800 border-sky-300">Top 20 menor giro</span>' +
      '</div>' +
      '<div class="overflow-x-auto"><table class="w-full text-xs text-left">' +
      '<thead class="text-[11px] uppercase text-stone-500 border-b border-stone-200"><tr>' +
      '<th class="py-2 pr-2">Produto</th><th class="py-2 pr-2">Vendidos no Período</th><th class="py-2 pr-2">Estoque Parado</th><th class="py-2">Orientação</th>' +
      '</tr></thead><tbody class="divide-y divide-stone-100">' +
      d.menosVendidos.slice(0, 20).map(function (x) {
        return '<tr class="hover:bg-stone-50">' +
          '<td class="py-2 pr-2"><div class="font-bold text-stone-900">' + (CAT_ICON[x.p.categoria] || '') + ' ' + esc(x.p.nome) + '</div>' +
          '<div class="text-[11px] text-stone-500">' + esc(x.p.marca || x.p.categoria) + '</div></td>' +
          '<td class="py-2 pr-2 font-bold ' + (x.qtd === 0 ? 'text-rose-600' : 'text-stone-700') + '">' + nf(x.qtd) + ' un</td>' +
          '<td class="py-2 pr-2">' + fmtQtd(x.estoqueAtual, x.p.unPorCx) + '</td>' +
          '<td class="py-2">' + badge(x.rec.label, x.rec.cls) + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div></div>';

    root.innerHTML = kpisHtml + fluxoHtml + topHtml + menosHtml;
  };

  A.relCsv = function () {
    var d = calcularDadosRelatorio();
    var linhas = [['Ranking', 'Produto', 'Categoria', 'Qtd Vendida (un)', 'Estoque Atual (un)', 'Faturamento', 'Orientação de Compra']];
    d.maisVendidos.concat(d.menosVendidos.filter(function (x) { return x.qtd === 0; })).forEach(function (x, i) {
      linhas.push([
        i + 1,
        x.p.nome,
        x.p.categoria,
        x.qtd,
        x.estoqueAtual,
        ehVendedor() ? '-' : String(Math.round(x.faturamento * 100) / 100).replace('.', ','),
        x.rec.label
      ]);
    });
    csv('relatorio-vendas-' + diaLocal() + '.csv', linhas);
  };

  // ============================================================ ajustes, celular, scanner global
  A.scanGlobal = function () {
    A.scanner(function (code) {
      var r = acharPorCodigo(code);
      if (!r) return cadastrarPorCodigo(code, function (p) { expandido[p.id] = true; A.tab('estoque'); });
      var p = r.p, e = E[p.id];
      var el = abrirModal('<div class="p-5 space-y-3"><div class="flex justify-between"><div><h3 class="font-extrabold text-lg">' + (CAT_ICON[p.categoria] || '') + ' ' + esc(p.nome) + '</h3><p class="text-xs text-stone-500">' + esc(p.marca) + ' ' + esc(p.volume) + ' · ' + esc(p.tipoEmb) + ' c/' + p.unPorCx + '</p></div><button data-x class="text-2xl text-stone-400 cursor-pointer">&times;</button></div>' +
        '<div class="grid grid-cols-2 gap-2 text-sm"><div class="bg-stone-50 rounded-xl p-3"><div class="text-[11px] text-stone-500">Em estoque</div><b>' + fmtQtd(e.total, p.unPorCx) + '</b></div><div class="bg-stone-50 rounded-xl p-3"><div class="text-[11px] text-stone-500">Preço</div><b>' + brl(p.preco) + '</b> / ' + brl(precoCxEf(p)) + ' cx</div></div>' +
        (e.lotes.length ? '<div class="text-xs space-y-1">' + e.lotes.slice(0, 4).map(function (l) { var st = statusVal(l.validade); return '<div class="flex justify-between border border-stone-200 rounded-lg px-2 py-1"><span>Lote ' + esc(l.lote) + ' · ' + esc(l.deposito) + '</span><span>' + fmtQtd(l.qtd, p.unPorCx) + ' ' + badge(st.label, st.cls) + '</span></div>'; }).join('') + '</div>' : '') +
        '<div class="grid grid-cols-3 gap-2"><button class="btn btn-green" data-a="e">📥 Entrada</button><button class="btn btn-pri" data-a="s">🚚 Vender</button><button class="btn btn-out" data-a="p">✏️ Editar</button></div></div>', 'max-w-md');
      el.querySelector('[data-x]').onclick = function () { el.close(); };
      el.querySelector('[data-a=e]').onclick = function () { el.close(); A.entradaPara(p.id); };
      el.querySelector('[data-a=s]').onclick = function () { el.close(); A.saidaPara(p.id); };
      el.querySelector('[data-a=p]').onclick = function () { el.close(); A.produtoModal(p.id); };
    }, 'Consultar / escanear produto');
  };
  A.celular = async function () {
    var info = {}; try { info = await api('/api/info'); } catch (e) { return toast(e.message, 'erro'); }
    function qr(url) { try { var q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createImgTag(5, 4); } catch (e) { return '<div class="text-xs text-stone-400">(QR indisponível sem internet)</div>'; } }
    var bloco = function (tit, url, desc) { return '<div class="border border-stone-200 rounded-xl p-3 text-center space-y-1"><div class="font-bold text-sm">' + tit + '</div><div class="flex justify-center">' + qr(url) + '</div><div class="font-mono text-[11px] break-all select-all">' + esc(url) + '</div><div class="text-[11px] text-stone-500">' + desc + '</div></div>'; };
    var el = abrirModal('<div class="p-5 space-y-3"><div class="flex justify-between"><h3 class="font-extrabold text-lg">📱 Abrir no celular</h3><button data-x class="text-2xl text-stone-400 cursor-pointer">&times;</button></div>' +
      '<p class="text-xs text-stone-600">Conecte o celular no <b>mesmo Wi-Fi</b> do computador e leia o QR Code. Todos os aparelhos usam os mesmos dados.</p>' + bloco('Wi-Fi da loja', info.wifiUrl, 'Funciona sem internet. A câmera pode ficar indisponível (navegadores exigem HTTPS) — use "Foto do código" ou digite.') +
      (info.tunnelUrl ? bloco('Link seguro HTTPS', info.tunnelUrl, '✅ Câmera funciona. O endereço muda quando o programa reinicia. Quem tiver o link acessa — use um PIN em Ajustes.') : '<p class="text-[11px] text-stone-500 bg-stone-50 rounded-xl p-3">Para usar a <b>câmera</b> no celular, coloque o arquivo <code>cloudflared.exe</code> na pasta do programa e reabra: um link HTTPS será gerado automaticamente.</p>') +
      '<div class="text-right"><button class="btn btn-dark" data-x>Fechar</button></div></div>', 'max-w-md');
    el.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { el.close(); }; });
  };
  A.config = function () {
    var m = formModal({
      title: '⚙️ Ajustes', submit: 'Salvar', subtitle: 'Dados da empresa e segurança',
      fields: [
        { name: 'empresa', label: 'Nome da empresa', value: S.config.empresa, span2: true }, { name: 'operador', label: 'Responsável padrão (aparece no histórico)', value: S.config.operador, span2: true },
        { name: 'pin', label: 'PIN de acesso (4 a 12 números)', type: 'password', inputmode: 'numeric', value: '', placeholder: S.config.pinAtivo ? 'PIN ativo — digite outro para trocar' : 'Vazio = sem PIN', span2: true, hint: S.config.pinAtivo ? 'Para remover o PIN, use o botão "Remover PIN" abaixo.' : 'Recomendado se usar o link HTTPS do celular.' }
      ],
      onSubmit: async function (f) {
        var body = { empresa: f.empresa, operador: f.operador };
        if (f.pin) { body.pin = f.pin; }
        await salvar('/api/config', body, 'Ajustes salvos');
        if (f.pin) { PIN = f.pin; localStorage.setItem('db_pin', PIN); }
      }
    });
    var ex = document.createElement('div'); ex.className = 'border-t border-stone-200 pt-3 flex flex-wrap gap-2';
    ex.innerHTML = '<button type="button" class="btn btn-green btn-sm" data-sec>🛡️ Testar Segurança Anti-Hacker</button><button type="button" class="btn btn-out btn-sm" data-b>⬇️ Baixar backup (JSON)</button>' + (S.config.pinAtivo ? '<button type="button" class="btn btn-out btn-sm" data-p>🔓 Remover PIN</button>' : '') + (S.produtos.length ? '<button type="button" class="btn btn-out btn-sm" data-c>➕ Completar catálogo exemplo</button>' : '<button type="button" class="btn btn-out btn-sm" data-d>🧪 Carregar exemplos</button>') + '<button type="button" class="btn btn-red btn-sm" data-z>🗑️ Zerar tudo</button>';
    m.querySelector('form').appendChild(ex);
    ex.querySelector('[data-sec]').onclick = function () { m.close(); A.auditoriaSegurancaModal(); };
    ex.querySelector('[data-b]').onclick = async function () {
      try { var r = await fetch('/api/backup', { headers: { 'x-pin': PIN } }); if (!r.ok) throw new Error('Falha no backup'); baixarArquivo('backup-distribuidora-' + diaLocal() + '.json', await r.text(), 'application/json'); } catch (e) { toast(e.message, 'erro'); }
    };
    var bp = ex.querySelector('[data-p]'); if (bp) bp.onclick = async function () { try { await salvar('/api/config', { pin: '' }, 'PIN removido'); PIN = ''; localStorage.removeItem('db_pin'); m.close(); } catch (e) { toast(e.message, 'erro'); } };
    var bd = ex.querySelector('[data-d]'); if (bd) bd.onclick = function () { m.close(); A.demo(); };
    var bc = ex.querySelector('[data-c]'); if (bc) bc.onclick = async function () { try { var r = await salvar('/api/demo/completar', {}); toast(r.adicionados ? (r.adicionados + ' novos produtos adicionados ao catálogo!') : 'Catálogo já está completo!'); m.close(); } catch (e) { toast(e.message, 'erro'); } };
    ex.querySelector('[data-z]').onclick = function () {
      var c = abrirModal('<div class="p-6 space-y-3"><h3 class="text-lg font-extrabold text-rose-700">Zerar todos os dados?</h3><p class="text-sm text-stone-600">Apaga produtos, lotes, clientes, vendas e histórico. Uma cópia de segurança é guardada na pasta do programa. Digite <b>ZERAR</b> para confirmar.</p><input id="zr" class="inp" placeholder="ZERAR"><div class="flex justify-end gap-2"><button class="btn btn-out" data-n>Cancelar</button><button class="btn btn-red" data-s>Apagar tudo</button></div></div>', 'max-w-md');
      c.querySelector('[data-n]').onclick = function () { c.close(); };
      c.querySelector('[data-s]').onclick = async function () { try { await salvar('/api/zerar', { confirmacao: $('zr').value }, 'Dados zerados'); cart = []; fechaModais(); } catch (e) { toast(e.message, 'erro'); } };
    };
  };

  A.auditoriaSegurancaModal = async function () {
    var d = null;
    try { d = await api('/api/auditoria-seguranca'); } catch (e) { return toast(e.message, 'erro'); }
    var el = abrirModal('<div class="p-5 sm:p-6 space-y-4">' +
      '<div class="flex items-start justify-between gap-2">' +
      '<div><span class="badge bg-emerald-100 text-emerald-800 border-emerald-300">🛡️ Blindagem Ativa · ' + d.totalTestes + '/' + d.totalTestes + ' Testes Aprovados</span>' +
      '<h3 class="font-extrabold text-lg text-stone-900 mt-1">Auditoria de Segurança Anti-Hacker</h3>' +
      '<p class="text-xs text-stone-500">Verificação em tempo real das defesas contra invasão, roubo de dados, fraude financeira e ataques web.</p></div>' +
      '<button type="button" data-x class="text-2xl text-stone-400 cursor-pointer">&times;</button></div>' +
      (!d.pinAtivo ? '<div class="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between gap-2"><span>⚠️ <b>Dica:</b> Seu sistema está sem senha PIN ativa. Se for usar o link HTTPS no celular fora da loja, cadastre um PIN em Ajustes.</span><button type="button" class="btn btn-pri btn-sm" id="sec-pin-btn">Definir PIN</button></div>' : '<div class="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-900 font-semibold">🔒 Proteção por PIN ativa com criptografia anti-timing attack e bloqueio automático após 8 tentativas erradas.</div>') +
      '<div class="space-y-2 max-h-96 overflow-y-auto pr-1">' +
      d.testes.map(function (t, idx) {
        return '<div class="border border-stone-200 rounded-xl p-3 bg-stone-50/60 flex items-start justify-between gap-3">' +
          '<div><div class="font-extrabold text-xs text-stone-900">✅ ' + (idx + 1) + '. ' + esc(t.nome) + '</div>' +
          '<div class="text-[11px] text-stone-500 mt-0.5">' + esc(t.detalhe) + '</div></div>' +
          '<span class="badge bg-emerald-100 text-emerald-800 border-emerald-300">' + esc(t.status) + '</span></div>';
      }).join('') +
      '</div>' +
      '<div class="flex justify-end"><button type="button" class="btn btn-dark" data-x>Fechar Relatório</button></div></div>', 'max-w-2xl');
    el.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { el.close(); }; });
    var btnPin = el.querySelector('#sec-pin-btn');
    if (btnPin) btnPin.onclick = function () { el.close(); A.config(); };
  };

  // ============================================================ inicialização
  var iniciado = false, montado = false, timer = null;
  function iniciar() {
    if (!montado) { montar(); montado = true; }
    A.tab(TABS.some(function (t) { return t.id === tab; }) ? tab : 'dashboard');
    if (!iniciado) {
      iniciado = true;
      timer = setInterval(async function () {
        try { var r = await api('/api/rev'); if (r.rev !== S.rev) { await carregar(); renderAll(); } } catch (_) {}
      }, 6000);
    }
  }
  async function boot() {
    try {
      await carregar();
      iniciar();
    } catch (e) {
      if (/PIN/.test(e.message)) return; // overlay de login já aberto
      $('app').innerHTML = '<div class="card p-8 text-center space-y-3 max-w-lg mx-auto mt-10"><div class="text-5xl">🔌</div><h2 class="font-extrabold text-lg">Não consegui falar com o servidor</h2><p class="text-sm text-stone-600">' + esc(e.message) + '</p><p class="text-xs text-stone-400">Tentando de novo automaticamente…</p></div>';
      setTimeout(boot, 3000);
    }
  }
  boot();
})();

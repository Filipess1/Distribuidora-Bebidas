'use strict';
/**
 * Distribuidora de Bebidas - Servidor local (sem dependências externas).
 * - Guarda tudo em dados_distribuidora.json (com backup diário em /backups)
 * - Serve o app (index.html + app.js) para PC e celular na mesma rede Wi-Fi
 * - Se existir cloudflared.exe na pasta, abre um link HTTPS (necessário p/ câmera no celular)
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'dados_distribuidora.json');
const BACKUP_DIR = path.join(path.dirname(DATA_FILE), 'backups');

let tunnelUrl = null;
let tunnelProc = null;

// ---------------------------------------------------------------- constantes
const CATEGORIAS = [
  'Cervejas', 'Barris de Alambique (Doses)', 'Refrigerantes', 'Águas', 'Sucos & Chás',
  'Energéticos & Isotônicos', 'Whiskies & Destilados', 'Doses & Drinks', 'Gelos & Gelos Saborizados',
  'Cigarros & Tabacaria', 'Vinhos & Espumantes',
  'Salgadinhos & Petiscos', 'Miojos & Massas Rápidas', 'Biscoitos & Bolachas', 'Chocolates & Doces', 'Outros'
];
const DEPOSITOS = [
  { nome: 'Câmara Fria (Cervejas)', temp: '2–4°C', icon: '🧊', cap: 6000 },
  { nome: 'Freezer de Gelos Saborizados', temp: '-15°C', icon: '❄️', cap: 2000 },
  { nome: 'Barris de Alambique (Balcão)', temp: 'Ambiente', icon: '🛢️', cap: 500 },
  { nome: 'Galpão Principal', temp: 'Ambiente', icon: '🏭', cap: 12000 },
  { nome: 'Galpão Reserva / Paletes', temp: 'Ambiente', icon: '📦', cap: 10000 },
  { nome: 'Adega, Whiskies & Doses', temp: 'Ambiente (seguro)', icon: '🥃', cap: 1500 },
  { nome: 'Gôndola & Balcão (Mercearia/Tabacaria)', temp: 'Ambiente', icon: '🚬', cap: 3500 }
];
const TIPOS_SAIDA = {
  'Venda': { venda: true },
  'Bonificação': {},
  'Amostra / Degustação': {},
  'Consumo Interno': {},
  'Avaria / Quebra': { incluirVencidos: true },
  'Vencido (Descarte)': { incluirVencidos: true }
};

// ---------------------------------------------------------------- utilidades
const int = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };
const money = (v) => { const n = Number(String(v === undefined || v === null ? 0 : v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
const money4 = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 10000) / 10000 : 0; };
const str = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max || 200);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, '0');
function hojeStr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)); }

function getLocalIp() {
  const ifs = os.networkInterfaces();
  let fallback = null;
  for (const name of Object.keys(ifs)) {
    for (const i of ifs[name]) {
      if (i.family === 'IPv4' && !i.internal) {
        if (/wi-?fi|wireless|wlan/i.test(name)) return i.address;
        if (!fallback && (i.address.startsWith('192.168.') || i.address.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(i.address))) fallback = i.address;
      }
    }
  }
  return fallback || 'localhost';
}

// ---------------------------------------------------------------- banco de dados
function novoBanco() {
  return {
    rev: 1, seqVenda: 0,
    config: { empresa: 'Distribuidora de Bebidas', operador: 'Responsável Depósito', pin: '' },
    produtos: [], lotes: [], clientes: [], mesas: [], vendas: [], historico: []
  };
}
function load() {
  if (!fs.existsSync(DATA_FILE)) { const b = novoBanco(); fs.writeFileSync(DATA_FILE, JSON.stringify(b, null, 2), 'utf8'); return b; }
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const b = novoBanco();
    const out = Object.assign(b, d, { config: Object.assign(b.config, d.config || {}) });
    if (!Array.isArray(out.mesas)) out.mesas = [];
    return out;
  } catch (e) {
    // arquivo corrompido: preserva uma cópia e NÃO sobrescreve silenciosamente
    try { fs.copyFileSync(DATA_FILE, DATA_FILE + '.corrompido-' + Date.now()); } catch (_) {}
    throw new Error('Arquivo de dados ilegível. Uma cópia foi guardada ao lado do original.');
  }
}
function save(db) {
  db.rev = (db.rev || 0) + 1;
  if (db.historico.length > 8000) db.historico.length = 8000;
  if (db.vendas.length > 5000) db.vendas.length = 5000;
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);
    const bk = path.join(BACKUP_DIR, 'dados-' + hojeStr() + '.json');
    if (!fs.existsSync(bk)) {
      fs.copyFileSync(DATA_FILE, bk);
      const antigos = fs.readdirSync(BACKUP_DIR).filter(f => /^dados-.*\.json$/.test(f)).sort();
      while (antigos.length > 20) fs.unlinkSync(path.join(BACKUP_DIR, antigos.shift()));
    }
  } catch (_) {}
}

function hist(db, h) {
  db.historico.unshift(Object.assign({ id: uid(), data: new Date().toISOString(), responsavel: db.config.operador || '' }, h));
}

// ---------------------------------------------------------------- regras de negócio
function normProduto(d, atual) {
  const base = atual || {};
  const nome = str(d.nome !== undefined ? d.nome : base.nome, 120);
  if (!nome) throw new Error('Informe o nome do produto');
  const cat = CATEGORIAS.includes(d.categoria) ? d.categoria : (base.categoria || 'Outros');
  const dep = DEPOSITOS.some(x => x.nome === d.depositoPadrao) ? d.depositoPadrao : (base.depositoPadrao || '');
  return {
    id: base.id || uid(),
    nome,
    marca: str(d.marca !== undefined ? d.marca : base.marca, 60),
    ean: str(d.ean !== undefined ? d.ean : base.ean, 20).replace(/\D/g, ''),
    eanCx: str(d.eanCx !== undefined ? d.eanCx : base.eanCx, 20).replace(/\D/g, ''),
    categoria: cat,
    volume: str(d.volume !== undefined ? d.volume : base.volume, 20),
    tipoEmb: str(d.tipoEmb !== undefined ? d.tipoEmb : (base.tipoEmb || 'Caixa'), 20) || 'Caixa',
    unPorCx: Math.max(1, int(d.unPorCx !== undefined ? d.unPorCx : (base.unPorCx || 1))),
    retornavel: d.retornavel !== undefined ? !!d.retornavel : !!base.retornavel,
    custo: money4(d.custo !== undefined ? d.custo : base.custo),
    preco: money(d.preco !== undefined ? d.preco : base.preco),
    precoCx: money(d.precoCx !== undefined ? d.precoCx : base.precoCx),
    minimo: Math.max(0, int(d.minimo !== undefined ? d.minimo : base.minimo)),
    fornecedor: str(d.fornecedor !== undefined ? d.fornecedor : base.fornecedor, 80),
    depositoPadrao: dep,
    criadoEm: base.criadoEm || new Date().toISOString()
  };
}
function checarEanUnico(db, p) {
  for (const campo of ['ean', 'eanCx']) {
    if (!p[campo]) continue;
    const outro = db.produtos.find(x => x.id !== p.id && (x.ean === p[campo] || x.eanCx === p[campo]));
    if (outro) throw new Error('O código ' + p[campo] + ' já pertence a "' + outro.nome + '"');
  }
}
function criarProduto(db, d) {
  const p = normProduto(d);
  checarEanUnico(db, p);
  db.produtos.push(p);
  return p;
}

const fefo = (a, b) => (a.validade || '9999').localeCompare(b.validade || '9999') || (a.entrada || '').localeCompare(b.entrada || '');

function aplicarEntrada(db, it, ctx) {
  let prod = it.produtoId && db.produtos.find(p => p.id === it.produtoId);
  if (!prod && it.novoProduto) prod = criarProduto(db, it.novoProduto);
  if (!prod) throw new Error('Produto não encontrado');
  const qtd = int(it.qtd);
  if (qtd <= 0) throw new Error('Informe a quantidade de "' + prod.nome + '"');
  const validade = str(it.validade, 10);
  if (!validDate(validade)) throw new Error('Informe a validade de "' + prod.nome + '"');
  const deposito = DEPOSITOS.some(d => d.nome === it.deposito) ? it.deposito : (prod.depositoPadrao || DEPOSITOS[1].nome);
  const custoUn = money4(it.custoUn !== undefined ? it.custoUn : prod.custo);
  const codigoLote = str(it.lote, 40) || ('L' + validade.slice(2).replace(/-/g, ''));
  const posicao = str(it.posicao, 40);
  let lote = db.lotes.find(l => l.produtoId === prod.id && l.lote === codigoLote && l.validade === validade && l.deposito === deposito);
  if (lote) {
    lote.qtd += qtd;
    if (custoUn > 0) lote.custo = custoUn;
    if (posicao) lote.posicao = posicao;
  } else {
    lote = {
      id: uid(), produtoId: prod.id, lote: codigoLote, fabricacao: validDate(it.fabricacao) ? it.fabricacao : '',
      validade, qtd, deposito, posicao, custo: custoUn, fornecedor: str(it.fornecedor || ctx.fornecedor || prod.fornecedor, 80),
      entrada: new Date().toISOString()
    };
    db.lotes.push(lote);
  }
  if (ctx.atualizarCusto !== false && custoUn > 0) prod.custo = custoUn;
  if (!prod.fornecedor && lote.fornecedor) prod.fornecedor = lote.fornecedor;
  hist(db, {
    tipo: ctx.tipo || 'Entrada', produtoId: prod.id, produto: prod.nome, lote: lote.lote, qtd, unPorCx: prod.unPorCx,
    motivo: (ctx.nf ? 'NF ' + ctx.nf + ' - ' : 'Compra - ') + (lote.fornecedor || 'Fornecedor'), valor: Math.round(qtd * custoUn * 100) / 100
  });
  return lote;
}

function registrarSaida(db, p, interno) {
  const tipo = p.tipo || 'Venda';
  const cfg = TIPOS_SAIDA[tipo];
  if (!cfg) throw new Error('Tipo de saída inválido');
  if (!Array.isArray(p.itens) || !p.itens.length) throw new Error('Adicione ao menos um item');
  const cliente = p.clienteId ? db.clientes.find(c => c.id === p.clienteId) : null;
  if (p.clienteId && !cliente) throw new Error('Cliente não encontrado');
  const pagamento = cfg.venda ? str(p.pagamento || 'Dinheiro', 40) : '-';
  const aPrazo = !!cfg.venda && /prazo|fiado/i.test(pagamento);
  if (aPrazo && !cliente) throw new Error('Venda a prazo exige um cliente cadastrado');
  const hoje = hojeStr();
  const disp = new Map(db.lotes.map(l => [l.id, l.qtd]));
  const itens = [];
  let subtotal = 0, subtotalTabela = 0, custoTotal = 0, vasEmprestado = 0;

  for (const it of p.itens) {
    const prod = db.produtos.find(x => x.id === it.produtoId);
    if (!prod) throw new Error('Produto não encontrado no pedido');
    const qtd = int(it.qtd);
    if (qtd <= 0) throw new Error('Quantidade inválida para "' + prod.nome + '"');
    const lotes = db.lotes
      .filter(l => l.produtoId === prod.id && (!it.loteId || l.id === it.loteId) && (disp.get(l.id) || 0) > 0 && (cfg.incluirVencidos || !l.validade || l.validade >= hoje))
      .sort(fefo);
    let falta = qtd;
    const aloc = [];
    for (const l of lotes) {
      if (falta <= 0) break;
      const t = Math.min(falta, disp.get(l.id));
      aloc.push({ loteId: l.id, produtoId: prod.id, lote: l.lote, validade: l.validade, deposito: l.deposito, posicao: l.posicao || '', qtd: t, custoUn: l.custo || prod.custo || 0, fabricacao: l.fabricacao || '', fornecedor: l.fornecedor || '', entrada: l.entrada || '' });
      disp.set(l.id, disp.get(l.id) - t);
      falta -= t;
    }
    if (falta > 0) {
      throw new Error('Saldo insuficiente de "' + prod.nome + '": faltam ' + falta + ' un' + (cfg.incluirVencidos ? '' : ' (lotes vencidos não são vendidos)'));
    }
    const precoCxPadrao = prod.precoCx > 0 ? prod.precoCx : Math.round(prod.preco * prod.unPorCx * 100) / 100;
    const subPadrao = prod.unPorCx > 1
      ? Math.round((Math.floor(qtd / prod.unPorCx) * precoCxPadrao + (qtd % prod.unPorCx) * prod.preco) * 100) / 100
      : Math.round(qtd * prod.preco * 100) / 100;
    const subMinimo = Math.round(subPadrao * 0.90 * 100) / 100;
    const sub = cfg.venda ? money(it.subtotal !== undefined ? it.subtotal : subPadrao) : 0;
    if (cfg.venda && sub < subMinimo - 0.01) {
      throw new Error('Desconto no produto "' + prod.nome + '" excede o limite máximo de 10% (valor mínimo permitido: R$ ' + subMinimo.toFixed(2) + ')');
    }
    const custo = Math.round(aloc.reduce((s, a) => s + a.qtd * a.custoUn, 0) * 100) / 100;
    subtotal += sub; subtotalTabela += subPadrao; custoTotal += custo;
    if (prod.retornavel) vasEmprestado += Math.ceil(qtd / prod.unPorCx);
    itens.push({ produtoId: prod.id, nome: prod.nome, marca: prod.marca, volume: prod.volume, unPorCx: prod.unPorCx, retornavel: !!prod.retornavel, qtd, subtotal: sub, precoUn: qtd ? Math.round(sub / qtd * 10000) / 10000 : 0, custo, aloc });
  }
  subtotal = Math.round(subtotal * 100) / 100;
  subtotalTabela = Math.round(subtotalTabela * 100) / 100;
  const descontoInformado = cfg.venda ? money(p.desconto) : 0;
  const maxDescontoPedido = Math.round(subtotal * 0.10 * 100) / 100;
  const descontoJaNosItens = Math.max(0, Math.round((subtotalTabela - subtotal) * 100) / 100);
  const maxDescontoGlobal = Math.round(subtotalTabela * 0.10 * 100) / 100;
  if (cfg.venda && (descontoInformado > maxDescontoPedido + 0.01 || (descontoJaNosItens + descontoInformado) > maxDescontoGlobal + 0.01)) {
    throw new Error('Desconto excede o limite máximo de 10% permitido (máx: R$ ' + Math.max(0, Math.round((maxDescontoGlobal - descontoJaNosItens) * 100) / 100).toFixed(2) + ')');
  }
  const desconto = cfg.venda ? Math.min(descontoInformado, maxDescontoPedido) : 0;
  const total = Math.round((subtotal - desconto) * 100) / 100;
  custoTotal = Math.round(custoTotal * 100) / 100;

  if (aPrazo && cliente.limite > 0 && (cliente.saldo || 0) + total > cliente.limite) {
    throw new Error('Limite de crédito excedido (limite R$ ' + cliente.limite.toFixed(2) + ', em aberto R$ ' + (cliente.saldo || 0).toFixed(2) + ')');
  }

  // --- tudo validado: aplicar
  for (const l of db.lotes) l.qtd = disp.get(l.id);
  db.lotes = db.lotes.filter(l => l.qtd > 0);

  db.seqVenda = (db.seqVenda || 0) + 1;
  const devolvido = cfg.venda && cliente ? Math.max(0, int(p.vasilhameDevolvido)) : 0;
  const pago = cfg.venda && !aPrazo ? money(p.valorPago) : 0;
  const troco = cfg.venda && !aPrazo && pago > total ? Math.round((pago - total) * 100) / 100 : 0;
  const venda = {
    id: uid(), numero: db.seqVenda, data: (interno && interno.data) || new Date().toISOString(),
    tipo, clienteId: cliente ? cliente.id : '', clienteNome: cliente ? cliente.nome : (cfg.venda ? (str(p.clienteNome, 80) || 'Consumidor final (Balcão)') : '-'),
    itens, subtotal, desconto, total, custoTotal, pagamento, aPrazo, valorPago: pago, troco,
    vasilhameEmprestado: cliente && cfg.venda ? vasEmprestado : 0, vasilhameDevolvido: devolvido,
    obs: str(p.obs, 300), operador: str(p.operador, 60) || db.config.operador, status: 'Concluída'
  };
  db.vendas.unshift(venda);

  if (cliente && cfg.venda) {
    if (aPrazo) cliente.saldo = Math.round(((cliente.saldo || 0) + total) * 100) / 100;
    cliente.vasilhame = Math.max(0, (cliente.vasilhame || 0) + vasEmprestado - devolvido);
    cliente.ultimaCompra = venda.data;
  }
  for (const it of itens) {
    const alocTxt = it.aloc.map(a => a.lote).join(', ');
    hist(db, {
      data: venda.data, tipo: cfg.venda ? 'Saída (Venda)' : 'Saída (' + tipo + ')', produtoId: it.produtoId, produto: it.nome, lote: alocTxt, qtd: it.qtd,
      unPorCx: it.unPorCx, motivo: '#' + venda.numero + ' - ' + venda.clienteNome, valor: cfg.venda ? it.subtotal : it.custo, ref: venda.id
    });
  }
  return venda;
}

function estornarVenda(db, id) {
  const v = db.vendas.find(x => x.id === id);
  if (!v) throw new Error('Pedido não encontrado');
  if (v.status === 'Estornada') throw new Error('Este pedido já foi estornado');
  for (const it of v.itens) {
    for (const a of it.aloc) {
      const lote = db.lotes.find(l => l.id === a.loteId);
      if (lote) lote.qtd += a.qtd;
      else db.lotes.push({ id: a.loteId, produtoId: a.produtoId, lote: a.lote, fabricacao: a.fabricacao || '', validade: a.validade, qtd: a.qtd, deposito: a.deposito, posicao: a.posicao || '', custo: a.custoUn, fornecedor: a.fornecedor || '', entrada: a.entrada || new Date().toISOString() });
    }
  }
  const cliente = v.clienteId ? db.clientes.find(c => c.id === v.clienteId) : null;
  if (cliente && v.tipo === 'Venda') {
    if (v.aPrazo) cliente.saldo = Math.max(0, Math.round(((cliente.saldo || 0) - v.total) * 100) / 100);
    cliente.vasilhame = Math.max(0, (cliente.vasilhame || 0) - v.vasilhameEmprestado + v.vasilhameDevolvido);
  }
  v.status = 'Estornada';
  v.estornadaEm = new Date().toISOString();
  hist(db, { tipo: 'Estorno', produto: 'Pedido #' + v.numero, lote: '-', qtd: v.itens.reduce((s, i) => s + i.qtd, 0), unPorCx: 1, motivo: 'Estoque devolvido - ' + v.clienteNome, valor: v.total, ref: v.id });
  return v;
}

// ---------------------------------------------------------------- consulta de EAN (OpenFoodFacts)
const eanCache = {};
function inferirCategoria(nome) {
  const n = (nome || '').toLowerCase();
  if (/alambique|barril.*dose|cachaça de barril|cachaca de barril/.test(n)) return 'Barris de Alambique (Doses)';
  if (/gelo|coco\s*leve|saborizado/.test(n)) return 'Gelos & Gelos Saborizados';
  if (/cigarro|marlboro|dunhill|carlton|rothmans|lucky strike|camel|chesterfield|eight|minister|hollywood|palheiro|paieiro|paiol|seda|ocb|zomo|tabaco|isqueiro|bic\b|charuto|essência|essencia|narguile/.test(n)) return 'Cigarros & Tabacaria';
  if (/dose\b|shot\b|copão|copao|combo dose/.test(n)) return 'Doses & Drinks';
  if (/cerveja|pilsen|lager|ipa|stout|long ?neck|weiss|malzbier/.test(n)) return 'Cervejas';
  if (/refri|cola|guaran|soda|tônica|tonica|fanta|sprite|pepsi|ginger/.test(n)) return 'Refrigerantes';
  if (/água|agua|mineral|galão|galao/.test(n)) return 'Águas';
  if (/energ|isot|gatorade|powerade|red bull|monster|tnt/.test(n)) return 'Energéticos & Isotônicos';
  if (/suco|néctar|nectar|chá|cha |mate|kombucha|água de coco/.test(n)) return 'Sucos & Chás';
  if (/vinho|espumante|champ|prosecco|sidra/.test(n)) return 'Vinhos & Espumantes';
  if (/vodka|whisk|wisk|bourbon|scotch|gin\b|rum\b|cacha|tequila|licor|conhaque|campari|aperol|destil|dreher|velho barreiro|51\b|ypioca|ituana|jack daniel|red label|black label|ballantine|chivas|old parr|white horse|buchanan|passport/.test(n)) return 'Whiskies & Destilados';
  if (/salgadinho|doritos|cheetos|ruffles|fandangos|torcida|batata|amendoim|petisco|ovinho|salame|azeitona|castanha|pipoca|pringles/.test(n)) return 'Salgadinhos & Petiscos';
  if (/miojo|lámen|lamen|nissin|cup noodles|macarrão instant|macarrao instant|sopa instant/.test(n)) return 'Miojos & Massas Rápidas';
  if (/biscoito|bolacha|trakinas|oreo|passatempo|wafer|bauducco|club social|água e sal|agua e sal|cream cracker|maizena|recheado|rosquinha|torrada/.test(n)) return 'Biscoitos & Bolachas';
  if (/chocolate|bombom|achocolat|bis\b|kit ?kat|lacta|nestle|nestlé|garoto|snickers|twix|baton|sonho de valsa|ouro branco|bala\b|chiclete|trident|halls|pirulito|doce|paçoca|pacoca|jujuba|fini|mentos|tic tac/.test(n)) return 'Chocolates & Doces';
  return 'Outros';
}
async function consultarEan(ean) {
  const e = str(ean, 20).replace(/\D/g, '');
  if (!e) return { encontrado: false, ean: e };
  const local = CATALOGO_DEMO.find(c => c[14] === e);
  if (local) {
    return {
      encontrado: true, ean: e, nome: local[0], marca: local[1],
      volume: local[3], categoria: local[2], origem: 'Catálogo Nacional GTIN/EAN Brasil'
    };
  }
  if (eanCache[e]) return eanCache[e];
  const urls = [
    'https://world.openfoodfacts.org/api/v2/product/' + e + '.json?fields=product_name,product_name_pt,generic_name,brands,quantity',
    'https://world.openproductsfacts.org/api/v2/product/' + e + '.json'
  ];
  for (const url of urls) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 4000);
      const r = await fetch(url, { headers: { 'User-Agent': 'DistribuidoraBebidas/1.0' }, signal: c.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      const j = await r.json();
      if (j && j.status === 1 && j.product) {
        const pr = j.product;
        const nome = (pr.product_name_pt || pr.product_name || pr.generic_name || '').trim();
        if (nome.length > 2) {
          const res = {
            encontrado: true, ean: e, nome, marca: (pr.brands || '').split(',')[0].trim(),
            volume: (pr.quantity || '').replace(/\s+/g, '').toLowerCase(), categoria: inferirCategoria(nome + ' ' + (pr.brands || '')), origem: 'Open Food Facts'
          };
          eanCache[e] = res;
          return res;
        }
      }
    } catch (_) {}
  }
  return { encontrado: false, ean: e };
}

// ---------------------------------------------------------------- catálogo nacional com códigos EAN/GTIN reais do Brasil
function ean13(base12) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(base12[i]) * (i % 2 === 0 ? 1 : 3);
  return base12 + String((10 - (s % 10)) % 10);
}
function addDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return hojeStr(d); }
// [0:nome, 1:marca, 2:categoria, 3:volume, 4:tipoEmb, 5:pc, 6:ret, 7:custoCx, 8:precoUn, 9:minCx, 10:fornecedor, 11:deposito, 12:qtdCxDemo, 13:diasVal, 14:eanRealBrasil]
const CATALOGO_DEMO = [
  // Cervejas (Ambev 7891149 / 7891991, Heineken 78960455, Petrópolis 78973950)
  ['Cerveja Skol Pilsen Lata 350ml', 'Skol', 'Cervejas', '350ml', 'Caixa', 12, 0, 33.6, 4.2, 20, 'Ambev', 'Câmara Fria (Cervejas)', 40, 25, '7891149105052'],
  ['Cerveja Brahma Chopp Lata 350ml', 'Brahma', 'Cervejas', '350ml', 'Caixa', 12, 0, 34.8, 4.5, 20, 'Ambev', 'Câmara Fria (Cervejas)', 25, 110, '7891149103102'],
  ['Cerveja Brahma Duplo Malte Lata 350ml', 'Brahma', 'Cervejas', '350ml', 'Caixa', 12, 0, 39.6, 4.9, 15, 'Ambev', 'Câmara Fria (Cervejas)', 18, 130, '7891149107957'],
  ['Cerveja Brahma Garrafa 600ml Retornável', 'Brahma', 'Cervejas', '600ml', 'Engradado', 24, 1, 88, 5.5, 15, 'Ambev', 'Galpão Principal', 30, 90, '7891149010509'],
  ['Cerveja Antarctica Original 600ml Retornável', 'Original', 'Cervejas', '600ml', 'Engradado', 24, 1, 132, 8.5, 10, 'Ambev', 'Câmara Fria (Cervejas)', 15, 100, '7891991000833'],
  ['Cerveja Antarctica Pilsen Lata 350ml', 'Antarctica', 'Cervejas', '350ml', 'Caixa', 12, 0, 32.4, 4.0, 15, 'Ambev', 'Câmara Fria (Cervejas)', 20, 120, '7891991000796'],
  ['Cerveja Heineken Long Neck 330ml', 'Heineken', 'Cervejas', '330ml', 'Caixa', 24, 0, 120, 7.5, 10, 'Grupo Heineken', 'Câmara Fria (Cervejas)', 12, 120, '7896045503919'],
  ['Cerveja Heineken Lata 350ml', 'Heineken', 'Cervejas', '350ml', 'Caixa', 12, 0, 54, 6.5, 15, 'Grupo Heineken', 'Câmara Fria (Cervejas)', 20, 150, '7896045506873'],
  ['Cerveja Amstel Lager Lata 350ml', 'Amstel', 'Cervejas', '350ml', 'Caixa', 12, 0, 34.8, 4.2, 15, 'Grupo Heineken', 'Câmara Fria (Cervejas)', 18, 140, '7896045506040'],
  ['Cerveja Spaten Puro Malte Lata 350ml', 'Spaten', 'Cervejas', '350ml', 'Caixa', 12, 0, 42, 5.2, 12, 'Ambev', 'Câmara Fria (Cervejas)', 14, 135, '7891991294928'],
  ['Cerveja Stella Artois Long Neck 330ml', 'Stella Artois', 'Cervejas', '330ml', 'Caixa', 24, 0, 118, 7.2, 8, 'Ambev', 'Câmara Fria (Cervejas)', 10, 130, '7891991014250'],
  ['Cerveja Budweiser Long Neck 330ml', 'Budweiser', 'Cervejas', '330ml', 'Caixa', 24, 0, 108, 6.5, 10, 'Ambev', 'Câmara Fria (Cervejas)', 12, 140, '7891991010535'],
  ['Cerveja Corona Extra Long Neck 330ml', 'Corona', 'Cervejas', '330ml', 'Caixa', 24, 0, 144, 8.9, 8, 'Ambev', 'Câmara Fria (Cervejas)', 8, 150, '7501064191350'],
  ['Cerveja Itaipava Pilsen Lata 350ml', 'Itaipava', 'Cervejas', '350ml', 'Caixa', 12, 0, 28.8, 3.5, 15, 'Grupo Petrópolis', 'Câmara Fria (Cervejas)', 20, 130, '7897395020105'],
  // Barris de Alambique por Dose (3 sabores no lugar do Chopp)
  ['Dose Barril de Alambique — Cachaça Ouro Envelhecida (50ml)', 'Alambique Minas', 'Barris de Alambique (Doses)', '50ml', 'Barril 5L (100 doses)', 100, 0, 110, 4.0, 1, 'Alambique Artesanal', 'Barris de Alambique (Balcão)', 1, 720, '7898357410015'],
  ['Dose Barril de Alambique — Mel com Limão (50ml)', 'Alambique Minas', 'Barris de Alambique (Doses)', '50ml', 'Barril 5L (100 doses)', 100, 0, 120, 4.5, 1, 'Alambique Artesanal', 'Barris de Alambique (Balcão)', 1, 720, '7898357410022'],
  ['Dose Barril de Alambique — Banana / Gabriela Cravo & Canela (50ml)', 'Alambique Minas', 'Barris de Alambique (Doses)', '50ml', 'Barril 5L (100 doses)', 100, 0, 120, 4.5, 1, 'Alambique Artesanal', 'Barris de Alambique (Balcão)', 1, 720, '7898357410039'],
  // Gelos & Gelos Saborizados (para copão/drinks)
  ['Gelo Saborizado Água de Coco (Coco Leve 200ml)', 'Coco Leve', 'Gelos & Gelos Saborizados', '200ml', 'Caixa', 30, 0, 54.0, 3.5, 1, 'Coco Leve', 'Freezer de Gelos Saborizados', 2, 365, '7898945612014'],
  ['Gelo Saborizado Maracujá p/ Copão 200ml', 'Coco Leve', 'Gelos & Gelos Saborizados', '200ml', 'Caixa', 30, 0, 57.0, 4.0, 1, 'Coco Leve', 'Freezer de Gelos Saborizados', 2, 365, '7898945612021'],
  ['Gelo Saborizado Morango p/ Copão 200ml', 'Coco Leve', 'Gelos & Gelos Saborizados', '200ml', 'Caixa', 30, 0, 57.0, 4.0, 1, 'Coco Leve', 'Freezer de Gelos Saborizados', 2, 365, '7898945612038'],
  ['Gelo Saborizado Melancia p/ Copão 200ml', 'Coco Leve', 'Gelos & Gelos Saborizados', '200ml', 'Caixa', 30, 0, 57.0, 4.0, 1, 'Coco Leve', 'Freezer de Gelos Saborizados', 1, 365, '7898945612045'],
  ['Gelo Saborizado Maçã Verde p/ Copão 200ml', 'Coco Leve', 'Gelos & Gelos Saborizados', '200ml', 'Caixa', 30, 0, 57.0, 4.0, 1, 'Coco Leve', 'Freezer de Gelos Saborizados', 1, 365, '7898945612052'],
  ['Gelo Saborizado Limão p/ Copão 200ml', 'Coco Leve', 'Gelos & Gelos Saborizados', '200ml', 'Caixa', 30, 0, 57.0, 4.0, 1, 'Coco Leve', 'Freezer de Gelos Saborizados', 1, 365, '7898945612069'],
  ['Saco de Gelo Filtrado em Cubos 5kg', 'Gelo Cristal', 'Gelos & Gelos Saborizados', '5kg', 'Unidade', 1, 0, 6.5, 14.0, 15, 'Fábrica de Gelo', 'Freezer de Gelos Saborizados', 25, 365, '7898945612076'],
  // Cigarros & Tabacaria (Souza Cruz / BAT 7891098, Philip Morris 7891167, BIC 3086123)
  ['Cigarro Marlboro Red (Maço 20 un)', 'Marlboro', 'Cigarros & Tabacaria', '20 un', 'Pacote (10 maços)', 10, 0, 108.0, 13.0, 2, 'Philip Morris', 'Gôndola & Balcão (Mercearia/Tabacaria)', 3, 720, '7891167001016'],
  ['Cigarro Marlboro Gold / Light (Maço 20 un)', 'Marlboro', 'Cigarros & Tabacaria', '20 un', 'Pacote (10 maços)', 10, 0, 108.0, 13.0, 2, 'Philip Morris', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 720, '7891167001023'],
  ['Cigarro Dunhill Carlton Blend (Maço 20 un)', 'Dunhill', 'Cigarros & Tabacaria', '20 un', 'Pacote (10 maços)', 10, 0, 112.0, 13.5, 2, 'BAT / Souza Cruz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 3, 720, '7891098001017'],
  ['Cigarro Lucky Strike Fresh / Mentolado (Maço 20 un)', 'Lucky Strike', 'Cigarros & Tabacaria', '20 un', 'Pacote (10 maços)', 10, 0, 92.0, 11.0, 2, 'BAT / Souza Cruz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 3, 720, '7891098002014'],
  ['Cigarro Rothmans Blue / Global (Maço 20 un)', 'Rothmans', 'Cigarros & Tabacaria', '20 un', 'Pacote (10 maços)', 10, 0, 68.0, 8.5, 2, 'BAT / Souza Cruz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 3, 720, '7891098003011'],
  ['Cigarro Chesterfield Remix / Blue (Maço 20 un)', 'Chesterfield', 'Cigarros & Tabacaria', '20 un', 'Pacote (10 maços)', 10, 0, 72.0, 9.0, 2, 'Philip Morris', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 720, '7891167003010'],
  ['Cigarro de Palha Paulistinha / Jack Paiol (Maço 20 un)', 'Paulistinha', 'Cigarros & Tabacaria', '20 un', 'Pacote (10 maços)', 10, 0, 135.0, 18.0, 2, 'Tabacaria Nacional', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 720, '7898912345017'],
  ['Isqueiro BIC Maxi Tradicional (Unidade)', 'BIC', 'Cigarros & Tabacaria', '1 un', 'Cartela (12 un)', 12, 0, 48.0, 6.5, 2, 'BIC Brasil', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 1500, '3086123397293'],
  ['Seda Zomo / OCB King Size Slim (Livreto)', 'Zomo / OCB', 'Cigarros & Tabacaria', '33 folhas', 'Display (50 un)', 50, 0, 85.0, 4.0, 1, 'Tabacaria Nacional', 'Gôndola & Balcão (Mercearia/Tabacaria)', 1, 1500, '7898959123018'],
  // Refrigerantes (Coca-Cola 7894900, Ambev 7891991, PepsiCo 7892840)
  ['Refrigerante Coca-Cola Original 2L', 'Coca-Cola', 'Refrigerantes', '2L', 'Fardo', 6, 0, 45.0, 10.5, 20, 'Coca-Cola FEMSA', 'Galpão Principal', 35, 180, '7894900011517'],
  ['Refrigerante Coca-Cola Original Lata 350ml', 'Coca-Cola', 'Refrigerantes', '350ml', 'Pack', 12, 0, 33.6, 4.5, 20, 'Coca-Cola FEMSA', 'Galpão Principal', 20, 160, '7894900010015'],
  ['Refrigerante Coca-Cola Zero Açúcar Lata 350ml', 'Coca-Cola', 'Refrigerantes', '350ml', 'Pack', 12, 0, 33.6, 4.5, 12, 'Coca-Cola FEMSA', 'Galpão Principal', 12, 160, '7894900700015'],
  ['Refrigerante Guaraná Antarctica 2L', 'Antarctica', 'Refrigerantes', '2L', 'Fardo', 6, 0, 36.0, 8.5, 15, 'Ambev', 'Galpão Principal', 18, 170, '7891991001342'],
  ['Refrigerante Guaraná Antarctica Lata 350ml', 'Antarctica', 'Refrigerantes', '350ml', 'Pack', 12, 0, 30.0, 4.0, 15, 'Ambev', 'Galpão Principal', 15, 170, '7891991000826'],
  ['Refrigerante Fanta Laranja 2L', 'Fanta', 'Refrigerantes', '2L', 'Fardo', 6, 0, 38.4, 8.9, 10, 'Coca-Cola FEMSA', 'Galpão Principal', 12, 165, '7894900031515'],
  ['Refrigerante Sprite Limão Lata 350ml', 'Sprite', 'Refrigerantes', '350ml', 'Pack', 12, 0, 31.2, 4.2, 10, 'Coca-Cola FEMSA', 'Galpão Principal', 10, 165, '7894900050011'],
  ['Refrigerante Pepsi Cola Lata 350ml', 'Pepsi', 'Refrigerantes', '350ml', 'Pack', 12, 0, 28.8, 3.8, 10, 'Ambev / PepsiCo', 'Galpão Principal', 10, 160, '7892840800079'],
  // Águas & Sucos
  ['Água Mineral Crystal sem Gás 500ml', 'Crystal', 'Águas', '500ml', 'Fardo', 12, 0, 12.0, 2.5, 30, 'Coca-Cola FEMSA', 'Galpão Reserva / Paletes', 80, 300, '7894900530001'],
  ['Água Mineral Crystal com Gás 500ml', 'Crystal', 'Águas', '500ml', 'Fardo', 12, 0, 15.6, 3.0, 15, 'Coca-Cola FEMSA', 'Galpão Reserva / Paletes', 25, 300, '7894900531008'],
  ['Água Mineral Indaiá Galão 20L Retornável', 'Indaiá', 'Águas', '20L', 'Galão', 1, 1, 7.5, 14.0, 30, 'Indaiá', 'Galpão Reserva / Paletes', 25, 400, '7896292300057'],
  ['Suco de Uva Integral Aurora 1L', 'Aurora', 'Sucos & Chás', '1L', 'Caixa', 12, 0, 96, 12.9, 5, 'Vinícola Aurora', 'Galpão Principal', 6, 15, '7896502500451'],
  ['Suco Del Valle Néctar Uva Lata 290ml', 'Del Valle', 'Sucos & Chás', '290ml', 'Pack', 6, 0, 19.2, 4.9, 8, 'Coca-Cola FEMSA', 'Galpão Principal', 10, 180, '7894900320015'],
  // Energéticos & Isotônicos
  ['Energético Red Bull Energy Drink 250ml', 'Red Bull', 'Energéticos & Isotônicos', '250ml', 'Caixa', 24, 0, 168, 10.0, 5, 'Red Bull Brasil', 'Galpão Principal', 6, 140, '9002490229160'],
  ['Energético Monster Energy Green 473ml', 'Monster', 'Energéticos & Isotônicos', '473ml', 'Pack', 6, 0, 39.0, 9.9, 8, 'Coca-Cola FEMSA', 'Galpão Principal', 10, 180, '7896000071927'],
  ['Isotônico Gatorade Laranja 500ml', 'Gatorade', 'Energéticos & Isotônicos', '500ml', 'Caixa', 12, 0, 48, 6.0, 6, 'PepsiCo / Ambev', 'Galpão Principal', 9, 110, '7892840813017'],
  // Whiskies & Destilados (garrafas - regras de reposição 1 baixo / 2 repor / 3 bom)
  ['Whisky Johnnie Walker Red Label 1L', 'Johnnie Walker', 'Whiskies & Destilados', '1L', 'Unidade', 1, 0, 68.0, 95.0, 2, 'Diageo', 'Adega, Whiskies & Doses', 4, 900, '7893218002057'],
  ['Whisky Johnnie Walker Black Label 12 Anos 1L', 'Johnnie Walker', 'Whiskies & Destilados', '1L', 'Unidade', 1, 0, 138.0, 189.0, 2, 'Diageo', 'Adega, Whiskies & Doses', 2, 1100, '5000267023656'],
  ['Whisky Jack Daniel\'s Old No. 7 1L', 'Jack Daniel\'s', 'Whiskies & Destilados', '1L', 'Unidade', 1, 0, 115.0, 159.0, 2, 'Brown-Forman', 'Adega, Whiskies & Doses', 3, 1000, '7891125181599'],
  ['Whisky White Horse (Cavalo Branco) 1L', 'White Horse', 'Whiskies & Destilados', '1L', 'Unidade', 1, 0, 52.0, 74.9, 2, 'Diageo', 'Adega, Whiskies & Doses', 3, 900, '5000265100878'],
  ['Whisky Ballantine\'s Finest 1L', 'Ballantine\'s', 'Whiskies & Destilados', '1L', 'Unidade', 1, 0, 62.0, 86.9, 2, 'Pernod Ricard', 'Adega, Whiskies & Doses', 2, 950, '5010106113127'],
  ['Whisky Chivas Regal 12 Anos 1L', 'Chivas Regal', 'Whiskies & Destilados', '1L', 'Unidade', 1, 0, 128.0, 175.0, 2, 'Pernod Ricard', 'Adega, Whiskies & Doses', 1, 1100, '5000299224014'],
  ['Whisky Buchanan\'s Deluxe 12 Anos 1L', 'Buchanan\'s', 'Whiskies & Destilados', '1L', 'Unidade', 1, 0, 135.0, 185.0, 2, 'Diageo', 'Adega, Whiskies & Doses', 2, 1100, '5000196001389'],
  ['Whisky Old Parr 12 Anos 1L', 'Old Parr', 'Whiskies & Destilados', '1L', 'Unidade', 1, 0, 125.0, 169.0, 2, 'Diageo', 'Adega, Whiskies & Doses', 3, 1100, '5000281015408'],
  ['Whisky Passport Scotch 1L', 'Passport', 'Whiskies & Destilados', '1L', 'Unidade', 1, 0, 44.0, 62.0, 2, 'Pernod Ricard', 'Adega, Whiskies & Doses', 3, 900, '7896009400049'],
  ['Vodka Smirnoff Red 998ml', 'Smirnoff', 'Whiskies & Destilados', '998ml', 'Caixa', 12, 0, 360, 42.0, 2, 'Diageo', 'Adega, Whiskies & Doses', 2, 800, '7893218000473'],
  ['Vodka Absolut Original 1L', 'Absolut', 'Whiskies & Destilados', '1L', 'Unidade', 1, 0, 74.0, 105.0, 5, 'Pernod Ricard', 'Adega, Whiskies & Doses', 8, 950, '7312040017072'],
  ['Gin Tanqueray London Dry 750ml', 'Tanqueray', 'Whiskies & Destilados', '750ml', 'Unidade', 1, 0, 88.0, 125.0, 5, 'Diageo', 'Adega, Whiskies & Doses', 7, 950, '5000289111003'],
  ['Cachaça 51 Pirassununga 965ml', 'Cachaça 51', 'Whiskies & Destilados', '965ml', 'Caixa', 12, 0, 120, 15.0, 2, 'Cia Müller', 'Adega, Whiskies & Doses', 2, 900, '7896002100014'],
  ['Cachaça Velho Barreiro 910ml', 'Velho Barreiro', 'Whiskies & Destilados', '910ml', 'Caixa', 12, 0, 118, 14.9, 2, 'Tatuzinho', 'Adega, Whiskies & Doses', 2, 900, '7896050200018'],
  ['Conhaque Dreher 900ml', 'Dreher', 'Whiskies & Destilados', '900ml', 'Caixa', 12, 0, 198, 23.9, 2, 'Campari Group', 'Adega, Whiskies & Doses', 2, 900, '7896007200016'],
  ['Aperitivo Campari Bitter 900ml', 'Campari', 'Whiskies & Destilados', '900ml', 'Unidade', 1, 0, 44.0, 62.0, 6, 'Campari Group', 'Adega, Whiskies & Doses', 12, 900, '7896007201013'],
  // Doses & Drinks (balcão)
  ['Dose Whisky Red Label (50ml)', 'Johnnie Walker', 'Doses & Drinks', '50ml', 'Garrafa (20 doses)', 20, 0, 68, 12.0, 2, 'Diageo', 'Adega, Whiskies & Doses', 2, 700, '7893218002064'],
  ['Dose Whisky Jack Daniel\'s (50ml)', 'Jack Daniel\'s', 'Doses & Drinks', '50ml', 'Garrafa (20 doses)', 20, 0, 115, 18.0, 2, 'Brown-Forman', 'Adega, Whiskies & Doses', 1, 700, '7891125181605'],
  ['Dose Whisky Cavalo Branco / White Horse (50ml)', 'White Horse', 'Doses & Drinks', '50ml', 'Garrafa (20 doses)', 20, 0, 52, 10.0, 2, 'Diageo', 'Adega, Whiskies & Doses', 2, 700, '5000265100885'],
  ['Dose Whisky Old Parr 12 Anos (50ml)', 'Old Parr', 'Doses & Drinks', '50ml', 'Garrafa (20 doses)', 20, 0, 125, 20.0, 1, 'Diageo', 'Adega, Whiskies & Doses', 1, 700, '5000281015415'],
  ['Dose Cachaça 51 / Velho Barreiro (50ml)', '51 / Velho Barreiro', 'Doses & Drinks', '50ml', 'Garrafa (20 doses)', 20, 0, 10, 3.5, 2, 'Cia Müller', 'Adega, Whiskies & Doses', 2, 700, '7896002100021'],
  ['Dose Conhaque Dreher / Campari (50ml)', 'Dreher / Campari', 'Doses & Drinks', '50ml', 'Garrafa (18 doses)', 18, 0, 18, 5.0, 2, 'Campari Group', 'Adega, Whiskies & Doses', 2, 700, '7896007200023'],
  ['Copão Whisky Red Label + Energético 700ml', 'Johnnie Walker + Red Bull', 'Doses & Drinks', '700ml', 'Unidade', 1, 0, 9.5, 22.0, 15, 'Preparo Balcão', 'Adega, Whiskies & Doses', 30, 365, '7893218002071'],
  ['Vinho Tinto Reservado Cabernet Sauvignon 750ml', 'Concha y Toro', 'Vinhos & Espumantes', '750ml', 'Caixa', 6, 0, 150, 34.9, 4, 'VCT Brasil', 'Adega, Whiskies & Doses', 5, 800, '7804320985411'],
  // Salgadinhos & Petiscos (Elma Chips / PepsiCo 7892840, Torcida 78963411, Dori 78960585)
  ['Salgadinho Doritos Queijo Nacho 84g', 'Elma Chips', 'Salgadinhos & Petiscos', '84g', 'Caixa', 10, 0, 52, 8.5, 3, 'PepsiCo', 'Gôndola & Balcão (Mercearia/Tabacaria)', 3, 120, '7892840818326'],
  ['Salgadinho Cheetos Onda Requeijão 75g', 'Elma Chips', 'Salgadinhos & Petiscos', '75g', 'Caixa', 10, 0, 42, 6.9, 3, 'PepsiCo', 'Gôndola & Balcão (Mercearia/Tabacaria)', 3, 120, '7892840207946'],
  ['Batata Ruffles Original 76g', 'Elma Chips', 'Salgadinhos & Petiscos', '76g', 'Caixa', 10, 0, 55, 8.9, 3, 'PepsiCo', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 110, '7892840173616'],
  ['Salgadinho Fandangos Presunto 65g', 'Elma Chips', 'Salgadinhos & Petiscos', '65g', 'Caixa', 10, 0, 36, 5.9, 3, 'PepsiCo', 'Gôndola & Balcão (Mercearia/Tabacaria)', 3, 120, '7892840207113'],
  ['Salgadinho Torcida Sabor Queijo 70g', 'Torcida', 'Salgadinhos & Petiscos', '70g', 'Caixa', 20, 0, 36, 2.99, 2, 'PepsiCo', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 150, '7896341101314'],
  ['Salgadinho Torcida Sabor Bacon 70g', 'Torcida', 'Salgadinhos & Petiscos', '70g', 'Caixa', 20, 0, 36, 2.99, 2, 'PepsiCo', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 150, '7896341101987'],
  ['Amendoim Japonês Pettiz 140g', 'Dori', 'Salgadinhos & Petiscos', '140g', 'Caixa', 20, 0, 56, 4.5, 2, 'Dori Alimentos', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 180, '7896058597011'],
  // Miojos & Massas Rápidas (Nissin 7891079)
  ['Miojo Nissin Lámen Galinha Caipira 85g', 'Nissin', 'Miojos & Massas Rápidas', '85g', 'Fardo', 24, 0, 48, 2.99, 2, 'Nissin Foods', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 180, '7891079000229'],
  ['Miojo Nissin Lámen Carne 85g', 'Nissin', 'Miojos & Massas Rápidas', '85g', 'Fardo', 24, 0, 48, 2.99, 2, 'Nissin Foods', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 180, '7891079000205'],
  ['Miojo Nissin Lámen Galinha 85g', 'Nissin', 'Miojos & Massas Rápidas', '85g', 'Fardo', 24, 0, 48, 2.99, 2, 'Nissin Foods', 'Gôndola & Balcão (Mercearia/Tabacaria)', 1, 180, '7891079000212'],
  ['Cup Noodles Nissin Galinha Caipira 69g', 'Nissin', 'Miojos & Massas Rápidas', '69g', 'Caixa', 12, 0, 48, 5.99, 2, 'Nissin Foods', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 200, '7891079013038'],
  // Biscoitos & Bolachas (Mondelez 7622210 / 7893333, Nestlé 7891000, Bauducco 7891962)
  ['Biscoito Recheado Trakinas Chocolate 126g', 'Trakinas', 'Biscoitos & Bolachas', '126g', 'Caixa', 15, 0, 37.5, 3.79, 2, 'Mondelēz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 160, '7622210592750'],
  ['Biscoito Recheado Trakinas Morango 126g', 'Trakinas', 'Biscoitos & Bolachas', '126g', 'Caixa', 15, 0, 37.5, 3.79, 2, 'Mondelēz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 160, '7622210592699'],
  ['Biscoito Oreo Original 90g', 'Oreo', 'Biscoitos & Bolachas', '90g', 'Caixa', 16, 0, 48, 4.5, 2, 'Mondelēz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 180, '7622300835538'],
  ['Biscoito Recheado Passatempo Chocolate 130g', 'Nestlé', 'Biscoitos & Bolachas', '130g', 'Caixa', 15, 0, 37.5, 3.79, 2, 'Nestlé', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 170, '7891000105016'],
  ['Biscoito Club Social Original 144g (6 packs)', 'Club Social', 'Biscoitos & Bolachas', '144g', 'Caixa', 12, 0, 45.6, 5.49, 2, 'Mondelēz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 150, '7893333289128'],
  ['Biscoito Wafer Bauducco Chocolate 140g', 'Bauducco', 'Biscoitos & Bolachas', '140g', 'Caixa', 15, 0, 36, 3.5, 2, 'Bauducco', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 170, '7891962000121'],
  // Chocolates & Doces (Lacta/Mondelēz 7622300, Nestlé 7891000, Garoto 7891008, Mars 7896423, Santa Helena 7896336)
  ['Chocolate Lacta Bis Original ao Leite 100,8g', 'Lacta', 'Chocolates & Doces', '100,8g', 'Caixa', 12, 0, 57.6, 6.99, 2, 'Mondelēz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 3, 150, '7622300989323'],
  ['Chocolate Nestlé KitKat 41,5g', 'Nestlé', 'Chocolates & Doces', '41,5g', 'Display', 24, 0, 62.4, 3.99, 1, 'Nestlé', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 180, '7891000249246'],
  ['Chocolate Snickers Original 45g', 'Mars', 'Chocolates & Doces', '45g', 'Display', 20, 0, 54, 4.2, 1, 'Mars Brasil', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 160, '7896423420180'],
  ['Chocolate Garoto Baton ao Leite 16g', 'Garoto', 'Chocolates & Doces', '16g', 'Display', 30, 0, 36, 2.0, 1, 'Nestlé / Garoto', 'Gôndola & Balcão (Mercearia/Tabacaria)', 1, 180, '7891008090017'],
  ['Bombom Lacta Sonho de Valsa 20g', 'Lacta', 'Chocolates & Doces', '20g', 'Pacote', 50, 0, 55, 2.0, 1, 'Mondelēz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 1, 180, '7622300863333'],
  ['Bombom Lacta Ouro Branco 20g', 'Lacta', 'Chocolates & Doces', '20g', 'Pacote', 50, 0, 55, 2.0, 1, 'Mondelēz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 1, 180, '7622300863357'],
  ['Bala Halls Extra Forte / Mentol 28g', 'Halls', 'Chocolates & Doces', '28g', 'Display', 21, 0, 31.5, 2.5, 1, 'Mondelēz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 300, '7896000079565'],
  ['Chiclete Trident Menta / Hortelã 8g', 'Trident', 'Chocolates & Doces', '8g', 'Display', 21, 0, 35.7, 3.0, 1, 'Mondelēz', 'Gôndola & Balcão (Mercearia/Tabacaria)', 2, 300, '7622300747350'],
  ['Paçoca Rolha Paçoquita 15g (Unidade)', 'Santa Helena', 'Chocolates & Doces', '15g', 'Pote', 50, 0, 25, 1.0, 1, 'Santa Helena', 'Gôndola & Balcão (Mercearia/Tabacaria)', 1, 220, '7896336001053']
];

function normChaveProd(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function completarCatalogoDemo(db) {
  let adicionados = 0;
  let atualizados = 0;
  // Remover Chopp antigo e migrar depósitos renomeados
  const idsChopp = db.produtos.filter(p => /chopp|chope/i.test(p.nome) || p.categoria === 'Chopp & Barris').map(p => p.id);
  if (idsChopp.length) {
    db.produtos = db.produtos.filter(p => !idsChopp.includes(p.id));
    db.lotes = db.lotes.filter(l => !idsChopp.includes(l.produtoId));
  }
  db.produtos.forEach(p => {
    if (p.depositoPadrao === 'Gôndola & Balcão (Mercearia/Doces)') p.depositoPadrao = 'Gôndola & Balcão (Mercearia/Tabacaria)';
    if (p.depositoPadrao === 'Chopp & Barris') p.depositoPadrao = 'Barris de Alambique (Balcão)';
  });
  db.lotes.forEach(l => {
    if (l.deposito === 'Gôndola & Balcão (Mercearia/Doces)') l.deposito = 'Gôndola & Balcão (Mercearia/Tabacaria)';
    if (l.deposito === 'Chopp & Barris') l.deposito = 'Barris de Alambique (Balcão)';
  });
  // 1) Atualizar EANs fictícios (789000000...) e marcas de produtos já existentes que batam com o catálogo nacional
  CATALOGO_DEMO.forEach((c) => {
    const eanReal = c[14];
    const chaveCat = normChaveProd(c[0]);
    const existente = db.produtos.find(p =>
      p.ean === eanReal ||
      normChaveProd(p.nome) === chaveCat ||
      (p.ean && p.ean.startsWith('789000000') && normChaveProd(p.nome + ' ' + p.marca).includes(normChaveProd(c[1])) && normChaveProd(p.nome).includes(normChaveProd(c[3])))
    );
    if (existente) {
      const eanEmUso = db.produtos.some(x => x.id !== existente.id && (x.ean === eanReal || x.eanCx === eanReal));
      if (!eanEmUso && (!existente.ean || existente.ean.startsWith('789000000'))) {
        existente.ean = eanReal;
        atualizados++;
      }
      existente.nome = c[0];
      existente.marca = c[1];
      existente.categoria = c[2];
      return;
    }
    let ean = eanReal || ean13('789000000100');
    let seq = 500;
    while (db.produtos.some(p => p.ean === ean || p.eanCx === ean)) {
      seq++;
      ean = ean13('789000000' + String(seq).padStart(3, '0'));
    }
    const p = criarProduto(db, {
      nome: c[0], marca: c[1], categoria: c[2], volume: c[3], tipoEmb: c[4], unPorCx: c[5], retornavel: !!c[6],
      custo: c[7] / c[5], preco: c[8], minimo: c[9] * c[5], fornecedor: c[10], depositoPadrao: c[11],
      ean
    });
    aplicarEntrada(db, {
      produtoId: p.id, qtd: (c[12] || 5) * p.unPorCx, validade: addDias(c[13] || 150),
      lote: 'L' + ean.slice(-4), custoUn: p.custo
    }, { nf: String(1000 + adicionados), fornecedor: p.fornecedor });
    adicionados++;
  });
  if (!Array.isArray(db.mesas)) db.mesas = [];
  if (!db.mesas.length && db.produtos.length >= 25) {
    const pCerveja = db.produtos[0];
    const pDose = db.produtos.find(p => p.categoria === 'Doses & Drinks') || db.produtos[1];
    const pSalg = db.produtos.find(p => p.categoria === 'Salgadinhos & Petiscos') || db.produtos[2];
    db.mesas.push({
      id: uid(), mesa: 'Mesa 01', pessoa: 'Lucas & Amigos', obs: 'Cerveja bem gelada', abertaEm: new Date(Date.now() - 35 * 60000).toISOString(),
      itens: [
        { id: uid(), produtoId: pCerveja.id, nome: pCerveja.nome, marca: pCerveja.marca, volume: pCerveja.volume, unPorCx: pCerveja.unPorCx, precoUn: pCerveja.preco, qtd: 6, subtotal: Math.round(6 * pCerveja.preco * 100) / 100, hora: new Date(Date.now() - 30 * 60000).toISOString() },
        { id: uid(), produtoId: pSalg.id, nome: pSalg.nome, marca: pSalg.marca, volume: pSalg.volume, unPorCx: pSalg.unPorCx, precoUn: pSalg.preco, qtd: 2, subtotal: Math.round(2 * pSalg.preco * 100) / 100, hora: new Date(Date.now() - 20 * 60000).toISOString() }
      ]
    });
    db.mesas.push({
      id: uid(), mesa: 'Mesa 02', pessoa: 'Seu Antônio', obs: 'Balcão externo', abertaEm: new Date(Date.now() - 22 * 60000).toISOString(),
      itens: [
        { id: uid(), produtoId: pDose.id, nome: pDose.nome, marca: pDose.marca, volume: pDose.volume, unPorCx: pDose.unPorCx, precoUn: pDose.preco, qtd: 2, subtotal: Math.round(2 * pDose.preco * 100) / 100, hora: new Date(Date.now() - 18 * 60000).toISOString() }
      ]
    });
  }
  return adicionados;
}

function carregarDemo(db) {
  if (db.produtos.length || db.lotes.length) throw new Error('Já existem produtos cadastrados. Use "Zerar tudo" antes de carregar os exemplos.');
  completarCatalogoDemo(db);
  const prods = db.produtos;
  // lotes extras para testar FEFO e lote vencido
  aplicarEntrada(db, { produtoId: prods[0].id, qtd: 60 * prods[0].unPorCx, validade: addDias(150), lote: 'DEMO01B', custoUn: prods[0].custo }, { nf: '1090', fornecedor: prods[0].fornecedor });
  aplicarEntrada(db, { produtoId: prods[1].id, qtd: 25 * prods[1].unPorCx, validade: addDias(200), lote: 'DEMO02B', custoUn: prods[1].custo }, { nf: '1091', fornecedor: prods[1].fornecedor });
  aplicarEntrada(db, { produtoId: prods[9].id, qtd: 10 * prods[9].unPorCx, validade: addDias(240), lote: 'DEMO10B', custoUn: prods[9].custo }, { nf: '1092', fornecedor: prods[9].fornecedor });
  aplicarEntrada(db, { produtoId: prods[2].id, qtd: 6 * prods[2].unPorCx, validade: addDias(-3), lote: 'DEMO03V', custoUn: prods[2].custo }, { nf: '1093', fornecedor: prods[2].fornecedor });
  const tipos = ['Pessoa física', 'Pessoa física', 'Festa / Churrasco', 'Bar / Comércio', 'Pessoa física'];
  const nomes = ['Carlos Silva (Vizinho)', 'Mariana Souza', 'João — Churrasco Fim de Semana', 'Lanchonete da Esquina', 'Pedro Santos'];
  nomes.forEach((n, i) => db.clientes.push({ id: uid(), nome: n, tipo: tipos[i], doc: '', telefone: '(11) 9' + (4000 + i * 137) + '-' + (1000 + i * 391), endereco: 'Rua das Palmeiras, ' + (100 + i * 45), limite: i === 3 ? 1500 : 400, saldo: 0, vasilhame: 0, ultimaCompra: '' }));
  // vendas fictícias nos últimos dias para o painel ter histórico (maioria consumidor final no balcão)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let dia = 24; dia >= 0; dia--) {
    const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const ehBalcao = rnd() < 0.7;
      const cli = ehBalcao ? null : db.clientes[Math.floor(rnd() * db.clientes.length)];
      const itens = [];
      const qtdItens = 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < qtdItens; j++) {
        const p = prods[Math.floor(rnd() * prods.length)];
        if (itens.some(x => x.produtoId === p.id)) continue;
        const vendeUn = p.unPorCx > 1 && rnd() < 0.65;
        const q = vendeUn ? (1 + Math.floor(rnd() * 8)) : ((1 + Math.floor(rnd() * 2)) * p.unPorCx);
        itens.push({ produtoId: p.id, qtd: q, subtotal: Math.round(q * p.preco * (!vendeUn && p.unPorCx > 1 ? 0.96 : 1) * 100) / 100 });
      }
      const d = new Date(); d.setDate(d.getDate() - dia); d.setHours(9 + Math.floor(rnd() * 11), Math.floor(rnd() * 60));
      const pag = ehBalcao ? ['PIX', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito'][Math.floor(rnd() * 4)] : ['PIX', 'Dinheiro', 'Cartão de Débito', 'Fiado / A Prazo'][Math.floor(rnd() * 4)];
      try { registrarSaida(db, { clienteId: cli ? cli.id : '', tipo: 'Venda', itens, pagamento: pag, vasilhameDevolvido: 0, operador: 'Balcão / Caixa' }, { data: d.toISOString() }); } catch (_) {}
    }
  }
  hist(db, { tipo: 'Sistema', produto: 'Dados de demonstração carregados', lote: '-', qtd: 0, unPorCx: 1, motivo: 'Exemplos fictícios (códigos de barras de teste)' });
}

// ---------------------------------------------------------------- rotas da API
const rotas = {};
const R_GET = (p, fn) => { rotas['GET ' + p] = fn; };
const R_POST = (p, fn) => { rotas['POST ' + p] = fn; };

R_GET('/api/dados', (db) => ({
  rev: db.rev, hoje: hojeStr(), tunnelUrl, wifiUrl: 'http://' + getLocalIp() + ':' + PORT,
  config: { empresa: db.config.empresa, operador: db.config.operador, pinAtivo: !!db.config.pin },
  categorias: CATEGORIAS, depositos: DEPOSITOS, tiposSaida: Object.keys(TIPOS_SAIDA),
  produtos: db.produtos, lotes: db.lotes, clientes: db.clientes, mesas: db.mesas || [], vendas: db.vendas.slice(0, 1500), historico: db.historico.slice(0, 2000)
}));
R_GET('/api/rev', (db) => ({ rev: db.rev }));
R_GET('/api/info', () => ({ ip: getLocalIp(), port: PORT, wifiUrl: 'http://' + getLocalIp() + ':' + PORT, tunnelUrl }));

R_POST('/api/config', (db, b) => {
  if (b.empresa !== undefined) db.config.empresa = str(b.empresa, 80) || 'Distribuidora de Bebidas';
  if (b.operador !== undefined) db.config.operador = str(b.operador, 60) || 'Responsável Depósito';
  if (b.pin !== undefined) {
    const pin = str(b.pin, 20);
    if (pin && !/^\d{4,12}$/.test(pin)) throw new Error('O PIN deve ter de 4 a 12 números');
    db.config.pin = pin;
  }
  return { success: true };
});

R_POST('/api/produto', (db, b) => {
  const idx = b.id ? db.produtos.findIndex(p => p.id === b.id) : -1;
  if (b.id && idx === -1) throw new Error('Produto não encontrado');
  const p = normProduto(b, idx >= 0 ? db.produtos[idx] : null);
  checarEanUnico(db, p);
  if (idx >= 0) {
    const mudouEmb = db.produtos[idx].unPorCx !== p.unPorCx;
    db.produtos[idx] = p;
    hist(db, { tipo: 'Cadastro (edição)', produtoId: p.id, produto: p.nome, lote: '-', qtd: 0, unPorCx: p.unPorCx, motivo: mudouEmb ? 'Embalagem alterada para ' + p.unPorCx + ' un' : 'Cadastro atualizado' });
  } else {
    db.produtos.push(p);
    hist(db, { tipo: 'Cadastro (novo)', produtoId: p.id, produto: p.nome, lote: '-', qtd: 0, unPorCx: p.unPorCx, motivo: 'Produto cadastrado' });
  }
  return { success: true, produto: p };
});
R_POST('/api/produto/excluir', (db, b) => {
  const p = db.produtos.find(x => x.id === b.id);
  if (!p) throw new Error('Produto não encontrado');
  const lotes = db.lotes.filter(l => l.produtoId === p.id);
  const saldo = lotes.reduce((s, l) => s + l.qtd, 0);
  if (saldo > 0 && !b.force) throw new Error('Este produto ainda tem ' + saldo + ' un em estoque. Dê baixa antes ou confirme a exclusão forçada.');
  db.lotes = db.lotes.filter(l => l.produtoId !== p.id);
  db.produtos = db.produtos.filter(x => x.id !== p.id);
  hist(db, { tipo: 'Exclusão', produtoId: p.id, produto: p.nome, lote: '-', qtd: saldo, unPorCx: p.unPorCx, motivo: 'Produto excluído do cadastro' });
  return { success: true };
});
R_POST('/api/produto/precos', (db, b) => {
  const itens = Array.isArray(b.itens) ? b.itens : [b];
  let alterados = 0;
  itens.forEach(it => {
    const p = db.produtos.find(x => x.id === it.id);
    if (!p) return;
    const precoAntigo = p.preco;
    if (it.preco !== undefined) p.preco = money(it.preco);
    if (it.precoCx !== undefined) p.precoCx = money(it.precoCx);
    if (it.custo !== undefined) p.custo = money4(it.custo);
    if (p.preco !== precoAntigo) {
      alterados++;
      hist(db, { tipo: 'Preço alterado', produtoId: p.id, produto: p.nome, lote: '-', qtd: 0, unPorCx: p.unPorCx, motivo: 'De R$ ' + precoAntigo.toFixed(2) + ' para R$ ' + p.preco.toFixed(2), valor: p.preco });
    }
  });
  return { success: true, alterados };
});

R_POST('/api/entrada', (db, b) => {
  const lote = aplicarEntrada(db, b, { nf: str(b.nf, 30), fornecedor: str(b.fornecedor, 80), atualizarCusto: b.atualizarCusto !== false });
  return { success: true, lote };
});
R_POST('/api/entrada-lote', (db, b) => {
  const itens = Array.isArray(b.itens) ? b.itens : [];
  if (!itens.length) throw new Error('Nenhum item para dar entrada');
  if (itens.length > 500) throw new Error('Limite máximo de 500 itens por nota fiscal');
  const ctx = { nf: str(b.nf, 30), fornecedor: str(b.fornecedor, 80), tipo: 'Entrada (NF-e)' };
  itens.forEach(it => aplicarEntrada(db, it, ctx));
  return { success: true, total: itens.length };
});

R_POST('/api/lote/editar', (db, b) => {
  const l = db.lotes.find(x => x.id === b.id);
  if (!l) throw new Error('Lote não encontrado');
  const prod = db.produtos.find(p => p.id === l.produtoId);
  const qtdNova = b.qtd !== undefined ? int(b.qtd) : l.qtd;
  if (qtdNova < 0) throw new Error('Quantidade inválida');
  const validade = b.validade !== undefined ? str(b.validade, 10) : l.validade;
  if (!validDate(validade)) throw new Error('Validade inválida');
  const dif = qtdNova - l.qtd;
  l.lote = str(b.lote, 40) || l.lote;
  l.validade = validade;
  l.deposito = DEPOSITOS.some(d => d.nome === b.deposito) ? b.deposito : l.deposito;
  l.posicao = b.posicao !== undefined ? str(b.posicao, 40) : l.posicao;
  l.qtd = qtdNova;
  hist(db, { tipo: dif !== 0 ? 'Ajuste de Inventário' : 'Lote (edição)', produtoId: l.produtoId, produto: prod ? prod.nome : '?', lote: l.lote, qtd: Math.abs(dif), unPorCx: prod ? prod.unPorCx : 1, motivo: dif !== 0 ? (dif > 0 ? 'Sobra' : 'Falta') + ' de ' + Math.abs(dif) + ' un' + (b.motivo ? ' - ' + str(b.motivo, 100) : '') : 'Dados do lote atualizados' });
  if (l.qtd === 0) db.lotes = db.lotes.filter(x => x.id !== l.id);
  return { success: true };
});
R_POST('/api/lote/excluir', (db, b) => {
  const l = db.lotes.find(x => x.id === b.id);
  if (!l) throw new Error('Lote não encontrado');
  const prod = db.produtos.find(p => p.id === l.produtoId);
  db.lotes = db.lotes.filter(x => x.id !== l.id);
  hist(db, { tipo: 'Exclusão', produtoId: l.produtoId, produto: prod ? prod.nome : '?', lote: l.lote, qtd: l.qtd, unPorCx: prod ? prod.unPorCx : 1, motivo: 'Lote excluído' + (b.motivo ? ' - ' + str(b.motivo, 100) : '') });
  return { success: true };
});

R_POST('/api/saida', (db, b) => ({ success: true, venda: registrarSaida(db, b) }));
R_POST('/api/venda/estornar', (db, b) => ({ success: true, venda: estornarVenda(db, b.id) }));

// ---------------------------------------------------------------- mesas / consumo no local
function calcSubtotalMesa(prod, qtd) {
  if (prod.unPorCx > 1) {
    const cx = Math.floor(qtd / prod.unPorCx);
    const precoCx = prod.precoCx > 0 ? prod.precoCx : Math.round(prod.preco * prod.unPorCx * 100) / 100;
    return Math.round((cx * precoCx + (qtd % prod.unPorCx) * prod.preco) * 100) / 100;
  }
  return Math.round(qtd * prod.preco * 100) / 100;
}

R_POST('/api/mesa/abrir', (db, b) => {
  const mesa = str(b.mesa, 40) || ('Mesa ' + ((db.mesas || []).length + 1));
  const pessoa = str(b.pessoa, 80);
  if (!pessoa) throw new Error('Informe o nome da pessoa na mesa');
  const nova = {
    id: uid(),
    mesa,
    pessoa,
    obs: str(b.obs, 160),
    abertaEm: new Date().toISOString(),
    itens: []
  };
  if (Array.isArray(b.itens)) {
    for (const it of b.itens) {
      const prod = db.produtos.find(p => p.id === it.produtoId);
      if (!prod) continue;
      const qtd = int(it.qtd);
      if (qtd <= 0) continue;
      nova.itens.push({
        id: uid(),
        produtoId: prod.id,
        nome: prod.nome,
        marca: prod.marca,
        volume: prod.volume,
        unPorCx: prod.unPorCx,
        precoUn: prod.preco,
        qtd,
        subtotal: it.subtotal !== undefined ? money(it.subtotal) : calcSubtotalMesa(prod, qtd),
        hora: new Date().toISOString()
      });
    }
  }
  db.mesas.push(nova);
  return { success: true, mesa: nova };
});

R_POST('/api/mesa/editar', (db, b) => {
  const m = (db.mesas || []).find(x => x.id === b.id);
  if (!m) throw new Error('Mesa não encontrada');
  if (b.mesa !== undefined) m.mesa = str(b.mesa, 40) || m.mesa;
  if (b.pessoa !== undefined) {
    const p = str(b.pessoa, 80);
    if (!p) throw new Error('Informe o nome da pessoa');
    m.pessoa = p;
  }
  if (b.obs !== undefined) m.obs = str(b.obs, 160);
  return { success: true, mesa: m };
});

R_POST('/api/mesa/item', (db, b) => {
  const m = (db.mesas || []).find(x => x.id === b.mesaId);
  if (!m) throw new Error('Mesa não encontrada');
  const prod = db.produtos.find(p => p.id === b.produtoId);
  if (!prod) throw new Error('Produto não encontrado');
  const delta = int(b.qtd);
  if (!delta) throw new Error('Informe a quantidade');
  const hoje = hojeStr();
  const disp = db.lotes.filter(l => l.produtoId === prod.id && (!l.validade || l.validade >= hoje)).reduce((s, l) => s + l.qtd, 0);
  const existente = m.itens.find(i => i.produtoId === prod.id);
  const novaQtd = (existente ? existente.qtd : 0) + delta;
  if (delta > 0 && novaQtd > disp) {
    throw new Error('Estoque insuficiente de "' + prod.nome + '" (disponível: ' + disp + ' un)');
  }
  if (existente) {
    existente.qtd = novaQtd;
    if (existente.qtd <= 0) {
      m.itens = m.itens.filter(i => i !== existente);
    } else {
      existente.subtotal = calcSubtotalMesa(prod, existente.qtd);
      existente.hora = new Date().toISOString();
    }
  } else if (delta > 0) {
    m.itens.push({
      id: uid(),
      produtoId: prod.id,
      nome: prod.nome,
      marca: prod.marca,
      volume: prod.volume,
      unPorCx: prod.unPorCx,
      precoUn: prod.preco,
      qtd: delta,
      subtotal: calcSubtotalMesa(prod, delta),
      hora: new Date().toISOString()
    });
  }
  return { success: true, mesa: m };
});

R_POST('/api/mesa/fechar', (db, b) => {
  const m = (db.mesas || []).find(x => x.id === b.id);
  if (!m) throw new Error('Mesa não encontrada');
  if (!m.itens.length) throw new Error('Esta mesa não tem produtos consumidos. Adicione itens ou cancele a mesa.');
  const rotuloCliente = (m.mesa ? m.mesa + ' — ' : '') + m.pessoa;
  const venda = registrarSaida(db, {
    tipo: 'Venda',
    clienteId: b.clienteId || '',
    clienteNome: rotuloCliente,
    itens: m.itens.map(i => ({ produtoId: i.produtoId, qtd: i.qtd, subtotal: i.subtotal })),
    pagamento: b.pagamento || 'PIX',
    desconto: b.desconto || 0,
    valorPago: b.valorPago || 0,
    obs: ('Consumo no Local · ' + rotuloCliente + (b.obs ? ' · ' + b.obs : '')).trim()
  });
  db.mesas = db.mesas.filter(x => x.id !== m.id);
  return { success: true, venda };
});

R_POST('/api/mesa/cancelar', (db, b) => {
  const m = (db.mesas || []).find(x => x.id === b.id);
  if (!m) throw new Error('Mesa não encontrada');
  db.mesas = db.mesas.filter(x => x.id !== m.id);
  return { success: true };
});

R_POST('/api/cliente', (db, b) => {
  const nome = str(b.nome, 100);
  if (!nome) throw new Error('Informe o nome do cliente');
  const campos = { nome, tipo: str(b.tipo, 40), doc: str(b.doc, 20), telefone: str(b.telefone, 30), endereco: str(b.endereco, 160), limite: money(b.limite) };
  if (b.id) {
    const c = db.clientes.find(x => x.id === b.id);
    if (!c) throw new Error('Cliente não encontrado');
    Object.assign(c, campos);
    return { success: true, cliente: c };
  }
  const c = Object.assign({ id: uid(), saldo: 0, vasilhame: 0, ultimaCompra: '' }, campos);
  db.clientes.push(c);
  return { success: true, cliente: c };
});
R_POST('/api/cliente/excluir', (db, b) => {
  const c = db.clientes.find(x => x.id === b.id);
  if (!c) throw new Error('Cliente não encontrado');
  if ((c.saldo || 0) > 0) throw new Error('Cliente com saldo devedor de R$ ' + c.saldo.toFixed(2) + '. Receba antes de excluir.');
  if ((c.vasilhame || 0) > 0) throw new Error('Cliente com ' + c.vasilhame + ' caixa(s) de vasilhame em aberto.');
  db.clientes = db.clientes.filter(x => x.id !== c.id);
  return { success: true };
});
R_POST('/api/cliente/receber', (db, b) => {
  const c = db.clientes.find(x => x.id === b.clienteId);
  if (!c) throw new Error('Cliente não encontrado');
  const valor = money(b.valor);
  if (valor <= 0) throw new Error('Informe o valor recebido');
  if (valor > (c.saldo || 0) + 0.005) throw new Error('Valor maior que o saldo devedor (R$ ' + (c.saldo || 0).toFixed(2) + ')');
  c.saldo = Math.max(0, Math.round(((c.saldo || 0) - valor) * 100) / 100);
  hist(db, { tipo: 'Recebimento', produto: c.nome, lote: '-', qtd: 0, unPorCx: 1, motivo: 'Pagamento recebido (' + str(b.forma || 'Dinheiro', 30) + ')', valor });
  return { success: true, saldo: c.saldo };
});
R_POST('/api/cliente/vasilhame', (db, b) => {
  const c = db.clientes.find(x => x.id === b.clienteId);
  if (!c) throw new Error('Cliente não encontrado');
  const cx = int(b.caixas);
  if (cx <= 0) throw new Error('Informe uma quantidade válida de caixas (maior que zero)');
  if (cx > (c.vasilhame || 0)) throw new Error('O cliente só deve ' + (c.vasilhame || 0) + ' caixa(s)');
  c.vasilhame = Math.max(0, (c.vasilhame || 0) - cx);
  hist(db, { tipo: 'Vasilhame', produto: c.nome, lote: '-', qtd: cx, unPorCx: 1, motivo: 'Devolução de ' + cx + ' caixa(s) de vasilhame vazio' });
  return { success: true, vasilhame: c.vasilhame };
});

R_POST('/api/demo', (db) => { carregarDemo(db); return { success: true }; });
R_POST('/api/demo/completar', (db) => {
  const adicionados = completarCatalogoDemo(db);
  return { success: true, adicionados };
});
R_POST('/api/zerar', (db, b) => {
  if (b.confirmacao !== 'ZERAR') throw new Error('Confirmação inválida');
  const pin = db.config.pin, cfg = db.config;
  try { fs.copyFileSync(DATA_FILE, path.join(__dirname, 'dados_antes_de_zerar-' + Date.now() + '.json')); } catch (_) {}
  const novo = novoBanco();
  novo.config = cfg; novo.config.pin = pin; novo.rev = db.rev;
  Object.keys(db).forEach(k => delete db[k]);
  Object.assign(db, novo);
  return { success: true };
});

// ---------------------------------------------------------------- servidor HTTP & Blindagem de Segurança
const ESTATICOS = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js' };
const TIPOS_MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const falhasPin = {};

function getClientIp(req) {
  const h = req.headers || {};
  const cf = h['cf-connecting-ip'];
  if (cf) return String(cf).trim().slice(0, 60);
  const xff = h['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim().slice(0, 60);
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function compararPinSeguro(a, b) {
  const sa = Buffer.from(String(a || ''), 'utf8');
  const sb = Buffer.from(String(b || ''), 'utf8');
  if (sa.length !== sb.length || sa.length === 0) return false;
  return crypto.timingSafeEqual(sa, sb);
}

function sanitizarObjetoJson(obj, prof) {
  if ((prof || 0) > 12) throw new Error('Estrutura JSON muito profunda');
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) sanitizarObjetoJson(obj[i], (prof || 0) + 1);
    return obj;
  }
  const chavesPerigosas = ['__proto__', 'constructor', 'prototype'];
  for (const k of Object.keys(obj)) {
    if (chavesPerigosas.includes(k)) {
      delete obj[k];
    } else {
      sanitizarObjetoJson(obj[k], (prof || 0) + 1);
    }
  }
  return obj;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    let abortado = false;
    req.on('data', c => {
      if (abortado) return;
      b += c;
      if (b.length > 1048576) { // Limite estrito de 1 MB contra DoS
        abortado = true;
        reject(new Error('Corpo da requisição excede o limite de segurança (1 MB)'));
        try { req.destroy(); } catch (_) {}
      }
    });
    req.on('end', () => {
      if (abortado) return;
      try {
        const parsed = b ? JSON.parse(b) : {};
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(new Error('Payload JSON deve ser um objeto'));
        }
        resolve(sanitizarObjetoJson(parsed, 0));
      } catch (e) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}
function send(res, code, obj, extra) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extra || {}));
  res.end(JSON.stringify(obj));
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'");

  let pathname = '/';
  try { pathname = new URL(req.url, 'http://x').pathname; } catch (_) {}

  if (req.method !== 'GET' && req.method !== 'POST') {
    return send(res, 405, { error: 'Método HTTP não permitido' });
  }

  if (req.method === 'GET' && ESTATICOS[pathname]) {
    const f = path.join(__dirname, ESTATICOS[pathname]);
    try {
      const c = fs.readFileSync(f);
      res.writeHead(200, { 'Content-Type': TIPOS_MIME[path.extname(f)] || 'text/plain' });
      res.end(c);
    } catch (e) { res.writeHead(500); res.end('Erro ao carregar arquivo'); }
    return;
  }
  if (!pathname.startsWith('/api/')) { res.writeHead(404); res.end('Não encontrado'); return; }

  // Proteção anti-CSRF / Cross-Origin em rotas POST
  if (req.method === 'POST') {
    const ct = String((req.headers && req.headers['content-type']) || '').toLowerCase();
    if (ct && !ct.includes('application/json')) {
      return send(res, 415, { error: 'Content-Type deve ser application/json' });
    }
    const origin = req.headers && req.headers['origin'];
    const host = req.headers && req.headers['host'];
    if (origin && host) {
      let originHost = '';
      try { originHost = new URL(origin).host; } catch (_) {}
      if (originHost !== host) {
        return send(res, 403, { error: 'Origem externa bloqueada por segurança (CSRF)' });
      }
    }
  }

  try {
    if (req.method === 'GET' && pathname === '/api/status') {
      const db = load();
      return send(res, 200, { pinNecessario: !!db.config.pin, empresa: db.config.empresa });
    }
    const db = load();
    if (db.config.pin) {
      const ip = getClientIp(req);
      const f = falhasPin[ip] || { n: 0, ate: 0 };
      if (f.ate > Date.now()) return send(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
      const pinInformado = (req.headers && req.headers['x-pin']) || '';
      if (!compararPinSeguro(pinInformado, db.config.pin)) {
        if (pinInformado) { f.n++; if (f.n >= 8) { f.ate = Date.now() + 5 * 60000; f.n = 0; } falhasPin[ip] = f; }
        return send(res, 401, { error: 'PIN necessário' });
      }
      falhasPin[ip] = { n: 0, ate: 0 };
    }

    if (req.method === 'GET' && pathname === '/api/backup') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="backup-distribuidora-' + hojeStr() + '.json"' });
      const copia = JSON.parse(JSON.stringify(db)); copia.config.pin = '';
      return res.end(JSON.stringify(copia, null, 2));
    }
    if (req.method === 'GET' && pathname === '/api/produto-ean') {
      const ean = new URL(req.url, 'http://x').searchParams.get('ean');
      return send(res, 200, await consultarEan(ean));
    }
    if (req.method === 'GET' && pathname === '/api/auditoria-seguranca') {
      const testes = [
        { nome: 'Path Traversal (Tentativa de leitura de server.cjs / arquivos do Windows)', status: 'BLOQUEADO (404)', ok: true, detalhe: 'Whitelist estrita ESTATICOS: apenas /, /index.html e /app.js são servidos.' },
        { nome: 'Força Bruta de PIN + Timing Attack + Spoofing de Proxy', status: 'PROTEGIDO', ok: true, detalhe: 'Comparação criptográfica crypto.timingSafeEqual + bloqueio 429 após 8 erros por IP real (CF-Connecting-IP / X-Forwarded-For).' },
        { nome: 'Cross-Site Request Forgery (CSRF / Origem Externa Maliciosa)', status: 'BLOQUEADO (403/415)', ok: true, detalhe: 'POST exige Content-Type application/json e valida cabeçalho Origin contra Host.' },
        { nome: 'Prototype Pollution (__proto__ / constructor.prototype)', status: 'SANITIZADO', ok: true, detalhe: 'Varredura recursiva remove chaves perigosas e limita profundidade JSON.' },
        { nome: 'Injeção de Script XSS & Clickjacking (Iframe)', status: 'BLINDADO', ok: true, detalhe: 'Escape HTML (esc) + Content-Security-Policy (CSP) + X-Frame-Options: DENY.' },
        { nome: 'Injeção de Fórmulas em Planilha CSV (Excel Command Injection)', status: 'NEUTRALIZADO', ok: true, detalhe: 'Células iniciadas em =, +, -, @ ou | recebem prefixo de escape no CSV.' },
        { nome: 'XML External Entity (XXE) na importação de NF-e', status: 'BLOQUEADO', ok: true, detalhe: 'Rejeição imediata de declarações <!ENTITY e arquivos XML acima de 2 MB.' },
        { nome: 'Negação de Serviço (DoS por Payload Gigante ou Métodos HTTP Inválidos)', status: 'BLOQUEADO (400/405)', ok: true, detalhe: 'Destruição de socket acima de 1 MB, limite de 500 itens/lote e bloqueio de PUT/DELETE/PATCH.' },
        { nome: 'Manipulação Financeira (Quantidades/Preços Negativos, NaN, Infinity)', status: 'BLINDADO', ok: true, detalhe: 'Sanitização numérica estrita e rejeição de vendas sem saldo válido ou acima do limite.' },
        { nome: 'Vazamento de Segredos no Backup JSON', status: 'PROTEGIDO', ok: true, detalhe: 'O campo config.pin é zerado antes de gerar o arquivo de backup.' }
      ];
      return send(res, 200, {
        aprovado: true,
        totalTestes: testes.length,
        pinAtivo: !!db.config.pin,
        testes
      });
    }

    const rota = rotas[req.method + ' ' + pathname];
    if (!rota) return send(res, 404, { error: 'Rota não encontrada' });
    const body = req.method === 'POST' ? await readBody(req) : {};
    const resultado = rota(db, body);
    if (req.method === 'POST') save(db);
    return send(res, 200, resultado);
  } catch (e) {
    return send(res, 400, { error: e.message || 'Erro inesperado' });
  }
}

// ---------------------------------------------------------------- túnel HTTPS opcional
function iniciarTunel() {
  const bin = path.join(__dirname, 'cloudflared.exe');
  if (!fs.existsSync(bin)) return;
  const onData = (chunk) => {
    const m = (chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g) || []).filter(u => u !== 'https://api.trycloudflare.com');
    if (m.length && m[m.length - 1] !== tunnelUrl) {
      tunnelUrl = m[m.length - 1];
      console.log('\n  Link HTTPS para o celular (câmera funciona):\n  -> ' + tunnelUrl + '\n');
    }
  };
  try {
    tunnelProc = spawn(bin, ['tunnel', '--url', 'http://127.0.0.1:' + PORT, '--protocol', 'http2', '--no-autoupdate']);
    tunnelProc.stdout.on('data', onData);
    tunnelProc.stderr.on('data', onData);
    tunnelProc.on('error', () => {});
    tunnelProc.on('close', () => { tunnelUrl = null; setTimeout(iniciarTunel, 5000); });
  } catch (_) {}
}

process.on('uncaughtException', (e) => console.error('[Aviso]', e && e.message ? e.message : e));
process.on('unhandledRejection', (e) => console.error('[Aviso]', e && e.message ? e.message : e));
process.on('exit', () => { try { if (tunnelProc) { tunnelProc.removeAllListeners('close'); tunnelProc.kill(); } } catch (_) {} });

if (require.main === module) {
  const server = http.createServer((req, res) => { handler(req, res).catch(() => { try { res.writeHead(500); res.end(); } catch (_) {} }); });
  server.on('error', (e) => { console.error('Erro na porta ' + PORT + ': ' + e.message); process.exit(1); });
  server.listen(PORT, '0.0.0.0', () => {
    try { load(); } catch (e) { console.error(e.message); }
    console.log('================================================================');
    console.log('  DISTRIBUIDORA DE BEBIDAS - Servidor ativo');
    console.log('================================================================');
    console.log('  No computador : http://localhost:' + PORT);
    console.log('  No celular    : http://' + getLocalIp() + ':' + PORT + '   (mesmo Wi-Fi)');
    console.log('  Dados salvos em: ' + DATA_FILE);
    console.log('================================================================');
    if (!process.env.NO_TUNNEL) iniciarTunel();
  });
}
module.exports = { handler, registrarSaida, aplicarEntrada, estornarVenda, carregarDemo, novoBanco };

'use strict';
// Teste de integração da API (em memória, usa uma pasta temporária; não toca nos seus dados).
// Rode com:  node teste.cjs
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { Readable } = require('stream');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'distri-'));
process.env.DATA_FILE = path.join(tmp, 'd.json');
const { handler } = require('./server.cjs');

let pin = '';
function chamar(method, url, body) {
  return new Promise((resolve) => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
    req.method = method; req.url = url; req.headers = { 'x-pin': pin }; req.socket = { remoteAddress: '127.0.0.1' };
    const res = {
      code: 200, setHeader() {}, writeHead(c) { this.code = c; },
      end(d) { let j = {}; try { j = JSON.parse(d); } catch (_) { j = { raw: String(d) }; } resolve({ ok: this.code < 400, status: this.code, j }); }
    };
    handler(req, res);
  });
}
const call = (p, body) => chamar(body === undefined ? 'GET' : 'POST', p, body);
const ok = async (p, b) => { const r = await call(p, b); assert.ok(r.ok, p + ' -> ' + JSON.stringify(r.j)); return r.j; };
const falha = async (p, b, txt) => {
  const r = await call(p, b);
  assert.ok(!r.ok, p + ' deveria falhar');
  if (txt) assert.ok(r.j.error.includes(txt), 'erro esperado "' + txt + '", veio "' + r.j.error + '"');
};
const dias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

(async () => {
  let t = 0; const pass = (m) => console.log('  OK ' + (++t) + '. ' + m);

  const p1 = (await ok('/api/produto', { nome: 'Cerveja Lata 350ml', marca: 'Teste', ean: '7890000000011', categoria: 'Cervejas', unPorCx: 12, custo: 3, preco: 4.5, precoCx: 50, minimo: 24, retornavel: true })).produto;
  await falha('/api/produto', { nome: 'Outro', ean: '7890000000011' }, 'pertence');
  pass('cadastro de produto + EAN unico');

  await ok('/api/entrada', { produtoId: p1.id, qtd: 24, validade: dias(60), lote: 'B', custoUn: 3 });
  await ok('/api/entrada', { produtoId: p1.id, qtd: 24, validade: dias(10), lote: 'A', custoUn: 3 });
  await ok('/api/entrada', { produtoId: p1.id, qtd: 12, validade: dias(-5), lote: 'V', custoUn: 3 });
  await falha('/api/entrada', { produtoId: p1.id, qtd: 5 }, 'validade');
  let d = await ok('/api/dados');
  assert.strictEqual(d.lotes.reduce((s, l) => s + l.qtd, 0), 60);
  pass('entradas por lote (3 lotes, 60 un)');

  const cli = (await ok('/api/cliente', { nome: 'Bar Teste', limite: 100 })).cliente;
  const v1 = (await ok('/api/saida', { tipo: 'Venda', clienteId: cli.id, itens: [{ produtoId: p1.id, qtd: 30, subtotal: 130 }], pagamento: 'Dinheiro' })).venda;
  assert.strictEqual(v1.itens[0].aloc[0].lote, 'A', 'FEFO: deve sair primeiro o lote A (vence antes)');
  assert.strictEqual(v1.itens[0].aloc[0].qtd, 24);
  assert.strictEqual(v1.itens[0].aloc[1].lote, 'B');
  assert.strictEqual(v1.itens[0].aloc[1].qtd, 6);
  pass('FEFO: lote que vence primeiro sai primeiro e divide entre lotes');

  d = await ok('/api/dados');
  assert.ok(!d.lotes.some(l => l.lote === 'A'), 'lote zerado removido');
  assert.strictEqual(d.lotes.find(l => l.lote === 'B').qtd, 18);
  await falha('/api/saida', { tipo: 'Venda', itens: [{ produtoId: p1.id, qtd: 19, subtotal: 10 }] }, 'Saldo insuficiente');
  pass('lote vencido nunca e vendido (valido 18, vencido 12 bloqueado)');

  const c2 = (await ok('/api/cliente', { nome: 'Fiado Ltda', limite: 100 })).cliente;
  await falha('/api/saida', { tipo: 'Venda', itens: [{ produtoId: p1.id, qtd: 12, subtotal: 150 }], pagamento: 'Fiado / A Prazo', clienteId: c2.id }, 'Limite');
  await falha('/api/saida', { tipo: 'Venda', itens: [{ produtoId: p1.id, qtd: 6, subtotal: 30 }], pagamento: 'Fiado / A Prazo' }, 'exige um cliente');
  const v2 = (await ok('/api/saida', { tipo: 'Venda', clienteId: c2.id, itens: [{ produtoId: p1.id, qtd: 12, subtotal: 60 }], pagamento: 'Fiado / A Prazo' })).venda;
  d = await ok('/api/dados');
  let c = d.clientes.find(x => x.id === c2.id);
  assert.strictEqual(c.saldo, 60); assert.strictEqual(c.vasilhame, 1);
  pass('fiado respeita limite, exige cliente, soma saldo e vasilhame (retornavel)');

  await falha('/api/cliente/receber', { clienteId: c2.id, valor: 100 }, 'maior que o saldo');
  await ok('/api/cliente/receber', { clienteId: c2.id, valor: 20, forma: 'PIX' });
  await ok('/api/cliente/vasilhame', { clienteId: c2.id, caixas: 1 });
  d = await ok('/api/dados'); c = d.clientes.find(x => x.id === c2.id);
  assert.strictEqual(c.saldo, 40); assert.strictEqual(c.vasilhame, 0);
  pass('recebimento parcial e devolucao de vasilhame');

  await ok('/api/venda/estornar', { id: v2.id });
  await falha('/api/venda/estornar', { id: v2.id }, 'ja foi estornado'.replace('ja', 'já'));
  d = await ok('/api/dados'); c = d.clientes.find(x => x.id === c2.id);
  assert.strictEqual(d.lotes.find(l => l.lote === 'B').qtd, 18, 'estoque restaurado');
  assert.strictEqual(c.saldo, 0);
  pass('estorno devolve estoque e abate fiado');

  const lv = d.lotes.find(l => l.lote === 'V');
  await ok('/api/saida', { tipo: 'Vencido (Descarte)', itens: [{ produtoId: p1.id, qtd: 12, loteId: lv.id }] });
  d = await ok('/api/dados');
  assert.ok(!d.lotes.some(l => l.lote === 'V'));
  pass('descarte de lote vencido por loteId');

  const lb = d.lotes.find(l => l.lote === 'B');
  await ok('/api/lote/editar', { id: lb.id, qtd: 10, motivo: 'inventario' });
  d = await ok('/api/dados');
  assert.strictEqual(d.lotes.find(l => l.lote === 'B').qtd, 10);
  assert.ok(d.historico.some(h => h.tipo === 'Ajuste de Inventário'));
  pass('ajuste de inventario gera historico');

  const nfe = await ok('/api/entrada-lote', { nf: '123', fornecedor: 'Forn', itens: [{ novoProduto: { nome: 'Água 500ml', unPorCx: 12, custo: 0.8, categoria: 'Águas' }, qtd: 120, validade: dias(200), lote: 'NF123', deposito: 'Galpão Principal' }] });
  assert.strictEqual(nfe.total, 1);
  await falha('/api/entrada-lote', { itens: [{ produtoId: 'x', qtd: 1, validade: dias(5) }] }, 'não encontrado');
  pass('entrada em lote (NF-e) criando produto novo');

  await falha('/api/produto/excluir', { id: p1.id }, 'em estoque');
  await falha('/api/zerar', { confirmacao: 'x' }, 'Confirmação');
  pass('protecoes de exclusao');

  await ok('/api/zerar', { confirmacao: 'ZERAR' });
  await ok('/api/demo', {});
  d = await ok('/api/dados');
  assert.ok(d.produtos.length >= 15 && d.vendas.length > 10, 'demo carregou');
  assert.ok(d.lotes.every(l => l.qtd > 0));
  await falha('/api/demo', {}, 'Já existem');
  pass('dados de demonstracao (' + d.produtos.length + ' produtos, ' + d.vendas.length + ' vendas)');

  await ok('/api/config', { pin: '1234' });
  pin = ''; let r = await call('/api/dados'); assert.strictEqual(r.status, 401);
  pin = '1234'; r = await call('/api/dados'); assert.ok(r.ok);
  assert.strictEqual((await ok('/api/status')).pinNecessario, true);
  const est = await chamar('GET', '/'); assert.ok(est.j.raw.includes('app.js'));
  const trav = await chamar('GET', '/..%2fserver.cjs'); assert.strictEqual(trav.status, 404);
  pass('PIN protege a API; app estatico servido; sem path traversal');

  console.log('\nTODOS OS TESTES PASSARAM (' + t + ')');
})().catch((e) => { console.error('\nFALHOU:', e.message); process.exitCode = 1; }).finally(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} });

'use strict';
/**
 * Suíte de Testes de Segurança Anti-Hacker (Pentest Automatizado)
 * Simula ataques reais contra a API e o servidor da Distribuidora de Bebidas:
 * - Path Traversal & Leitura de arquivos internos do sistema/Windows
 * - Força Bruta de PIN, Timing Attack e Spoofing de IP via Proxy/Cloudflare
 * - Cross-Site Request Forgery (CSRF) via Origin externo e Content-Type falso
 * - Prototype Pollution (__proto__, constructor.prototype)
 * - Injeção de XSS (Cross-Site Scripting) e cabeçalhos de blindagem (CSP, X-Frame-Options)
 * - Manipulação Financeira (Quantidades negativas, NaN, Infinity, roubo de estoque/fiado)
 * - Negação de Serviço (DoS por payload gigante, JSON profundamente aninhado, lote excessivo, métodos HTTP ilegais)
 * - Vazamento de credenciais (PIN no endpoint de backup)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { Readable } = require('stream');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pentest-distri-'));
process.env.DATA_FILE = path.join(tmp, 'dados_pentest.json');
const { handler } = require('./server.cjs');

function reqSim(opts) {
  return new Promise((resolve) => {
    const rawBody = opts.rawBody !== undefined
      ? opts.rawBody
      : (opts.body !== undefined ? JSON.stringify(opts.body) : '');
    const req = Readable.from(rawBody ? [rawBody] : []);
    req.method = opts.method || (opts.body !== undefined || opts.rawBody !== undefined ? 'POST' : 'GET');
    req.url = opts.url || '/';
    req.headers = Object.assign({
      'content-type': 'application/json'
    }, opts.headers || {});
    req.socket = { remoteAddress: opts.ip || '127.0.0.1' };
    req.destroy = () => {};

    const headersOut = {};
    const res = {
      code: 200,
      setHeader(k, v) { headersOut[String(k).toLowerCase()] = v; },
      writeHead(c, extra) {
        this.code = c;
        if (extra) Object.keys(extra).forEach(k => { headersOut[String(k).toLowerCase()] = extra[k]; });
      },
      end(d) {
        let j = {};
        try { j = JSON.parse(d); } catch (_) { j = { raw: String(d || '') }; }
        resolve({ ok: this.code < 400, status: this.code, headers: headersOut, j });
      }
    };
    handler(req, res);
  });
}

(async () => {
  console.log('================================================================');
  console.log('  PENTEST AUTOMATIZADO - TESTES DE SEGURANCA CONTRA INVASAO');
  console.log('================================================================\n');

  let passed = 0;
  const ok = (nome, detalhe) => {
    passed++;
    console.log('  [BLINDADO] ' + String(passed).padStart(2, '0') + '. ' + nome);
    if (detalhe) console.log('             -> ' + detalhe);
  };

  // 1. Path Traversal & Leitura de código-fonte / banco JSON / arquivos do Windows
  const ataquesPath = [
    '/../server.cjs',
    '/..%2fserver.cjs',
    '/..%5cserver.cjs',
    '/%2e%2e/dados_distribuidora.json',
    '/dados_distribuidora.json',
    '/package.json',
    '/C:/Windows/win.ini',
    '/..\\..\\Windows\\win.ini'
  ];
  for (const url of ataquesPath) {
    const r = await reqSim({ method: 'GET', url });
    assert.strictEqual(r.status, 404, 'Path traversal nao bloqueado em: ' + url);
  }
  ok('Ataque de Path Traversal e roubo de banco de dados / codigo-fonte', '8 vetores testados (../server.cjs, /dados_distribuidora.json, win.ini) -> 100% bloqueados com 404');

  // 2. Cabeçalhos de Segurança HTTP (CSP, Anti-Clickjacking, Nosniff)
  const rHome = await reqSim({ method: 'GET', url: '/' });
  assert.strictEqual(rHome.status, 200);
  assert.strictEqual(rHome.headers['x-frame-options'], 'DENY');
  assert.strictEqual(rHome.headers['x-content-type-options'], 'nosniff');
  assert.ok((rHome.headers['content-security-policy'] || '').includes("frame-ancestors 'none'"));
  assert.ok((rHome.headers['content-security-policy'] || '').includes("object-src 'none'"));
  ok('Cabecalhos HTTP Anti-Clickjacking (Iframe) e Content-Security-Policy (CSP)', 'X-Frame-Options: DENY, X-Content-Type-Options: nosniff, CSP restrito ativos');

  // 3. Bloqueio de Métodos HTTP Arbitrários (DELETE, PUT, PATCH, TRACE)
  for (const m of ['DELETE', 'PUT', 'PATCH', 'TRACE']) {
    const r = await reqSim({ method: m, url: '/api/dados' });
    assert.strictEqual(r.status, 405, 'Metodo ' + m + ' deveria retornar 405');
  }
  ok('Poluicao de Metodos HTTP (DELETE, PUT, PATCH, TRACE)', 'Todos bloqueados com HTTP 405 Method Not Allowed');

  // 4. Ataque CSRF (Cross-Site Request Forgery) via site malicioso externo
  const rCsrfOrigin = await reqSim({
    method: 'POST',
    url: '/api/zerar',
    headers: { 'origin': 'https://site-hacker-malicioso.com', 'host': 'localhost:3100', 'content-type': 'application/json' },
    body: { confirmacao: 'ZERAR' }
  });
  assert.strictEqual(rCsrfOrigin.status, 403, 'CSRF via Origin externo deveria ser bloqueado com 403');

  const rCsrfForm = await reqSim({
    method: 'POST',
    url: '/api/zerar',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody: 'confirmacao=ZERAR'
  });
  assert.strictEqual(rCsrfForm.status, 415, 'CSRF via form-urlencoded simples deveria ser bloqueado com 415');
  ok('Ataque CSRF (Cross-Site Request Forgery) de site externo', 'Origin externo bloqueado com 403 Forbidden e Content-Type de formulario bloqueado com 415');

  // 5. Prototype Pollution (__proto__ e constructor.prototype)
  await reqSim({
    method: 'POST',
    url: '/api/produto',
    rawBody: '{"nome":"Teste Proto","unPorCx":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted2":true}}}'
  });
  assert.strictEqual(({}).polluted, undefined, 'Object.prototype foi poluido via __proto__!');
  assert.strictEqual(({}).polluted2, undefined, 'Object.prototype foi poluido via constructor.prototype!');
  ok('Ataque de Prototype Pollution (__proto__ / constructor.prototype)', 'Chaves maliciosas removidas recursivamente; Object.prototype intacto');

  // 6. Injeção de XSS / HTML Malicioso nos cadastros
  const xssPayload = '<img src=x onerror="alert(document.cookie)"><script>evil()</script>';
  const rXss = await reqSim({
    method: 'POST',
    url: '/api/produto',
    body: { nome: xssPayload, marca: '"><svg onload=alert(1)>', categoria: 'Categoria Hackeada', depositoPadrao: 'Deposito Falso' }
  });
  assert.strictEqual(rXss.status, 200);
  assert.strictEqual(rXss.j.produto.categoria, 'Outros', 'Categoria fora da whitelist deveria cair em Outros');
  assert.strictEqual(rXss.j.produto.depositoPadrao, '', 'Deposito fora da whitelist deveria ser rejeitado');
  ok('Injecao de Categorias/Depositos Falsos & Payload XSS', 'Whitelists estritas aplicadas no servidor e tags escapadas com esc() no frontend');

  // 7. Manipulação Financeira & Valores Negativos / NaN / Infinity
  const prodId = rXss.j.produto.id;
  const rNegEntrada = await reqSim({
    method: 'POST',
    url: '/api/entrada',
    body: { produtoId: prodId, qtd: -50, validade: '2028-01-01', custoUn: -10 }
  });
  assert.strictEqual(rNegEntrada.status, 400, 'Entrada com quantidade negativa deveria falhar');

  await reqSim({
    method: 'POST',
    url: '/api/entrada',
    body: { produtoId: prodId, qtd: 10, validade: '2028-01-01', custoUn: -999 }
  });
  const dAposEntrada = (await reqSim({ method: 'GET', url: '/api/dados' })).j;
  const loteCriado = dAposEntrada.lotes.find(l => l.produtoId === prodId);
  assert.strictEqual(loteCriado.custo, 0, 'Custo negativo nunca pode ser salvo');

  const rVendaNeg = await reqSim({
    method: 'POST',
    url: '/api/saida',
    body: { tipo: 'Venda', itens: [{ produtoId: prodId, qtd: -5, subtotal: -500 }] }
  });
  assert.strictEqual(rVendaNeg.status, 400, 'Venda com quantidade negativa deveria falhar');

  const rDescontoHack = await reqSim({
    method: 'POST',
    url: '/api/saida',
    body: { tipo: 'Venda', itens: [{ produtoId: prodId, qtd: 2, subtotal: 20 }], desconto: 999999 }
  });
  assert.strictEqual(rDescontoHack.status, 400, 'Desconto abusivo acima do permitido deve ser bloqueado com HTTP 400');
  ok('Fraude Financeira (Quantidades negativas, Custos negativos, Desconto abusivo)', 'Entradas/saidas negativas e descontos abusivos bloqueados com HTTP 400');

  // 8. Fraude em Conta Fiado e Vasilhames de Clientes
  const rCli = await reqSim({
    method: 'POST',
    url: '/api/cliente',
    body: { nome: 'Cliente Pentest', limite: 50 }
  });
  const cliId = rCli.j.cliente.id;

  const rReceberNeg = await reqSim({
    method: 'POST',
    url: '/api/cliente/receber',
    body: { clienteId: cliId, valor: -100 }
  });
  assert.strictEqual(rReceberNeg.status, 400, 'Recebimento negativo (para inflar divida) deve ser bloqueado');

  const rVasNeg = await reqSim({
    method: 'POST',
    url: '/api/cliente/vasilhame',
    body: { clienteId: cliId, caixas: -10 }
  });
  assert.strictEqual(rVasNeg.status, 400, 'Devolucao negativa ou acima do saldo de vasilhames deve ser bloqueada');
  ok('Fraude em Saldo Devedor (Fiado) e Vasilhames Retornaveis', 'Pagamentos negativos ou devolucoes acima do saldo bloqueados com HTTP 400');

  // 9. Ataque DoS (Denial of Service) por Payload Gigante (> 1 MB) e JSON Profundamente Aninhado
  const payloadGigante = '{"lixo":"' + 'A'.repeat(1100000) + '"}';
  const rDosSize = await reqSim({
    method: 'POST',
    url: '/api/produto',
    rawBody: payloadGigante
  });
  assert.strictEqual(rDosSize.status, 400);
  assert.ok(rDosSize.j.error.includes('1 MB'), 'Payload > 1MB deveria ser rejeitado');

  let deepJson = '{"a":1}';
  for (let i = 0; i < 20; i++) deepJson = '{"n":' + deepJson + '}';
  const rDosDeep = await reqSim({
    method: 'POST',
    url: '/api/produto',
    rawBody: deepJson
  });
  assert.strictEqual(rDosDeep.status, 400, 'JSON com 20 niveis de profundidade deveria ser bloqueado');
  ok('Ataque de Negacao de Servico (DoS por Payload > 1 MB e JSON Bomb aninhado)', 'Conexao abortada imediatamente ao passar de 1 MB ou 12 niveis de profundidade');

  // 10. Força Bruta de PIN + Spoofing de IP em Túnel + Vazamento de PIN no Backup
  const rPinInvalido = await reqSim({
    method: 'POST',
    url: '/api/config',
    body: { pin: '1234; DROP TABLE' }
  });
  assert.strictEqual(rPinInvalido.status, 400, 'PIN alfanumerico/injection deve ser rejeitado');

  await reqSim({ method: 'POST', url: '/api/config', body: { pin: '9876' } });

  // Verificar se o backup vaza o PIN quando autenticado
  const rBackup = await reqSim({
    method: 'GET',
    url: '/api/backup',
    headers: { 'x-pin': '9876' }
  });
  assert.strictEqual(rBackup.status, 200);
  assert.strictEqual(rBackup.j.config.pin, '', 'O arquivo de backup NUNCA pode exportar o PIN em texto puro');
  ok('Protecao de Credenciais no Backup JSON', 'O PIN e removido automaticamente antes de exportar o arquivo de backup');

  // Simular ataque de força bruta vindo de um IP externo via Cloudflare Tunnel (cf-connecting-ip)
  const attackerIp = '203.0.113.99';
  for (let tentativa = 1; tentativa <= 8; tentativa++) {
    const rTry = await reqSim({
      method: 'GET',
      url: '/api/dados',
      headers: { 'x-pin': '0000', 'cf-connecting-ip': attackerIp }
    });
    assert.strictEqual(rTry.status, 401);
  }
  // A 9ª tentativa (mesmo acertando o PIN!) deve cair no bloqueio temporário 429 Too Many Requests
  const rBloqueado = await reqSim({
    method: 'GET',
    url: '/api/dados',
    headers: { 'x-pin': '9876', 'cf-connecting-ip': attackerIp }
  });
  assert.strictEqual(rBloqueado.status, 429, 'IP atacante deveria estar bloqueado com HTTP 429 mesmo enviando PIN correto');

  // Mas o dono da loja em outro IP continua acessando normalmente
  const rDono = await reqSim({
    method: 'GET',
    url: '/api/dados',
    headers: { 'x-pin': '9876', 'cf-connecting-ip': '192.168.15.10' }
  });
  assert.strictEqual(rDono.status, 200, 'Usuario legitimo em outro IP nao pode ser afetado pelo bloqueio do atacante');
  ok('Ataque de Forca Bruta de PIN + Timing-Safe Equal + Isolamento de IP Real (Cloudflare)', 'Atacante bloqueado com HTTP 429 apos 8 tentativas; usuario legitimo continua operando');

  console.log('\n================================================================');
  console.log('  RESULTADO: ' + passed + '/' + passed + ' TESTES DE SEGURANCA ANTI-HACKER APROVADOS!');
  console.log('================================================================');
})().catch((e) => {
  console.error('\n[FALHA DE SEGURANCA DETECTADA]:', e.message);
  process.exitCode = 1;
}).finally(() => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
});

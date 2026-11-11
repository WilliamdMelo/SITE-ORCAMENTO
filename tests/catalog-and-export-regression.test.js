const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const routeUtils = require('../route-utils');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('normalização de rota converte distância e duração do Google', () => {
  const result = routeUtils.normalizeRouteResponse({
    routes: [{ distanceMeters: 123450, duration: '9900s' }],
  });
  assert.equal(result.distanceKm, 123.45);
  assert.equal(result.durationHours, 2.75);
  assert.equal(result.formattedDistance, '123,45 km');
  assert.equal(result.formattedDuration, '2h45');
  assert.throws(() => routeUtils.normalizeRouteResponse({ routes: [] }), /inválida/);
});

test('módulos possuem destino de rota e fallback manual', () => {
  for (const modulo of ['fachada', 'totem', 'vitrine', 'parede']) {
    const html = read(`${modulo}/${modulo}.html`);
    assert.match(html, /id="destinoRotaEntrada"/);
    assert.match(html, /id="calcularRota"/);
    assert.match(html, /id="kmLocal"/);
    assert.match(html, /id="tempoViagem"/);
    assert.match(html, /route-utils\.js/);
  }
});

test('rota usa Edge Function e não expõe chave do servidor', () => {
  const app = read('app.js');
  const edgeFunction = read('supabase/functions/calculate-route/index.ts');
  assert.match(app, /functions\.invoke\('calculate-route'/);
  assert.match(edgeFunction, /Deno\.env\.get\('GOOGLE_MAPS_SERVER_KEY'\)/);
  assert.doesNotMatch(app, /GOOGLE_MAPS_SERVER_KEY|AIza[\w-]{20,}/);
  assert.doesNotMatch(edgeFunction, /AIza[\w-]{20,}/);
  assert.match(edgeFunction, /routingPreference: 'TRAFFIC_UNAWARE'/);
});

test('catálogo de painéis contém a resolução técnica por unidade', () => {
  const source = read('produtos.js').replace('const produtosPainel =', 'globalThis.produtosPainel =');
  const context = {};
  vm.runInNewContext(source, context);
  const pixelsEsperados = new Map([
    ['P2.97 Rental', [168, 336]],
    ['P3.9 Rental', [128, 256]],
    ['P4.81 Rental', [104, 104]],
    ['P5 Magnésio', [192, 192]],
    ['P2.5 GOB ACM', [128, 64]],
    ['P1.86GOB ACM', [172, 86]],
    ['P3 ACM', [106, 53]],
    ['P4 ACM', [80, 40]],
    ['P2.5 GOB IMÃ', [128, 64]],
    ['P3 IMÃ Indoor', [106, 53]],
  ]);
  assert.equal(context.produtosPainel.length, pixelsEsperados.size);
  for (const [nome, [largura, altura]] of pixelsEsperados) {
    const produto = context.produtosPainel.find(item => item.nome === nome);
    assert.ok(produto, `produto ausente: ${nome}`);
    assert.equal(produto.pixelsLargura, largura);
    assert.equal(produto.pixelsAltura, altura);
  }
});

test('cálculo e exibição carregam a resolução efetiva do painel', () => {
  const app = read('app.js');
  assert.match(app, /const resolucaoLargura = qtdLarg \* pixelsLargura/);
  assert.match(app, /const resolucaoAltura = qtdAlt \* pixelsAltura/);
  assert.match(app, /resolucaoFinal = resolucaoLargura > 0 && resolucaoAltura > 0/);
  assert.match(app, /<strong>Resolução:<\/strong> \$\{resolucaoFinal\}/);
  assert.match(app, /objetoResolucaoEl\.textContent = dados\.resolucaoFinal/);
  assert.match(app, /resolucaoFinal,\s+custoPainel/);
});

test('linha do objeto usa apresentação editorial na proposta', () => {
  const app = read('app.js');
  const proposta = read('proposta.html');
  assert.match(proposta, /class="objeto-label"/);
  assert.match(proposta, /class="objeto-grid"/);
  assert.match(proposta, /id="objeto-resolucao"/);
  assert.match(proposta, /id="objeto-ambiente"/);
  assert.match(proposta, /id="objeto-medida"/);
  assert.match(proposta, /id="objeto-face"/);
  assert.match(app, /getElementById\('objeto-resolucao'\)/);
});

test('catálogo central de controladoras contém os preços definidos', () => {
  const source = read('controladoras.js');
  for (const [value, price] of [
    ['Novastar TB10 Plus', 1600], ['Novastar TB20 Plus', 2000],
    ['Novastar TB30', 2250], ['Novastar TB40', 4000], ['Novastar TB50', 1],
    ['Novastar TB60', 7900], ['Novastar VX400', 11400], ['Novastar VX600', 13600],
    ['Novastar VX1000', 16800], ['Novastar V960', 4860],
  ]) {
    assert.match(source, new RegExp(`value: '${value.replace('.', '\\.')}'[\\s\\S]*?price: ${price}`));
  }
  assert.doesNotMatch(source, /value: 'Novastar TB2'/);
  assert.doesNotMatch(source, /Huidu A3/);
});

test('módulos carregam o catálogo central e os limites mínimos', () => {
  for (const modulo of ['fachada', 'totem', 'vitrine', 'parede']) {
    const html = read(`${modulo}/${modulo}.html`);
    assert.match(html, /controladoras\.js/);
    if (modulo === 'totem') {
      assert.match(html, /id="larguraDisplay"[^>]*min="0\.32"/);
      assert.match(html, /id="alturaDisplay"[^>]*min="0\.16"/);
    } else {
      assert.match(html, /id="larguraPainel"[^>]*min="0\.32"/);
      assert.match(html, /id="alturaPainel"[^>]*min="0\.16"/);
    }
  }
});

test('proposta mantém apenas a exportação PDF', () => {
  const app = read('app.js');
  const proposta = read('proposta.html');
  assert.doesNotMatch(app, /gerarWord|btnSalvarWord|docx/i);
  assert.doesNotMatch(proposta, /Salvar Word|btnSalvarWord|docx/i);
  assert.match(proposta, /btnSalvarPDF/);
});

test('valores de borda e revestimento permanecem separados', () => {
  const app = read('app.js');
  assert.match(app, /const precoPorMetro = 350\.00/);
  assert.match(app, /precoAcmM2: 550/);
  assert.match(app, /custoACM = somaM2 \* CONFIG\.precoAcmM2/);
});

test('menus de seleção mantêm contraste explícito nas opções', () => {
  const css = read('src/input.css');
  assert.match(css, /select\.input\s*\{[\s\S]*color:\s*#111827\s*!important/);
  assert.match(css, /select\.input option\s*\{[\s\S]*background-color:\s*#fff\s*!important/);
  assert.match(css, /select\.input option:checked\s*\{[\s\S]*background-color:\s*#2563eb\s*!important/);
});

test('formulário limita a largura dos menus em telas grandes', () => {
  const css = read('src/input.css');
  assert.match(css, /#orcamento-form\s*\{[\s\S]*max-width:\s*1280px/);
  assert.match(css, /#orcamento-form select\s*\{[\s\S]*max-width:\s*100%/);
});

test('gerar proposta abre a proposta em nova aba e calcular permanece no orçamento', () => {
  const app = read('app.js');
  assert.match(app, /window\.open\('about:blank', '_blank'\)/);
  assert.match(app, /janelaProposta\.location\.href = caminhoProposta/);
  assert.match(app, /form\.addEventListener\('submit', \(event\) => \{\s*event\.preventDefault\(\);\s*calcularOrcamento\(moduloAtual\);\s*\}\);/);
  assert.match(app, /btnGerarProposta\.addEventListener\('click', \(\) => abrirPropostaAtual\(true\)\)/);
});

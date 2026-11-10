const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

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

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'locacao.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: 'locacao.js' });
const calcularLocacao = sandbox.window.calcularLocacao;

const referencias = [
  [100000, [10540.78, 5993.65, 4528.02, 3857.39, 3459.82]],
  [50000, [5270.39, 2996.82, 2264.01, 1928.70, 1729.91]],
  [37599, [3963.23, 2253.55, 1702.49, 1450.34, 1300.86]],
];

for (const [valor, parcelasEsperadas] of referencias) {
  test(`locação PRICE preserva referência para R$ ${valor}`, () => {
    const parcelas = calcularLocacao(valor);
    assert.deepEqual(Array.from(parcelas, item => item.prazo), [12, 24, 36, 48, 60]);
    parcelas.forEach((item, index) => {
      assert.ok(Math.abs(item.valor - parcelasEsperadas[index]) <= 0.01,
        `prazo ${item.prazo}: esperado ${parcelasEsperadas[index]}, obtido ${item.valor}`);
    });
  });
}

test('locação rejeita base nula ou negativa', () => {
  assert.equal(calcularLocacao(0).length, 0);
  assert.equal(calcularLocacao(-1).length, 0);
  assert.equal(calcularLocacao(null).length, 0);
});

test('locação escala proporcionalmente', () => {
  const metade = calcularLocacao(50000);
  const dobro = calcularLocacao(100000);
  metade.forEach((item, index) => assert.ok(Math.abs(item.valor * 2 - dobro[index].valor) < 0.000001));
});

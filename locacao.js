/**
 * locacao.js
 * ----------------------------
 * Responsável por calcular as parcelas de LOCAÇÃO
 * com base no sistema PRICE (parcelas fixas mensais).
 * 
 * Taxas utilizadas:
 * - 12 meses → 2.6% ao mês
 * - 24, 36, 48, 60 meses → 2.4% ao mês
 * 
 * Fórmula:
 * PMT = PV * [i(1+i)^n] / [(1+i)^n - 1]
 * 
 * Onde:
 *  - PV = Valor presente (total do orçamento)
 *  - i = taxa de juros mensal
 *  - n = número de parcelas
 */

function calcularLocacao(valorTotal) {
  if (!valorTotal || valorTotal <= 0) return [];

  const prazos = [12, 24, 36, 48, 60];
  const resultados = [];

  for (let n of prazos) {
    // Taxa de juros mensal
    const i = n === 12 ? 0.026 : 0.024;

    // Fórmula PRICE
    const pmt = valorTotal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);

    resultados.push({
      prazo: n,
      valor: pmt,
      totalPago: pmt * n,
      acrescimo: ((pmt * n / valorTotal) - 1) * 100
    });
  }

  return resultados;
}

/**
 * Formata número para moeda brasileira (R$)
 */
function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

/**
 * Preenche a tabela de locação (HTML)
 * Chamar no app.js depois que o cálculo estiver pronto
 */
function preencherTabelaLocacao(resultados) {
  const tabela = document.getElementById('tabelaLocacao');
  if (!tabela) return;

  tabela.innerHTML = resultados.map(item => `
    <tr>
      <td class="py-1 px-2">${item.prazo} meses</td>
      <td class="py-1 px-2">${formatarMoeda(item.valor)}</td>
    </tr>
  `).join('');
}

/**
 * Exibe ou esconde o bloco de locação
 */
function alternarBlocoLocacao(ativo) {
  const bloco = document.getElementById('blocoLocacao');
  if (!bloco) return;
  bloco.style.display = ativo ? 'block' : 'none';
}

// Exporta funções para uso no app.js
window.calcularLocacao = calcularLocacao;
window.preencherTabelaLocacao = preencherTabelaLocacao;
window.alternarBlocoLocacao = alternarBlocoLocacao;
window.formatarMoeda = formatarMoeda;

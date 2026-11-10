// Catálogo único de controladoras e processadoras usado por todos os módulos.
const controladoras = [
  { value: 'Novastar TB10 Plus', label: 'Controladora de vídeo - Novastar TB10 Plus - 650 kp', price: 1600 },
  { value: 'Novastar TB20 Plus', label: 'Controladora de vídeo - Novastar TB20 Plus - 650 kp', price: 2000 },
  { value: 'Novastar TB30', label: 'Controladora de vídeo - Novastar TB30 - 650 kp', price: 2250 },
  { value: 'Novastar TB40', label: 'Controladora de vídeo - Novastar TB40 - 1.3 Mp', price: 4000 },
  { value: 'Novastar TB50', label: 'Controladora de vídeo - Novastar TB50 - 1.3 Mp', price: 1 },
  { value: 'Novastar TB60', label: 'Controladora de vídeo - Novastar TB60 - 2.3 Mp', price: 7900 },
  { value: 'Novastar VX400', label: 'Processadora de vídeo - Novastar VX400', price: 11400 },
  { value: 'Novastar VX600', label: 'Processadora de vídeo - Novastar VX600', price: 13600 },
  { value: 'Novastar VX1000', label: 'Processadora de vídeo - Novastar VX1000', price: 16800 },
  { value: 'Novastar V960', label: 'Processadora de vídeo - Novastar V960 - 2.6 Mp', price: 4860 },
];

function carregarControladoras() {
  const select = document.getElementById('controladora');
  if (!select) return;
  const valorAtual = select.value;
  select.innerHTML = '<option value="">Selecionar Controladora</option>';
  controladoras.forEach(controladora => {
    const option = document.createElement('option');
    option.value = controladora.value;
    option.textContent = controladora.label;
    option.dataset.valor = String(controladora.price);
    select.appendChild(option);
  });
  if (valorAtual && controladoras.some(item => item.value === valorAtual)) select.value = valorAtual;
}

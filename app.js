const CONFIG = {
  precoEletricaM2: 78,
  taxaFixaInstalacao: 250,
  precoPorKm: 2.5,
  custoHoraViagem: 46.87,
  custoHoraTrabalho: 31.25,
  custoDiariaHotel: 300,
  custoHoraMunk: 200,
  impostoInstalacao: 1.18,
  precoAcmM2: 450,
  profundidadeTotemM: 0.10,
  bordaInternaTotemM: 0.04,
};

const vendedores = [
    { id: 'patricia', nome: 'Patricia Gomez', cargo: 'Consultora comercial - Via Painéis', fone: '(47) 93618-1267', email: 'vendas5@viapaineis.com.br' },
    { id: 'William', nome: 'William Melo', cargo: 'Consultor Comercial', fone: '(47) 99722-1472', email: 'vendas1@viapaineis.com.br' },
    { id: 'Patric', nome: 'Patric Marques', cargo: 'Consultor Comercial', fone: '(47) 99711-2059', email: 'vendas4@viapaineis.com.br' },
   { id: 'Frederico Carvalho', nome: 'Frederico Carvalho', cargo: 'Diretor', fone: '(47) 9995-3208', email: 'adm@viapaineis.com.br' },
    { id: 'Paulo', nome: 'Paulo Marques', cargo: 'Gerente Comercial', fone: '(47) 99752-0289', email: 'paulo.marques@viapaineis.com.br' }
];

let painelSelecionado = null;
let ultimoResultado = null;

const MODULOS_EM_SUBPASTA = ['fachada', 'totem', 'vitrine', 'parede'];

function obterParametrosAuthUrl() {
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return {
        code: queryParams.get('code') || hashParams.get('code'),
        type: queryParams.get('type') || hashParams.get('type'),
        accessToken: hashParams.get('access_token'),
        refreshToken: hashParams.get('refresh_token'),
        error: queryParams.get('error') || hashParams.get('error'),
        errorDescription: queryParams.get('error_description') || hashParams.get('error_description'),
    };
}

function urlTemFluxoDeSenha() {
    const params = obterParametrosAuthUrl();
    return params.type === 'recovery' || params.type === 'invite' || Boolean(params.accessToken && params.refreshToken);
}

function redirecionarFluxoDeSenhaParaPaginaCorreta(moduloAtual) {
    if (moduloAtual === 'accept-invite' || !urlTemFluxoDeSenha()) return false;

    const destino = new URL('/accept-invite.html', window.location.origin);
    destino.search = window.location.search;
    destino.hash = window.location.hash;
    window.location.replace(destino.toString());
    return true;
}

function getSupabaseClient() {
    if (!window.supabaseClient) {
        throw new Error(window.supabaseSetupError || 'Supabase não configurado.');
    }
    return window.supabaseClient;
}

async function obterSessaoAtual() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session || !urlTemFluxoDeSenha()) return data.session || null;

    return new Promise((resolve) => {
        let subscription = null;
        const finish = (session) => {
            if (subscription) subscription.unsubscribe();
            resolve(session || null);
        };

        const timeoutId = setTimeout(async () => {
            const { data: refreshedData } = await supabase.auth.getSession();
            finish(refreshedData.session || null);
        }, 1500);

        const authListener = supabase.auth.onAuthStateChange((_event, session) => {
            clearTimeout(timeoutId);
            finish(session);
        });
        subscription = authListener?.data?.subscription || null;
    });
}

function limparAuthLegado() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
}

function obterNomeUsuario(session) {
    const user = session?.user;
    return user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || '';
}

function caminhoParaLogin(moduloAtual) {
    return MODULOS_EM_SUBPASTA.includes(moduloAtual) ? '../login.html' : 'login.html';
}

function redirecionarParaLogin(moduloAtual) {
    const loginPath = caminhoParaLogin(moduloAtual);
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `${loginPath}?next=${next}`;
}

function getSafeNextUrl() {
    const next = new URLSearchParams(window.location.search).get('next');
    if (!next || /^https?:\/\//i.test(next) || next.startsWith('//')) return 'index.html';
    return next;
}

function normalizarDadosProposta(valor) {
    if (typeof valor !== 'string') return valor;
    try {
        return JSON.parse(valor);
    } catch (_) {
        return valor;
    }
}

function gerenciarCabecalhoUsuario(session) {
    const header = document.getElementById('user-header');
    const userEmailSpan = document.getElementById('user-email');
    const logoutButton = document.getElementById('logout-button');

    if (!header || !userEmailSpan || !logoutButton) {
        return;
    }

    const userName = obterNomeUsuario(session);

    if (session && userName) {
        userEmailSpan.textContent = `Usuário: ${userName}`;
        header.classList.remove('hidden');

        logoutButton.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja sair?')) {
                try {
                    await getSupabaseClient().auth.signOut();
                } catch (_) {}
                limparAuthLegado();
                alert('Você saiu da sua conta.');

                const moduloAtual = document.body.dataset.modulo;
                window.location.href = caminhoParaLogin(moduloAtual);
            }
        }, { once: true });
    } else {
        header.classList.add('hidden');
    }
}

async function obterPerfilAtual(session) {
    if (!session) return null;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role')
    .eq('id', session.user.id)
    .single();

    if (error) return null;
    return data;
}

function mostrarControlesAdmin(perfil) {
    const adminLink = document.getElementById('admin-link');
    if (!adminLink) return;
    adminLink.classList.toggle('hidden', perfil?.role !== 'superadmin');
}

async function carregarPainelAdmin(session, perfil) {
    if (perfil?.role !== 'superadmin') {
        alert('Acesso restrito ao superadmin.');
        window.location.href = 'index.html';
        return;
    }

    await carregarUsuariosAdmin();

    const form = document.getElementById('admin-create-user-form');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const status = document.getElementById('admin-create-user-status');
        const formData = new FormData(form);
        const payload = {
            full_name: String(formData.get('full_name') || '').trim(),
            email: String(formData.get('email') || '').trim().toLowerCase(),
            role: formData.get('role') === 'superadmin' ? 'superadmin' : 'user',
            redirect_to: `${window.location.origin}/accept-invite.html`,
        };

        if (status) {
            status.textContent = 'Enviando convite...';
            status.className = 'text-sm mt-4 text-gray-600';
        }

        try {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase.functions.invoke('admin-create-user', {
                body: payload,
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            form.reset();
            if (status) {
                status.textContent = data?.link_type === 'recovery'
                    ? 'Usuário já existia. Link para definir nova senha enviado.'
                    : 'Convite enviado e usuário registrado.';
                status.className = 'text-sm mt-4 text-green-700';
            }
            await carregarUsuariosAdmin();
        } catch (error) {
            if (status) {
                status.textContent = error.message || 'Falha ao criar usuário.';
                status.className = 'text-sm mt-4 text-red-600';
            }
        }
    });
}

async function carregarUsuariosAdmin() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    try {
        const supabase = getSupabaseClient();
        const { data: usuarios, error } = await supabase
        .from('user_profiles')
        .select('email, full_name, role, created_at')
        .order('created_at', { ascending: false });

        if (error) throw error;

        if (!usuarios || usuarios.length === 0) {
            container.innerHTML = '<p>Nenhum usuário cadastrado.</p>';
            return;
        }

        container.innerHTML = '';
        usuarios.forEach(usuario => {
            const card = document.createElement('div');
            card.className = 'bg-gray-50 p-3 rounded border border-gray-200';

            const nome = document.createElement('p');
            nome.className = 'font-semibold';
            nome.textContent = usuario.full_name || usuario.email;

            const detalhes = document.createElement('p');
            detalhes.className = 'text-sm text-gray-600';
            detalhes.textContent = `${usuario.email} • ${usuario.role === 'superadmin' ? 'Superadmin' : 'Usuário'}`;

            card.appendChild(nome);
            card.appendChild(detalhes);
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = `<p class="text-red-500">${error.message}</p>`;
    }
}

async function configurarAceiteConvite() {
    const form = document.getElementById('accept-invite-form');
    const message = document.getElementById('accept-invite-message');
    if (!form || !message) return;

    const params = obterParametrosAuthUrl();
    if (params.error) {
        sessionStorage.removeItem('passwordRecoveryPending');
        message.textContent = params.errorDescription || 'Convite inválido ou expirado. Peça para o administrador enviar um novo convite.';
        message.className = 'text-sm text-red-600 text-center mb-6';
        return;
    }

    if (sessionStorage.getItem('passwordRecoveryPending') !== '1') {
        message.textContent = 'Abra o link mais recente recebido por email para definir sua senha.';
        message.className = 'text-sm text-red-600 text-center mb-6';
        return;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
        sessionStorage.removeItem('passwordRecoveryPending');
        message.textContent = 'Convite inválido ou expirado. Peça para o administrador enviar um novo convite.';
        message.className = 'text-sm text-red-600 text-center mb-6';
        return;
    }

    message.textContent = `Convite aceito para ${data.session.user.email}. Defina sua senha para concluir o acesso.`;
    message.className = 'text-sm text-gray-600 text-center mb-6';
    form.classList.remove('hidden');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = form.elements.namedItem('password').value;
        const passwordConfirmation = form.elements.namedItem('password_confirmation').value;

        if (password !== passwordConfirmation) {
            message.textContent = 'As senhas não conferem.';
            message.className = 'text-sm text-red-600 text-center mb-6';
            return;
        }

        try {
            message.textContent = 'Salvando senha...';
            message.className = 'text-sm text-gray-600 text-center mb-6';
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;

            sessionStorage.removeItem('passwordRecoveryPending');
            await supabase.auth.signOut();
            message.textContent = 'Senha definida com sucesso. Entre novamente com sua nova senha.';
            message.className = 'text-sm text-green-700 text-center mb-6';
            window.location.href = 'login.html';
        } catch (updateError) {
            message.textContent = updateError.message || 'Não foi possível definir a senha.';
            message.className = 'text-sm text-red-600 text-center mb-6';
        }
    });
}

function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function carregarVendedores() {
    const select = document.getElementById('selectVendedor');
    if (!select) return;
    vendedores.forEach(v => {
    const option = document.createElement('option');
    option.value = v.id;
    option.textContent = v.nome;
    select.appendChild(option);
    });
}

function carregarModelos() {
  const select = document.getElementById("modeloPainel");
  if (!select) return;
  select.innerHTML = '<option value="">Selecionar modelo do painel</option>';
  produtosPainel.forEach(p => {
    const option = document.createElement('option');
    option.value = p.nome;
    let textoOpcao;
    if (p.dimensao === "0.32x0.16") {
    textoOpcao = `${p.nome} ${p.ambiente} sobmedida`;
    } else {
    const [larguraM, alturaM] = p.dimensao.split('x').map(Number);
    const larguraCm = Math.round(larguraM * 100);
    const alturaCm = Math.round(alturaM * 100);
    textoOpcao = `${p.nome} ${p.ambiente} ${larguraCm}x${alturaCm}cm`;
    }
    option.textContent = textoOpcao;
    select.appendChild(option);
  });
}

function atualizarPainelSelecionado() {
  const select = document.getElementById("modeloPainel");
  const valorUnitarioInput = document.getElementById("valorUnitario");
  if (!select || !valorUnitarioInput) return;
  const nomeSelecionado = select.value;
  painelSelecionado = produtosPainel.find(p => p.nome === nomeSelecionado) || null;
  if (painelSelecionado && painelSelecionado.valor === "MANUAL") {
    valorUnitarioInput.value = "";
    valorUnitarioInput.readOnly = false;
    valorUnitarioInput.placeholder = "Insira o valor unitário";
    valorUnitarioInput.focus();
  } else if (painelSelecionado) {
    valorUnitarioInput.value = painelSelecionado.valor;
    valorUnitarioInput.readOnly = false;
    valorUnitarioInput.placeholder = "";
  } else {
    valorUnitarioInput.value = "";
    valorUnitarioInput.readOnly = true;
    valorUnitarioInput.placeholder = "Valor Unitário (R$)";
  }
}

function obterValorAjustado(id, valorAutomatico) {
  const input = document.getElementById(id);
  if (!input) return valorAutomatico;
  if (!input.dataset.userEdited) input.value = Number(valorAutomatico || 0).toFixed(2);
  const valor = parseFloat(input.value);
  return Number.isFinite(valor) && valor >= 0 ? valor : valorAutomatico;
}

function prepararCamposDeValorEditavel() {
  const form = document.getElementById('orcamento-form');
  if (!form || document.getElementById('ajustes-valores')) return;
  const bloco = document.createElement('div');
  bloco.id = 'ajustes-valores';
  bloco.className = 'mt-6 border-t border-gray-300 pt-4';
  bloco.innerHTML = `
    <h2 class="text-lg font-semibold mb-2">Ajustes de valores da proposta</h2>
    <p class="text-sm text-gray-600 mb-4">Os valores começam com o cadastro automático e podem ser alterados nesta proposta.</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label class="block text-sm font-medium text-gray-700">Controladora (R$)<input id="ajusteControladora" type="number" min="0" step="0.01" class="input mt-1"></label>
      <label class="block text-sm font-medium text-gray-700">Estrutura unitária (R$)<input id="ajusteEstrutura" type="number" min="0" step="0.01" class="input mt-1"></label>
      <label class="block text-sm font-medium text-gray-700">Elétrica (R$)<input id="ajusteEletrica" type="number" min="0" step="0.01" class="input mt-1"></label>
      <label class="block text-sm font-medium text-gray-700">Instalação ou frete (R$)<input id="ajusteInstalacao" type="number" min="0" step="0.01" class="input mt-1"></label>
      <label class="block text-sm font-medium text-gray-700">ACM (R$)<input id="ajusteACM" type="number" min="0" step="0.01" class="input mt-1"></label>
      <label class="block text-sm font-medium text-gray-700">Pilar (R$)<input id="ajustePilar" type="number" min="0" step="0.01" class="input mt-1"></label>
      <label class="block text-sm font-medium text-gray-700">Sapata (R$)<input id="ajusteSapata" type="number" min="0" step="0.01" class="input mt-1"></label>
      <label class="block text-sm font-medium text-gray-700">Borda (R$)<input id="ajusteBorda" type="number" min="0" step="0.01" class="input mt-1"></label>
    </div>`;
  const submit = form.querySelector('button[type="submit"]');
  form.insertBefore(bloco, submit || null);
  bloco.querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
    input.dataset.userEdited = 'true';
  }));
}

function calcularMedidaFinal(larguraInput, alturaInput) {
  if (!painelSelecionado) return { qtd: 0, medidaFinal: '0.00m x 0.00m', finalW: 0, finalH: 0 };
  const [modLarg, modAlt] = painelSelecionado.dimensao.split("x").map(Number);
  let qtd, medidaFinal, finalW, finalH;
  if (painelSelecionado.tipo === "gabinete") {
    const qtdLarg = Math.floor(larguraInput / modLarg);
    const qtdAlt = Math.floor(alturaInput / modAlt);
    qtd = qtdLarg * qtdAlt;
    finalW = qtdLarg * modLarg;
    finalH = qtdAlt * modAlt;
  } else {
    finalW = Math.floor(larguraInput / modLarg) * modLarg;
    finalH = Math.floor(alturaInput / modAlt) * modAlt;
    qtd = parseFloat((finalW * finalH).toFixed(4));
  }
  medidaFinal = `${finalW.toFixed(2)}m x ${finalH.toFixed(2)}m`;
  return { qtd, medidaFinal, finalW, finalH };
}

function desenharEsbocoTotem(wTotem, hTotem, wDisp, hDisp, posicao) {
  const canvas = document.getElementById("esbocoTotem");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const marginTop = 20, marginBottom = 20;
  const escala = (canvas.height - marginTop - marginBottom) / hTotem * 0.85;
  const tW = wTotem * escala, tH = hTotem * escala;
  const dW = wDisp * escala, dH = hDisp * escala;
  const cx = (canvas.width - tW) / 2, cy = marginTop;
  ctx.fillStyle = "#e0e0e0"; ctx.fillRect(cx, cy, tW, tH);
  ctx.strokeStyle = "#444"; ctx.lineWidth = 1; ctx.strokeRect(cx, cy, tW, tH);
  const bordaPx = CONFIG.bordaInternaTotemM * escala;
  let dispY;
  if (posicao === "cima") dispY = cy + bordaPx;
  else if (posicao === "baixo") dispY = cy + tH - dH - bordaPx;
  else dispY = cy + (tH - dH) / 2;
  ctx.fillStyle = "#111";
  ctx.fillRect(cx + (tW - dW) / 2, dispY, dW, dH);
}

function calcularCustoInstalacao(modulo) {
    const km = parseFloat(document.getElementById("kmLocal")?.value) || 0;
    const taxaFixa = CONFIG.taxaFixaInstalacao;
    const kmTotal = km * 2;
    const valorKM = kmTotal * CONFIG.precoPorKm;
    let tipoEntrega = 'instalacao';
    if (modulo === 'totem') {
    tipoEntrega = document.querySelector('input[name="tipoEntrega"]:checked').value;
    }
    if (tipoEntrega === 'frete') {
    const frete = (taxaFixa + valorKM);
    return { custoTotal: frete * CONFIG.impostoInstalacao, tipo: 'Frete' };
    }
    const tempoViagemHoras = parseFloat(document.getElementById("tempoViagem")?.value) || 0;
    const funcionarios = parseFloat(document.getElementById("funcionarios")?.value) || 0;
    const horasTrabalho = parseFloat(document.getElementById("tempoTrabalho")?.value) || 0;
    const munkHoras = parseFloat(document.getElementById("horasMunk")?.value) || 0;
    const horasDeslocamentoTotal = tempoViagemHoras * 2;
    const valorDeslocamento = horasDeslocamentoTotal * CONFIG.custoHoraViagem;
    const valorTrabalho = funcionarios * horasTrabalho * CONFIG.custoHoraTrabalho;
    const custoHotel = (kmTotal > 500) ? CONFIG.custoDiariaHotel : 0;
    let custoMunk = munkHoras * CONFIG.custoHoraMunk;
    if (modulo === 'parede' || modulo === 'vitrine') custoMunk = 0;
    const subtotal = taxaFixa + valorKM + valorDeslocamento + valorTrabalho + custoHotel + custoMunk;
    const custoTotal = subtotal * CONFIG.impostoInstalacao;
    return { custoTotal, tipo: 'Instalação' };
}

function getFormInputs(form) {
    const inputs = {};
    const elements = form.querySelectorAll('input, select');
    elements.forEach(el => {
    if (el.type === 'radio' && !el.checked) return;
    const key = el.id || el.name;
    if(key) {
      if (el.type === 'checkbox') inputs[key] = el.checked;
      else inputs[key] = el.value;
    }
    });
    return inputs;
}

function preencherFormulario(dados) {
    if (!dados || !dados.inputs) return;
    prepararCamposDeValorEditavel();
    const inputs = dados.inputs;
    for (const key in inputs) {
    const element = document.getElementById(key) || document.querySelector(`[name="${key}"][value="${inputs[key]}"]`);
    if (element) {
    if (element.type === 'radio') {
    element.checked = true;
    } else if (element.type === 'checkbox') {
      element.checked = !!inputs[key];
    } else {
    element.value = inputs[key];
    }
    }
    }
    document.getElementById('modeloPainel')?.dispatchEvent(new Event('change'));
    ['valorUnitario', 'ajusteControladora', 'ajusteEstrutura', 'ajusteEletrica', 'ajusteInstalacao', 'ajusteACM', 'ajustePilar', 'ajusteSapata', 'ajusteBorda'].forEach(id => {
      const element = document.getElementById(id);
      if (element && inputs[id] !== undefined && inputs[id] !== '') {
        element.value = inputs[id];
        element.dataset.userEdited = 'true';
      }
    });
    if (dados.modulo === 'pilar') document.getElementById('tipoPilar')?.dispatchEvent(new Event('change'));
    if (dados.modulo === 'totem') document.querySelector('input[name="tipoEntrega"]')?.dispatchEvent(new Event('change'));
}

function calcularOrcamento(modulo) {
  prepararCamposDeValorEditavel();
  const resultadoDiv = document.getElementById("resultado");
  if (!painelSelecionado) {
  if (!window.__carregandoHistorico) {
    alert("Selecione um modelo de painel.");
  }
  if (!painelSelecionado) {
  const sel = document.getElementById('modeloPainel');
  if (sel && sel.value) {
    painelSelecionado = produtosPainel.find(p => p.nome === sel.value) || null;
  }
}
  return;
}
  let largura, altura;
  if (modulo === 'totem') {
    largura = parseFloat(document.getElementById("larguraDisplay").value);
    altura = parseFloat(document.getElementById("alturaDisplay").value);
  } else {
    largura = parseFloat(document.getElementById("larguraPainel").value);
    altura = parseFloat(document.getElementById("alturaPainel").value);
  }
  if (isNaN(largura) || isNaN(altura) || largura <= 0 || altura <= 0) { alert("Preencha as dimensões com valores válidos."); return; }
  const valorUnitario = parseFloat(document.getElementById("valorUnitario").value);
  if (isNaN(valorUnitario) || valorUnitario <= 0) { alert("Por favor, insira um valor unitário válido."); return; }
  const { qtd, medidaFinal, finalW, finalH } = calcularMedidaFinal(largura, altura);
  const selectControladora = document.getElementById("controladora");
  const optionSelecionadaCtrl = selectControladora.options[selectControladora.selectedIndex] || { dataset: { valor: 0 }, text: ''};
  const vendedorId = document.getElementById('selectVendedor').value;
  let custoPainel = qtd * valorUnitario;
  let custoControladora = parseFloat(optionSelecionadaCtrl.dataset.valor) || 0;
  let custoEstrutura = 0;
  let custoEletrica = 0, custoInstalacao = 0;
  let custoPilar = 0, custoSapata = 0, custoACM = 0, totalACM = 0;
  let custoBorda = 0, metrosBorda = 0;
  let tipoEntrega = 'Instalação';
  let valorPorMetroQuadrado = 0;
  const inst = calcularCustoInstalacao(modulo);
  custoInstalacao = inst.custoTotal;
  tipoEntrega = inst.tipo;

  // CALCULO BORDA (se existir checkbox na página)
  const incluirBordaEl = document.getElementById('incluirBorda');
  if (incluirBordaEl && incluirBordaEl.checked) {
    // metros lineares = perímetro do painel final
    metrosBorda = 2 * (finalW + finalH);
    const tipoBorda = document.getElementById('tipoBorda')?.value || '15x10';
    const precoPorMetro = tipoBorda === '15x10' ? 293.00 : 345.00;
    custoBorda = metrosBorda * precoPorMetro;
  }

  // Calcular valorPorMetroQuadrado
  if (painelSelecionado.tipo === 'm2') {
    valorPorMetroQuadrado = valorUnitario;
  } else {
    const areaGabinete = parseFloat(painelSelecionado.dimensao.split('x')[0]) * parseFloat(painelSelecionado.dimensao.split('x')[1]);
    if(areaGabinete > 0) valorPorMetroQuadrado = valorUnitario / areaGabinete;
  }

  // Calcular quantidadeDeEstruturas (SEMPRE baseado no tipo de gabinete)
  let quantidadeDeEstruturas = 0;
  if (painelSelecionado.tipo === 'm2') {
    // Sob medida = 1 estrutura por M²
    quantidadeDeEstruturas = qtd;
  } else {
    // Gabinetes: baseado na dimensão
    switch (painelSelecionado.dimensao) {
    case '0.96x0.96': quantidadeDeEstruturas = qtd; break; // 1 estrutura por gabinete
    case '0.50x1.00': quantidadeDeEstruturas = qtd / 2; break; // 0.5 estrutura por gabinete
    case '0.50x0.50': quantidadeDeEstruturas = qtd / 4; break; // 0.25 estrutura por gabinete
    default: quantidadeDeEstruturas = qtd;
    }
  }

  // Custos base por módulo
  switch (modulo) {
    case 'fachada': case 'pilar': case 'totem': case 'vitrine':
    custoEletrica = qtd * CONFIG.precoEletricaM2;
    break;
    case 'parede': break;
  }

  if (modulo === 'pilar') {
    const tipoPilarSelect = document.getElementById('tipoPilar');
    const pilarOption = tipoPilarSelect.options[tipoPilarSelect.selectedIndex];
    const isCalandrado = pilarOption.dataset.calandrado === 'true';
    let valorPilarManual = parseFloat(document.getElementById('valorPilarManual').value) || 0;
    if (isCalandrado) {
    const qtdPilar = parseFloat(document.getElementById('qtdPilarCalandrado').value) || 1;
    custoPilar = valorPilarManual * qtdPilar;
    } else {
    custoPilar = valorPilarManual;
    }
    const modeloSapataValor = parseFloat(document.getElementById("modeloSapata").value) || 0;
    const qtdSapatas = parseInt(document.getElementById("qtdSapatas").value) || 0;
    custoSapata = modeloSapataValor * qtdSapatas;
  } else if (modulo === 'totem') {
  const wTotem = parseFloat(document.getElementById("larguraTotem").value);
  const hTotem = parseFloat(document.getElementById("alturaTotem").value);
  if (isNaN(wTotem) || isNaN(hTotem)) { alert("Preencha as dimensões do totem."); return; }

  // medidas (m)
  const larguraTotal = wTotem;
  const alturaTotal  = hTotem;
  const larguraPainel = finalW; // já calculado antes
  const alturaPainel  = finalH; // já calculado antes

  // REVESTIMENTO
  const revestimentoTotal   = larguraTotal * alturaTotal;
  const displayArea    = larguraPainel * alturaPainel;
  const frente    = Math.max(revestimentoTotal - displayArea, 0);

  const lateralFaixaM = 0.15; // 15cm
  const lateral    = (lateralFaixaM * alturaTotal) * 2;

  const cima    = lateralFaixaM * larguraTotal;
  const traseiro    = revestimentoTotal;

  const somaM2    = frente + lateral + cima + traseiro;

  totalACM = somaM2;
  custoACM = somaM2 * 450; // R$/m²

  const posicao = document.getElementById("posicaoDisplay").value;
  desenharEsbocoTotem(larguraTotal, alturaTotal, larguraPainel, alturaPainel, posicao);
}

// Se a página tiver o checkbox incluirPilar e ele estiver marcado, calular pilar mesmo em fachadas
const incluirPilarChk = document.getElementById('incluirPilar');
if (incluirPilarChk && incluirPilarChk.checked) {
  const tipoPilarSelect = document.getElementById('tipoPilar');
  if (tipoPilarSelect) {
    const pilarOption = tipoPilarSelect.options[tipoPilarSelect.selectedIndex];
    const isCalandrado = pilarOption && pilarOption.dataset && pilarOption.dataset.calandrado === 'true';
    // prioridade para valor informado manualmente, senão usa value do select
    const valorPilarManualInput = parseFloat(document.getElementById('valorPilarManual')?.value);
    const valorPilarManual = !isNaN(valorPilarManualInput) && valorPilarManualInput > 0 ? valorPilarManualInput : parseFloat(tipoPilarSelect.value) || 0;
    if (isCalandrado) {
      const qtdPilar = parseFloat(document.getElementById('qtdPilarCalandrado')?.value) || 1;
      custoPilar = valorPilarManual * qtdPilar;
    } else {
      custoPilar = valorPilarManual;
    }
    const modeloSapataValor = parseFloat(document.getElementById("modeloSapata")?.value) || 0;
    const qtdSapatas = parseInt(document.getElementById("qtdSapatas")?.value) || 0;
    custoSapata = modeloSapataValor * qtdSapatas;
  }
}

// NOVA LÓGICA DE FACES
const tipoFace = document.querySelector('input[name="tipoFace"]:checked').value;

// Definir multiplicadores e valores de estrutura por tipo de face
let multiplicaPainel = 1;
let multiplicaEletrica = 1;
let multiplicaControladora = 1;
let multiplicaEstrutura = 1;
let valorEstruturaUnit = 1360; // default

switch (tipoFace) {
  case 'uma':
  multiplicaPainel = 1;
  multiplicaEletrica = 1;
  multiplicaControladora = 1;
  multiplicaEstrutura = 1;
  valorEstruturaUnit = 1360;
  break;

  case 'dupla':
  multiplicaPainel = 2;
  multiplicaEletrica = 2;
  multiplicaControladora = 1;
  multiplicaEstrutura = 1;
  valorEstruturaUnit = 1800;
  break;

  case 'dupla_angulo':
  multiplicaPainel = 2;
  multiplicaEletrica = 2;
  multiplicaControladora = 1;
  multiplicaEstrutura = 2;
  valorEstruturaUnit = 1360;
  break;

  case 'dupla_lona':
  multiplicaPainel = 1;
  multiplicaEletrica = 1;
  multiplicaControladora = 1;
  multiplicaEstrutura = 1;
  valorEstruturaUnit = 1560;
  break;

  case 'dupla_angulo_lona':
  multiplicaPainel = 1;
  multiplicaEletrica = 1;
  multiplicaControladora = 1;
  multiplicaEstrutura = 1;
  valorEstruturaUnit = 1760;
  break;
}

// Aplicar multiplicadores
custoPainel *= multiplicaPainel;
custoEletrica *= multiplicaEletrica;
custoControladora *= multiplicaControladora;

// Calcular estrutura: quantidadeDeEstruturas × multiplicaEstrutura × valorEstruturaUnit
const valorEstruturaInformado = parseFloat(document.getElementById('valorEstrutura')?.value);
if (Number.isFinite(valorEstruturaInformado) && valorEstruturaInformado >= 0) valorEstruturaUnit = valorEstruturaInformado;
custoEstrutura = quantidadeDeEstruturas * multiplicaEstrutura * valorEstruturaUnit;

// Condição para zerar estrutura no módulo 'parede'
if (modulo === 'parede') {
  custoEstrutura = 0;
}

// Os valores editados pelo usuário têm prioridade sobre os cálculos automáticos.
custoPainel = obterValorAjustado('valorUnitario', valorUnitario) * qtd * multiplicaPainel;
custoControladora = obterValorAjustado('ajusteControladora', custoControladora);
const estruturaUnitarioFinal = obterValorAjustado('ajusteEstrutura', valorEstruturaUnit);
custoEstrutura = modulo === 'parede' ? 0 : quantidadeDeEstruturas * multiplicaEstrutura * estruturaUnitarioFinal;
custoEletrica = obterValorAjustado('ajusteEletrica', custoEletrica);
custoInstalacao = obterValorAjustado('ajusteInstalacao', custoInstalacao);
custoACM = obterValorAjustado('ajusteACM', custoACM);
custoPilar = obterValorAjustado('ajustePilar', custoPilar);
custoSapata = obterValorAjustado('ajusteSapata', custoSapata);
custoBorda = obterValorAjustado('ajusteBorda', custoBorda);

const total = custoPainel + custoControladora + custoEstrutura + custoEletrica + custoInstalacao + custoPilar + custoSapata + custoACM + custoBorda;

ultimoResultado = { 
  total, medidaFinal, painel: painelSelecionado, qtd, valorUnitario, 
  custoPainel, custoControladora, custoEstrutura, custoEletrica, custoInstalacao, 
  custoPilar, custoSapata, custoACM, totalACM, tipoEntrega, 
  isDuplaFace: (multiplicaPainel > 1), controladoraTexto: optionSelecionadaCtrl.text, 
  vendedorId, modulo, inputs: getFormInputs(document.getElementById('orcamento-form')), 
  valorPorMetroQuadrado, tipoFace, quantidadeDeEstruturas, multiplicaEstrutura, valorEstruturaUnit: estruturaUnitarioFinal,
  custoBorda, metrosBorda
};

let resultadoHTML = `<h3 class="text-lg font-semibold mb-2">Resumo do Orçamento</h3><ul class="space-y-1">`;

// Mostrar tipo de face se não for "uma"
if (tipoFace !== 'uma') {
  const tipoTexto = tipoFace.replace('_', ' ').replace('dupla', 'Dupla').replace('angulo', 'Ângulo').replace('lona', 'Lona');
  resultadoHTML += `<li><strong>Tipo:</strong> ${tipoTexto}</li>`;
}

resultadoHTML += `<li><strong>Painel:</strong> ${formatCurrency(custoPainel)} (${medidaFinal})</li>`;
if (custoEstrutura > 0) resultadoHTML += `<li><strong>Estrutura:</strong> ${formatCurrency(custoEstrutura)} (${quantidadeDeEstruturas * multiplicaEstrutura} × ${formatCurrency(estruturaUnitarioFinal)})</li>`;
if (custoEletrica > 0) resultadoHTML += `<li><strong>Elétrica:</strong> ${formatCurrency(custoEletrica)}</li>`;
if (custoACM > 0) resultadoHTML += `<li><strong>Revestimento ACM (${totalACM.toFixed(2)} m²):</strong> ${formatCurrency(custoACM)}</li>`;
if (custoBorda > 0) {
  const tipoBordaText = document.getElementById('tipoBorda')?.value || '15x10';
  resultadoHTML += `<li><strong>Borda (${tipoBordaText}):</strong> ${metrosBorda.toFixed(2)} m × ${formatCurrency(tipoBordaText === '15x10' ? 293 : 345)} = ${formatCurrency(custoBorda)}</li>`;
}
if (custoPilar > 0) resultadoHTML += `<li><strong>Pilar:</strong> ${formatCurrency(custoPilar)}</li>`;
if (custoSapata > 0) resultadoHTML += `<li><strong>Sapata:</strong> ${formatCurrency(custoSapata)}</li>`;
resultadoHTML += `<li><strong>${tipoEntrega}:</strong> ${formatCurrency(custoInstalacao)}</li>`;
resultadoHTML += `<li><strong>Controladora:</strong> ${formatCurrency(custoControladora)}</li>`;
resultadoHTML += `</ul><p class="mt-4 pt-2 border-t text-lg font-bold text-indigo-700">TOTAL: ${formatCurrency(total)}</p>`;
resultadoDiv.innerHTML = resultadoHTML;
resultadoDiv.classList.remove('hidden');
document.getElementById('container-gerar-proposta')?.classList.remove('hidden');
}

// =============================================================
// BLOCO DE INTEGRAÇÃO COM LOCAÇÃO
// =============================================================
try {
  const checkboxLocacao = document.getElementById('oferecerLocacao');
  if (checkboxLocacao) {
    checkboxLocacao.addEventListener('change', () => {
      const ativo = checkboxLocacao.checked;
      alternarBlocoLocacao(ativo);

      if (ativo) {
        // Extrai o valor total do orçamento já exibido
        const textoTotal = document.querySelector('#resultado .text-indigo-700')?.innerText || '';
        const valorNumerico = parseFloat(textoTotal.replace(/[^\d,]/g, '').replace(',', '.'));

        if (!isNaN(valorNumerico) && valorNumerico > 0) {
          const parcelas = calcularLocacao(valorNumerico);
          preencherTabelaLocacao(parcelas);
        } else {
          console.warn('Valor total do orçamento não encontrado ou inválido.');
        }
      }
    });
  }
} catch (e) {
  console.error('Erro ao inicializar módulo de locação:', e);
}
// =============================================================

function hideResultOnInputChange() {
    document.getElementById('resultado')?.classList.add('hidden');
    document.getElementById('container-gerar-proposta')?.classList.add('hidden');
}

function atualizarCamposPilar() {
    const select = document.getElementById('tipoPilar');
    if (!select) return;
    const valorInput = document.getElementById('valorPilarManual');
    const qtdContainer = document.getElementById('container-qtd-calandrado');
    const selectedOption = select.options[select.selectedIndex];
    const precoPadrao = selectedOption.value;
    const isCalandrado = selectedOption.dataset.calandrado === 'true';
    valorInput.value = precoPadrao;
    if (isCalandrado) qtdContainer.classList.remove('hidden');
    else qtdContainer.classList.add('hidden');
}

function toggleInstalacaoFields() {
    if (document.body.dataset.modulo !== 'totem') return;
    const tipoEntrega = document.querySelector('input[name="tipoEntrega"]:checked').value;
    document.querySelectorAll('.campo-completo').forEach(c => c.style.display = tipoEntrega === 'frete' ? 'none' : 'block');
}

function preencherProposta() {
    const dadosOrig = JSON.parse(localStorage.getItem('dadosProposta'));
    if (!dadosOrig) {
        document.body.innerHTML = '<h1>Dados da proposta não encontrados.</h1>';
        return;
    }

    // Cria cópia para não perder dadosOrig imediatamente (iremos salvar ajuste depois)
    const dados = JSON.parse(JSON.stringify(dadosOrig));

    const vendedor = vendedores.find(v => v.id === dados.vendedorId);
    // Mantemos os valores originais dos equipamentos (não serão alterados)
    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

    const totalPainel = round2(Number(dados.custoPainel) || 0);
    const totalControladora = round2(Number(dados.custoControladora) || 0);
    const equipamentosTotal = round2(totalPainel + totalControladora);

    // Agrupa opcionais vindos dos dados (valores originais do orçamento)
    const opcionaisKeys = ['custoEstrutura','custoEletrica','custoInstalacao','custoPilar','custoSapata','custoACM','custoBorda'];
    const opcionais = {};
    let somaOpcionais = 0;
    opcionaisKeys.forEach(k => {
      opcionais[k] = round2(Number(dados[k]) || 0);
      somaOpcionais = round2(somaOpcionais + opcionais[k]);
    });

    // Total original antes do arredondamento (equipamentos + opcionais)
    const totalOriginal = round2(equipamentosTotal + somaOpcionais);

    // Arredondar para a próxima centena
    const totalArredondado = Math.ceil(totalOriginal / 100) * 100;

    // Diferença a ser ajustada (pode ser 0)
    const diferencaArredondamento = round2(totalArredondado - totalOriginal);

    // Somar essa diferença ao item 'custoInstalacao' (itens opcionais)
    opcionais['custoInstalacao'] = round2(opcionais['custoInstalacao'] + diferencaArredondamento);

    // Recalcular soma de opcionais após ajuste
    somaOpcionais = opcionaisKeys.reduce((acc,k) => round2(acc + opcionais[k]), 0);

    // Totais finais exibidos
    const totalInstalacaoExibido = somaOpcionais;
    const totalGeralExibido = round2(equipamentosTotal + somaOpcionais); // deve ser igual a totalArredondado

    // Atualiza dados ajustados para gerar PDF/Word coerente com a exibição
    const dadosAjustados = JSON.parse(JSON.stringify(dados));
    // sobrescreve os campos que mudaram (instalacao e total)
    dadosAjustados.custoInstalacao = opcionais['custoInstalacao'];
    dadosAjustados.custoEstrutura = opcionais['custoEstrutura'];
    dadosAjustados.custoEletrica = opcionais['custoEletrica'];
    dadosAjustados.custoPilar = opcionais['custoPilar'];
    dadosAjustados.custoSapata = opcionais['custoSapata'];
    dadosAjustados.custoACM = opcionais['custoACM'];
    dadosAjustados.custoBorda = opcionais['custoBorda'];
    dadosAjustados.total = totalGeralExibido;
    dadosAjustados.diferencaArredondamento = diferencaArredondamento;

  if (typeof calcularLocacao === 'function') {
  const parcelasLocacao = calcularLocacao(ultimoResultado.total);
  ultimoResultado.locacao = parcelasLocacao;
}

    // Salva a versão ajustada no localStorage para que PDF/Word usem os mesmos números exibidos
    localStorage.setItem('dadosProposta', JSON.stringify(dadosAjustados));

    // Medida total em cm (mantive para exibição geral)
    let medidaCm = '';
    const medidaStr = dados.medidaFinal || '';
    if (medidaStr) {
      const parts = medidaStr.replace(/m/g, '').split('x').map(s => s.trim()).filter(Boolean);
      if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
        medidaCm = parts.map(v => (parseFloat(v) * 100).toFixed(0) + 'cm').join('x');
      } else {
        medidaCm = medidaStr;
      }
    }

    // --- NOVO: dimensao do gabinete em cm (para mostrar nos itens inclusos) ---
    let gabineteDimensaoCm = '';
    if (dados.painel && dados.painel.dimensao) {
      const dparts = dados.painel.dimensao.split('x').map(s => parseFloat(s));
      if (dparts.length === 2 && !isNaN(dparts[0]) && !isNaN(dparts[1])) {
        gabineteDimensaoCm = `${Math.round(dparts[0]*100)}x${Math.round(dparts[1]*100)}cm`;
      } else {
        gabineteDimensaoCm = dados.painel.dimensao;
      }
    }

    // --- NOVO: calcular "Valor por metro quadrado" mostrado conforme regras solicitadas ---
    const valorUnitarioNum = Number(dados.valorUnitario) || 0;
    const valorPorM2Num = Number(dados.valorPorMetroQuadrado) || 0;
    let valorPorM2Display = 0;

    if (dados.painel && dados.painel.tipo === 'm2') {
      // Sob medida: usa o valor do modelo (se existir valorPorMetroQuadrado, usa ele; senão valorUnitario)
      valorPorM2Display = valorPorM2Num || valorUnitarioNum;
    } else {
      // Gabinetes: regras específicas por dimensão
      const dim = (dados.painel && dados.painel.dimensao) ? dados.painel.dimensao.trim() : '';
      switch (dim) {
        case '0.96x0.96':
          // 1 gabinete → exibe valor do gabinete
          valorPorM2Display = valorUnitarioNum;
          break;
        case '0.50x1.00':
          // soma de dois gabinetes
          valorPorM2Display = valorUnitarioNum * 2;
          break;
        case '0.50x0.50':
          // soma de quatro gabinetes
          valorPorM2Display = valorUnitarioNum * 4;
          break;
        default:
          // fallback: tenta derivar por área (valorUnitario / area) ou exibe valorUnitario
          if (dados.painel && dados.painel.dimensao) {
            const parts = dados.painel.dimensao.split('x').map(s => parseFloat(s));
            if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
              const areaGab = parts[0] * parts[1]; // m² do gabinete
              // Se valorUnitario representa o preço do gabinete, aqui mostramos o equivalente por m²
              valorPorM2Display = areaGab > 0 ? (valorUnitarioNum / areaGab) : valorUnitarioNum;
            } else {
              valorPorM2Display = valorUnitarioNum;
            }
          } else {
            valorPorM2Display = valorUnitarioNum;
          }
      }
    }
    // ---------------------------------------------------------------------

    // Preencher nome do cliente (procura por campos comuns)
    let clienteNome = '-';
    if (dados.inputs) {
      clienteNome = dados.inputs.clienteNome || dados.inputs.cliente || dados.inputs['cliente-nome'] || '-';
      if (clienteNome === '-' || !clienteNome) {
        const k = Object.keys(dados.inputs).find(key => key.toLowerCase().includes('cliente'));
        if (k) clienteNome = dados.inputs[k] || '-';
      }
    }
    const clienteEl = document.getElementById('cliente-nome');
    if (clienteEl) clienteEl.textContent = clienteNome;

    // Montar campo 'Objeto' dinamicamente
    const painel = dados.painel || {};
    const resolucao = painel.resolucao || '';
    const ambiente = painel.ambiente || '';
    const faceTexto = dados.isDuplaFace ? 'Dupla face' : 'Face única';
    const objetoTextParts = [];
    if (resolucao) objetoTextParts.push(resolucao);
    if (ambiente) objetoTextParts.push(ambiente);
    if (medidaCm) objetoTextParts.push(medidaCm);
    objetoTextParts.push(faceTexto);
    const objetoFinal = `Painel LED ${objetoTextParts.join(' ')}`.trim();
    const objetoEl = document.getElementById('objeto-proposta');
    if (objetoEl) objetoEl.textContent = objetoFinal;

    // Equipamentos HTML (mostrar totals exatos) - agora usa dimensão do gabinete quando aplicável
    let labelEquipamento = '';
    if (dados.painel && dados.painel.tipo === 'm2') {
      labelEquipamento = `✓ ${Math.round(dados.qtd || 0)} m² de LED ${dados.painel?.resolucao || ''} – ${medidaCm} – ${dados.painel?.ambiente || ''}`;
    } else {
      labelEquipamento = `✓ ${Math.round(dados.qtd || 0)} gabinetes de LED ${dados.painel?.resolucao || ''} – ${gabineteDimensaoCm} – ${dados.painel?.ambiente || ''}`;
    }

    let equipamentosHTML = `
    <div class="line-item text-sm">
      <span class="label">${labelEquipamento}</span>
      <span class="dots"></span>
      <span class="price">${formatCurrency(totalPainel)}</span>
    </div>
    <div class="text-xs text-gray-500 pl-4">
      (Valor por unidade fornecido no orçamento: ${formatCurrency(dados.valorUnitario || dados.valorPorMetroQuadrado || 0)})
    </div>
    `;

    equipamentosHTML += `
    <div class="line-item text-sm">
      <span class="label">✓ ${dados.controladoraTexto || ''}</span>
      <span class="dots"></span>
      <span class="price">${formatCurrency(totalControladora)}</span>
    </div>
    `;

    document.getElementById('tabela-equipamentos').innerHTML = equipamentosHTML;
    document.getElementById('total-equipamentos').textContent = formatCurrency(equipamentosTotal);

    // Itens de instalação (usando os valores ajustados do objeto 'opcionais')
    let instalacaoHTML = "";
    if (opcionais.custoEstrutura > 0) instalacaoHTML += `<li class="line-item"><span class="label">✓ Estrutura metálica superior de sustentação dos gabinetes de LED;</span><span class="dots"></span><span class="price">${formatCurrency(opcionais.custoEstrutura)}</span></li>`;
    if (opcionais.custoEletrica > 0) instalacaoHTML += `<li class="line-item"><span class="label">✓ Elétrica de instalação interna;</span><span class="dots"></span><span class="price">${formatCurrency(opcionais.custoEletrica)}</span></li>`;
    if (opcionais.custoBorda > 0) instalacaoHTML += `<li class="line-item"><span class="label">✓ Borda (${dados.inputs?.tipoBorda || ''}) — ${ (dados.metrosBorda || 0).toFixed(2) } m;</span><span class="dots"></span><span class="price">${formatCurrency(opcionais.custoBorda)}</span></li>`;
    if (opcionais.custoPilar > 0) instalacaoHTML += `<li class="line-item"><span class="label">✓ Pilar de ferro;</span><span class="dots"></span><span class="price">${formatCurrency(opcionais.custoPilar)}</span></li>`;
    if (opcionais.custoSapata > 0) instalacaoHTML += `<li class="line-item"><span class="label">✓ Sapata de concreto;</span><span class="dots"></span><span class="price">${formatCurrency(opcionais.custoSapata)}</span></li>`;
    if (opcionais.custoACM > 0) instalacaoHTML += `<li class="line-item"><span class="label">✓ Revestimento em ACM (${(dados.totalACM || 0).toFixed(2)} m²);</span><span class="dots"></span><span class="price">${formatCurrency(opcionais.custoACM)}</span></li>`;
    if (opcionais.custoInstalacao > 0) instalacaoHTML += `<li class="line-item"><span class="label">✓ ${dados.tipoEntrega || 'Instalação'} / configuração e fixação no local; ${diferencaArredondamento > 0 ? `<small style="color:#666"> </small>` : ''}</span><span class="dots"></span><span class="price">${formatCurrency(opcionais.custoInstalacao)}</span></li>`;

    document.getElementById('lista-instalacao').innerHTML = instalacaoHTML;
    document.getElementById('total-instalacao').textContent = formatCurrency(totalInstalacaoExibido);

    // Totais
    document.getElementById('total-geral').textContent = formatCurrency(totalGeralExibido);

    // Condições de pagamento com base no total arredondado
    const totalProjeto = totalGeralExibido;

    // Opção 1: À vista com 5% de desconto (1+1)
    const valorComDesconto = totalProjeto * 0.95;
    const parcelaAVista = valorComDesconto / 2;
    const condicao1 = `A vista 5% desconto (1+1): ${formatCurrency(parcelaAVista)} + 1 de ${formatCurrency(parcelaAVista)}`;

    // Opção 2: 40% de entrada + 6x
    const entrada40 = totalProjeto * 0.40;
    const saldo6x = totalProjeto * 0.60;
    const parcela6x = saldo6x / 6;
    const condicao2 = `40% de entrada e saldo em 6x (boleto ou cartão) sem juros: ${formatCurrency(entrada40)} + 6x ${formatCurrency(parcela6x)}`;

    // Opção 3: 12x no cartão com 8% de juros
    const valorComJuros = totalProjeto * 1.12;
    const parcela12x = valorComJuros / 12;
    const condicao3 = `12x de ${formatCurrency(parcela12x)} no cartão de crédito`;

    const condicoesContainer = document.getElementById('lista-condicoes');
    if (condicoesContainer) {
      condicoesContainer.innerHTML = `
        <li>${condicao1};</li>
        <li>${condicao2};</li>
        <li>${condicao3};</li>
      `;
    }

    // Vendedor
    if (vendedor) {
      document.getElementById('vendedor-nome').textContent = vendedor.nome;
      document.getElementById('vendedor-cargo').textContent = vendedor.cargo;
      document.getElementById('vendedor-fone').textContent = vendedor.fone;
    }

    // Data
    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    document.getElementById('data-emissao').textContent = `Porto Belo, ${dataFormatada}`;
}

async function gerarPDF() {
    const elementoParaImprimir = document.getElementById('conteudo-proposta');
    const paginas = elementoParaImprimir.querySelectorAll('section.print-page');
    const docDefinition = {
    pageSize: { width: 595.28, height: 841.89 }, // A4 vertical (portrait)
    pageOrientation: 'portrait',
    pageMargins: [0, 0, 0, 0],
    content: []
    };
    for (let i = 0; i < paginas.length; i++) {
    // Aumenta o scale para melhorar a nitidez (ex: 3)
    const canvas = await html2canvas(paginas[i], { scale: 3 });
    const imgData = canvas.toDataURL('image/jpeg', 1.0); // qualidade máxima
    if (i > 0) {
    docDefinition.content.push({ text: '', pageBreak: 'before' });
    }
    docDefinition.content.push({ image: imgData, width: 595.28 }); // largura A4 vertical
    }
    pdfMake.createPdf(docDefinition).download('proposta.pdf');
}

function gerarWord() {
    if (!window.docx) {
    alert("Biblioteca docx não carregada. Tente atualizar a página.");
    return;
    }
    
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableCell, TableRow, WidthType, BorderStyle } = window.docx;

    const dados = JSON.parse(localStorage.getItem('dadosProposta'));
    if (!dados) {
    alert("Dados da proposta não encontrados.");
    return;
    }

    const vendedor = vendedores.find(v => v.id === dados.vendedorId) || {};
    let contador = parseInt(localStorage.getItem('propostaContador')) || 0;
    contador++;
    localStorage.setItem('propostaContador', contador);
    const numeroProposta = contador.toString().padStart(2, '0');
    const nomeVendedor = vendedor.nome ? vendedor.nome.split(' ')[0].toLowerCase() : 'proposta';
    const nomeFicheiro = `proposta comercial ${numeroProposta} - ${nomeVendedor}.docx`;

    const totalEquipamentos = (Number(dados.custoPainel) || 0) + (Number(dados.custoControladora) || 0);
    const totalInstalacao = (Number(dados.custoEstrutura) || 0) + (Number(dados.custoEletrica) || 0) + (Number(dados.custoInstalacao) || 0) + (Number(dados.custoPilar) || 0) + (Number(dados.custoSapata) || 0) + (Number(dados.custoACM) || 0) + (Number(dados.custoBorda) || 0);

    // Helper para criar uma linha da tabela
    const createLineItemRow = (label, price) => {
    return new TableRow({
    children: [
    new TableCell({
    children: [new Paragraph({ children: [new TextRun(label)] })],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    }),
    new TableCell({
    children: [new Paragraph({ text: price, alignment: AlignmentType.RIGHT })],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    }),
    ],
    });
    };

    // converte dimensao do painel (ex: "0.96x0.96") para "96x96cm"
    let dimensaoCm = '';
    if (dados.painel && dados.painel.dimensao) {
      const dparts = dados.painel.dimensao.split('x').map(s => parseFloat(s));
      if (dparts.length === 2 && !isNaN(dparts[0]) && !isNaN(dparts[1])) {
        dimensaoCm = `${Math.round(dparts[0]*100)}x${Math.round(dparts[1]*100)}cm`;
      } else {
        dimensaoCm = dados.painel.dimensao;
      }
    }

    const doc = new Document({
    sections: [{
    children: [
    new Paragraph({ text: "Proposta comercial", heading: HeadingLevel.HEADING_1, spacing: { after: 400 } }),
    new Paragraph({ text: `1 – OBJETO: Painel LED ${dados.painel?.resolucao || ''} ${dados.painel?.ambiente || ''} ${dados.medidaFinal || ''}`, spacing: { after: 200 } }),
    new Paragraph({ text: "Itens inclusos (Equipamentos):", style: "strong", spacing: { after: 200 } }),
    new Table({
    columnWidths: [8000, 2000],
    rows: [
    createLineItemRow(`✓ ${dados.isDuplaFace ? (dados.qtd * 2) : dados.qtd} Gabinetes LED ${dados.painel?.resolucao || ''} - ${dimensaoCm} - ${dados.painel?.ambiente || ''}`, formatCurrency(dados.custoPainel)),
    createLineItemRow(`✓ ${dados.isDuplaFace ? '2' : '1'} ${dados.controladoraTexto}`, formatCurrency(dados.custoControladora)),
    createLineItemRow('Valor equipamentos', formatCurrency(totalEquipamentos)),
    ],
    }),
    new Paragraph({ text: "\nItens opcionais complementares (Estrutura/ mão de obra):", style: "strong", spacing: { after: 200 } }),
    new Table({
    columnWidths: [8000, 2000],
    rows: [
    createLineItemRow('Valor materiais / instalação', formatCurrency(totalInstalacao)),
    ],
    }),
    new Paragraph({ text: "", spacing: { after: 400 } }),
    new Table({
    columnWidths: [8000, 2000],
    rows: [
    createLineItemRow('Valor total do projeto', formatCurrency(dados.total)),
    ],
    }),
    ],
    }],
    styles: {
    paragraph: { run: { size: "22pt" } }, // 11pt
    strong: { run: { bold: true, size: "22pt" } },
    }
    });

    Packer.toBlob(doc).then(blob => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nomeFicheiro;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    });
}

async function carregarHistorico() {
    try {
    const session = await obterSessaoAtual();
    if (!session) {
    redirecionarParaLogin('historico');
    return;
    }

    const supabase = getSupabaseClient();
    const { data: propostas, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

    if (error) throw error;

    const container = document.getElementById('lista-historico');
    if (!container) return;
    if (!propostas || propostas.length === 0) {
    container.innerHTML = '<p>Nenhuma proposta salva ainda.</p>';
    return;
    }

    container.innerHTML = '';
    propostas.forEach(p => {
    const dadosProposta = normalizarDadosProposta(p.data);
    if (!dadosProposta || !dadosProposta.modulo) return;
    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded shadow cursor-pointer hover:bg-gray-100';

    const titulo = document.createElement('p');
    titulo.className = 'font-semibold';
    titulo.textContent = p.title || 'Proposta sem título';

    const dataCriacao = document.createElement('p');
    dataCriacao.className = 'text-xs text-gray-500';
    const createdAt = p.created_at || p.createdAt;
    dataCriacao.textContent = createdAt
    ? `Criada em: ${new Date(createdAt).toLocaleDateString('pt-BR')}`
    : 'Criada em: data indisponível';

    card.appendChild(titulo);
    card.appendChild(dataCriacao);
    card.addEventListener('click', () => {
    localStorage.setItem('propostaParaCarregar', JSON.stringify(dadosProposta));
    window.location.href = `./${dadosProposta.modulo}/${dadosProposta.modulo}.html`;
    });
    container.appendChild(card);
    });
    } catch (error) {
    if(document.getElementById('lista-historico')) document.getElementById('lista-historico').innerHTML = `<p class="text-red-500">${error.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.supabaseAuthRedirecting) return;
    const body = document.body;
    const moduloAtual = body.dataset.modulo;
    if (!moduloAtual) return;

    if (redirecionarFluxoDeSenhaParaPaginaCorreta(moduloAtual)) {
      return;
    }

    const paginasPublicas = ['login', 'accept-invite'];
    const paginaPublica = paginasPublicas.includes(moduloAtual);
    let session = null;
    let perfilAtual = null;

    try {
      session = await obterSessaoAtual();
      limparAuthLegado();
    } catch (error) {
      if (!paginaPublica) {
        alert(error.message);
        redirecionarParaLogin(moduloAtual);
        return;
      }
    }

    gerenciarCabecalhoUsuario(session);
    perfilAtual = await obterPerfilAtual(session);
    mostrarControlesAdmin(perfilAtual);

    if (!paginaPublica && !session) {
      redirecionarParaLogin(moduloAtual);
      return;
    }

    if (moduloAtual === 'proposta') {
      preencherProposta();
      const btnSalvarPDF = document.getElementById('btnSalvarPDF');
      const btnSalvarWord = document.getElementById('btnSalvarWord');
      if (btnSalvarPDF) btnSalvarPDF.addEventListener('click', gerarPDF);
      if (btnSalvarWord) btnSalvarWord.addEventListener('click', gerarWord);
    }
    else if (moduloAtual === 'accept-invite') {
      await configurarAceiteConvite();
    }
    else if (moduloAtual === 'register') {
      window.location.replace('login.html');
    }
    else if (moduloAtual === 'login') {
      if (session) {
        window.location.href = getSafeNextUrl();
        return;
      }
      const form = document.getElementById('login-form');
      if (form) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = form.email.value.trim();
        const password = form.password.value;
        try {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;

          localStorage.setItem('userEmail', data.user.email || email);
          localStorage.setItem('userName', obterNomeUsuario(data.session));

          alert('Login bem-sucedido!');
          window.location.href = getSafeNextUrl();
        } catch (error) {
          alert(error.message || 'Falha no login.');
        }
      });
      }
    }
    else if (moduloAtual === 'historico') {
      carregarHistorico();
    }
    else if (moduloAtual === 'admin') {
      await carregarPainelAdmin(session, perfilAtual);
    }
    else {
      carregarModelos();
      carregarVendedores();
      const dadosParaCarregar = JSON.parse(localStorage.getItem('propostaParaCarregar'));
      if (dadosParaCarregar && dadosParaCarregar.modulo === moduloAtual) {
      preencherFormulario(dadosParaCarregar);
      localStorage.removeItem('propostaParaCarregar');
      document.getElementById('modeloPainel')?.dispatchEvent(new Event('change', { bubbles: true }));

      window.__carregandoHistorico = true;
      setTimeout(() => {
        calcularOrcamento(moduloAtual);
        window.__carregandoHistorico = false;
      }, 0);
      setTimeout(() => {
          calcularOrcamento(moduloAtual);
      }, 200);
      }
      const form = document.getElementById('orcamento-form');
      const selectModelo = document.getElementById('modeloPainel');
      if (selectModelo) selectModelo.addEventListener('change', atualizarPainelSelecionado);
      if (moduloAtual === 'totem') {
      const radiosEntrega = document.querySelectorAll('input[name="tipoEntrega"]');
      radiosEntrega.forEach(radio => radio.addEventListener('change', toggleInstalacaoFields));
      toggleInstalacaoFields();
      }
      if (moduloAtual === 'pilar') {
      const tipoPilarSelect = document.getElementById('tipoPilar');
      if (tipoPilarSelect) {
      tipoPilarSelect.addEventListener('change', atualizarCamposPilar);
      atualizarCamposPilar();
      }
      }

      const incluirBorda = document.getElementById('incluirBorda');
      const bordaOptions = document.getElementById('bordaOptions');
      if (incluirBorda && bordaOptions) {
        incluirBorda.addEventListener('change', () => {
        bordaOptions.style.display = incluirBorda.checked ? 'block' : 'none';
        });
        bordaOptions.style.display = incluirBorda.checked ? 'block' : 'none';
      }

      if (form) {
      form.addEventListener('submit', (event) => {
      event.preventDefault();
      calcularOrcamento(moduloAtual);
      });
      const formInputs = form.querySelectorAll('input, select');
      formInputs.forEach(input => input.addEventListener('change', hideResultOnInputChange));
      const btnGerarProposta = document.getElementById('btnGerarProposta');
      if (btnGerarProposta) {
      btnGerarProposta.addEventListener('click', async () => {
      if (!ultimoResultado) {
      alert("Calcule um orçamento antes de gerar a proposta.");
      return;
      }

      try {
      const activeSession = await obterSessaoAtual();
      if (!activeSession) {
      alert("Sessão expirada. Por favor, faça login novamente.");
      redirecionarParaLogin(moduloAtual);
      return;
      }

      const vendedor = vendedores.find(v => v.id === ultimoResultado.vendedorId);
      const clienteNome = ultimoResultado?.inputs?.clienteNome || '-';
      const vendedorNome = vendedor ? vendedor.nome : 'Geral';
      const tituloProposta = `${vendedorNome} - ${clienteNome}`;

      const supabase = getSupabaseClient();
      const { error } = await supabase
      .from('proposals')
      .insert([{
        user_id: activeSession.user.id,
        title: tituloProposta,
        data: ultimoResultado
      }]);
      if (error) throw error;

      localStorage.setItem('dadosProposta', JSON.stringify(ultimoResultado));
      window.location.href = MODULOS_EM_SUBPASTA.includes(moduloAtual) ? '../proposta.html' : 'proposta.html';
      } catch (error) {
      alert(error.message || 'Falha ao salvar a proposta.');
      }
      });
      }
      }
    }
});

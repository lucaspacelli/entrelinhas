const API_URL = 'https://script.google.com/macros/s/AKfycbx3qSIUSCE7Uw41oRsmgXmEJyZXSkiA_97lz5wPtk4a673kuU4dFXC7MB_yzvMlJr88/exec';

let listaPacientes = [];
let dadosAgenda = [];
let configuracoes = {};

/* Converte qualquer formato de data válido (ISO, dd/mm/yyyy) para um objeto Date.
 * @param {string | Date} dataInput A data vinda da planilha.
 * @returns {Date | null} Um objeto Date válido ou nulo se a data for inválida.*/
function parseDataUniversal(dataInput) {
  if (!dataInput) return null;
  if (dataInput instanceof Date) return dataInput;

  const str = String(dataInput);

  // Tenta interpretar como ISO (YYYY-MM-DD ou com T)
  if (str.includes('-') && str.length >= 10) {
    const data = new Date(str);
    // Adiciona 1 dia se necessário por conta de fuso horário UTC
    data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
    return data;
  }

  // Tenta interpretar como dd/MM/yyyy
  if (str.includes('/')) {
    const [dia, mes, ano] = str.split(' ')[0].split('/');
    if (dia && mes && ano) {
      return new Date(Number(ano), Number(mes) - 1, Number(dia));
    }
  }
  
  return null; // Retorna nulo se não conseguir interpretar
}

/**
 * Formata um objeto Date para o formato YYYY-MM-DD, exigido pelo <input type="date">.
 * @param {Date} d O objeto Date.
 * @returns {string} A data formatada ou uma string vazia.
 */
function toIsoDateLocal(d) {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}


function mascaraValor(event) {
  const input = event.target;
  let valor = input.value.replace(/\D/g, '');
  if (!valor) { input.value = ''; return; }
  valor = (parseInt(valor, 10) / 100);
  input.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarValorDisplay(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    const numero = parseFloat(String(valor).replace(/[^0-9,.-]+/g, "").replace(",", "."));
    if (isNaN(numero)) return '';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
}

function mascaraTelefone(event) {
  const input = event.target;
  let valor = input.value.replace(/\D/g, '').substring(0, 11);
  if (valor.length > 2) valor = `(${valor.substring(0, 2)}) ${valor.substring(2)}`;
  if (valor.length > 9) valor = `${valor.substring(0, 9)}-${valor.substring(9)}`;
  input.value = valor;
}

function formatarTelefoneDisplay(numero) {
    if (!numero) return '';
    let valor = String(numero).replace(/\D/g, '').substring(0, 11);
    if (valor.length > 2) valor = `(${valor.substring(0, 2)}) ${valor.substring(2)}`;
    if (valor.length > 9) valor = `${valor.substring(0, 9)}-${valor.substring(9)}`;
    return valor;
}

async function carregarDadosIniciais() {
  document.getElementById('loadingOverlay').style.display = 'flex';
  try {
    const [resPacientes, resAgenda, resConfig] = await Promise.all([
      fetch(API_URL),
      fetch(`${API_URL}?action=agenda`),
      fetch(`${API_URL}?action=getConfig`)
    ]);
    if (!resPacientes.ok || !resAgenda.ok || !resConfig.ok) throw new Error('Falha ao buscar dados da API.');
    listaPacientes = await resPacientes.json();
    dadosAgenda = await resAgenda.json();
    configuracoes = await resConfig.json();
    listaPacientes.sort((a, b) => a.Paciente.localeCompare(b.Paciente));
    preencherCardsPacientes(listaPacientes);
    document.getElementById('inputTelefone').addEventListener('input', mascaraTelefone);
    document.getElementById('inputValor').addEventListener('input', mascaraValor);
    document.getElementById('inputFiltro').addEventListener('input', filtrarPacientes);
  } catch (erro) {
    console.error('Erro ao carregar dados iniciais:', erro);
    alert('Erro grave ao carregar os dados! Verifique a conexão e a API.');
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

function filtrarPacientes() {
  const termo = document.getElementById('inputFiltro').value.toLowerCase();
  const pacientesFiltrados = listaPacientes.filter(paciente => {
    const nome = paciente.Paciente.toLowerCase();
    const apelido = (paciente.Apelido || '').toLowerCase();
    return nome.includes(termo) || apelido.includes(termo);
  });
  preencherCardsPacientes(pacientesFiltrados);
}

function preencherCardsPacientes(pacientesParaExibir) {
  const container = document.getElementById('cardsContainerCadastros');
  container.innerHTML = '';
  if (pacientesParaExibir.length === 0) {
    container.innerHTML = '<p>Nenhum paciente encontrado.</p>';
    return;
  }
  pacientesParaExibir.forEach(paciente => {
    const card = document.createElement('div');
    card.className = 'card';
    if (paciente.Situação && paciente.Situação.toLowerCase() === 'ativo') {
      card.classList.add('status-ativo');
    } else {
      card.classList.add('status-inativo');
    }
    card.addEventListener('click', () => mostrarEvolucao(paciente.Paciente, card));
    card.innerHTML = `
      <h3>${paciente.Paciente}</h3>
      <p><strong>Situação:</strong> ${paciente.Situação}</p>
      <p><strong>Telefone:</strong> ${formatarTelefoneDisplay(paciente.Telefone) || 'Não informado'}</p>
      <div class="card-buttons">
        <button onclick="event.stopPropagation(); editarCadastro(${paciente.ID})"><i class="fas fa-edit"></i> Editar</button>
        <button id='btnDel' class="btn-excluir" onclick="event.stopPropagation(); excluirCadastro(${paciente.ID})"><i class="fas fa-trash"></i> Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function mostrarEvolucao(nomePaciente, cardElement) {
  document.querySelectorAll('#cardsContainerCadastros .card').forEach(c => c.classList.remove('selecionado'));
  cardElement.classList.add('selecionado');
  const container = document.getElementById('containerEvolucao');
  container.innerHTML = ''; // Limpa o conteúdo anterior

  const prontuarios = dadosAgenda
    .filter(item => item.Paciente === nomePaciente && item.Prontuário && item.Prontuário.trim() !== '')
    .sort((a, b) => {
      // Garante que a data seja um objeto Date válido para comparação
      const dataA = parseDataUniversal(a.Sessão);
      const dataB = parseDataUniversal(b.Sessão);
      return (dataB ? dataB.getTime() : 0) - (dataA ? dataA.getTime() : 0);
    });

  const header = document.createElement('div');
  header.className = 'card evolution-card';
  header.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h2>Prontuário de Evolução</h2>
      <button class="print-button" title="Imprimir/Exportar PDF" onclick="imprimirEvolucao()">
        <i class="fas fa-print"></i>
      </button>
    </div>
    <p><strong>Psicóloga:</strong> ${configuracoes.nome_psicologo || ''} | CRP: ${configuracoes.crp_psicologo || ''}</p>
    <p><strong>Paciente:</strong> ${nomePaciente}</p>
    <p><strong>Número de Sessões com Prontuário:</strong> ${prontuarios.length}</p>
  `;
  container.appendChild(header);

  if (prontuarios.length === 0) {
    const vazio = document.createElement('div');
    vazio.className = 'card';
    vazio.innerHTML = `<p>Nenhum prontuário encontrado para este paciente.</p>`;
    container.appendChild(vazio);
    return;
  }

  prontuarios.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'card evolution-card';
    
    // Converte a data da sessão para um formato exibível
    const dataSessaoObj = parseDataUniversal(item.Sessão);
    const dataFormatada = dataSessaoObj ? 
      `${String(dataSessaoObj.getDate()).padStart(2, '0')}/${String(dataSessaoObj.getMonth() + 1).padStart(2, '0')}/${dataSessaoObj.getFullYear()} ${String(dataSessaoObj.getHours()).padStart(2, '0')}:${String(dataSessaoObj.getMinutes()).padStart(2, '0')}` : 
      item.Sessão; // Retorna o original se não conseguir formatar

    div.innerHTML = `
      <h3>${dataFormatada}</h3>
      <p style="white-space: pre-wrap;">${item.Prontuário}</p>
    `;
    container.appendChild(div);
  });
}

// NOVA FUNÇÃO: Imprimir Prontuário de Evolução
function imprimirEvolucao() {
    window.print();
}

let editandoId = null;

function novoCadastro() {
  editandoId = null;
  document.getElementById("modalTitulo").innerHTML = "<strong>Novo Paciente</strong>";
  document.getElementById("formCadastro").reset();
  abrirModal();
}

function editarCadastro(id) {
  const paciente = listaPacientes.find(p => p.ID == id);
  if (!paciente) return;
  editandoId = id;
  document.getElementById("modalTitulo").innerHTML = "<strong>Editar Paciente</strong>";
  document.getElementById("inputId").value = paciente.ID;
  document.getElementById("inputPaciente").value = paciente.Paciente;
  document.getElementById("inputApelido").value = paciente.Apelido || '';
  document.getElementById("inputValor").value = formatarValorDisplay(paciente.Valor);
  document.getElementById("inputTelefone").value = formatarTelefoneDisplay(paciente.Telefone);

  const dataReajuste = parseDataUniversal(paciente['Data de reajuste']);
  document.getElementById("inputData").value = toIsoDateLocal(dataReajuste);

  document.getElementById("inputSituacao").value = paciente.Situação;
  abrirModal();
}

function abrirModal() {
  document.getElementById("modal").style.display = "flex";
}

function fecharModal() {
  document.getElementById("modal").style.display = "none";
  document.getElementById("formCadastro").reset();
  editandoId = null;
}

async function excluirCadastro(id) {
  if (!confirm("Tem certeza que deseja excluir este paciente? A ação não pode ser desfeita.")) return;
  document.getElementById('loadingOverlay').style.display = 'flex';
  try {
    await fetch(`${API_URL}?action=delete&id=${id}`);
    await carregarDadosIniciais();
    document.getElementById('containerEvolucao').innerHTML = '<div class="card"><p>Paciente excluído.</p></div>';
  } catch (err) {
    alert('Erro ao excluir o paciente.');
    console.error(err);
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

document.getElementById("formCadastro").addEventListener("submit", async function (e) {
  e.preventDefault();
  const valorInput = document.getElementById("inputValor").value;
  const valorLimpo = parseFloat(valorInput.replace('R$', '').replace('.', '').replace(',', '.').trim());
  const paciente = document.getElementById("inputPaciente").value;
  const apelido = document.getElementById("inputApelido").value;
  const data = document.getElementById("inputData").value;
  const situacao = document.getElementById("inputSituacao").value;
  const telefone = document.getElementById("inputTelefone").value.replace(/\D/g, '');
  let url = `${API_URL}?action=${editandoId ? 'update' : 'create'}&paciente=${encodeURIComponent(paciente)}&apelido=${encodeURIComponent(apelido)}&valor=${valorLimpo}&data=${data}&situacao=${situacao}&telefone=${encodeURIComponent(telefone)}`;
  if (editandoId) {
    url += `&id=${editandoId}`;
  }
  document.getElementById('loadingOverlay').style.display = 'flex';
  await fetch(url);
  fecharModal();
  await carregarDadosIniciais();
});

window.onload = carregarDadosIniciais;
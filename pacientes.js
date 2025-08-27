const API_URL = 'https://script.google.com/macros/s/AKfycbxjVk4pa9zfDoU9HQGA2Cl8AzhsKTm6F89sdaBYw4U4kpKkNF67U46a_hys_47m7jeW/exec';

let listaPacientes = [];
let dadosAgenda = [];

function mascaraValor(event) {
  const input = event.target;
  let valor = input.value.replace(/\D/g, '');
  if (valor === '') {
      input.value = '';
      return;
  }
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
    const [resPacientes, resAgenda] = await Promise.all([
      fetch(API_URL),
      fetch(`${API_URL}?action=agenda`)
    ]);
    if (!resPacientes.ok || !resAgenda.ok) throw new Error('Falha ao buscar dados da API.');
    listaPacientes = await resPacientes.json();
    dadosAgenda = await resAgenda.json();
    listaPacientes.sort((a, b) => a.Paciente.localeCompare(b.Paciente));
    preencherCardsPacientes();
    document.getElementById('inputTelefone').addEventListener('input', mascaraTelefone);
    document.getElementById('inputValor').addEventListener('input', mascaraValor);
  } catch (erro) {
    console.error('Erro ao carregar dados iniciais:', erro);
    alert('Erro grave ao carregar os dados! Verifique a conexão e a API.');
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

function preencherCardsPacientes() {
  const container = document.getElementById('cardsContainerCadastros');
  container.innerHTML = '';
  if (listaPacientes.length === 0) {
    container.innerHTML = '<p>Nenhum paciente cadastrado.</p>';
    return;
  }
  listaPacientes.forEach(paciente => {
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
        <button class="btn-excluir" onclick="event.stopPropagation(); excluirCadastro(${paciente.ID})"><i class="fas fa-trash"></i> Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function mostrarEvolucao(nomePaciente, cardElement) {
  document.querySelectorAll('#cardsContainerCadastros .card').forEach(c => c.classList.remove('selecionado'));
  cardElement.classList.add('selecionado');
  const container = document.getElementById('containerEvolucao');
  container.innerHTML = '';

  const prontuarios = dadosAgenda
    .filter(item => item.Paciente === nomePaciente && item.Prontuário && item.Prontuário.trim() !== '')
    // MODIFICADO: Inverte a ordem da classificação (b - a) para mostrar o mais recente primeiro
    .sort((a, b) => new Date(b.Sessão) - new Date(a.Sessão));

  const header = document.createElement('div');
  header.className = 'card evolution-card';
  header.innerHTML = `
    <h2>Prontuário de Evolução</h2>
    <p><strong>Psicóloga:</strong> Andressa Alves Ferreira CRP: xxx</p>
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

  prontuarios.forEach((item) => { // Removido o 'idx' que não é mais necessário
    const div = document.createElement('div');
    div.className = 'card evolution-card';
    
    const dataSessao = new Date(item.Sessão);
    const dia = String(dataSessao.getDate()).padStart(2, '0');
    const mes = String(dataSessao.getMonth() + 1).padStart(2, '0');
    const ano = dataSessao.getFullYear();
    const hora = dataSessao.toTimeString().slice(0, 5);
    const dataFormatada = `${dia}/${mes}/${ano} ${hora}`;

    // MODIFICADO: Remove "Sessão X" e deixa apenas a data formatada no título
    div.innerHTML = `
      <h3>${dataFormatada}</h3>
      <p style="white-space: pre-wrap;">${item.Prontuário}</p>
    `;
    container.appendChild(div);
  });
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
  document.getElementById("inputValor").value = formatarValorDisplay(paciente.Valor);
  document.getElementById("inputTelefone").value = formatarTelefoneDisplay(paciente.Telefone);
  document.getElementById("inputData").value = formatarDataISO(paciente['Data de reajuste']);
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
  const valorLimpo = valorInput.replace(/\D/g, '') / 100;
  const paciente = document.getElementById("inputPaciente").value;
  const data = document.getElementById("inputData").value;
  const situacao = document.getElementById("inputSituacao").value;
  const telefone = document.getElementById("inputTelefone").value.replace(/\D/g, '');
  let url = `${API_URL}?action=${editandoId ? 'update' : 'create'}&paciente=${encodeURIComponent(paciente)}&valor=${valorLimpo}&data=${data}&situacao=${situacao}&telefone=${encodeURIComponent(telefone)}`;
  if (editandoId) {
    url += `&id=${editandoId}`;
  }
  document.getElementById('loadingOverlay').style.display = 'flex';
  await fetch(url);
  fecharModal();
  await carregarDadosIniciais();
});

function formatarDataISO(dataBR) {
  if (!dataBR || !dataBR.includes('/')) return dataBR;
  const partes = dataBR.split('/');
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

window.onload = carregarDadosIniciais;

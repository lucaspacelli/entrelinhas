const API_URL = 'https://script.google.com/macros/s/AKfycbwjiT6L2i2TnUsQ61J7abFBm9lJOH3AEcgKLpfqvZvPJx12H6k1i6NFJK9tuC_m-dTm/exec'; // v12

let editandoId = null;

async function carregar() {
    document.getElementById('loadingOverlay').style.display = 'flex';

  try {
    const res = await fetch(API_URL); // sem parâmetros = listar todos
    const dados = await res.json();
    preencherTabela(dados);
  } catch (erro) {
    console.error('Erro ao carregar dados:', erro);
    alert('Erro ao carregar dados!');
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

function preencherTabela(dados) {
  const tbody = document.querySelector('#tabela tbody');
  tbody.innerHTML = '';

  dados.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.ID}</td>
      <td>${p.Paciente}</td>
      <td>${p.Valor}</td>
      <td>${p['Data de reajuste']}</td>
      <td>${p.Situação}</td>
      <td>
        <button onclick="editarCadastro(${p.ID})">Editar</button>
        <button onclick="excluirCadastro(${p.ID})">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function novoCadastro() {
  editandoId = null;
  document.getElementById("modalTitulo").textContent = "Novo Cadastro";
  abrirModal();
}

function editarCadastro(id) {
  const linha = Array.from(document.querySelectorAll('#tabela tbody tr'))
    .find(tr => tr.children[0].textContent == id);

  if (!linha) return;

  editandoId = id;
  document.getElementById("modalTitulo").textContent = "Editar Cadastro";

  document.getElementById("inputId").value = id;
  document.getElementById("inputPaciente").value = linha.children[1].textContent;
  document.getElementById("inputValor").value = linha.children[2].textContent;
  document.getElementById("inputData").value = formatarDataISO(linha.children[3].textContent);
  document.getElementById("inputSituacao").value = linha.children[4].textContent;

  abrirModal();
}

function excluirCadastro(id) {
  if (!confirm("Tem certeza que deseja excluir este cadastro?")) return;

  const url = `${API_URL}?action=delete&id=${id}`;
  fetch(url).then(() => carregar());
}

function abrirModal() {
  document.getElementById("modal").style.display = "block";
}

function fecharModal() {
  document.getElementById("modal").style.display = "none";
  document.getElementById("formCadastro").reset();
  editandoId = null;
}

document.getElementById("formCadastro").addEventListener("submit", function (e) {
  e.preventDefault();

  const paciente = document.getElementById("inputPaciente").value;
  const valor = document.getElementById("inputValor").value;
  const data = document.getElementById("inputData").value;
  const situacao = document.getElementById("inputSituacao").value;

  let url = `${API_URL}?action=${editandoId ? 'update' : 'create'}&paciente=${encodeURIComponent(paciente)}&valor=${valor}&data=${data}&situacao=${situacao}`;

  if (editandoId) {
    url += `&id=${editandoId}`;
  }

  fetch(url).then(() => {
    fecharModal();
    carregar();
  });
});

function formatarDataISO(dataBR) {
  if (!dataBR.includes('/')) return dataBR;
  const partes = dataBR.split('/');
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

window.onload = carregar;
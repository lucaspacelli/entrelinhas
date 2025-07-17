const API_URL = 'https://script.google.com/macros/s/AKfycbwjiT6L2i2TnUsQ61J7abFBm9lJOH3AEcgKLpfqvZvPJx12H6k1i6NFJK9tuC_m-dTm/exec'; // v12

async function carregarAgenda() {
  try {
    const res = await fetch(`${API_URL}?action=agenda`);
    const dados = await res.json();
    preencherTabelaAgenda(dados);
  } catch (err) {
    console.error('Erro ao carregar agenda:', err);
    alert('Erro ao carregar agenda!');
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('containerAgenda').style.display = 'block';
  }
}

function preencherTabelaAgenda(agenda) {
  const tbody = document.querySelector('#tabelaAgenda tbody');
  tbody.innerHTML = '';

  agenda.forEach((item, index) => {
    const prontuarioId = `prontuario-${index}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.Paciente}</td>
      <td>${item.Sessão}</td>
      <td>${item.Pagamento}</td>
      <td>
        <button onclick="mostrarProntuario('${prontuarioId}')">Ver</button>
        <button onclick="editarAgenda(${index})">Editar</button>
        <div id="${prontuarioId}" style="display:none; margin-top:5px;">${item.Prontuário}</div>
      </td>
    `;
    tbody.appendChild(tr);
    console.log("Item recebido:", item);
  });

  window._agendaData = agenda;
}

function editarAgenda(index) {
  const item = window._agendaData[index];

  // Limpa e mostra os campos novamente
  document.getElementById("formAgenda").reset();
  document.getElementById('agendaIndex').value = index;
  document.getElementById('agendaPaciente').value = item.Paciente;
  document.getElementById('agendaSessao').value = item.Sessão;
  document.getElementById('agendaPagamento').value = item.Pagamento;
  document.getElementById('agendaProntuario').value = item.Prontuário;

  // REEXIBE os campos
  document.getElementById('agendaPagamento').closest('label').style.display = 'block';
  document.getElementById('agendaProntuario').closest('label').style.display = 'block';

  document.getElementById('modalAgenda').style.display = 'block';
}

function fecharModalAgenda() {
  document.getElementById('modalAgenda').style.display = 'none';
  document.getElementById('formAgenda').reset();
}

document.getElementById("formAgenda").addEventListener("submit", function (e) {
  e.preventDefault();

  const index = document.getElementById('agendaIndex').value;
  const paciente = document.getElementById('agendaPaciente').value;
  const sessao = document.getElementById('agendaSessao').value;
  const pagamento = document.getElementById('agendaPagamento').value;
  const prontuario = document.getElementById('agendaProntuario').value;

  const emailDestino = "lucaslinhares1304@gmail.com";

  let url;

  if (index === '') {
    // Novo agendamento
    url = `${API_URL}?action=createAgenda&paciente=${encodeURIComponent(paciente)}&sessao=${encodeURIComponent(sessao)}&email=${encodeURIComponent(emailDestino)}`;
  } else {
    // Atualização
    url = `${API_URL}?action=updateAgenda&index=${index}&paciente=${encodeURIComponent(paciente)}&sessao=${encodeURIComponent(sessao)}&pagamento=${encodeURIComponent(pagamento)}&prontuario=${encodeURIComponent(prontuario)}`;
  }

  fetch(url).then(() => {
    fecharModalAgenda();
    carregarAgenda();
  });
});

function mostrarProntuario(id) {
  const div = document.getElementById(id);
  if (!div) return;
  div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

function novoAgendamento() {
  document.getElementById("formAgenda").reset();
  document.getElementById('agendaIndex').value = '';

  // Oculta campos não usados na criação
  document.getElementById('agendaPagamento').closest('label').style.display = 'none';
  document.getElementById('agendaProntuario').closest('label').style.display = 'none';

  document.getElementById('modalAgenda').style.display = 'block';
}

window.onload = carregarAgenda;

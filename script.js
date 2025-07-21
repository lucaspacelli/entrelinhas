const API_URL = 'https://script.google.com/macros/s/AKfycbxuq9G3NhqzVQVyevBheBhkCw355ciOuooQVfKNkrUAI24nkj6jGU1eACGmLk-_SxLt/exec'; // v13

async function carregarAgenda() {
  try {
    const res = await fetch(`${API_URL}?action=agenda`);
    const dados = await res.json();
    preencherCardsAgenda(dados);
  } catch (err) {
    console.error('Erro ao carregar agenda:', err);
    alert('Erro ao carregar agenda!');
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('containerAgenda').style.display = 'block';
  }
}

function preencherCardsAgenda(agenda) {
  const container = document.getElementById('cardsContainer');
  container.innerHTML = '';

  agenda.forEach((item, index) => {
    const prontuarioId = `prontuario-${index}`;

    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `
      <h3>${item.Paciente}</h3>
      <p><strong>Sessão:</strong> ${item.Sessão}</p>
      <p><strong>Pagamento:</strong> ${item.Pagamento}</p>
      <button onclick="mostrarProntuario('${prontuarioId}')">Ver Prontuário</button>
      <button onclick="editarAgenda(${index})">Editar compromisso</button>
      <button onclick="excluirAgenda(${index})" style="background-color: #FFA2A2;">Excluir</button>
      <div id="${prontuarioId}" style="display:none; margin-top:10px;"><strong>Prontuário:</strong><br>${item.Prontuário}</div>
    `;

    container.appendChild(card);
  });

  window._agendaData = agenda;
}

function editarAgenda(index) {
  const item = window._agendaData[index];

  document.getElementById("formAgenda").reset();
  document.getElementById('agendaIndex').value = index;
  document.getElementById('agendaPaciente').value = item.Paciente;
  document.getElementById('agendaSessao').value = item.Sessão;
  document.getElementById('agendaPagamento').value = item.Pagamento;
  document.getElementById('agendaProntuario').value = item.Prontuário;

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

  let url;

  if (index === '') {
    url = `${API_URL}?action=createAgenda&paciente=${encodeURIComponent(paciente)}&sessao=${encodeURIComponent(sessao)}`;
  } else {
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

  document.getElementById('agendaPagamento').closest('label').style.display = 'none';
  document.getElementById('agendaProntuario').closest('label').style.display = 'none';

  document.getElementById('modalAgenda').style.display = 'block';
}

function excluirAgenda(index) {
  if (!confirm("Tem certeza que deseja excluir este compromisso?")) return;

  const url = `${API_URL}?action=deleteAgenda&index=${index}`;

  fetch(url)
    .then(res => res.json())
    .then(() => carregarAgenda())
    .catch(err => {
      console.error('Erro ao excluir compromisso:', err);
      alert('Erro ao excluir compromisso.');
    });
}

window.onload = carregarAgenda;
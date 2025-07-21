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

  // Ordena por data
  agenda.sort((a, b) => {
    const parseData = (dataStr) => {
      if (!dataStr) return new Date(0);
      const [dia, mes, resto] = dataStr.split('/');
      if (!dia || !mes || !resto) return new Date(0);
      const [ano, hora = '00:00'] = resto.split(' ');
      const [hh, mm] = hora.split(':');
      return new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hh), Number(mm));
    };
    return parseData(a.Sessão) - parseData(b.Sessão);
  });

  agenda.forEach((item, index) => {
    const prontuarioId = `prontuario-${index}`;
    const card = document.createElement('div');
    card.className = 'card';

    // Verifica se está no passado
    const [dia, mes, resto] = item.Sessão.split('/');
    const [ano, hora = '00:00'] = resto.split(' ');
    const [hh, mm] = hora.split(':');
    const dataAgendamento = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hh), Number(mm));
    const agora = new Date();
    if (!isNaN(dataAgendamento.getTime()) && dataAgendamento < agora) {
      card.classList.add('passado');
    }

    card.innerHTML = `
      <h3>${item.Paciente}</h3>
      <p><strong>Sessão:</strong> ${item.Sessão}</p>
      <p><strong>Pagamento:</strong> ${item.Pagamento}</p>
      <button onclick="mostrarProntuario('${prontuarioId}')">Ver Prontuário</button>
      <button onclick="editarAgenda(${index})">Editar compromisso</button>
      <button onclick="excluirAgenda(${index})">Excluir</button>
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

  // Validação de conflito de horário
  const [dia, mes, resto] = sessao.split('/');
  const [ano, hora = '00:00'] = resto.split(' ');
  const [hh, mm] = hora.split(':');
  const novaData = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hh), Number(mm));

  if (isNaN(novaData.getTime())) {
    alert("Data inválida.");
    return;
  }

  const existeConflito = window._agendaData.some((item, i) => {
    if (i == index) return false;
    const [d, m, r] = item.Sessão.split('/');
    const [y, h = '00:00'] = r.split(' ');
    const [h1, m1] = h.split(':');
    const dataExistente = new Date(Number(y), Number(m) - 1, Number(d), Number(h1), Number(m1));
    if (isNaN(dataExistente.getTime())) return false;
    const diffMs = Math.abs(novaData - dataExistente);
    return diffMs < 60 * 60 * 1000;
  });

  if (existeConflito) {
    alert("Já existe uma sessão marcada neste horário.");
    return;
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

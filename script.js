const API_URL = 'https://script.google.com/macros/s/AKfycbyQV7CIT1wV7DKdvojIQnsMZFHKYzCGrqKViLaq7akYmazVzF38UtJGVztl6Wl0ijlK/exec';

const HORA_INICIO_DIA = 7;
const HORA_FIM_DIA = 23;

async function carregarAgenda() {
  try {
    const res = await fetch(`${API_URL}?action=agenda`);
    const dados = await res.json();

    // guarda em memória e mostra cards
    window._agendaData = dados.slice().sort((a, b) => parseDataHora(a.Sessão) - parseDataHora(b.Sessão));
    preencherCardsAgenda(window._agendaData);

    // define o dia atual no seletor e carrega compromissos do dia
    const hojeIso = toIsoDateLocal(new Date()); // yyyy-mm-dd sem timezone bug
    const inputData = document.getElementById('selectedDate');
    inputData.value = hojeIso;
    preencherVisaoDiaria(window._agendaData, parseIsoDateLocal(hojeIso));

    // quando mudar a data, recarrega a visão diária
    inputData.addEventListener('change', () => {
      const selecionado = parseIsoDateLocal(inputData.value);
      preencherVisaoDiaria(window._agendaData, selecionado);
    });

  } catch (err) {
    console.error('Erro ao carregar agenda:', err);
    alert('Erro ao carregar agenda!');
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('containerAgenda').style.display = 'flex';
  }
}

function preencherCardsAgenda(agenda) {
  const cardsContainer = document.getElementById('cardsContainer');
  cardsContainer.innerHTML = '';

  const agora = new Date();

  agenda.forEach((item, index) => {
    const prontuarioId = `prontuario-${index}`;
    const dataSessao = parseDataHora(item.Sessão);
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = item.ID;

    let status = '';
    if (!isNaN(dataSessao.getTime()) && dataSessao < agora) {
      card.classList.add('passado');
      if (!item.Prontuário || item.Prontuário.trim() === '') {
        card.classList.add('cancelado');
        status = 'Cancelado';
      } else {
        status = 'Concluído';
      }
    } else {
      status = 'Agendado';
    }

    card.innerHTML = `
      <h3>${item.Paciente}</h3>
      <p><strong>Sessão:</strong> ${item.Sessão}</p>
      <p><strong>Pagamento:</strong> ${item.Pagamento}</p>
      <p><strong>Status:</strong> ${status}</p>
      <div class="card-buttons">
        <button onclick="mostrarProntuario('${prontuarioId}')">Ver Prontuário</button>
        <button onclick="editarAgenda(${index})">Editar</button>
        <button class="btn-excluir" onclick="excluirAgenda(${index})">Excluir</button>
      </div>
      <div id="${prontuarioId}" style="display:none; margin-top:10px;"><strong>Prontuário:</strong><br>${item.Prontuário}</div>
    `;
    cardsContainer.appendChild(card);
  });
}

function preencherVisaoDiaria(agenda, diaSelecionado) {
  const dailyView = document.getElementById('dailyView');
  dailyView.innerHTML = '';

  // trilha de horas
  for (let hora = HORA_INICIO_DIA; hora <= HORA_FIM_DIA; hora++) {
    const slot = document.createElement('div');
    slot.className = 'hour-slot';
    slot.dataset.hour = hora;
    slot.innerHTML = `<div class="hour-label">${String(hora).padStart(2,'0')}:00</div>`;
    dailyView.appendChild(slot);
  }

  // filtra somente itens do dia selecionado (comparação numérica de ano/mês/dia)
  const doDia = agenda.filter(item => {
    const data = parseDataHora(item.Sessão);
    return sameDay(data, diaSelecionado);
  });

  // posiciona os blocos na linha do tempo
  doDia.forEach(item => {
    const data = parseDataHora(item.Sessão);
    if (isNaN(data.getTime())) return;

    const horaInicio = data.getHours();
    const minutosInicio = data.getMinutes();
    const duracaoMin = 60;

    // ignora eventos fora da janela
    if (horaInicio < HORA_INICIO_DIA || horaInicio > HORA_FIM_DIA) return;

    const offsetMin = (horaInicio - HORA_INICIO_DIA) * 60 + minutosInicio;

    const bloco = document.createElement('div');
    bloco.className = 'appointment-block';
    bloco.style.top = `${offsetMin}px`;
    bloco.style.height = `${duracaoMin}px`;
    bloco.innerHTML = `<strong>${item.Paciente}</strong><br>${item.Sessão}`;

    dailyView.appendChild(bloco);
  });
}

/* --------- Utilidades de data --------- */

// "07/08/2025 10:00" ou "07/08/2025 10:00:30" -> Date (local)
function parseDataHora(dataStr) {
  if (!dataStr) return new Date(NaN);
  const [dia, mes, resto] = dataStr.split('/');
  if (!dia || !mes || !resto) return new Date(NaN);
  const [ano, horaStr = '00:00'] = resto.split(' ');
  const [hh = '00', mm = '00'] = horaStr.split(':');
  return new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hh), Number(mm));
}

// "2025-08-07" -> Date local (sem bug de UTC)
function parseIsoDateLocal(iso) {
  if (!iso) return new Date(NaN);
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Date -> "yyyy-mm-dd" (sempre local, sem UTC)
function toIsoDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// compara só ano/mês/dia em local time
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

/* --------- Modal / CRUD --------- */

function editarAgenda(index) {
  const item = window._agendaData[index];

  document.getElementById("formAgenda").reset();
  document.getElementById('agendaId').value = item.ID;
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

  const id = document.getElementById('agendaId').value;
  const paciente = document.getElementById('agendaPaciente').value;
  const sessao = document.getElementById('agendaSessao').value;
  const pagamento = document.getElementById('agendaPagamento').value;
  const prontuario = document.getElementById('agendaProntuario').value;

  const novaData = parseDataHora(sessao);
  if (isNaN(novaData.getTime())) {
    alert("Data inválida.");
    return;
  }

  const existeConflito = window._agendaData.some(item => {
    if (item.ID == id) return false;
    const dataExistente = parseDataHora(item.Sessão);
    if (isNaN(dataExistente.getTime())) return false;
    return Math.abs(novaData - dataExistente) < 60 * 60 * 1000;
  });

  if (existeConflito) {
    alert("Já existe uma sessão marcada neste horário.");
    return;
  }

  let url = '';
  if (id === '') {
    url = `${API_URL}?action=createAgenda&paciente=${encodeURIComponent(paciente)}&sessao=${encodeURIComponent(sessao)}`;
  } else {
    url = `${API_URL}?action=updateAgenda&id=${id}&paciente=${encodeURIComponent(paciente)}&sessao=${encodeURIComponent(sessao)}&pagamento=${encodeURIComponent(pagamento)}&prontuario=${encodeURIComponent(prontuario)}`;
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
  document.getElementById('agendaId').value = '';
  document.getElementById('agendaPagamento').closest('label').style.display = 'none';
  document.getElementById('agendaProntuario').closest('label').style.display = 'none';
  document.getElementById('modalAgenda').style.display = 'block';
}

function excluirAgenda(index) {
  const item = window._agendaData[index];
  const id = item.ID;

  if (!confirm("Tem certeza que deseja excluir este compromisso?")) return;

  const url = `${API_URL}?action=deleteAgenda&id=${id}`;

  fetch(url)
    .then(res => res.json())
    .then(() => carregarAgenda())
    .catch(err => {
      console.error('Erro ao excluir compromisso:', err);
      alert('Erro ao excluir compromisso.');
    });
}

window.onload = carregarAgenda;

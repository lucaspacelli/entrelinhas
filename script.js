const API_URL = 'https://script.google.com/macros/s/AKfycbxjVk4pa9zfDoU9HQGA2Cl8AzhsKTm6F89sdaBYw4U4kpKkNF67U46a_hys_47m7jeW/exec';

const HORA_INICIO_DIA = 7;
const HORA_FIM_DIA = 23;
let listaPacientes = [];
let _agendaData = [];

async function salvarStatus(selectElement, appointmentId) {
  const novoStatus = selectElement.value;
  selectElement.style.opacity = '0.5';
  try {
    const url = `${API_URL}?action=updateStatus&id=${appointmentId}&status=${encodeURIComponent(novoStatus)}`;
    const response = await fetch(url);
    const result = await response.json();
    if (result.status === "success") {
      const itemIndex = window._agendaData.findIndex(item => item.ID == appointmentId);
      if (itemIndex > -1) {
        window._agendaData[itemIndex].Status = novoStatus;
      }
      preencherCardsAgenda(window._agendaData);
    } else {
      throw new Error(result.message || "Erro desconhecido ao salvar status.");
    }
  } catch (err) {
    console.error('Erro ao salvar status:', err);
    alert('Houve um erro ao tentar salvar o novo status.');
  } finally {
    selectElement.style.opacity = '1';
  }
}

function gerarOpcoesStatus(statusAtual) {
  const statusOptions = ['Agendado', 'Confirmado', 'Concluído', 'Cancelado'];
  return statusOptions.map(opt =>
    `<option value="${opt}" ${opt === statusAtual ? 'selected' : ''}>${opt}</option>`
  ).join('');
}

function formatarTelefoneParaWhatsApp(telefone) {
  const numeroLimpo = String(telefone || '').replace(/\D/g, '');
  if (numeroLimpo.startsWith('55') && (numeroLimpo.length === 12 || numeroLimpo.length === 13)) {
    return numeroLimpo;
  }
  if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
    return numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
  }
  return null;
}

async function carregarDadosIniciais() {
  document.getElementById('loadingOverlay').style.display = 'flex';
  try {
    const [resAgenda, resPacientes] = await Promise.all([
      fetch(`${API_URL}?action=agenda`),
      fetch(API_URL)
    ]);
    window._agendaData = await resAgenda.json();
    listaPacientes = await resPacientes.json();
    window._agendaData.sort((a, b) => parseDataHora(a.Sessão) - parseDataHora(b.Sessão));
    preencherCardsAgenda(window._agendaData);
    const hojeIso = toIsoDateLocal(new Date());
    const inputData = document.getElementById('selectedDate');
    inputData.value = hojeIso;
    preencherVisaoDiaria(window._agendaData, parseIsoDateLocal(hojeIso));
    inputData.addEventListener('change', () => {
      preencherVisaoDiaria(window._agendaData, parseIsoDateLocal(inputData.value));
    });
  } catch (err) {
    console.error('Erro ao carregar dados iniciais:', err);
    alert('Erro ao carregar dados iniciais!');
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

function popularPacientesDropdown(pacienteSelecionado = '') {
  const select = document.getElementById('agendaPaciente');
  select.innerHTML = '<option value="">-- Selecione um paciente --</option>';
  listaPacientes.sort((a, b) => a.Paciente.localeCompare(b.Paciente));
  listaPacientes.forEach(p => {
    const option = document.createElement('option');
    option.value = p.Paciente;
    option.textContent = p.Paciente;
    if (p.Paciente === pacienteSelecionado) option.selected = true;
    select.appendChild(option);
  });
}

function preencherCardsAgenda(agenda) {
    const cardsContainer = document.getElementById('cardsContainer');
    cardsContainer.innerHTML = '';
    agenda.slice().reverse().forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card';
      const statusAtual = item.Status || 'Agendado';
      if (statusAtual === 'Concluído') {
        card.classList.add('status-concluido');
      } else if (statusAtual === 'Cancelado') {
        card.classList.add('status-cancelado');
      }
      const desabilitarConfirmacao = statusAtual === 'Confirmado' || statusAtual === 'Concluído' || statusAtual === 'Cancelado';
      const desabilitarAcoesOnline = statusAtual === 'Concluído' || statusAtual === 'Cancelado';
      let botaoConfirmacao = '', botaoEnviarLink = '', botaoMeet = '';
      const infoPaciente = listaPacientes.find(p => p.Paciente.trim().toLowerCase() === item.Paciente.trim().toLowerCase());
      const telefoneFormatado = infoPaciente ? formatarTelefoneParaWhatsApp(infoPaciente.Telefone) : null;
      const linkMeet = item['Link Meet'];
      const dataSessao = parseDataHora(item.Sessão);
  
      if (telefoneFormatado) {
        const horaSessao = dataSessao.toTimeString().slice(0, 5);
        const dataFormatada = `${String(dataSessao.getDate()).padStart(2,'0')}/${String(dataSessao.getMonth()+1).padStart(2,'0')}/${dataSessao.getFullYear()}`;
        const textoData = sameDay(dataSessao, new Date()) ? `hoje às ${horaSessao}h` : `para o dia ${dataFormatada} às ${horaSessao}h`;
        const msgConfirmacao = `Olá, tudo bem? Estou entrando em contato para confirmar nossa sessão agendada para ${textoData}.\n\nPara garantir a realização da sessão, solicito que o pagamento seja realizado por meio do Pix, utilizando a seguinte chave: psi.andressaferreira@gmail.com\n\nAguardo o seu retorno para encaminhar o link de acesso! Até mais`;
        const urlConfirmacao = `https://wa.me/${telefoneFormatado}?text=${encodeURIComponent(msgConfirmacao)}`;
        botaoConfirmacao = `<a href="${urlConfirmacao}" target="_blank" rel="noopener noreferrer"><button class="btn-confirm ${desabilitarConfirmacao ? 'btn-disabled' : ''}" ${desabilitarConfirmacao ? 'disabled' : ''}><i class="fas fa-check"></i> Confirmação</button></a>`;
      }
      if (telefoneFormatado && linkMeet) {
        const msgLink = `Muito obrigada! Segue o link para a nossa sessão. Estarei lhe aguardando, até mais!\n\n${linkMeet}`;
        const urlLink = `https://wa.me/${telefoneFormatado}?text=${encodeURIComponent(msgLink)}`;
        botaoEnviarLink = `<a href="${urlLink}" target="_blank" rel="noopener noreferrer"><button class="btn-whatsapp ${desabilitarAcoesOnline ? 'btn-disabled' : ''}" ${desabilitarAcoesOnline ? 'disabled' : ''}><i class="fab fa-whatsapp"></i> Enviar Link</button></a>`;
      }
      if (linkMeet) {
        botaoMeet = `<a href="${linkMeet}" target="_blank" rel="noopener noreferrer"><button class="btn-meet ${desabilitarAcoesOnline ? 'btn-disabled' : ''}" ${desabilitarAcoesOnline ? 'disabled' : ''}><i class="fas fa-video"></i> Entrar na Sala</button></a>`;
      }
      const botaoEditar = `<button onclick="editarAgenda(${item.ID})"><i class="fas fa-edit"></i> Editar</button>`;
      const botaoExcluir = `<button class="btn-excluir" onclick="excluirAgenda(${item.ID})"><i class="fas fa-trash"></i> Excluir</button>`;
      
      let sessaoFormatadaParaDisplay = item.Sessão;
      if (!isNaN(dataSessao.getTime())) {
        const dia = String(dataSessao.getDate()).padStart(2, '0');
        const mes = String(dataSessao.getMonth() + 1).padStart(2, '0');
        const ano = dataSessao.getFullYear();
        const hora = dataSessao.toTimeString().slice(0, 5);
        sessaoFormatadaParaDisplay = `${dia}/${mes}/${ano} ${hora}`;
      }
  
      card.innerHTML = `
        <h3>${item.Paciente}</h3>
        <p><strong>Sessão:</strong> ${sessaoFormatadaParaDisplay}</p>
        <select class="status-select" onchange="salvarStatus(this, ${item.ID})">
          ${gerarOpcoesStatus(statusAtual)}
        </select>
        <div class="card-buttons">
          ${botaoConfirmacao} ${botaoEnviarLink} ${botaoMeet} ${botaoEditar} ${botaoExcluir}
        </div>
      `;
      cardsContainer.appendChild(card);
    });
    cardsContainer.scrollTop = 0;
}

function editarAgenda(id) {
    const item = window._agendaData.find(appt => appt.ID == id);
    if (!item) return alert('Erro: Compromisso não encontrado.');
    popularPacientesDropdown(item.Paciente);
    const dataSessao = parseDataHora(item.Sessão);
    if (!isNaN(dataSessao.getTime())) {
      document.getElementById('agendaData').value = toIsoDateLocal(dataSessao);
      document.getElementById('agendaHora').value = dataSessao.toTimeString().slice(0, 5);
    }
    const dataPagamento = parseDataHora(item.Pagamento);
    if (!isNaN(dataPagamento.getTime())) {
      document.getElementById('agendaPagamento').value = toIsoDateLocal(dataPagamento);
    } else {
      document.getElementById('agendaPagamento').value = '';
    }
    document.getElementById('agendaId').value = item.ID;
    document.getElementById('agendaProntuario').value = item.Prontuário;
    document.getElementById('modalAgenda').style.display = 'flex';
}

function novoAgendamento() {
    document.getElementById("formAgenda").reset();
    popularPacientesDropdown();
    document.getElementById('agendaData').value = toIsoDateLocal(new Date());
    document.getElementById('agendaHora').value = "10:00";
    document.getElementById('agendaId').value = '';
    document.getElementById('modalAgenda').style.display = 'flex';
}

document.getElementById("formAgenda").addEventListener("submit", function (e) {
    e.preventDefault();
    const id = document.getElementById('agendaId').value;
    const paciente = document.getElementById('agendaPaciente').value;
    const data = document.getElementById('agendaData').value;
    const hora = document.getElementById('agendaHora').value;
    const prontuario = document.getElementById('agendaProntuario').value;
    const pagamentoISO = document.getElementById('agendaPagamento').value;
    let pagamentoFormatado = '';
    if (pagamentoISO) {
      const [anoP, mesP, diaP] = pagamentoISO.split('-');
      pagamentoFormatado = `${diaP}/${mesP}/${anoP}`;
    }
    const [ano, mes, dia] = data.split('-');
    const sessaoFormatada = `${dia}/${mes}/${ano} ${hora}`;
    const novaData = new Date(`${data}T${hora}`);
    if (isNaN(novaData.getTime())) {
      alert("Data ou hora inválida.");
      return;
    }
    const existeConflito = window._agendaData.some(item => {
      if (item.ID == id) return false;
      const dataExistente = parseDataHora(item.Sessão);
      return Math.abs(novaData - dataExistente) < 50 * 60 * 1000;
    });
    if (existeConflito) {
      if (!confirm("Já existe uma sessão marcada neste horário ou muito próxima. Deseja continuar mesmo assim?")) {
        return;
      }
    }
    const urlParams = new URLSearchParams({
        action: id ? 'updateAgenda' : 'createAgenda',
        id: id,
        paciente: paciente,
        sessao: sessaoFormatada,
        pagamento: pagamentoFormatado,
        prontuario: prontuario
    });
    fetch(`${API_URL}?${urlParams.toString()}`).then(() => {
      fecharModalAgenda();
      carregarDadosIniciais();
    });
});

function preencherVisaoDiaria(agenda, diaSelecionado) {
    const dailyView = document.getElementById('dailyView');
    dailyView.innerHTML = '';
    for (let hora = HORA_INICIO_DIA; hora <= HORA_FIM_DIA; hora++) {
      const slot = document.createElement('div');
      slot.className = 'hour-slot';
      slot.innerHTML = `<div class="hour-label">${String(hora).padStart(2, '0')}:00</div>`;
      dailyView.appendChild(slot);
    }
    const doDia = agenda.filter(item => {
      const dataItem = parseDataHora(item.Sessão);
      return sameDay(dataItem, diaSelecionado);
    });
    doDia.forEach(item => {
      const data = parseDataHora(item.Sessão);
      if (isNaN(data.getTime())) return;
      const horaFormatada = data.toTimeString().slice(0, 5);
      const diaFormatado = `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
      const offsetMin = (data.getHours() - HORA_INICIO_DIA) * 60 + data.getMinutes();
      if (offsetMin < 0 || offsetMin > (HORA_FIM_DIA - HORA_INICIO_DIA + 1) * 60) return;
      const bloco = document.createElement('div');
      bloco.className = 'appointment-block';
      bloco.style.top = `${offsetMin + 1}px`;
      bloco.style.height = `${60 - 2}px`;
      bloco.innerHTML = `<strong>${item.Paciente}</strong><br>${diaFormatado} ${horaFormatada}`;
      dailyView.appendChild(bloco);
    });
}

function parseDataHora(dataStr) {
    if (!dataStr) return new Date(NaN);
    if (typeof dataStr === 'string' && dataStr.includes('T')) {
      return new Date(dataStr);
    }
    if (typeof dataStr === 'string' && dataStr.includes('/')) {
      const [dataPart, horaPart = '00:00'] = dataStr.split(' ');
      const [dia, mes, ano] = dataPart.split('/');
      const [hh = '00', mm = '00'] = horaPart.split(':');
      if (dia && mes && ano) {
        return new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hh), Number(mm));
      }
    }
    return new Date(dataStr);
}

function parseIsoDateLocal(iso) {
    if (!iso) return new Date(NaN);
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function toIsoDateLocal(d) {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function sameDay(a, b) {
    if (!a || !b || isNaN(a.getTime()) || isNaN(b.getTime())) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fecharModalAgenda() {
    document.getElementById('modalAgenda').style.display = 'none';
    document.getElementById('formAgenda').reset();
}

function excluirAgenda(id) {
    const item = window._agendaData.find(appt => appt.ID == id);
    const nomePaciente = item ? item.Paciente : 'este compromisso';
    if (!confirm(`Tem certeza que deseja excluir o compromisso de ${nomePaciente}?`)) return;
    const url = `${API_URL}?action=deleteAgenda&id=${id}`;
    fetch(url).then(() => carregarDadosIniciais()).catch(err => {
      console.error('Erro ao excluir compromisso:', err);
      alert('Erro ao excluir compromisso.');
    });
}

window.onload = carregarDadosIniciais;

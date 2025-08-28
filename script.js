const API_URL = 'https://script.google.com/macros/s/AKfycbx3qSIUSCE7Uw41oRsmgXmEJyZXSkiA_97lz5wPtk4a673kuU4dFXC7MB_yzvMlJr88/exec';

const HORA_INICIO_DIA = 7;
const HORA_FIM_DIA = 23;
let listaPacientes = [];
let _agendaData = [];
let configuracoes = {};

function getWeekRangeForDate(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setDate(start.getDate() - start.getDay());
    const week = [];
    for (let i = 0; i < 7; i++) {
        const nextDay = new Date(start);
        nextDay.setDate(start.getDate() + i);
        week.push(nextDay);
    }
    return week;
}

async function carregarDadosIniciais() {
    document.getElementById('loadingOverlay').style.display = 'flex';
    try {
        const [resAgenda, resPacientes, resConfig] = await Promise.all([
            fetch(`${API_URL}?action=agenda`),
            fetch(API_URL),
            fetch(`${API_URL}?action=getConfig`)
        ]);
        window._agendaData = await resAgenda.json();
        listaPacientes = await resPacientes.json();
        configuracoes = await resConfig.json();
        preencherCardsAgenda(window._agendaData);
        const hoje = new Date();
        document.getElementById('selectedDate').value = toIsoDateLocal(hoje);
        preencherVisaoSemanal(window._agendaData, hoje);
        document.getElementById('selectedDate').addEventListener('change', (e) => {
            preencherVisaoSemanal(window._agendaData, parseIsoDateLocal(e.target.value));
        });
    } catch (err) {
        console.error('Erro ao carregar dados iniciais:', err);
        alert('Erro ao carregar dados iniciais!');
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

function preencherVisaoSemanal(agenda, dataSelecionada) {
    const container = document.getElementById('weeklyViewContainer');
    container.innerHTML = '';
    const semana = getWeekRangeForDate(dataSelecionada);
    const hoje = new Date();
    const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let headerHtml = '<div class="week-header"><div class="blank-header"></div>';
    semana.forEach(dia => {
        const isHojeClass = sameDay(dia, hoje) ? 'today' : '';
        headerHtml += `<div class="day-header ${isHojeClass}">${diasNomes[dia.getDay()]} ${dia.getDate()}</div>`;
    });
    headerHtml += '</div>';
    let bodyHtml = '<div class="week-body">';
    bodyHtml += '<div class="timeline-labels">';
    for (let h = HORA_INICIO_DIA; h <= HORA_FIM_DIA; h++) {
        bodyHtml += `<div class="hour-label">${String(h).padStart(2, '0')}:00</div>`;
    }
    bodyHtml += '</div>';
    semana.forEach(dia => {
        bodyHtml += `<div class="day-column" data-date="${toIsoDateLocal(dia)}">`;
        for (let h = HORA_INICIO_DIA; h <= HORA_FIM_DIA; h++) {
            bodyHtml += '<div class="hour-slot"></div>';
        }
        bodyHtml += '</div>';
    });
    bodyHtml += '</div>';
    container.innerHTML = headerHtml + bodyHtml;
    const inicioSemana = semana[0];
    const fimSemana = new Date(semana[6]);
    fimSemana.setHours(23, 59, 59);
    const compromissosDaSemana = agenda.filter(item => {
        const dataItem = parseDataHora(item.Sessão);
        return dataItem >= inicioSemana && dataItem <= fimSemana;
    });
    compromissosDaSemana.forEach(item => {
        const data = parseDataHora(item.Sessão);
        const diaISO = toIsoDateLocal(data);
        const dayColumnTarget = container.querySelector(`.day-column[data-date="${diaISO}"]`);
        if (dayColumnTarget) {
            const offsetMin = (data.getHours() * 60 + data.getMinutes()) - (HORA_INICIO_DIA * 60);
            if (offsetMin < 0) return;
            const bloco = document.createElement('div');
            bloco.className = 'appointment-block';
            bloco.style.top = `${offsetMin}px`;
            bloco.style.height = `58px`;
            const horaFormatada = data.toTimeString().slice(0, 5);
            bloco.innerHTML = `<strong>${item.Paciente}</strong><br>${horaFormatada}`;
            dayColumnTarget.appendChild(bloco);
        }
    });
}

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
    agenda.sort((a, b) => parseDataHora(a.Sessão) - parseDataHora(b.Sessão));
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
        const nomeParaMensagem = (infoPaciente && infoPaciente.Apelido) ? infoPaciente.Apelido : item.Paciente.split(' ')[0];
        const msgConfirmacao = (configuracoes.msg_confirmacao || "")
            .replace('{paciente}', item.Paciente)
            .replace('{apelido}', nomeParaMensagem)
            .replace('{data_hora}', textoData)
            .replace('{chave_pix}', configuracoes.chave_pix || '');
        const urlConfirmacao = `https://wa.me/${telefoneFormatado}?text=${encodeURIComponent(msgConfirmacao)}`;
        botaoConfirmacao = `<a href="${urlConfirmacao}" target="_blank" rel="noopener noreferrer"><button class="btn-confirm ${desabilitarConfirmacao ? 'btn-disabled' : ''}" ${desabilitarConfirmacao ? 'disabled' : ''}><i class="fas fa-check"></i> Confirmação</button></a>`;
      }
      if (telefoneFormatado && linkMeet) {
        const msgLink = (configuracoes.msg_link || "").replace('{link_meet}', linkMeet);
        const urlLink = `https://wa.me/${telefoneFormatado}?text=${encodeURIComponent(msgLink)}`;
        botaoEnviarLink = `<a href="${urlLink}" target="_blank" rel="noopener noreferrer"><button id='btn-whatsapp' class="btn-whatsapp ${desabilitarAcoesOnline ? 'btn-disabled' : ''}" ${desabilitarAcoesOnline ? 'disabled' : ''}><i class="fab fa-whatsapp"></i> Enviar Link</button></a>`;
      }
      if (linkMeet) {
        botaoMeet = `<a href="${linkMeet}" target="_blank" rel="noopener noreferrer"><button class="btn-meet ${desabilitarAcoesOnline ? 'btn-disabled' : ''}" ${desabilitarAcoesOnline ? 'disabled' : ''}><i class="fas fa-video"></i> Entrar na Sala</button></a>`;
      }
      // Adicionada a classe .btn-editar para estilização
      const botaoEditar = `<button class="btn-editar" onclick="editarAgenda(${item.ID})"><i class="fas fa-edit"></i> Editar</button>`;
      const botaoExcluir = `<button id='btnDel' class="btn-excluir" onclick="excluirAgenda(${item.ID})"><i class="fas fa-trash"></i> Excluir</button>`;
      
      let sessaoFormatadaParaDisplay = item.Sessão;
      if (!isNaN(dataSessao.getTime())) {
        const dia = String(dataSessao.getDate()).padStart(2, '0');
        const mes = String(dataSessao.getMonth() + 1).padStart(2, '0');
        const ano = dataSessao.getFullYear();
        const hora = dataSessao.toTimeString().slice(0, 5);
        sessaoFormatadaParaDisplay = `${dia}/${mes}/${ano} ${hora}`;
      }
  
      card.innerHTML = `<h3>${item.Paciente}</h3><p><strong>Sessão:</strong> ${sessaoFormatadaParaDisplay}</p><select class="status-select" onchange="salvarStatus(this, ${item.ID})">${gerarOpcoesStatus(statusAtual)}</select><div class="card-buttons">${botaoConfirmacao} ${botaoEnviarLink} ${botaoMeet} ${botaoEditar} ${botaoExcluir}</div>`;
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
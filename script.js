let listaPacientes = [];
let _agendaData = [];
let configuracoes = {};
const HORA_INICIO_DIA = 7;
const HORA_FIM_DIA = 23;

async function carregarDadosIniciais() {
    document.getElementById('loadingOverlay').style.display = 'flex';
    try {
        const [agendaSnapshot, pacientesSnapshot, configDoc] = await Promise.all([
            db.collection('agendamentos').get(),
            db.collection('pacientes').get(),
            db.collection('configuracoes').doc('geral').get()
        ]);
        _agendaData = agendaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        listaPacientes = pacientesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (configDoc.exists) configuracoes = configDoc.data();
        
        preencherCardsAgenda(_agendaData);
        const hoje = new Date();
        document.getElementById('selectedDate').value = toIsoDateLocal(hoje);
        preencherVisaoSemanal(_agendaData, hoje);
        document.getElementById('selectedDate').addEventListener('change', (e) => {
            preencherVisaoSemanal(_agendaData, parseIsoDateLocal(e.target.value));
        });
    } catch (err) {
        console.error('Erro ao carregar dados iniciais:', err);
        alert('Erro ao carregar dados iniciais!');
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

function preencherCardsAgenda(agenda) {
    const cardsContainer = document.getElementById('cardsContainer');
    cardsContainer.innerHTML = '';
    agenda.sort((a, b) => (a.sessao && b.sessao) ? a.sessao.toDate() - b.sessao.toDate() : 0);
    agenda.slice().reverse().forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        const statusAtual = item.status || 'Agendado';
        if (statusAtual === 'Concluído') card.classList.add('status-concluido');
        else if (statusAtual === 'Cancelado') card.classList.add('status-cancelado');
    });
}

async function salvarStatus(selectElement, appointmentId) {
    const novoStatus = selectElement.value;
    selectElement.style.opacity = '0.5';
    try {
        await db.collection('agendamentos').doc(appointmentId).update({ status: novoStatus });
        const itemIndex = _agendaData.findIndex(item => item.id === appointmentId);
        if (itemIndex > -1) _agendaData[itemIndex].status = novoStatus;
        preencherCardsAgenda(_agendaData);
    } catch(err) { /* ... */ } finally { selectElement.style.opacity = '1'; }
}

document.getElementById("formAgenda").addEventListener("submit", async function (e) {
    e.preventDefault();
    document.getElementById('loadingOverlay').style.display = 'flex';
    const id = document.getElementById('agendaId').value;
    const pacienteSelecionado = listaPacientes.find(p => p.nome === document.getElementById('agendaPaciente').value);
    
    const data = document.getElementById('agendaData').value;
    const hora = document.getElementById('agendaHora').value;
    const dataSessao = new Date(`${data}T${hora}`);

    const agendamentoData = {
        pacienteId: pacienteSelecionado ? pacienteSelecionado.id : null,
        pacienteNome: pacienteSelecionado ? pacienteSelecionado.nome : 'N/A',
        sessao: firebase.firestore.Timestamp.fromDate(dataSessao),
        dataPagamento: document.getElementById('agendaPagamento').value ? firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('agendaPagamento').value)) : null,
        prontuario: document.getElementById('agendaProntuario').value,
        status: 'Agendado' // ou pegar de um campo, se houver
    };

    try {
        if (id) {
            await db.collection('agendamentos').doc(id).update(agendamentoData);
        } else {
            await db.collection('agendamentos').add(agendamentoData);
        }
        fecharModalAgenda();
        await carregarDadosIniciais();
    } catch(err) { /* ... */ } finally { /* ... */ }
});
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
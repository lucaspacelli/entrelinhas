// A constante API_URL foi removida.
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
        const dataItem = parseDataHora(item.sessao);
        return dataItem >= inicioSemana && dataItem <= fimSemana;
    });

    compromissosDaSemana.forEach(item => {
        const data = parseDataHora(item.sessao);
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
            bloco.innerHTML = `<strong>${item.pacienteNome}</strong><br>${horaFormatada}`;
            dayColumnTarget.appendChild(bloco);
        }
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
  } catch(err) { 
    console.error("Erro ao salvar status:", err);
    alert("Erro ao salvar status.");
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
  if (numeroLimpo.startsWith('55') && (numeroLimpo.length === 12 || numeroLimpo.length === 13)) return numeroLimpo;
  if (numeroLimpo.length === 10 || numeroLimpo.length === 11) return numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
  return null;
}

function popularPacientesDropdown(pacienteSelecionado = '') {
  const select = document.getElementById('agendaPaciente');
  select.innerHTML = '<option value="">-- Selecione um paciente --</option>';
  listaPacientes.sort((a, b) => a.nome.localeCompare(b.nome));
  listaPacientes.forEach(p => {
    const option = document.createElement('option');
    option.value = p.nome;
    option.textContent = p.nome;
    if (p.nome === pacienteSelecionado) option.selected = true;
    select.appendChild(option);
  });
}

function preencherCardsAgenda(agenda) {
    const cardsContainer = document.getElementById('cardsContainer');
    cardsContainer.innerHTML = '';
    agenda.sort((a, b) => parseDataHora(a.sessao) - parseDataHora(b.sessao));
    agenda.slice().reverse().forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card';
      const statusAtual = item.status || 'Agendado';
      if (statusAtual === 'Concluído') card.classList.add('status-concluido');
      else if (statusAtual === 'Cancelado') card.classList.add('status-cancelado');
      const desabilitarConfirmacao = statusAtual === 'Confirmado' || statusAtual === 'Concluído' || statusAtual === 'Cancelado';
      const desabilitarAcoesOnline = statusAtual === 'Concluído' || statusAtual === 'Cancelado';
      let botaoConfirmacao = '', botaoEnviarLink = '', botaoMeet = '';
      const infoPaciente = listaPacientes.find(p => p.id === item.pacienteId);
      const telefoneFormatado = infoPaciente ? formatarTelefoneParaWhatsApp(infoPaciente.telefone) : null;
      const linkMeet = item.linkMeet;
      const dataSessao = parseDataHora(item.sessao);
  
      if (telefoneFormatado) {
        const horaSessao = dataSessao.toTimeString().slice(0, 5);
        const dataFormatada = `${String(dataSessao.getDate()).padStart(2,'0')}/${String(dataSessao.getMonth()+1).padStart(2,'0')}/${dataSessao.getFullYear()}`;
        const textoData = sameDay(dataSessao, new Date()) ? `hoje às ${horaSessao}h` : `para o dia ${dataFormatada} às ${horaSessao}h`;
        const nomeParaMensagem = (infoPaciente && infoPaciente.apelido) ? infoPaciente.apelido : item.pacienteNome.split(' ')[0];
        const msgConfirmacao = (configuracoes.msg_confirmacao || "").replace('{apelido}', nomeParaMensagem).replace('{data_hora}', textoData).replace('{chave_pix}', configuracoes.chave_pix || '');
        const urlConfirmacao = `https://wa.me/${telefoneFormatado}?text=${encodeURIComponent(msgConfirmacao)}`;
        botaoConfirmacao = `<a href="${urlConfirmacao}" target="_blank" rel="noopener noreferrer"><button class="btn-confirm ${desabilitarConfirmacao ? 'btn-disabled' : ''}" ${desabilitarConfirmacao ? 'disabled' : ''}><i class="fas fa-check"></i> Confirmação</button></a>`;
      }
      if (telefoneFormatado && linkMeet) {
        const msgLink = (configuracoes.msg_link || "").replace('{link_meet}', linkMeet);
        const urlLink = `https://wa.me/${telefoneFormatado}?text=${encodeURIComponent(msgLink)}`;
        botaoEnviarLink = `<a href="${urlLink}" target="_blank" rel="noopener noreferrer"><button class="btn-whatsapp ${desabilitarAcoesOnline ? 'btn-disabled' : ''}" ${desabilitarAcoesOnline ? 'disabled' : ''}><i class="fab fa-whatsapp"></i> Enviar Link</button></a>`;
      }
      if (linkMeet) {
        botaoMeet = `<a href="${linkMeet}" target="_blank" rel="noopener noreferrer"><button class="btn-meet ${desabilitarAcoesOnline ? 'btn-disabled' : ''}" ${desabilitarAcoesOnline ? 'disabled' : ''}><i class="fas fa-video"></i> Entrar na Sala</button></a>`;
      }
      const botaoEditar = `<button class="btn-editar" onclick="editarAgenda('${item.id}')"><i class="fas fa-edit"></i> Editar</button>`;
      const botaoExcluir = `<button class="btn-excluir" onclick="excluirAgenda('${item.id}', '${item.pacienteNome}')"><i class="fas fa-trash"></i> Excluir</button>`;
      
      let sessaoFormatadaParaDisplay = item.sessao ? parseDataHora(item.sessao).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'}) : 'Data inválida';
  
      card.innerHTML = `<h3>${item.pacienteNome}</h3><p><strong>Sessão:</strong> ${sessaoFormatadaParaDisplay}</p><select class="status-select" onchange="salvarStatus(this, '${item.id}')">${gerarOpcoesStatus(statusAtual)}</select><div class="card-buttons">${botaoConfirmacao} ${botaoEnviarLink} ${botaoMeet} ${botaoEditar} ${botaoExcluir}</div>`;
      cardsContainer.appendChild(card);
    });
    cardsContainer.scrollTop = 0;
}

function editarAgenda(id) {
    const item = _agendaData.find(appt => appt.id == id);
    if (!item) return alert('Erro: Compromisso não encontrado.');
    popularPacientesDropdown(item.pacienteNome);
    const dataSessao = parseDataHora(item.sessao);
    if (!isNaN(dataSessao.getTime())) {
      document.getElementById('agendaData').value = toIsoDateLocal(dataSessao);
      document.getElementById('agendaHora').value = dataSessao.toTimeString().slice(0, 5);
    }
    const dataPagamento = parseDataHora(item.dataPagamento);
    if (!isNaN(dataPagamento.getTime())) {
      document.getElementById('agendaPagamento').value = toIsoDateLocal(dataPagamento);
    } else {
      document.getElementById('agendaPagamento').value = '';
    }
    document.getElementById('agendaId').value = item.id;
    document.getElementById('agendaProntuario').value = item.prontuario;
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

document.getElementById("formAgenda").addEventListener("submit", async function (e) {
    e.preventDefault();
    document.getElementById('loadingOverlay').style.display = 'flex';
    const id = document.getElementById('agendaId').value;
    const pacienteNomeSelecionado = document.getElementById('agendaPaciente').value;
    const pacienteSelecionado = listaPacientes.find(p => p.nome === pacienteNomeSelecionado);
    const data = document.getElementById('agendaData').value;
    const hora = document.getElementById('agendaHora').value;
    const dataSessao = new Date(`${data}T${hora}`);
    const dataPagamentoInput = document.getElementById('agendaPagamento').value;

    const agendamentoData = {
        pacienteId: pacienteSelecionado ? pacienteSelecionado.id : null,
        pacienteNome: pacienteNomeSelecionado,
        sessao: firebase.firestore.Timestamp.fromDate(dataSessao),
        dataPagamento: dataPagamentoInput ? firebase.firestore.Timestamp.fromDate(new Date(dataPagamentoInput)) : null,
        prontuario: document.getElementById('agendaProntuario').value,
        status: 'Agendado',
        linkMeet: '' // Link do Meet agora é manual
    };
    try {
        if (id) {
            // Ao editar, não sobrescrevemos o link do meet, a menos que um campo seja adicionado para isso
            delete agendamentoData.linkMeet; 
            await db.collection('agendamentos').doc(id).update(agendamentoData);
        } else {
            await db.collection('agendamentos').add(agendamentoData);
        }
        fecharModalAgenda();
        await carregarDadosIniciais();
    } catch(err) {
        console.error("Erro ao salvar agendamento:", err);
        alert("Erro ao salvar agendamento!");
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
});

function parseDataHora(dataInput) {
    if (!dataInput) return new Date(NaN);
    if (typeof dataInput.toDate === 'function') return dataInput.toDate();
    if (dataInput instanceof Date) return dataInput;
    if (typeof dataInput === 'string' && dataInput.includes('T')) return new Date(dataInput);
    if (typeof dataInput === 'string' && dataInput.includes('/')) {
      const [dataPart, horaPart = '00:00'] = dataInput.split(' ');
      const [dia, mes, ano] = dataPart.split('/');
      const [hh = '00', mm = '00'] = horaPart.split(':');
      if (dia && mes && ano) {
        return new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hh), Number(mm));
      }
    }
    return new Date(dataInput);
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

async function excluirAgenda(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir o compromisso de ${nome}?`)) return;
    try {
        await db.collection('agendamentos').doc(id).delete();
        await carregarDadosIniciais();
    } catch(err) {
      console.error('Erro ao excluir compromisso:', err);
      alert('Erro ao excluir compromisso.');
    }
}
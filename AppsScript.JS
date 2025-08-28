const NOME_PLANILHA_CADASTROS = "Cadastros";
const NOME_PLANILHA_AGENDA = "Agenda";
const NOME_PLANILHA_CONFIG = "Configurações";

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;

  // Ação para buscar as configurações
  if (action === 'getConfig') {
    const sheet = ss.getSheetByName(NOME_PLANILHA_CONFIG);
    const data = sheet.getDataRange().getValues();
    const config = {};
    for (let i = 1; i < data.length; i++) {
      const chave = data[i][0];
      const valor = data[i][1];
      if (chave) config[chave] = valor;
    }
    return ContentService.createTextOutput(JSON.stringify(config)).setMimeType(ContentService.MimeType.JSON);
  }

  // Ação para salvar as configurações
  if (action === 'saveConfig') {
    const sheet = ss.getSheetByName(NOME_PLANILHA_CONFIG);
    const newConfig = JSON.parse(e.parameter.config);
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2);
    const values = range.getValues();
    for (let i = 0; i < values.length; i++) {
      const chave = values[i][0];
      if (newConfig.hasOwnProperty(chave)) {
        values[i][1] = newConfig[chave];
      }
    }
    range.setValues(values);
    return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
  }

  // Ação para atualizar rapidamente apenas o status
  if (action === 'updateStatus') {
    const sheet = ss.getSheetByName(NOME_PLANILHA_AGENDA);
    const id = e.parameter.id;
    const novoStatus = e.parameter.status;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const statusCol = headers.indexOf('Status') + 1;
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) {
        const row = i + 2;
        if (statusCol > 0) {
          sheet.getRange(row, statusCol).setValue(novoStatus);
          return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Status atualizado."})).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: "ID não encontrado."})).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Ação para buscar os dados da agenda
  if (action === 'agenda') {
    const sheet = ss.getSheetByName(NOME_PLANILHA_AGENDA);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const rows = data.map(r => {
      let obj = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
  }

  // Ação para criar um novo agendamento
  if (action === 'createAgenda') {
    const sheet = ss.getSheetByName(NOME_PLANILHA_AGENDA);
    const data = sheet.getDataRange().getValues();
    const lastId = data.length > 1 ? Math.max(...data.slice(1).map(r => r[0] || 0)) : 0;
    const newId = lastId + 1;
    const paciente = e.parameter.paciente || '';
    const sessaoStr = e.parameter.sessao || '';
    const linkMeet = criarEventoEGerarLinkMeet(paciente, sessaoStr);
    sheet.appendRow([ newId, paciente, sessaoStr, e.parameter.prontuario || '', e.parameter.pagamento || '', 'Agendado', linkMeet ]);
    return ContentService.createTextOutput('{"status":"agenda created"}');
  }

  // Ação para atualizar um agendamento existente
  if (action === 'updateAgenda') {
    const sheet = ss.getSheetByName(NOME_PLANILHA_AGENDA);
    const id = parseInt(e.parameter.id);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.getRange(i + 1, 2, 1, 4).setValues([[ e.parameter.paciente, e.parameter.sessao, e.parameter.prontuario, e.parameter.pagamento ]]);
        break;
      }
    }
    return ContentService.createTextOutput('{"status":"agenda updated"}');
  }

  // Ação para excluir um agendamento
  if (action === 'deleteAgenda') {
    const sheet = ss.getSheetByName(NOME_PLANILHA_AGENDA);
    const id = parseInt(e.parameter.id);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return ContentService.createTextOutput('{"status":"agenda deleted"}');
  }
  
  // --- Ações de Pacientes (Cadastros) ---

  // Ação para criar um novo paciente
  if (action === 'create') {
    const sheet = ss.getSheetByName("Cadastros");
    const data = sheet.getDataRange().getValues();
    const lastId = data.length > 1 ? Math.max(...data.slice(1).map(r => r[0] || 0)) : 0;
    const newId = lastId + 1;
    // Adicionado e.parameter.apelido
    sheet.appendRow([ newId, e.parameter.paciente, e.parameter.apelido, e.parameter.telefone, e.parameter.valor, e.parameter.data, e.parameter.situacao ]);
    return ContentService.createTextOutput('{"status":"created"}');
  }

  // Ação para atualizar um paciente
  if (action === 'update') {
    const sheet = ss.getSheetByName("Cadastros");
    const id = parseInt(e.parameter.id);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        // Adicionado e.parameter.apelido - ATENÇÃO À ORDEM DAS COLUNAS
        // A ordem aqui deve ser EXATAMENTE a mesma da sua planilha
        // Ex: Paciente, Apelido, Telefone, Valor, Data, Situação
        sheet.getRange(i + 1, 2, 1, 6).setValues([[ e.parameter.paciente, e.parameter.apelido, e.parameter.telefone, e.parameter.valor, e.parameter.data, e.parameter.situacao ]]);
        break;
      }
    }
    return ContentService.createTextOutput('{"status":"updated"}');
  }
  
  // Ação para excluir um paciente
  if (action === 'delete') {
    const sheet = ss.getSheetByName(NOME_PLANILHA_CADASTROS);
    const id = parseInt(e.parameter.id);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return ContentService.createTextOutput('{"status":"deleted"}');
  }

  // Ação padrão: buscar lista de pacientes (Cadastros)
  const sheet = ss.getSheetByName(NOME_PLANILHA_CADASTROS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const rows = data.map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i]; });
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
}

// --- Funções Auxiliares ---

function criarEventoEGerarLinkMeet(paciente, dataSessaoStr) {
  try {
    const calendarId = 'primary';
    const dataSessao = parseBrDate(dataSessaoStr);
    const dataFimSessao = new Date(dataSessao.getTime() + 60 * 60 * 1000);
    const event = {
      summary: `Sessão: ${paciente}`,
      description: `Sessão de psicologia com ${paciente}.`,
      start: { dateTime: dataSessao.toISOString() },
      end: { dateTime: dataFimSessao.toISOString() },
      conferenceData: {
        createRequest: {
          requestId: `meet-${paciente}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };
    const createdEvent = Calendar.Events.insert(event, calendarId, { conferenceDataVersion: 1 });
    return createdEvent.hangoutLink;
  } catch (err) {
    Logger.log('Erro ao criar evento no Calendar: ' + err.toString());
    return '';
  }
}

function parseBrDate(dateString) {
  const [datePart, timePart] = dateString.split(' ');
  const [day, month, year] = datePart.split('/');
  const [hours, minutes] = timePart.split(':');
  return new Date(year, month - 1, day, hours, minutes);
}
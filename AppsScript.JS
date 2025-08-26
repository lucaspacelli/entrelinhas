function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;

  // NOVO: Bloco para atualizar rapidamente apenas o status
  if (action === 'updateStatus') {
    const sheet = ss.getSheetByName('Agenda');
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

  // O resto da sua função doGet continua aqui...
  if (!action) {
    const sheet = ss.getSheetByName('Cadastros');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const rows = data.map(r => {
      const obj = {};
      r.forEach((valor, i) => {
        const coluna = headers[i];
        if (coluna === 'Data de reajuste' && valor instanceof Date) {
          obj[coluna] = Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy');
        } else {
          obj[coluna] = valor;
        }
      });
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'create') {
    // ... (seu código de create continua aqui)
  }

  if (action === 'update') {
    // ... (seu código de update continua aqui)
  }

  if (action === 'delete') {
    // ... (seu código de delete continua aqui)
  }

  if (action === 'agenda') {
    const sheet = ss.getSheetByName('Agenda');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const rows = data.map(r => {
      const obj = {};
      r.forEach((valor, i) => {
        const coluna = headers[i];
        obj[coluna] = valor;
      });
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'createAgenda') {
    const sheet = ss.getSheetByName('Agenda');
    const data = sheet.getDataRange().getValues();
    const lastId = data.length > 1 ? Math.max(...data.slice(1).map(r => r[0] || 0)) : 0;
    const newId = lastId + 1;
    const paciente = e.parameter.paciente || '';
    const sessaoStr = e.parameter.sessao || '';
    const linkMeet = criarEventoEGerarLinkMeet(paciente, sessaoStr);
    sheet.appendRow([
      newId,
      paciente,
      sessaoStr,
      '',      // Prontuário
      '',      // Pagamento
      'Agendado', // Status Padrão
      linkMeet // Link Meet
    ]);
    return ContentService.createTextOutput('{"status":"agenda created"}');
  }

  if (action === 'updateAgenda') {
    // ... (seu código de updateAgenda continua aqui)
  }

  if (action === 'deleteAgenda') {
    // ... (seu código de deleteAgenda continua aqui)
  }

  return ContentService.createTextOutput('{"status":"unknown action"}');
}
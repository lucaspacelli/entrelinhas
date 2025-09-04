let listaPacientes = [];
let _agendaData = [];
let dadosFinanceiros = []; // Array "enriquecido" com os valores
let filtroAtivo = 'geral'; // Controla qual card está selecionado

// Função principal que inicia tudo
async function carregarDadosFinanceiros() {
    document.getElementById('loadingOverlay').style.display = 'flex';
    try {
        const [pacientesSnapshot, agendaSnapshot] = await Promise.all([
            db.collection('pacientes').get(),
            db.collection('agendamentos').get()
        ]);
        
        listaPacientes = pacientesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        _agendaData = agendaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Passo crucial: "Enriquecer" os dados de agendamento com o valor da sessão
        dadosFinanceiros = _agendaData.map(agendamento => {
            const paciente = listaPacientes.find(p => p.id === agendamento.pacienteId);
            return {
                ...agendamento,
                valorSessao: paciente ? paciente.valorSessao : 0
            };
        });

        renderizarModulo();

    } catch (err) {
        console.error("Erro ao carregar dados financeiros:", err);
        alert("Não foi possível carregar os dados financeiros.");
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

// Renderiza todos os componentes da tela
function renderizarModulo() {
    renderizarCardsResumo();
    renderizarExtrato();
}

// Renderiza a coluna da esquerda com os cards de resumo
function renderizarCardsResumo() {
    const container = document.getElementById('cardsContainerFinanceiro');
    container.innerHTML = '';

    // 1. Card "Em Aberto"
    const emAberto = dadosFinanceiros.filter(item => item.status === 'Confirmado' && !item.dataPagamento);
    const totalEmAberto = emAberto.reduce((sum, item) => sum + (item.valorSessao || 0), 0);
    
    container.innerHTML += criarCardHtml('em-aberto', 'Em Aberto', totalEmAberto, 'em-aberto');

    // 2. Cards por Mês
    const pagos = dadosFinanceiros.filter(item => item.dataPagamento);
    const agrupadosPorMes = pagos.reduce((acc, item) => {
        const dataPag = item.dataPagamento.toDate();
        const mesAno = `${dataPag.getFullYear()}-${String(dataPag.getMonth() + 1).padStart(2, '0')}`;
        if (!acc[mesAno]) {
            acc[mesAno] = 0;
        }
        acc[mesAno] += (item.valorSessao || 0);
        return acc;
    }, {});

    const mesesOrdenados = Object.keys(agrupadosPorMes).sort().reverse();
    mesesOrdenados.forEach(mesAno => {
        const [ano, mes] = mesAno.split('-');
        const nomeMes = new Date(ano, mes - 1).toLocaleString('pt-BR', { month: 'long' });
        const titulo = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} ${ano}`;
        container.innerHTML += criarCardHtml(mesAno, titulo, agrupadosPorMes[mesAno]);
    });
}

// Função auxiliar para criar o HTML de um card
function criarCardHtml(id, titulo, valor, classeExtra = '') {
    const selecionadoClass = filtroAtivo === id ? 'selecionado' : '';
    return `
        <div class="card card-financeiro ${classeExtra} ${selecionadoClass}" onclick="filtrarExtratoPorCard('${id}')">
            <h3>${titulo}</h3>
            <p class="valor">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}</p>
        </div>
    `;
}

// Renderiza a tabela do extrato na direita
function renderizarExtrato() {
    const container = document.getElementById('extratoContainer');
    let itensParaExibir = [];
    let isEmAberto = false;

    if (filtroAtivo === 'geral') {
        itensParaExibir = dadosFinanceiros.filter(item => item.dataPagamento);
    } else if (filtroAtivo === 'em-aberto') {
        itensParaExibir = dadosFinanceiros.filter(item => item.status === 'Confirmado' && !item.dataPagamento);
        isEmAberto = true;
    } else { // Filtro de mês (ex: '2025-08')
        itensParaExibir = dadosFinanceiros.filter(item => {
            if (!item.dataPagamento) return false;
            const dataPag = item.dataPagamento.toDate();
            const mesAno = `${dataPag.getFullYear()}-${String(dataPag.getMonth() + 1).padStart(2, '0')}`;
            return mesAno === filtroAtivo;
        });
    }
    
    // Ordenação
    itensParaExibir.sort((a, b) => {
        const dataA = isEmAberto ? a.sessao.toDate() : a.dataPagamento.toDate();
        const dataB = isEmAberto ? b.sessao.toDate() : b.dataPagamento.toDate();
        return dataB - dataA;
    });

    // Filtros de texto
    const filtroData = document.getElementById('filtroData')?.value.toLowerCase() || '';
    const filtroOrigem = document.getElementById('filtroOrigem')?.value.toLowerCase() || '';
    const filtroValor = document.getElementById('filtroValor')?.value.toLowerCase() || '';

    const itensFiltrados = itensParaExibir.filter(item => {
        const dataPag = item.dataPagamento ? item.dataPagamento.toDate() : item.sessao.toDate();
        const dataStr = dataPag.toLocaleDateString('pt-BR');
        const origemStr = `${item.pacienteNome} ${item.sessao.toDate().toLocaleDateString('pt-BR')}`.toLowerCase();
        const valorStr = (item.valorSessao || 0).toFixed(2);

        return dataStr.includes(filtroData) &&
               origemStr.includes(filtroOrigem) &&
               valorStr.includes(filtroValor);
    });

    // Montagem do HTML
    let tableHtml = `
      <div class="table-wrapper">
        <table class="extrato-table">
          <thead>
            <tr>
              <th>${isEmAberto ? 'Data da Sessão' : 'Data Pag.'}</th>
              <th>Origem</th>
              <th>Valor</th>
            </tr>
            <tr class="filtro-th">
              <th><input type="text" id="filtroData" placeholder="Filtrar data..." oninput="renderizarExtrato()"></th>
              <th><input type="text" id="filtroOrigem" placeholder="Filtrar paciente..." oninput="renderizarExtrato()"></th>
              <th><input type="text" id="filtroValor" placeholder="Filtrar valor..." oninput="renderizarExtrato()"></th>
            </tr>
          </thead>
          <tbody>
    `;

    itensFiltrados.forEach(item => {
        const dataPag = isEmAberto ? item.sessao.toDate() : item.dataPagamento.toDate();
        const dataSessao = item.sessao.toDate();
        tableHtml += `
            <tr>
                <td>${dataPag.toLocaleDateString('pt-BR')}</td>
                <td>${item.pacienteNome} <small>(${dataSessao.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})})</small></td>
                <td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorSessao || 0)}</td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;

    // Restaura os valores dos filtros
    if(document.getElementById('filtroData')) document.getElementById('filtroData').value = filtroData;
    if(document.getElementById('filtroOrigem')) document.getElementById('filtroOrigem').value = filtroOrigem;
    if(document.getElementById('filtroValor')) document.getElementById('filtroValor').value = filtroValor;
}

// Função chamada pelo clique nos cards
function filtrarExtratoPorCard(id) {
    if (filtroAtivo === id) {
        filtroAtivo = 'geral'; // Desclicar
    } else {
        filtroAtivo = id;
    }
    // Limpa os filtros de texto ao mudar o card principal
    if(document.getElementById('filtroData')) document.getElementById('filtroData').value = '';
    if(document.getElementById('filtroOrigem')) document.getElementById('filtroOrigem').value = '';
    if(document.getElementById('filtroValor')) document.getElementById('filtroValor').value = '';
    
    renderizarModulo();
}


// Inicia o carregamento quando a página abre
document.addEventListener('DOMContentLoaded', carregarDadosFinanceiros);
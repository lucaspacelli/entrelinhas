const API_URL = 'https://script.google.com/macros/s/AKfycbyQV7CIT1wV7DKdvojIQnsMZFHKYzCGrqKViLaq7akYmazVzF38UtJGVztl6Wl0ijlK/exec'; // mesma URL usada na agenda

let dadosAgenda = [];

async function carregarPacientesEvolucao() {
  try {
    const res = await fetch(`${API_URL}?action=agenda`);
    const dados = await res.json();
    dadosAgenda = dados;

    const pacientesUnicos = [...new Set(dados.map(item => item.Paciente).filter(Boolean))].sort();

    const select = document.getElementById('selectPaciente');
    pacientesUnicos.forEach(paciente => {
      const option = document.createElement('option');
      option.value = paciente;
      option.textContent = paciente;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Erro ao carregar pacientes:', err);
    alert('Erro ao carregar lista de pacientes.');
  }
}

function filtrarEvolucao() {
    const pacienteSelecionado = document.getElementById('selectPaciente').value;
    const container = document.getElementById('containerEvolucao');
    container.innerHTML = '';
  
    if (!pacienteSelecionado) return;
  
    const prontuarios = dadosAgenda
      .filter(item => item.Paciente === pacienteSelecionado && item.Prontuário && item.Prontuário.trim() !== '')
      .sort((a, b) => {
        const getData = (d) => {
          const [dia, mes, resto] = d.Sessão.split('/');
          const [ano, hora = '00:00'] = resto.split(' ');
          const [hh, mm] = hora.split(':');
          return new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hh), Number(mm));
        };
        return getData(a) - getData(b);
      });
  
    // Cabeçalho de evolução
    const header = document.createElement('div');
    header.className = 'card';
    header.innerHTML = `
      <h2>Prontuário de Evolução de Paciente</h2>
      <p><strong>Nome do Paciente:</strong> ${pacienteSelecionado}</p>
      <p><strong>Número de Sessões:</strong> ${prontuarios.length}</p>
    `;
    container.appendChild(header);
  
    if (prontuarios.length === 0) {
      const vazio = document.createElement('div');
      vazio.className = 'card';
      vazio.innerHTML = `<p>Nenhum prontuário encontrado para este paciente.</p>`;
      container.appendChild(vazio);
      return;
    }
  
    prontuarios.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <h3>Sessão ${idx + 1} - ${item.Sessão}</h3>
        <p>${item.Prontuário}</p>
      `;
      container.appendChild(div);
    });
  }
  
window.onload = carregarPacientesEvolucao;

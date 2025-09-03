// A constante API_URL foi removida.
let listaPacientes = [];
let dadosAgenda = [];
let configuracoes = {};
let editandoId = null;

async function carregarDadosIniciais() {
  document.getElementById('loadingOverlay').style.display = 'flex';
  try {
    const [pacientesSnapshot, agendaSnapshot, configDoc] = await Promise.all([
      db.collection('pacientes').get(),
      db.collection('agendamentos').get(),
      db.collection('configuracoes').doc('geral').get()
    ]);
    
    listaPacientes = pacientesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    dadosAgenda = agendaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (configDoc.exists) {
        configuracoes = configDoc.data();
    }

    listaPacientes.sort((a, b) => a.nome.localeCompare(b.nome));
    preencherCardsPacientes(listaPacientes);

    document.getElementById('inputTelefone').addEventListener('input', mascaraTelefone);
    document.getElementById('inputValor').addEventListener('input', mascaraValor);
    document.getElementById('inputFiltro').addEventListener('input', filtrarPacientes);
  } catch (erro) {
    console.error('Erro ao carregar dados iniciais:', erro);
    alert('Erro grave ao carregar os dados!');
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

function filtrarPacientes() {
  const termo = document.getElementById('inputFiltro').value.toLowerCase();
  const pacientesFiltrados = listaPacientes.filter(p => 
    p.nome.toLowerCase().includes(termo) || (p.apelido || '').toLowerCase().includes(termo)
  );
  preencherCardsPacientes(pacientesFiltrados);
}

function preencherCardsPacientes(pacientesParaExibir) {
  const container = document.getElementById('cardsContainerCadastros');
  container.innerHTML = '';
  if (pacientesParaExibir.length === 0) {
    container.innerHTML = '<p>Nenhum paciente encontrado.</p>';
    return;
  }
  pacientesParaExibir.forEach(paciente => {
    const card = document.createElement('div');
    card.className = 'card';
    if (paciente.situacao && paciente.situacao.toLowerCase() === 'ativo') {
      card.classList.add('status-ativo');
    } else {
      card.classList.add('status-inativo');
    }
    card.addEventListener('click', () => mostrarEvolucao(paciente, card));
    card.innerHTML = `
      <h3>${paciente.nome}</h3>
      <p><strong>Situação:</strong> ${paciente.situacao}</p>
      <p><strong>Telefone:</strong> ${formatarTelefoneDisplay(paciente.telefone) || 'Não informado'}</p>
      <div class="card-buttons">
        <button onclick="event.stopPropagation(); editarCadastro('${paciente.id}')"><i class="fas fa-edit"></i> Editar</button>
        <button class="btn-excluir" onclick="event.stopPropagation(); excluirCadastro('${paciente.id}', '${paciente.nome}')"><i class="fas fa-trash"></i> Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function mostrarEvolucao(paciente, cardElement) {
  document.querySelectorAll('#cardsContainerCadastros .card').forEach(c => c.classList.remove('selecionado'));
  cardElement.classList.add('selecionado');
  const container = document.getElementById('containerEvolucao');
  container.innerHTML = '';

  const prontuarios = dadosAgenda
    .filter(item => item.pacienteId === paciente.id && item.prontuario && item.prontuario.trim() !== '')
    .sort((a, b) => b.sessao.toDate() - a.sessao.toDate());

  const header = document.createElement('div');
  header.className = 'card evolution-card';
  header.innerHTML = `
    <h2>Prontuário de Evolução</h2>
    <p><strong>Psicóloga:</strong> ${configuracoes.nome_psicologo || ''} | CRP: ${configuracoes.crp_psicologo || ''}</p>
    <p><strong>Paciente:</strong> ${paciente.nome}</p>
  `;
  container.appendChild(header);
  
  prontuarios.forEach(item => {
    const div = document.createElement('div');
    div.className = 'card evolution-card';
    const dataSessao = item.sessao.toDate();
    const dataFormatada = `${String(dataSessao.getDate()).padStart(2, '0')}/${String(dataSessao.getMonth() + 1).padStart(2, '0')}/${dataSessao.getFullYear()} ${String(dataSessao.getHours()).padStart(2, '0')}:${String(dataSessao.getMinutes()).padStart(2, '0')}`;
    div.innerHTML = `<h3>${dataFormatada}</h3><p style="white-space: pre-wrap;">${item.prontuario}</p>`;
    container.appendChild(div);
  });
}

function editarCadastro(id) {
  const paciente = listaPacientes.find(p => p.id === id);
  if (!paciente) return;
  editandoId = id;
  document.getElementById("modalTitulo").innerHTML = "<strong>Editar Paciente</strong>";
  document.getElementById("inputId").value = paciente.id;
  document.getElementById("inputPaciente").value = paciente.nome;
  document.getElementById("inputApelido").value = paciente.apelido || '';
  document.getElementById("inputValor").value = formatarValorDisplay(paciente.valorSessao);
  document.getElementById("inputTelefone").value = formatarTelefoneDisplay(paciente.telefone);
  
  const dataReajuste = paciente.dataReajuste ? paciente.dataReajuste.toDate() : null;
  document.getElementById("inputData").value = toIsoDateLocal(dataReajuste);
  document.getElementById("inputSituacao").value = paciente.situacao;
  
  abrirModal();
}

async function excluirCadastro(id, nome) {
  if (!confirm(`Tem certeza que deseja excluir ${nome}? A ação não pode ser desfeita.`)) return;
  document.getElementById('loadingOverlay').style.display = 'flex';
  try {
    await db.collection('pacientes').doc(id).delete();
    await carregarDadosIniciais();
    document.getElementById('containerEvolucao').innerHTML = '<div class="card"><p>Paciente excluído.</p></div>';
  } catch (err) {
    alert('Erro ao excluir o paciente.');
    console.error(err);
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

document.getElementById("formCadastro").addEventListener("submit", async function (e) {
  e.preventDefault();
  document.getElementById('loadingOverlay').style.display = 'flex';

  const valorLimpo = parseFloat(document.getElementById("inputValor").value.replace('R$', '').replace('.', '').replace(',', '.').trim());
  const dataReajuste = document.getElementById("inputData").value;

  const pacienteData = {
      nome: document.getElementById("inputPaciente").value,
      apelido: document.getElementById("inputApelido").value,
      valorSessao: isNaN(valorLimpo) ? 0 : valorLimpo,
      dataReajuste: dataReajuste ? firebase.firestore.Timestamp.fromDate(new Date(dataReajuste)) : null,
      situacao: document.getElementById("inputSituacao").value,
      telefone: document.getElementById("inputTelefone").value.replace(/\D/g, '')
  };

  try {
    if (editandoId) {
      await db.collection('pacientes').doc(editandoId).update(pacienteData);
    } else {
      await db.collection('pacientes').add(pacienteData);
    }
    fecharModal();
    await carregarDadosIniciais();
  } catch (err) {
      console.error("Erro ao salvar paciente:", err);
      alert("Erro ao salvar paciente!");
  } finally {
      document.getElementById('loadingOverlay').style.display = 'none';
  }
});

function toIsoDateLocal(d) {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function mascaraValor(event) {
  const input = event.target;
  let valor = input.value.replace(/\D/g, '');
  if (!valor) { input.value = ''; return; }
  valor = (parseInt(valor, 10) / 100);
  input.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
function formatarValorDisplay(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    const numero = parseFloat(String(valor).replace(/[^0-9,.-]+/g, "").replace(",", "."));
    if (isNaN(numero)) return '';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
}
function mascaraTelefone(event) {
  const input = event.target;
  let valor = input.value.replace(/\D/g, '').substring(0, 11);
  if (valor.length > 2) valor = `(${valor.substring(0, 2)}) ${valor.substring(2)}`;
  if (valor.length > 9) valor = `${valor.substring(0, 9)}-${valor.substring(9)}`;
  input.value = valor;
}
function formatarTelefoneDisplay(numero) {
    if (!numero) return '';
    let valor = String(numero).replace(/\D/g, '').substring(0, 11);
    if (valor.length > 2) valor = `(${valor.substring(0, 2)}) ${valor.substring(2)}`;
    if (valor.length > 9) valor = `${valor.substring(0, 9)}-${valor.substring(9)}`;
    return valor;
}
function novoCadastro() {
  editandoId = null;
  document.getElementById("modalTitulo").innerHTML = "<strong>Novo Paciente</strong>";
  document.getElementById("formCadastro").reset();
  abrirModal();
}
function abrirModal() {
  document.getElementById("modal").style.display = "flex";
}
function fecharModal() {
  document.getElementById("modal").style.display = "none";
  document.getElementById("formCadastro").reset();
  editandoId = null;
}
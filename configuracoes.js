const API_URL = 'https://script.google.com/macros/s/AKfycbx3qSIUSCE7Uw41oRsmgXmEJyZXSkiA_97lz5wPtk4a673kuU4dFXC7MB_yzvMlJr88/exec';

async function carregarConfiguracoes() {
    document.getElementById('loadingOverlay').style.display = 'flex';
    try {
        const response = await fetch(`${API_URL}?action=getConfig`);
        const config = await response.json();

        // Preenche cada campo do formulário com os valores da planilha
        for (const chave in config) {
            const element = document.getElementById(chave);
            if (element) {
                element.value = config[chave];
            }
        }
    } catch (err) {
        console.error("Erro ao carregar configurações:", err);
        alert("Não foi possível carregar as configurações.");
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

async function salvarConfiguracoes(event) {
    event.preventDefault();
    document.getElementById('loadingOverlay').style.display = 'flex';

    const config = {
        nome_psicologo: document.getElementById('nome_psicologo').value,
        crp_psicologo: document.getElementById('crp_psicologo').value,
        chave_pix: document.getElementById('chave_pix').value,
        msg_confirmacao: document.getElementById('msg_confirmacao').value,
        msg_link: document.getElementById('msg_link').value,
    };

    try {
        const url = `${API_URL}?action=saveConfig&config=${encodeURIComponent(JSON.stringify(config))}`;
        const response = await fetch(url); // Usando GET conforme sua estrutura
        const result = await response.json();
        if (result.status === "success") {
            alert("Configurações salvas com sucesso!");
        } else {
            throw new Error("Falha ao salvar no servidor.");
        }
    } catch (err) {
        console.error("Erro ao salvar configurações:", err);
        alert("Houve um erro ao salvar as configurações.");
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

// Inicia o carregamento quando a página abre
window.onload = carregarConfiguracoes;
// Adiciona o evento de salvar ao formulário
document.getElementById('formConfig').addEventListener('submit', salvarConfiguracoes);
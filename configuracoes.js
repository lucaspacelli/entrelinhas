// A constante API_URL foi removida.

async function carregarConfiguracoes() {
    document.getElementById('loadingOverlay').style.display = 'flex';
    try {
        const docRef = db.collection('configuracoes').doc('geral');
        const doc = await docRef.get();

        if (doc.exists) {
            const config = doc.data();
            for (const chave in config) {
                const element = document.getElementById(chave);
                if (element) {
                    element.value = config[chave];
                }
            }
        } else {
            console.log("Documento de configurações não encontrado!");
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
        await db.collection('configuracoes').doc('geral').set(config, { merge: true });
        alert("Configurações salvas com sucesso!");
    } catch (err) {
        console.error("Erro ao salvar configurações:", err);
        alert("Houve um erro ao salvar as configurações.");
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

document.getElementById('formConfig').addEventListener('submit', salvarConfiguracoes);
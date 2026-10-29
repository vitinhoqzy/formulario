// Encontra os formulários e os locais das mensagens no HTML.
const formularioCadastro = document.getElementById("formularioCadastro");
const mensagemCadastro = document.getElementById("mensagemCadastro");
const formularioLogin = document.getElementById("formularioLogin");
const mensagemLogin = document.getElementById("mensagemLogin");

// Encontra a mensagem de sessão e o botão Sair no HTML.
const estadoSessao = document.getElementById("estadoSessao");
const botaoSair = document.getElementById("botaoSair");
// Encontra o link para abrir a área privada.
const linkPainel = document.getElementById("linkPainel");
// Envia os dados de cadastro ao servidor.
formularioCadastro.addEventListener("submit", async function (evento) {
    // Impede o navegador de recarregar a página.
    evento.preventDefault();

    // Lê os valores digitados nos campos de cadastro.
    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("emailCadastro").value.trim();
    const senha = document.getElementById("senhaCadastro").value;

    // Envia os valores ao servidor no formato JSON.
    const resposta = await fetch("/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha })
    });

    // Lê e mostra a mensagem que o servidor devolveu.
    const resultado = await resposta.json();
    mensagemCadastro.textContent = resultado.mensagem;
    // Marca a resposta como sucesso ou erro para o CSS colorir.
mensagemCadastro.dataset.tipo = resposta.ok ? "sucesso" : "erro";
});

// Envia os dados de login ao servidor.
formularioLogin.addEventListener("submit", async function (evento) {
    // Impede o navegador de recarregar a página.
    evento.preventDefault();

    // Lê o e-mail e a senha digitados no formulário de login.
    const email = document.getElementById("emailLogin").value.trim();
    const senha = document.getElementById("senhaLogin").value;

    // Envia os dados ao servidor no formato JSON.
    const resposta = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
    });

    // Mostra a resposta do servidor, seja sucesso ou erro.
    const resultado = await resposta.json();
    mensagemLogin.textContent = resultado.mensagem;
    // Marca a resposta como sucesso ou erro para o CSS colorir.
mensagemLogin.dataset.tipo = resposta.ok ? "sucesso" : "erro";

    // Consulta se o servidor criou uma sessão de login.
    await atualizarSessao();
});

// Consulta o servidor e mostra se alguém está conectado.
async function atualizarSessao() {
    const resposta = await fetch("/sessao");
    const sessao = await resposta.json();

    if (sessao.conectado) {
        // Mostra o nome da pessoa conectada.
        linkPainel.hidden = false;
        estadoSessao.textContent =
            `Você está conectado como ${sessao.nome}.`;

        // Mostra o botão para encerrar a sessão.
        botaoSair.hidden = false;
    } else {
        // Apaga a mensagem e esconde o botão quando não há login.
        linkPainel.hidden = true;
        estadoSessao.textContent = "";
        botaoSair.hidden = true;
    }
}

// Envia ao servidor o pedido para encerrar a sessão.
botaoSair.addEventListener("click", async function () {
    const resposta = await fetch("/sair", {
        method: "POST"
    });

    // Mostra a confirmação de saída.
    const resultado = await resposta.json();
    mensagemLogin.textContent = resultado.mensagem;

    // Atualiza a tela para refletir que a sessão foi encerrada.
    await atualizarSessao();
});

// Verifica a sessão assim que a página abre ou é atualizada.
atualizarSessao();
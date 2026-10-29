// Encontra os elementos do painel.
const nomeUsuario = document.getElementById("nomeUsuario");
const mensagemPainel = document.getElementById("mensagemPainel");
const botaoSair = document.getElementById("botaoSair");
// Encontra o formulário de troca de senha e seu espaço para mensagens.
const formularioAlterarSenha =
    document.getElementById("formularioAlterarSenha");
const mensagemSenha = document.getElementById("mensagemSenha");

// Envia o pedido para trocar a senha ao servidor.
formularioAlterarSenha.addEventListener("submit", async function (evento) {
    // Evita que o navegador recarregue o painel.
    evento.preventDefault();

    // Lê as três senhas digitadas.
    const senhaAtual = document.getElementById("senhaAtual").value;
    const novaSenha = document.getElementById("novaSenha").value;
    const confirmarSenha =
        document.getElementById("confirmarSenha").value;

    // Envia as senhas ao servidor no formato JSON.
    const resposta = await fetch("/alterar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha, confirmarSenha })
    });

    // Lê a mensagem devolvida pelo servidor.
    const resultado = await resposta.json();
    mensagemSenha.textContent = resultado.mensagem;

    // Marca a mensagem para o CSS colorir como sucesso ou erro.
    mensagemSenha.dataset.tipo = resposta.ok ? "sucesso" : "erro";

    // Limpa os campos se a troca funcionou.
    if (resposta.ok) {
        formularioAlterarSenha.reset();
    }
});

// Consulta o servidor para descobrir quem está conectado.
async function carregarUsuario() {
    const resposta = await fetch("/sessao");
    const sessao = await resposta.json();

    // Se a sessão terminou, volta para a página inicial.
    if (!sessao.conectado) {
        window.location.href = "/";
        return;
    }

    // Mostra o nome recebido do servidor como texto.
    nomeUsuario.textContent = sessao.nome;
}

// Envia ao servidor o pedido para encerrar a sessão.
botaoSair.addEventListener("click", async function () {
    const resposta = await fetch("/sair", {
        method: "POST"
    });

    // Se a saída funcionou, volta para a página inicial.
    if (resposta.ok) {
        window.location.href = "/";
        return;
    }

    // Mostra uma mensagem se o servidor não conseguiu encerrar a sessão.
    mensagemPainel.textContent = "Não foi possível sair. Tente novamente.";
});

// Carrega o nome assim que o painel abrir.
carregarUsuario();
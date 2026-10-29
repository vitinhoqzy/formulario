// Encontra o formulário e a área de resposta.
const formularioRecuperacao =
    document.getElementById("formularioRecuperacao");
const mensagemRecuperacao =
    document.getElementById("mensagemRecuperacao");

// Envia o pedido de recuperação ao servidor.
formularioRecuperacao.addEventListener("submit", async function (evento) {
    // Evita que o navegador recarregue a página.
    evento.preventDefault();

    // Lê o e-mail digitado.
    const email = document
        .getElementById("emailRecuperacao")
        .value
        .trim();

    // Envia o e-mail ao servidor em formato JSON.
    const resposta = await fetch("/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    });

    // Mostra a resposta genérica do servidor.
    const resultado = await resposta.json();
    mensagemRecuperacao.textContent = resultado.mensagem;
});
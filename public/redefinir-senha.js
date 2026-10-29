// Encontra o formulário e os elementos da página.
const formulario = document.querySelector("#form-redefinir-senha");
const campoNovaSenha = document.querySelector("#nova-senha");
const campoConfirmarSenha = document.querySelector("#confirmar-senha");
const mensagem = document.querySelector("#mensagem");

// Lê o token que vem no endereço, depois de "?token=".
const parametros = new URLSearchParams(window.location.search);
const token = parametros.get("token");

// Sem token, não há como confirmar que o link de recuperação é válido.
if (!token) {
  mensagem.textContent = "O link está incompleto. Solicite outro na página inicial.";
  formulario.querySelector("button").disabled = true;
}

// Escuta o envio do formulário.
formulario.addEventListener("submit", async (evento) => {
  // Impede o navegador de recarregar a página.
  evento.preventDefault();

  const novaSenha = campoNovaSenha.value;
  const confirmarSenha = campoConfirmarSenha.value;

  // Confere se os dois campos foram preenchidos com a mesma senha.
  if (novaSenha !== confirmarSenha) {
    mensagem.textContent = "As senhas não coincidem.";
    return;
  }

  try {
    // Envia o token e a nova senha ao servidor.
    const resposta = await fetch("/redefinir-senha", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token, novaSenha })
    });

    const dados = await resposta.json();
    mensagem.textContent = dados.mensagem;

    // Limpa os campos depois que a senha for alterada.
    if (resposta.ok) {
      formulario.reset();
    }
  } catch (erro) {
    mensagem.textContent = "Não foi possível conectar ao servidor. Tente novamente.";
  }
});
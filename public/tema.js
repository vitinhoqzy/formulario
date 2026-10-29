// Procura o botão de tema e o elemento que controla as cores da página.
const botaoTema = document.getElementById("botaoTema");
const raizPagina = document.documentElement;

// Lê o tema salvo neste navegador. Se não houver escolha, usa o modo claro.
let temaSalvo = "light";

try {
    temaSalvo = localStorage.getItem("tema") || "light";
} catch (erro) {
    // Se o navegador bloquear o armazenamento, a página continua funcionando.
}

// Aplica o tema e atualiza o texto acessível do botão.
function aplicarTema(tema) {
    const modoNoturno = tema === "dark";

    raizPagina.dataset.theme = modoNoturno ? "dark" : "light";
    botaoTema.textContent = modoNoturno ? "Usar modo claro" : "Modo noturno";
    botaoTema.setAttribute("aria-pressed", String(modoNoturno));
    botaoTema.setAttribute(
        "aria-label",
        modoNoturno ? "Ativar modo claro" : "Ativar modo noturno"
    );
}

// Mostra a escolha guardada quando a página abre.
aplicarTema(temaSalvo === "dark" ? "dark" : "light");

// Alterna o tema e tenta guardar a escolha para as próximas visitas.
botaoTema.addEventListener("click", function () {
    const novoTema = raizPagina.dataset.theme === "dark" ? "light" : "dark";
    aplicarTema(novoTema);

    try {
        localStorage.setItem("tema", novoTema);
    } catch (erro) {
        // O tema continua alternando mesmo se não puder ser salvo.
    }
});

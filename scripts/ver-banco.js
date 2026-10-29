// Abre a conexão com o mesmo banco usado pelo servidor.
const db = require("../database");

// Busca apenas o ID, o nome e o e-mail dos usuários.
// A senha e o hash não são incluídos nesta consulta.
const usuarios = db.prepare(`
    SELECT id, nome, email
    FROM usuarios
`).all();

// Mostra os resultados no terminal.
console.table(usuarios);

// Fecha a conexão com o banco.
db.close();
// Importa ferramentas do Node.js para montar o caminho do arquivo.
const path = require("path");

// Importa a biblioteca SQLite.
const Database = require("better-sqlite3");

// Define o caminho do banco dentro da pasta data.
const caminhoBanco = path.join(__dirname, "data", "usuarios.db");

// Abre o banco de usuários nesse caminho.
const db = new Database(caminhoBanco);

// Cria a tabela se ela ainda não existir.
db.prepare(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha_hash TEXT NOT NULL
    )
`).run();
// Cria a tabela dos pedidos de redefinição, se ela ainda não existir.
db.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES usuarios(id)
    )
`).run();

// Ajuda o banco a encontrar rapidamente os tokens de cada usuário.
db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id
    ON password_reset_tokens(user_id)
`).run();

// Limita os e-mails de recuperação por conta para evitar envios repetidos.
db.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_email_limits (
        user_id INTEGER PRIMARY KEY,
        window_started_at INTEGER NOT NULL,
        last_sent_at INTEGER NOT NULL,
        sent_count INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES usuarios(id)
    )
`).run();

// Disponibiliza a conexão para outros arquivos.
module.exports = db;

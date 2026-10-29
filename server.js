// Importa o Express para criar o servidor.
const express = require("express");

// Importa ferramentas para montar caminhos de arquivos.
const path = require("path");
const nodemailer = require("nodemailer");
// Importa criptografia nativa do Node.js para gerar e resumir tokens.
const crypto = require("node:crypto");

// Importa o bcrypt para proteger senhas.
const bcrypt = require("bcrypt");

// Importa a conexão com o banco de usuários e tokens.
const db = require("./database");

// Importa a ferramenta de sessões.
const session = require("express-session");

// Guarda as sessões no arquivo SQLite.
const sessionStore = require("better-express-store")({
    dbPath: path.join(__dirname, "data", "sessions.db")
});

// Lê a chave secreta do arquivo .env.
const sessionSecret = process.env.SESSION_SECRET;

// Impede o servidor de iniciar sem essa chave.
if (!sessionSecret) {
    throw new Error("SESSION_SECRET não encontrada no arquivo .env.");
}

// Lê as credenciais do Gmail do arquivo .env.
const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

// Usa o endereço local durante o desenvolvimento.
const appUrl = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

// Não permite iniciar em produção sem um endereço público protegido por HTTPS.
if (process.env.NODE_ENV === "production") {
    let enderecoPublico;

    try {
        enderecoPublico = new URL(appUrl);
    } catch (erro) {
        throw new Error("APP_URL precisa ser o endereço público do site.");
    }

    if (enderecoPublico.protocol !== "https:") {
        throw new Error("APP_URL em produção precisa começar com https://.");
    }
}

// Confere se as credenciais do Gmail foram configuradas.
if (!gmailUser || !gmailAppPassword) {
    throw new Error("Configure GMAIL_USER e GMAIL_APP_PASSWORD no arquivo .env.");
}

// Configura o Nodemailer para enviar mensagens pelo Gmail.
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: gmailUser,
        pass: gmailAppPassword
    }
});

// Cria a aplicação do servidor.
const app = express();

// Informa ao Express que a hospedagem pode encaminhar tráfego por proxy.
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

// Permite que o servidor leia dados JSON dos formulários.
app.use(express.json({ limit: "10kb" }));

// Envia cabeçalhos básicos para reduzir riscos no navegador.
app.use(function (req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; base-uri 'self'; form-action 'self'; " +
        "frame-ancestors 'none'; object-src 'none'; script-src 'self'; " +
        "style-src 'self'; connect-src 'self'; img-src 'self' data:"
    );

    if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000");
    }

    next();
});

// Limita tentativas por endereço IP. A resposta não revela dados da conta.
function criarLimitadorPorIp(maximo, janelaMs, mensagem) {
    const contadores = new Map();

    return function (req, res, next) {
        const agora = Date.now();
        const enderecoIp = req.ip || req.socket.remoteAddress || "desconhecido";
        let contador = contadores.get(enderecoIp);

        if (!contador || agora - contador.inicio >= janelaMs) {
            contador = { inicio: agora, quantidade: 0 };
            contadores.set(enderecoIp, contador);
        }

        if (contador.quantidade >= maximo) {
            const aguardarSegundos = Math.ceil(
                (janelaMs - (agora - contador.inicio)) / 1000
            );

            res.setHeader("Retry-After", String(aguardarSegundos));
            return res.status(429).json({ mensagem });
        }

        contador.quantidade += 1;

        // Descarta contadores vencidos de vez em quando para limitar o uso de memória.
        if (contadores.size > 1000) {
            for (const [ip, registro] of contadores) {
                if (agora - registro.inicio >= janelaMs) {
                    contadores.delete(ip);
                }
            }
        }

        next();
    };
}

// Permite até 10 tentativas de login ou recuperação por IP a cada 15 minutos.
const limitarLoginPorIp = criarLimitadorPorIp(
    10,
    15 * 60 * 1000,
    "Muitas tentativas. Aguarde alguns minutos e tente novamente."
);
const limitarRecuperacaoPorIp = criarLimitadorPorIp(
    10,
    15 * 60 * 1000,
    "Muitas solicitações. Aguarde alguns minutos e tente novamente."
);

// Configura as sessões de login.
app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: "meuSite.sid",
    cookie: {
        maxAge: 30 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        // Em produção, o cookie só trafega por HTTPS.
        secure: process.env.NODE_ENV === "production"
    }
}));

// Envia a página inicial.
app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Envia o CSS ao navegador.
app.get("/style.css", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "style.css"));
});

// Envia o JavaScript que alterna o tema claro e o modo noturno.
app.get("/tema.js", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "tema.js"));
});

// Envia o JavaScript da página inicial.
app.get("/script.js", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "script.js"));
});

// Envia o JavaScript do painel.
app.get("/painel.js", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "painel.js"));
});

// Abre a página de pedido de recuperação.
app.get("/esqueci-senha", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "esqueci-senha.html"));
});

// Envia o JavaScript da página de recuperação.
app.get("/esqueci-senha.js", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "esqueci-senha.js"));
});

// Abre a página para escolher uma nova senha.
app.get("/redefinir-senha", function (req, res) {
    // Evita guardar em cache a página aberta por um link com token.
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname, "public", "redefinir-senha.html"));
});

// Envia o JavaScript da página de redefinição.
app.get("/redefinir-senha.js", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "redefinir-senha.js"));
});

// Recebe o pedido de recuperação e envia um link se a conta existir.
app.post("/esqueci-senha", limitarRecuperacaoPorIp, async function (req, res) {
    // A resposta não revela se o e-mail está cadastrado.
    const resposta = {
        mensagem: "Se houver uma conta com esse e-mail, enviaremos um link de recuperação."
    };

    // Lê e padroniza o e-mail.
    const email = typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!email) {
        return res.json(resposta);
    }

    // Procura a conta pelo e-mail.
    const usuario = db.prepare(`
        SELECT id
        FROM usuarios
        WHERE email = ?
    `).get(email);

    // Mantém a mesma resposta se a conta não existir.
    if (!usuario) {
        return res.json(resposta);
    }

    // Limita os envios a um por minuto e três por hora para cada conta.
    const agora = Date.now();
    const intervaloMinimo = 60 * 1000;
    const duracaoJanela = 60 * 60 * 1000;
    const maximoPorHora = 3;

    const podeEnviarEmail = db.transaction(() => {
        const limiteAtual = db.prepare(`
            SELECT window_started_at, last_sent_at, sent_count
            FROM password_reset_email_limits
            WHERE user_id = ?
        `).get(usuario.id);

        // No primeiro pedido, inicia a contagem da janela de uma hora.
        if (!limiteAtual) {
            db.prepare(`
                INSERT INTO password_reset_email_limits
                    (user_id, window_started_at, last_sent_at, sent_count)
                VALUES (?, ?, ?, ?)
            `).run(usuario.id, agora, agora, 1);

            return true;
        }

        // Reinicia a contagem quando a janela de uma hora termina.
        const janelaExpirou = agora - limiteAtual.window_started_at >= duracaoJanela;
        const inicioJanela = janelaExpirou
            ? agora
            : limiteAtual.window_started_at;
        const quantidadeNaJanela = janelaExpirou
            ? 0
            : limiteAtual.sent_count;

        // Recusa pedidos muito próximos ou acima do limite por hora.
        const intervaloMuitoCurto = agora - limiteAtual.last_sent_at < intervaloMinimo;
        const limitePorHoraAtingido = quantidadeNaJanela >= maximoPorHora;

        if (intervaloMuitoCurto || limitePorHoraAtingido) {
            return false;
        }

        // Reserva esta tentativa antes do envio para impedir pedidos simultâneos.
        db.prepare(`
            UPDATE password_reset_email_limits
            SET window_started_at = ?, last_sent_at = ?, sent_count = ?
            WHERE user_id = ?
        `).run(
            inicioJanela,
            agora,
            quantidadeNaJanela + 1,
            usuario.id
        );

        return true;
    })();

    // Mantém a resposta genérica, mas não envia outro e-mail durante o limite.
    if (!podeEnviarEmail) {
        return res.json(resposta);
    }

    // Gera um token aleatório e secreto de 32 bytes.
    const token = crypto.randomBytes(32).toString("hex");

    // Calcula o hash do token; o token original não será guardado no banco.
    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    // Define a validade do link para 15 minutos.
    const expiraEm = Date.now() + 15 * 60 * 1000;

    // Remove pedidos anteriores dessa conta.
    db.prepare(`
        DELETE FROM password_reset_tokens
        WHERE user_id = ?
    `).run(usuario.id);

    // Guarda o hash, o ID do usuário e o horário em que o token expira.
    db.prepare(`
        INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
        VALUES (?, ?, ?)
    `).run(tokenHash, usuario.id, expiraEm);

    // Monta o link que abre a página para escolher uma nova senha.
    const linkRedefinicao =
        `${appUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;

    try {
        // Envia o link para o endereço de e-mail da conta.
        await transporter.sendMail({
            from: `"Meu site" <${gmailUser}>`,
            to: email,
            subject: "Redefinição de senha",
            text: `Para escolher uma nova senha, abra este link: ${linkRedefinicao}\n\n` +
                "O link expira em 15 minutos. Se você não pediu essa alteração, ignore este e-mail.",
            html: `
                <p>Recebemos um pedido para redefinir a senha da sua conta.</p>
                <p>
                    <a href="${linkRedefinicao}">
                        Clique aqui para escolher uma nova senha
                    </a>
                </p>
                <p>O link expira em 15 minutos. Se você não pediu essa alteração, ignore este e-mail.</p>
            `
        });
    } catch (erro) {
        // O token não é exibido; o terminal mostra apenas o erro do envio.
        console.error("Erro ao enviar e-mail de recuperação:", erro.message);

        // Remove o token se o e-mail não pôde ser enviado.
        db.prepare(`
            DELETE FROM password_reset_tokens
            WHERE user_id = ?
        `).run(usuario.id);
    }

    // Devolve a mesma resposta genérica ao navegador.
    res.json(resposta);
});

// Recebe o token do link e salva a nova senha.
app.post("/redefinir-senha", async function (req, res) {
    // Lê o token enviado pela página.
    const token = typeof req.body?.token === "string"
        ? req.body.token
        : "";

    // Lê a nova senha enviada pela página.
    const novaSenha = typeof req.body?.novaSenha === "string"
        ? req.body.novaSenha
        : "";

    // Confere se os dois dados foram enviados.
    if (!token || !novaSenha) {
        return res.status(400).json({
            mensagem: "O link ou a nova senha está faltando."
        });
    }

    // Exige pelo menos oito caracteres.
    if (novaSenha.length < 8) {
        return res.status(400).json({
            mensagem: "A senha precisa ter pelo menos 8 caracteres."
        });
    }

    // O bcrypt aceita no máximo 72 bytes de senha.
    if (Buffer.byteLength(novaSenha, "utf8") > 72) {
        return res.status(400).json({
            mensagem: "A senha não pode exceder 72 bytes."
        });
    }

    // Calcula o hash do token para procurar no banco.
    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    // Confere se o token existe e ainda não expirou.
    const registro = db.prepare(`
        SELECT user_id
        FROM password_reset_tokens
        WHERE token_hash = ? AND expires_at > ?
    `).get(tokenHash, Date.now());

    // Recusa tokens inexistentes ou vencidos.
    if (!registro) {
        return res.status(400).json({
            mensagem: "Este link é inválido ou expirou. Solicite outro."
        });
    }

    try {
        // Cria o hash seguro da nova senha.
        const senhaHash = await bcrypt.hash(novaSenha, 12);

        // Atualiza a senha e remove os links pendentes em uma transação.
        const redefinido = db.transaction(() => {
            // Confere o token novamente antes de usá-lo.
            const tokenValido = db.prepare(`
                SELECT user_id
                FROM password_reset_tokens
                WHERE token_hash = ? AND expires_at > ?
            `).get(tokenHash, Date.now());

            // Se o token expirou ou já foi usado, não altera a senha.
            if (!tokenValido) {
                return false;
            }

            // Salva o novo hash da senha para essa conta.
            db.prepare(`
                UPDATE usuarios
                SET senha_hash = ?
                WHERE id = ?
            `).run(senhaHash, tokenValido.user_id);

            // Invalida todos os links de recuperação dessa conta.
            db.prepare(`
                DELETE FROM password_reset_tokens
                WHERE user_id = ?
            `).run(tokenValido.user_id);

            return true;
        })();

        // Informa se o token deixou de ser válido durante a operação.
        if (!redefinido) {
            return res.status(400).json({
                mensagem: "Este link é inválido ou expirou. Solicite outro."
            });
        }

        // Confirma que a troca foi concluída.
        res.json({
            mensagem: "Senha alterada. Agora você pode entrar com a nova senha."
        });
    } catch (erro) {
        // Mostra detalhes do erro no terminal do servidor.
        console.error("Erro ao redefinir senha:", erro.message);

        // Envia uma mensagem simples para a página.
        res.status(500).json({
            mensagem: "Não foi possível alterar a senha."
        });
    }
});

// Recebe e salva os dados de cadastro.
app.post("/cadastro", async function (req, res) {
    const nome = typeof req.body?.nome === "string"
        ? req.body.nome.trim()
        : "";

    const email = typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const senha = typeof req.body?.senha === "string"
        ? req.body.senha
        : "";

    if (!nome || !email || !senha) {
        return res.status(400).json({
            mensagem: "Preencha nome, e-mail e senha."
        });
    }

    if (nome.length < 2 || nome.length > 60) {
        return res.status(400).json({
            mensagem: "O nome precisa ter entre 2 e 60 caracteres."
        });
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailValido) {
        return res.status(400).json({
            mensagem: "Digite um e-mail válido, como nome@exemplo.com."
        });
    }

    if (senha.length < 8) {
        return res.status(400).json({
            mensagem: "A senha precisa ter pelo menos 8 caracteres."
        });
    }

    if (Buffer.byteLength(senha, "utf8") > 72) {
        return res.status(400).json({
            mensagem: "A senha não pode exceder 72 bytes."
        });
    }

    try {
        const senhaHash = await bcrypt.hash(senha, 12);

        const inserirUsuario = db.prepare(`
            INSERT INTO usuarios (nome, email, senha_hash)
            VALUES (?, ?, ?)
        `);

        inserirUsuario.run(nome, email, senhaHash);

        res.status(201).json({
            mensagem: `Cadastro de ${nome} salvo com sucesso!`
        });
    } catch (erro) {
        if (erro.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                mensagem: "Este e-mail já está cadastrado."
            });
        }

        console.error("Erro ao salvar cadastro:", erro.message);

        res.status(500).json({
            mensagem: "Não foi possível salvar o cadastro."
        });
    }
});

// Verifica o login.
app.post("/login", limitarLoginPorIp, async function (req, res) {
    const email = typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const senha = typeof req.body?.senha === "string"
        ? req.body.senha
        : "";

    if (!email || !senha) {
        return res.status(400).json({
            mensagem: "Informe o e-mail e a senha."
        });
    }

    const usuario = db.prepare(`
        SELECT id, nome, senha_hash
        FROM usuarios
        WHERE email = ?
    `).get(email);

    if (!usuario) {
        return res.status(401).json({
            mensagem: "E-mail ou senha incorretos."
        });
    }

    const senhaConfere = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaConfere) {
        return res.status(401).json({
            mensagem: "E-mail ou senha incorretos."
        });
    }

    // Cria um identificador de sessão novo ao autenticar, reduzindo risco de fixação.
    req.session.regenerate(function (erro) {
        if (erro) {
            console.error("Erro ao iniciar sessão:", erro.message);
            return res.status(500).json({
                mensagem: "Não foi possível iniciar a sessão. Tente novamente."
            });
        }

        req.session.userId = usuario.id;

        // Garante que a sessão foi salva antes de responder ao navegador.
        req.session.save(function (erroAoSalvar) {
            if (erroAoSalvar) {
                console.error("Erro ao salvar sessão:", erroAoSalvar.message);
                return res.status(500).json({
                    mensagem: "Não foi possível iniciar a sessão. Tente novamente."
                });
            }

            res.json({
                mensagem: `Login realizado. Olá, ${usuario.nome}!`
            });
        });
    });
});

// Informa à página se há alguém conectado.
app.get("/sessao", function (req, res) {
    if (!req.session.userId) {
        return res.json({ conectado: false });
    }

    const usuario = db.prepare(`
        SELECT id, nome
        FROM usuarios
        WHERE id = ?
    `).get(req.session.userId);

    if (usuario) {
        return res.json({
            conectado: true,
            nome: usuario.nome
        });
    }

    res.json({ conectado: false });
});

// Altera a senha de quem está conectado.
app.post("/alterar-senha", async function (req, res) {
    if (!req.session.userId) {
        return res.status(401).json({
            mensagem: "Entre na sua conta antes de trocar a senha."
        });
    }

    const senhaAtual = typeof req.body?.senhaAtual === "string"
        ? req.body.senhaAtual
        : "";

    const novaSenha = typeof req.body?.novaSenha === "string"
        ? req.body.novaSenha
        : "";

    const confirmarSenha = typeof req.body?.confirmarSenha === "string"
        ? req.body.confirmarSenha
        : "";

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
        return res.status(400).json({
            mensagem: "Preencha os três campos de senha."
        });
    }

    if (novaSenha !== confirmarSenha) {
        return res.status(400).json({
            mensagem: "As novas senhas não são iguais."
        });
    }

    if (novaSenha.length < 8) {
        return res.status(400).json({
            mensagem: "A nova senha precisa ter pelo menos 8 caracteres."
        });
    }

    if (Buffer.byteLength(novaSenha, "utf8") > 72) {
        return res.status(400).json({
            mensagem: "A nova senha não pode exceder 72 bytes."
        });
    }

    const usuario = db.prepare(`
        SELECT senha_hash
        FROM usuarios
        WHERE id = ?
    `).get(req.session.userId);

    if (!usuario) {
        return res.status(401).json({
            mensagem: "Não foi possível encontrar essa conta."
        });
    }

    const senhaAtualConfere = await bcrypt.compare(
        senhaAtual,
        usuario.senha_hash
    );

    if (!senhaAtualConfere) {
        return res.status(401).json({
            mensagem: "A senha atual está incorreta."
        });
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 12);

    db.prepare(`
        UPDATE usuarios
        SET senha_hash = ?
        WHERE id = ?
    `).run(novaSenhaHash, req.session.userId);

    res.json({
        mensagem: "Senha alterada com sucesso."
    });
});

// Encerra a sessão.
app.post("/sair", function (req, res) {
    req.session.destroy(function (erro) {
        if (erro) {
            return res.status(500).json({
                mensagem: "Não foi possível sair."
            });
        }

        res.clearCookie("meuSite.sid");

        res.json({
            mensagem: "Você saiu da sua conta."
        });
    });
});

// Abre o painel somente para uma conta conectada.
app.get("/painel", function (req, res) {
    if (!req.session.userId) {
        return res.redirect("/");
    }

    const usuario = db.prepare(`
        SELECT id
        FROM usuarios
        WHERE id = ?
    `).get(req.session.userId);

    if (!usuario) {
        return res.redirect("/");
    }

    res.sendFile(path.join(__dirname, "public", "painel.html"));
});

// Usa a porta definida pela hospedagem ou a porta 3000 no computador local.
const porta = process.env.PORT || 3000;
const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";

// Inicia o servidor.
app.listen(porta, host, function () {
    console.log(`Servidor aberto em ${host}:${porta}`);
});

const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Página inicial pública (Login e Cadastro)
exports.mostrarPaginaAcesso = (req, res) => {
  if (req.session.utilizador) {
    return res.redirect(
      req.session.utilizador.role === "Administrador" ? "/admin" : "/player",
    );
  }
  res.render("acesso", { erro: null });
};

// Cadastro público -> força sempre Utilizador e cria sessão
exports.cadastrar = async (req, res) => {
  try {
    const { nome, email, password } = req.body;

    const existe = await User.findOne({ email: email.toLowerCase().trim() });
    if (existe) {
      return res.render("acesso", { erro: "Este e-mail já está registado." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // No cadastro:
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
    const novoUtilizador = await User.create({
      nome,
      email,
      password: passwordHash,
      role: "Utilizador",
      trialEndsAt: new Date(Date.now() + seteDiasMs),
      statusSubscricao: "trial",
    });

    // No login (depois de validar email e password):
    const isAdmin = (user.role || "").toLowerCase() === "administrador";

    req.session.utilizador = {
      id: user._id,
      nome: user.nome,
      email: user.email,
      role: isAdmin ? "Administrador" : "Utilizador",
    };

    return res.redirect(isAdmin ? "/admin" : "/player");

    // Inicia sessão automaticamente após cadastro
    req.session.utilizador = {
      id: novoUser._id,
      nome: novoUser.nome,
      email: novoUser.email,
      role: novoUser.role,
    };

    return res.redirect("/player");
  } catch (erro) {
    console.error("Erro no cadastro:", erro);
    return res.render("acesso", {
      erro: "Erro ao criar conta. Tenta novamente.",
    });
  }
};

// Login -> valida credenciais e guarda na sessão
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.render("acesso", {
        erro: "E-mail ou palavra-passe inválidos.",
      });
    }

    const senhaValida = await bcrypt.compare(password, user.password);
    if (!senhaValida) {
      return res.render("acesso", {
        erro: "E-mail ou palavra-passe inválidos.",
      });
    }

    req.session.utilizador = {
      id: user._id,
      nome: user.nome,
      email: user.email,
      role: user.role,
    };

    return res.redirect(user.role === "Administrador" ? "/admin" : "/player");
  } catch (erro) {
    console.error("Erro no login:", erro);
    return res.render("acesso", { erro: "Erro ao iniciar sessão." });
  }
};

// Terminar sessão
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
};

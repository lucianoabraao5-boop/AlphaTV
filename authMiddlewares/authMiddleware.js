const User = require("../models/User");

function verificarSessao(req, res, next) {
  if (!req.session || !req.session.utilizador) {
    return res.redirect("/");
  }
  return next();
}

function verificarAdmin(req, res, next) {
  if (!req.session || !req.session.utilizador) {
    return res.redirect("/");
  }
  const role = (req.session.utilizador.role || "").toLowerCase();
  if (role !== "administrador") {
    return res.status(403).send("Acesso negado: apenas Administradores.");
  }
  return next();
}

async function verificarAcessoAtivo(req, res, next) {
  try {
    if (!req.session || !req.session.utilizador) {
      return res.redirect("/");
    }

    const role = (req.session.utilizador.role || "").toLowerCase();
    if (role === "administrador") {
      req.acessoInfo = { isAdmin: true };
      return next();
    }

    const user = await User.findById(req.session.utilizador.id);
    if (!user) {
      return res.redirect("/");
    }

    // Se a conta antiga não tinha trialEndsAt, define 7 dias a partir da criação
    if (!user.trialEndsAt) {
      const baseData = user.createdAt
        ? new Date(user.createdAt).getTime()
        : Date.now();
      user.trialEndsAt = new Date(baseData + 7 * 24 * 60 * 60 * 1000);
      await user.save();
    }

    const agora = new Date();
    const temSubscricaoPaga =
      user.statusSubscricao === "ativo" &&
      user.pagoAte &&
      new Date(user.pagoAte) > agora;

    const dentroDos7Dias = new Date(user.trialEndsAt) > agora;

    if (temSubscricaoPaga || dentroDos7Dias) {
      req.acessoInfo = {
        isAdmin: false,
        emTeste: !temSubscricaoPaga && dentroDos7Dias,
        trialEndsAt: user.trialEndsAt,
        diasRestantes: Math.max(
          1,
          Math.ceil(
            (new Date(user.trialEndsAt) - agora) / (24 * 60 * 60 * 1000),
          ),
        ),
      };
      return next();
    }

    if (user.statusSubscricao !== "expirado") {
      user.statusSubscricao = "expirado";
      await user.save();
    }

    return res.redirect("/subscricao");
  } catch (erro) {
    console.error("Erro ao verificar período de 7 dias:", erro);
    return res.redirect("/");
  }
}

module.exports = {
  verificarSessao,
  verificarAdmin,
  verificarAcessoAtivo,
};

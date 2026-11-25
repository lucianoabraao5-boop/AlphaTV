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

  if (req.session.utilizador.role !== "Administrador") {
    return res.status(403).send("Acesso negado: apenas Administradores.");
  }

  return next();
}

async function verificarAcessoAtivo(req, res, next) {
  try {
    if (!req.session || !req.session.utilizador) {
      return res.redirect("/");
    }

    // Administradores não ficam bloqueados por período de teste
    if (req.session.utilizador.role === "Administrador") {
      return next();
    }

    const user = await User.findById(req.session.utilizador.id);
    if (!user) {
      return res.redirect("/");
    }

    const agora = new Date();
    const temSubscricaoPaga =
      user.statusSubscricao === "ativo" &&
      user.pagoAte &&
      new Date(user.pagoAte) > agora;

    const dentroDos7Dias =
      user.trialEndsAt && new Date(user.trialEndsAt) > agora;

    if (temSubscricaoPaga || dentroDos7Dias) {
      req.acessoInfo = {
        emTeste: !temSubscricaoPaga && dentroDos7Dias,
        trialEndsAt: user.trialEndsAt,
        diasRestantes: user.trialEndsAt
          ? Math.max(
              0,
              Math.ceil(
                (new Date(user.trialEndsAt) - agora) / (24 * 60 * 60 * 1000),
              ),
            )
          : 0,
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

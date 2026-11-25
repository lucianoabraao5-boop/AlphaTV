const express = require("express");
const router = express.Router();
const User = require("../models/User");
const userController = require("../controllers/userController");
const {
  verificarSessao,
  verificarAdmin,
} = require("../authMiddlewares/authMiddleware");

// Rotas públicas (Cadastro e Login)
router.get("/", userController.mostrarPaginaAcesso);
router.get("/login", userController.mostrarPaginaAcesso);
router.post("/cadastrar", userController.cadastrar);
router.post("/login", userController.login);
router.get("/logout", userController.logout);

// Página de cobrança / subscrição após os 7 dias
router.get("/subscricao", verificarSessao, async (req, res) => {
  try {
    const userAtual = await User.findById(req.session.utilizador.id);
    res.render("subscricao", {
      utilizador: userAtual || req.session.utilizador,
    });
  } catch (erro) {
    console.error("Erro ao carregar /subscricao:", erro);
    res.render("subscricao", {
      utilizador: req.session.utilizador,
    });
  }
});

// Ativar subscrição de 30 dias (após os 7 dias gratuitos)
router.post("/subscricao/ativar", verificarSessao, async (req, res) => {
  try {
    const user = await User.findById(req.session.utilizador.id);
    if (!user) {
      return res.redirect("/");
    }

    const agora = new Date();
    const baseData =
      user.pagoAte && new Date(user.pagoAte) > agora
        ? new Date(user.pagoAte).getTime()
        : agora.getTime();

    user.statusSubscricao = "ativo";
    user.pagoAte = new Date(baseData + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    return res.redirect("/player");
  } catch (erro) {
    console.error("Erro ao ativar subscrição:", erro);
    return res.redirect("/subscricao");
  }
});

// Rota administrativa (apenas Administrador com sessão ativa)
router.get("/admin", verificarAdmin, async (req, res) => {
  try {
    const utilizadores = await User.find().sort({ _id: -1 });
    res.render("admin", {
      utilizadores,
      utilizador: req.session.utilizador,
    });
  } catch (erro) {
    console.error("Erro ao carregar /admin:", erro);
    res.status(500).send("Erro ao carregar o painel de administração.");
  }
});

// Renovar / adicionar dias de gratuidade ao utilizador
router.post(
  "/admin/utilizadores/:id/renovar-teste",
  verificarAdmin,
  async (req, res) => {
    try {
      const alvo = await User.findById(req.params.id);
      if (!alvo) {
        return res.redirect("/admin");
      }

      const diasRaw = parseInt(req.body.dias, 10);
      const diasGratuitos =
        Number.isFinite(diasRaw) && diasRaw > 0 ? diasRaw : 7;

      const agora = new Date();
      const trialAtual = alvo.trialEndsAt ? new Date(alvo.trialEndsAt) : null;
      const baseData =
        trialAtual && trialAtual > agora
          ? trialAtual.getTime()
          : agora.getTime();

      alvo.trialEndsAt = new Date(
        baseData + diasGratuitos * 24 * 60 * 60 * 1000,
      );
      if (alvo.statusSubscricao === "expirado") {
        alvo.statusSubscricao = "trial";
      }

      await alvo.save();
      return res.redirect("/admin");
    } catch (erro) {
      console.error("Erro ao renovar dias de gratuidade:", erro);
      return res.redirect("/admin");
    }
  },
);

// Alternar perfil (Utilizador <-> Administrador)
router.post(
  "/admin/utilizadores/:id/role",
  verificarAdmin,
  async (req, res) => {
    try {
      const alvo = await User.findById(req.params.id);
      if (alvo) {
        const atualAdmin = (alvo.role || "").toLowerCase() === "administrador";
        alvo.role = atualAdmin ? "Utilizador" : "Administrador";
        await alvo.save();
      }
      res.redirect("/admin");
    } catch (erro) {
      console.error("Erro ao alterar perfil:", erro);
      res.redirect("/admin");
    }
  },
);

// Apagar utilizador
router.post(
  "/admin/utilizadores/:id/apagar",
  verificarAdmin,
  async (req, res) => {
    try {
      if (req.params.id !== String(req.session.utilizador.id)) {
        await User.findByIdAndDelete(req.params.id);
      }
      res.redirect("/admin");
    } catch (erro) {
      console.error("Erro ao apagar utilizador:", erro);
      res.redirect("/admin");
    }
  },
);

module.exports = router;

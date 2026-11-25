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
router.post("/cadastrar", userController.cadastrar);
router.post("/login", userController.login);
router.get("/logout", userController.logout);
router.get("/login", userController.mostrarPaginaAcesso);

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
const {
  verificarSessao,
  verificarAdmin,
  verificarAcessoAtivo,
} = require("../authMiddlewares/authMiddleware");

// Página de cobrança após os 7 dias
router.get("/subscricao", verificarSessao, (req, res) => {
  res.render("subscricao", { utilizador: req.session.utilizador });
});
// Alternar perfil (Utilizador <-> Administrador)
router.post(
  "/admin/utilizadores/:id/role",
  verificarAdmin,
  async (req, res) => {
    try {
      const alvo = await User.findById(req.params.id);
      if (alvo) {
        alvo.role =
          alvo.role === "Administrador" ? "Utilizador" : "Administrador";
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
      // Evita que o administrador apague a própria conta logada
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

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

// Rota administrativa (apenas Administrador com sessão ativa)
router.get("/admin", verificarAdmin, async (req, res) => {
  try {
    const utilizadores = await User.find().sort({ criadoEm: -1 });
    // Ajusta "index" para o nome exato do ficheiro .ejs do teu painel atual
    res.render("index", {
      utilizadores,
      utilizador: req.session.utilizador,
    });
  } catch (erro) {
    console.error("Erro ao carregar /admin:", erro);
    res.status(500).send("Erro ao carregar o painel de administração.");
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const {
  verificarSessao,
  verificarAdmin,
} = require("../middlewares/authMiddleware");

// Rotas públicas
router.get("/", userController.mostrarPaginaAcesso);
router.post("/cadastrar", userController.cadastrar);
router.post("/login", userController.login);
router.get("/logout", userController.logout);

// Rota administrativa protegida (apenas Administrador)
router.get("/admin", verificarAdmin, async (req, res) => {
  // Aqui renderizas a tua view de gestão (ex: res.render("index", { utilizadores }))
});

module.exports = router;

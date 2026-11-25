const express = require("express");
const router = express.Router();
const { verificarSessao } = require("../middlewares/authMiddleware");

router.get("/player", verificarSessao, async (req, res) => {
  // Busca os canais/vídeos da base de dados e renderiza a view interna do utilizador
  res.render("player", { utilizador: req.session.utilizador });
});

module.exports = router;

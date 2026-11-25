const express = require("express");
const router = express.Router();
const { verificarSessao } = require("../authMiddlewares/authMiddleware");

router.get("/player", verificarSessao, verificarAcessoAtivo, (req, res) => {
  res.render("player", {
    utilizador: req.session.utilizador,
    acessoInfo: req.acessoInfo || null,
  });
});

module.exports = router;

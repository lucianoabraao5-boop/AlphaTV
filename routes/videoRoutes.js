const express = require("express");
const router = express.Router();
const { verificarSessao } = require("../middlewares/authMiddleware");

router.get("/player", verificarSessao, (req, res) => {
  res.render("player", { utilizador: req.session.utilizador });
});

module.exports = router;

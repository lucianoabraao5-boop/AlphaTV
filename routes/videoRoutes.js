const express = require("express");
const router = express.Router();
const User = require("../models/User");
const {
  verificarSessao,
  verificarAcessoAtivo,
} = require("../authMiddlewares/authMiddleware");

router.get(
  "/player",
  verificarSessao,
  verificarAcessoAtivo,
  async (req, res) => {
    let historicoCompras = [];
    let userDoc = null;

    try {
      userDoc = await User.findById(req.session.utilizador.id);
      if (userDoc && Array.isArray(userDoc.historicoCompras)) {
        historicoCompras = [...userDoc.historicoCompras].reverse();
      }
    } catch (erro) {
      console.error("Erro ao buscar histórico de compras em /player:", erro);
    }

    return res.render("player", {
      utilizador: userDoc || req.session.utilizador,
      acessoInfo: req.acessoInfo || null,
      historicoCompras,
    });
  },
);

module.exports = router;

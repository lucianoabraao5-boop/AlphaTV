const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// Rota principal (GET) -> Lista os dados
router.get("/", userController.listarUtilizadores);

// Rota de envio do formulário (POST) -> Cria novo registo
router.post("/criar", userController.criarUtilizador);

// Rota para apagar (POST com parâmetro dinâmico :id)
router.post("/apagar/:id", userController.apagarUtilizador);

module.exports = router;

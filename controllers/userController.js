const User = require("../models/User");

// 1. READ - Listar todos os utilizadores e renderizar a página
exports.listarUtilizadores = async (req, res) => {
  try {
    // Busca todos os registos ordenados do mais recente para o mais antigo
    const utilizadores = await User.find().sort({ criadoEm: -1 });
    res.render("index", { utilizadores, erro: null });
  } catch (erro) {
    res.status(500).send("Erro ao carregar dados: " + erro.message);
  }
};

// 2. CREATE - Guardar um novo utilizador
exports.criarUtilizador = async (req, res) => {
  try {
    const { nome, cargo } = req.body;
    await User.create({ nome, cargo });
    res.redirect("/"); // Volta para a página inicial atualizada
  } catch (erro) {
    const utilizadores = await User.find().sort({ criadoEm: -1 });
    res.render("index", {
      utilizadores,
      erro: "Erro ao guardar: verifica se o nome tem pelo menos 3 letras.",
    });
  }
};

// 3. DELETE - Apagar um utilizador pelo ID
exports.apagarUtilizador = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect("/");
  } catch (erro) {
    res.status(500).send("Erro ao apagar registo.");
  }
};

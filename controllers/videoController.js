const Video = require("../models/Video");

// 1. Renderizar Catálogo Público (Apenas ver e assistir)
exports.renderCatalogo = async (req, res) => {
  try {
    const { categoria } = req.query;
    let filtro = {};

    if (categoria && categoria !== "Todas") {
      filtro.categoria = categoria;
    }

    const videos = await Video.find(filtro).sort({ adicionadoEm: -1 });
    const categoriasDisponiveis = await Video.distinct("categoria");

    res.render("catalogo", {
      videos,
      categoriasDisponiveis,
      categoriaSelecionada: categoria || "Todas",
    });
  } catch (erro) {
    res.status(500).send("Erro ao carregar o catálogo.");
  }
};

// 2. Renderizar Painel Administrativo (Gestão completa)
exports.renderAdmin = async (req, res) => {
  try {
    const videos = await Video.find().sort({ adicionadoEm: -1 });
    const categoriasDisponiveis = await Video.distinct("categoria");
    res.render("admin", { videos, categoriasDisponiveis });
  } catch (erro) {
    res.status(500).send("Erro ao carregar o painel de administração.");
  }
};

// 3. Adicionar novo vídeo com dados de EPG
exports.adicionarVideoWeb = async (req, res) => {
  try {
    const { titulo, categoria, urlStream, programaAtual, horario } = req.body;
    await Video.create({
      titulo,
      categoria,
      urlStream,
      programaAtual: programaAtual || "Emissão Regular",
      horario: horario || "24h",
    });
    res.redirect("/admin?pin=1234");
  } catch (erro) {
    res.status(400).send("Erro ao criar vídeo: " + erro.message);
  }
};

// 4. Apagar vídeo
exports.apagarVideo = async (req, res) => {
  try {
    const { id } = req.params;
    await Video.findByIdAndDelete(id);
    res.redirect("/admin?pin=1234");
  } catch (erro) {
    res.status(400).send("Erro ao apagar vídeo: " + erro.message);
  }
};

// 5. Renderizar formulário de edição
exports.renderEditarVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);
    if (!video) return res.status(404).send("Vídeo não encontrado.");
    res.render("editarVideo", { video });
  } catch (erro) {
    res.status(500).send("Erro ao carregar o vídeo para edição.");
  }
};

// 6. Atualizar vídeo na base de dados com EPG
exports.atualizarVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, categoria, urlStream, programaAtual, horario } = req.body;
    await Video.findByIdAndUpdate(id, {
      titulo,
      categoria,
      urlStream,
      programaAtual,
      horario,
    });
    res.redirect("/admin?pin=1234");
  } catch (erro) {
    res.status(400).send("Erro ao atualizar vídeo: " + erro.message);
  }
};

// 7. API JSON
exports.obterVideosJSON = async (req, res) => {
  try {
    const videos = await Video.find().sort({ adicionadoEm: -1 });
    res.json({ sucesso: true, total: videos.length, dados: videos });
  } catch (erro) {
    res
      .status(500)
      .json({ sucesso: false, mensagem: "Erro ao carregar vídeos." });
  }
};

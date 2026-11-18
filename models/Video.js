const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  categoria: { type: String, required: true },
  urlStream: { type: String, required: true },
  programaAtual: { type: String, default: "Emissão Regular" }, // Novo campo EPG
  horario: { type: String, default: "24h" }, // Novo campo EPG
  adicionadoEm: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Video", videoSchema);

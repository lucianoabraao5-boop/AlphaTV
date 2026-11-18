const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, "O nome é obrigatório."],
    trim: true, // Remove espaços vazios antes e depois
    minlength: [3, "O nome deve ter pelo menos 3 caracteres."],
  },
  cargo: {
    type: String,
    default: "Utilizador",
  },
  criadoEm: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["Utilizador", "Administrador"],
    default: "Utilizador",
  },
  criadoEm: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);

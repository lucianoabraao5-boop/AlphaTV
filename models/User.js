const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["Utilizador", "Administrador"],
      default: "Utilizador",
    },
    // Data de fim dos 7 dias gratuitos (definida no cadastro)
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    // Estado da subscrição após os 7 dias
    statusSubscricao: {
      type: String,
      enum: ["trial", "ativo", "expirado"],
      default: "trial",
    },
    pagoAte: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);

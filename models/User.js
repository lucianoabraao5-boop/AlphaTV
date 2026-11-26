const mongoose = require("mongoose");

const compraHistoricoSchema = new mongoose.Schema(
  {
    codigoRecibo: { type: String, required: true },
    planoDias: { type: Number, enum: [30, 60, 90, 180], required: true },
    nomePlano: { type: String, required: true },
    valorBase: { type: Number, required: true },
    desconto: { type: Number, default: 0 },
    valorFinal: { type: Number, required: true },
    moeda: { type: String, default: "EUR" },
    metodoPagamento: { type: String, required: true },
    referenciaPagamento: { type: String, required: true },
    codigoPromocionalUsado: { type: String, default: null },
    status: {
      type: String,
      enum: ["pendente", "confirmado"],
      default: "confirmado",
    },
    dataPagamento: { type: Date, default: Date.now },
    validoAte: { type: Date, required: true },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: { type: String, default: "Utilizador" },

    // Recuperação de acesso por mensagem de telefone segundo o país
    pais: { type: String, enum: ["PT", "BR", "OUTROS"], default: "PT" },
    telefone: { type: String, default: "" },
    codigoRecuperacao: { type: String, default: null },
    codigoRecuperacaoExpira: { type: Date, default: null },

    // Período gratuito de 7 dias e subscrição confirmada
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    statusSubscricao: {
      type: String,
      enum: ["trial", "ativo", "expirado"],
      default: "trial",
    },
    pagoAte: { type: Date, default: null },

    // Código promocional de convite (gerado pelo utilizador apenas quando liberado pelo Admin)
    codigoPromocionalLiberado: { type: Boolean, default: false },
    codigoPromocional: { type: String, default: null },
    convitesRealizados: { type: Number, default: 0 },
    convidadoPorCodigo: { type: String, default: null },

    // Histórico de compras no perfil do utilizador
    historicoCompras: { type: [compraHistoricoSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);

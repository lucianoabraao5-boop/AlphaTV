const mongoose = require("mongoose");

const compraSchema = new mongoose.Schema(
  {
    utilizadorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    nomeUtilizador: { type: String, required: true },
    emailUtilizador: { type: String, required: true },
    codigoRecibo: { type: String, required: true, unique: true },
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
      default: "pendente",
    },
    criadoEm: { type: Date, default: Date.now },
    confirmadoEm: { type: Date, default: null },
    validoAte: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Compra", compraSchema);

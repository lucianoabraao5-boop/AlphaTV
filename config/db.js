const mongoose = require("mongoose");

const conectarDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Ligado ao MongoDB Atlas com sucesso!");
  } catch (erro) {
    console.error("❌ Erro crítico ao ligar à base de dados:", erro.message);
    process.exit(1); // Encerra a aplicação se a base de dados falhar
  }
};

module.exports = conectarDB;

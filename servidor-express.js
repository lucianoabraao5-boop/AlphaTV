require("dotenv").config(); // Carrega as variáveis do .env
const express = require("express");
const conectarDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const videoRoutes = require("./routes/videoRoutes"); // <--- Verifica se esta linha existe

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});

conectarDB();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// As Rotas
app.use("/", userRoutes);
app.use("/", videoRoutes); // <--- Verifica se esta linha existe

app.listen(PORT, () => {
  console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
});

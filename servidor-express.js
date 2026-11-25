require("dotenv").config();

const express = require("express");
const conectarDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const videoRoutes = require("./routes/videoRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

conectarDB();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Rotas
app.use("/", userRoutes);
app.use("/", videoRoutes);

app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});

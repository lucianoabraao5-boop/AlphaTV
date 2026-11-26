require("dotenv").config();

const express = require("express");
const session = require("express-session");
const conectarDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const videoRoutes = require("./routes/videoRoutes");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

conectarDB();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.use(cookieParser());

// Configuração da Sessão
app.use(
  session({
    secret: process.env.SESSION_SECRET || "alphatv_chave_secreta_2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 horas
    },
  }),
);

// Torna o utilizador logado disponível em todas as views EJS
app.use((req, res, next) => {
  res.locals.utilizador = req.session.utilizador || null;
  next();
});

// Rotas
app.use("/", userRoutes);
app.use("/", videoRoutes);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
const path = require("path");

app.get("/js/qrcode.min.js", (req, res) => {
  res.type("application/javascript");
  res.sendFile(
    path.join(__dirname, "node_modules", "qrcode", "build", "qrcode.min.js"),
  );
});

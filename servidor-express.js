require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const conectarDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const videoRoutes = require("./routes/videoRoutes");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

conectarDB();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.use(cookieParser());

const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "alphatv_chave_secreta_2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    },
  }),
);

app.use((req, res, next) => {
  res.locals.utilizador = req.session.utilizador || null;
  next();
});

// === CHAT DIRETO EM TEMPO REAL (CLIENTE <-> ADMIN) ===
const mensagensSuporte = [];
let configContatoAdmin = {
  whatsapp: "",
  telegram: "",
};

app.get("/api/suporte/mensagens", (req, res) => {
  const sessUser = req.session?.utilizador;
  if (!sessUser || !sessUser.id) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const isAdmin = String(sessUser.role || "").toLowerCase() === "administrador";
  const clienteFiltro = String(req.query.clienteEmail || "").trim().toLowerCase();

  const filtradas = isAdmin
    ? clienteFiltro
      ? mensagensSuporte.filter((m) => m.clienteEmail === clienteFiltro)
      : mensagensSuporte
    : mensagensSuporte.filter((m) => m.clienteEmail === String(sessUser.email || "").toLowerCase());

  return res.json({
    mensagens: filtradas,
    contatoAdmin: configContatoAdmin,
  });
});

app.post("/api/suporte/mensagens", (req, res) => {
  const sessUser = req.session?.utilizador;
  if (!sessUser || !sessUser.id) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const texto = String(req.body.texto || "").trim();
  if (!texto) {
    return res.status(400).json({ erro: "Mensagem vazia" });
  }

  const isAdmin = String(sessUser.role || "").toLowerCase() === "administrador";
  const clienteEmail = isAdmin
    ? String(req.body.clienteEmail || "geral@alphatv").trim().toLowerCase()
    : String(sessUser.email || "cliente@alphatv").trim().toLowerCase();

  const clienteNome = isAdmin
    ? String(req.body.clienteNome || clienteEmail).trim()
    : String(sessUser.nome || sessUser.email || "Cliente").trim();

  const novaMsg = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    remetente: isAdmin ? "admin" : "cliente",
    autorNome: isAdmin ? (sessUser.nome || "Admin") : clienteNome,
    clienteEmail,
    clienteNome,
    texto,
    criadoEm: new Date().toISOString(),
  };

  mensagensSuporte.push(novaMsg);
  if (mensagensSuporte.length > 300) {
    mensagensSuporte.shift();
  }

  return res.status(201).json({ mensagem: novaMsg });
});

app.post("/api/admin/contato-suporte", (req, res) => {
  const sessUser = req.session?.utilizador;
  if (!sessUser || String(sessUser.role || "").toLowerCase() !== "administrador") {
    return res.status(403).json({ erro: "Apenas administrador" });
  }

  configContatoAdmin = {
    whatsapp: String(req.body.whatsapp || "").trim(),
    telegram: String(req.body.telegram || "").trim(),
  };

  return res.json({ ok: true, contatoAdmin: configContatoAdmin });
});

app.use("/", userRoutes);
app.use("/", videoRoutes);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
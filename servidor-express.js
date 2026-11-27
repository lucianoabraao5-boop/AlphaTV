require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const conectarDB = require("./config/db");
const User = require("./models/User");
const Compra = require("./models/Compra");
const userRoutes = require("./routes/userRoutes");
const videoRoutes = require("./routes/videoRoutes");
const {
  PLANOS_SUBSCRICAO,
  METODOS_PAGAMENTO,
  gerarCodigoPromocional,
  gerarReferenciaPagamento,
} = require("./services/alphaService");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;
const INATIVIDADE_ADMIN_MS = 30 * 60 * 1000; // 30 minutos

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

// Estado em memória para chat, preços, entidade/referência e contactos do admin
const mensagensSuporte = [];
let configAdmin = {
  whatsapp: "",
  telegram: "",
  entidade: "21478",
  referenciaBase: "900",
  precosPlanos: {
    7: 3.99,
    30: 9.99,
    90: 24.99,
    365: 79.99,
  },
};

function isAdminSessao(req) {
  const u = req.session && req.session.utilizador;
  return Boolean(u && u.id && String(u.role || "").toLowerCase() === "administrador");
}

function exigirAdminAtivo(req, res, next) {
  if (!isAdminSessao(req)) {
    return res.redirect("/");
  }

  const agora = Date.now();
  const ultimaAtividade = Number(req.session.adminUltimaAtividade || agora);

  if (agora - ultimaAtividade > INATIVIDADE_ADMIN_MS) {
    return req.session.destroy(() => {
      return res.redirect("/?expirado=1");
    });
  }

  req.session.adminUltimaAtividade = agora;
  return next();
}

app.use((req, res, next) => {
  if (isAdminSessao(req)) {
    const agora = Date.now();
    const ultimaAtividade = Number(req.session.adminUltimaAtividade || agora);
    if (agora - ultimaAtividade > INATIVIDADE_ADMIN_MS) {
      return req.session.destroy(() => {
        res.locals.utilizador = null;
        return res.redirect("/?expirado=1");
      });
    }
    req.session.adminUltimaAtividade = agora;
  }

  res.locals.utilizador = req.session.utilizador || null;
  res.locals.configAdmin = configAdmin;
  next();
});

// === ROTAS DO ADMIN ===
app.get("/admin", exigirAdminAtivo, async (req, res) => {
  try {
    const compras = await Compra.find({}).sort({ criadoEm: -1 }).lean();
    const utilizadores = await User.find({}).sort({ nome: 1 }).lean();

    return res.render("admin", {
      utilizador: req.session.utilizador,
      compras,
      utilizadores,
      configAdmin,
      planos: Object.values(PLANOS_SUBSCRICAO),
    });
  } catch (erro) {
    console.error("Erro ao carregar /admin:", erro);
    return res.status(500).send("Erro ao carregar painel administrativo.");
  }
});

// Disponibilizar código promocional de 4 dígitos ao utilizador
app.post("/admin/utilizador/:id/codigo-promocional", exigirAdminAtivo, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect("/admin");

    if (!user.codigoPromocional) {
      user.codigoPromocional = gerarCodigoPromocional();
    }
    user.codigoPromocionalLiberado = true;
    await user.save();

    return res.redirect("/admin");
  } catch (erro) {
    console.error("Erro ao disponibilizar código promocional:", erro);
    return res.redirect("/admin");
  }
});

// Renovar dias de acesso do utilizador
app.post("/admin/utilizador/:id/dias", exigirAdminAtivo, async (req, res) => {
  try {
    const dias = Math.max(1, Math.min(3650, parseInt(req.body.dias, 10) || 7));
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect("/admin");

    const agora = new Date();
    const baseMs =
      user.pagoAte && new Date(user.pagoAte).getTime() > agora.getTime()
        ? new Date(user.pagoAte).getTime()
        : agora.getTime();

    user.pagoAte = new Date(baseMs + dias * 24 * 60 * 60 * 1000);
    user.statusSubscricao = "ativo";
    await user.save();

    return res.redirect("/admin");
  } catch (erro) {
    console.error("Erro ao renovar dias:", erro);
    return res.redirect("/admin");
  }
});

// Confirmar pagamento pelo admin e liberar recibo
app.post("/admin/confirmar-pagamento/:codigoRecibo", exigirAdminAtivo, async (req, res) => {
  try {
    const { codigoRecibo } = req.params;
    const compra = await Compra.findOne({ codigoRecibo });
    if (!compra) return res.status(404).send("Compra não encontrada.");

    const user = await User.findById(compra.utilizadorId);
    if (!user) return res.status(404).send("Utilizador não encontrado.");

    const agora = new Date();
    const baseMs =
      user.statusSubscricao === "ativo" &&
      user.pagoAte &&
      new Date(user.pagoAte).getTime() > agora.getTime()
        ? new Date(user.pagoAte).getTime()
        : agora.getTime();
    const validoAte = new Date(baseMs + Number(compra.planoDias || 30) * 24 * 60 * 60 * 1000);

    compra.status = "confirmado";
    compra.confirmadoPorAdmin = true;
    compra.confirmadoPorAdminId = req.session.utilizador.id;
    compra.confirmadoEm = agora;
    compra.validoAte = validoAte;
    await compra.save();

    user.statusSubscricao = "ativo";
    user.pagoAte = validoAte;

    const registoRecibo = {
      codigoRecibo: compra.codigoRecibo,
      planoDias: compra.planoDias,
      nomePlano: compra.nomePlano,
      valorBase: compra.valorBase,
      desconto: compra.desconto,
      valorFinal: compra.valorFinal,
      moeda: compra.moeda || "EUR",
      metodoPagamento: compra.metodoPagamento,
      referenciaPagamento: compra.referenciaPagamento,
      entidadePagamento: compra.entidadePagamento || configAdmin.entidade,
      codigoPromocionalUsado: compra.codigoPromocionalUsado,
      status: "confirmado",
      confirmadoPorAdmin: true,
      dataPagamento: agora,
      validoAte,
    };

    const idx = (user.historicoCompras || []).findIndex((c) => c.codigoRecibo === compra.codigoRecibo);
    if (idx >= 0) {
      user.historicoCompras[idx] = registoRecibo;
    } else {
      user.historicoCompras.push(registoRecibo);
    }
    await user.save();

    return res.redirect("/admin");
  } catch (erro) {
    console.error("Erro ao confirmar pagamento:", erro);
    return res.redirect("/admin");
  }
});

// Alterar preços dos planos pelo admin
app.post("/admin/precos-planos", exigirAdminAtivo, (req, res) => {
  const diasChaves = [7, 30, 90, 365];
  diasChaves.forEach((d) => {
    const raw = req.body[`plano_${d}`];
    const valor = Number(String(raw || "").replace(",", "."));
    if (!Number.isNaN(valor) && valor > 0) {
      configAdmin.precosPlanos[d] = Number(valor.toFixed(2));
      if (PLANOS_SUBSCRICAO[d]) {
        PLANOS_SUBSCRICAO[d].valorBase = Number(valor.toFixed(2));
      }
    }
  });

  if (req.body.entidade) {
    configAdmin.entidade = String(req.body.entidade).trim();
  }
  if (req.body.referenciaBase) {
    configAdmin.referenciaBase = String(req.body.referenciaBase).trim();
  }

  return res.redirect("/admin");
});

// Contacto do admin para WhatsApp / Telegram / Entidade / Referência
app.post("/api/admin/contato-suporte", exigirAdminAtivo, (req, res) => {
  configAdmin.whatsapp = String(req.body.whatsapp || "").trim();
  configAdmin.telegram = String(req.body.telegram || "").trim();
  if (req.body.entidade) {
    configAdmin.entidade = String(req.body.entidade).trim();
  }
  if (req.body.referenciaBase) {
    configAdmin.referenciaBase = String(req.body.referenciaBase).trim();
  }

  return res.json({ ok: true, configAdmin });
});

// === CHAT DIRETO EM TEMPO REAL (CLIENTE <-> ADMIN) ===
app.get("/api/suporte/mensagens", (req, res) => {
  const sessUser = req.session?.utilizador;
  if (!sessUser || !sessUser.id) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const isAdmin = String(sessUser.role || "").toLowerCase() === "administrador";
  const clienteEmailQuery = String(req.query.clienteEmail || "").trim().toLowerCase();

  let filtradas = mensagensSuporte;
  if (!isAdmin) {
    const meuEmail = String(sessUser.email || "").trim().toLowerCase();
    filtradas = mensagensSuporte.filter(
      (m) => !m.clienteEmail || m.clienteEmail === meuEmail || m.clienteEmail === "geral@alphatv",
    );
  } else if (clienteEmailQuery) {
    filtradas = mensagensSuporte.filter(
      (m) => m.clienteEmail === clienteEmailQuery || m.clienteEmail === "geral@alphatv",
    );
  }

  return res.json({
    mensagens: filtradas,
    contatoAdmin: {
      whatsapp: configAdmin.whatsapp,
      telegram: configAdmin.telegram,
      entidade: configAdmin.entidade,
      referenciaBase: configAdmin.referenciaBase,
    },
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

app.use("/", userRoutes);
app.use("/", videoRoutes);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
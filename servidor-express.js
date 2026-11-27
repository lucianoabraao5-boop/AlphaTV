require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const conectarDB = require("./config/db");
const User = require("./models/User");
const Compra = require("./models/Compra");
const userRoutes = require("./routes/userRoutes");
const videoRoutes = require("./routes/videoRoutes");
const {
  METODOS_PAGAMENTO_PADRAO,
  MOEDAS_WISE,
  obterListaPlanos,
  gerarCodigoPromocional,
} = require("./services/alphaService");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;
const INATIVIDADE_ADMIN_MS = 30 * 60 * 1000;

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

// === PERSISTÊNCIA EM DISCO (MANTÉM MESMO SE SAIR DA PÁGINA OU CAIR A CONEXÃO) ===
const DATA_DIR = path.join(__dirname, "data");
const CONFIG_FILE = path.join(DATA_DIR, "admin-config.json");

const configPadrao = {
  whatsapp: "",
  telegram: "",
  entidade: "21478",
  referenciaBase: "900",
  precosPlanos: {
    30: 9.99,
    60: 17.99,
    90: 24.99,
    180: 44.99,
    270: 64.99,
    360: 79.99,
  },
  metodosPagamento: METODOS_PAGAMENTO_PADRAO,
};

function carregarConfigDisco() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(CONFIG_FILE)) {
      const bruto = fs.readFileSync(CONFIG_FILE, "utf8");
      const parsed = JSON.parse(bruto);
      return {
        ...configPadrao,
        ...parsed,
        precosPlanos: {
          ...configPadrao.precosPlanos,
          ...(parsed.precosPlanos || {}),
        },
        metodosPagamento:
          Array.isArray(parsed.metodosPagamento) && parsed.metodosPagamento.length > 0
            ? parsed.metodosPagamento
            : configPadrao.metodosPagamento,
      };
    }
  } catch (e) {
    console.error("Erro ao carregar config em disco:", e);
  }
  return JSON.parse(JSON.stringify(configPadrao));
}

const configAdmin = carregarConfigDisco();
app.locals.configAdmin = configAdmin;

function salvarConfigDisco() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configAdmin, null, 2), "utf8");
  } catch (e) {
    console.error("Erro ao guardar config em disco:", e);
  }
}

salvarConfigDisco();

const mensagensSuporte = [];

let cacheCambioOntem = {
  dataReferencia: null,
  taxas: {
    EUR: 1,
    USD: 1.08,
    BRL: 6.15,
    GBP: 0.84,
    CHF: 0.94,
    CAD: 1.49,
    AUD: 1.65,
    JPY: 164.5,
    SEK: 11.45,
    NOK: 11.75,
    PLN: 4.32,
    AOA: 985.0,
    MZN: 69.0,
    CVE: 110.265,
  },
};

function obterDataOntemISO() {
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return ontem.toISOString().slice(0, 10);
}

async function obterTaxasDiaAnterior() {
  const dataOntem = obterDataOntemISO();
  if (cacheCambioOntem.dataReferencia === dataOntem) {
    return cacheCambioOntem;
  }

  try {
    const resp = await fetch(`https://api.frankfurter.app/${dataOntem}?from=EUR`);
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.rates) {
        cacheCambioOntem = {
          dataReferencia: json.date || dataOntem,
          taxas: {
            ...cacheCambioOntem.taxas,
            ...json.rates,
            EUR: 1,
          },
        };
      }
    }
  } catch (e) {}

  return cacheCambioOntem;
}

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

app.get("/api/cambio-ontem", async (req, res) => {
  const dados = await obterTaxasDiaAnterior();
  return res.json({
    dataReferencia: dados.dataReferencia || obterDataOntemISO(),
    base: "EUR",
    moedas: MOEDAS_WISE,
    taxas: dados.taxas,
  });
});

app.get("/admin", exigirAdminAtivo, async (req, res) => {
  try {
    const compras = await Compra.find({}).sort({ criadoEm: -1 }).lean();
    const utilizadores = await User.find({}).sort({ nome: 1 }).lean();

    return res.render("admin", {
      utilizador: req.session.utilizador,
      compras,
      utilizadores,
      configAdmin,
      planos: obterListaPlanos(configAdmin.precosPlanos),
    });
  } catch (erro) {
    console.error("Erro ao carregar /admin:", erro);
    return res.status(500).send("Erro ao carregar painel administrativo.");
  }
});

// Guardar preços dos planos (30, 60, 90, 180, 270, 360 dias) + Entidade + Prefixo Referência
app.post("/admin/precos-planos", exigirAdminAtivo, (req, res) => {
  [30, 60, 90, 180, 270, 360].forEach((d) => {
    const raw = req.body[`plano_${d}`];
    const valor = Number(String(raw || "").replace(",", "."));
    if (!Number.isNaN(valor) && valor > 0) {
      configAdmin.precosPlanos[d] = Number(valor.toFixed(2));
    }
  });

  if (req.body.entidade && String(req.body.entidade).trim() !== "") {
    configAdmin.entidade = String(req.body.entidade).trim();
  }
  if (req.body.referenciaBase && String(req.body.referenciaBase).trim() !== "") {
    configAdmin.referenciaBase = String(req.body.referenciaBase).trim();
  }

  salvarConfigDisco();
  return res.redirect("/admin");
});

// Guardar / Cadastrar métodos de pagamento (Chave PIX, Número MB WAY, IBAN, Entidade)
app.post("/admin/metodos-pagamento", exigirAdminAtivo, (req, res) => {
  const acao = String(req.body.acao || "salvar");

  if (acao === "novo") {
    const nomeNovo = String(req.body.novoNome || "").trim();
    const tipoNovo = String(req.body.novoTipo || "transferencia").trim().toLowerCase();
    const entidadeNova = String(req.body.novaEntidade || configAdmin.entidade || "21478").trim();
    const chavePixNova = String(req.body.novaChavePix || "").trim();
    const mbwayNovo = String(req.body.novoMbway || "").trim();
    const ibanNovo = String(req.body.novoIban || "").trim();
    const detalheNovo = String(req.body.novoDetalhe || "").trim();

    if (nomeNovo) {
      const slug = nomeNovo
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_");

      configAdmin.metodosPagamento.push({
        id: `${slug}_${Date.now().toString().slice(-4)}`,
        tipo: tipoNovo,
        nome: nomeNovo,
        entidade: entidadeNova,
        chavePix: chavePixNova,
        numeroMbway: mbwayNovo,
        iban: ibanNovo,
        detalhe: detalheNovo || "Método configurado pelo administrador",
        ativo: true,
      });
      salvarConfigDisco();
    }
    return res.redirect("/admin");
  }

  if (acao.startsWith("remover_")) {
    const idRemover = acao.replace("remover_", "");
    configAdmin.metodosPagamento = configAdmin.metodosPagamento.filter((m) => m.id !== idRemover);
    salvarConfigDisco();
    return res.redirect("/admin");
  }

  configAdmin.metodosPagamento = configAdmin.metodosPagamento.map((m) => {
    const nome = String(req.body[`nome_${m.id}`] || m.nome).trim();
    const tipo = String(req.body[`tipo_${m.id}`] || m.tipo || "transferencia").trim().toLowerCase();
    const entidade = String(req.body[`entidade_${m.id}`] || configAdmin.entidade || m.entidade).trim();
    const chavePix = String(req.body[`chavePix_${m.id}`] ?? m.chavePix ?? "").trim();
    const numeroMbway = String(req.body[`mbway_${m.id}`] ?? m.numeroMbway ?? "").trim();
    const iban = String(req.body[`iban_${m.id}`] ?? m.iban ?? "").trim();
    const detalhe = String(req.body[`detalhe_${m.id}`] ?? m.detalhe ?? "").trim();
    const ativo = req.body[`ativo_${m.id}`] === "on";

    return {
      ...m,
      nome,
      tipo,
      entidade,
      chavePix,
      numeroMbway,
      iban,
      detalhe,
      ativo,
    };
  });

  salvarConfigDisco();
  return res.redirect("/admin");
});

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
    console.error("Erro ao disponibilizar código:", erro);
    return res.redirect("/admin");
  }
});

app.post("/admin/utilizador/:id/dias", exigirAdminAtivo, async (req, res) => {
  try {
    const dias = Math.max(1, Math.min(3650, parseInt(req.body.dias, 10) || 30));
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

// Confirmar recebimento pelo admin e mudar estado de Pendente para Confirmado
app.post("/admin/confirmar-pagamento/:codigoRecibo", exigirAdminAtivo, async (req, res) => {
  try {
    const codigo = decodeURIComponent(String(req.params.codigoRecibo || "")).trim();
    const compra = await Compra.findOne({ codigoRecibo: codigo });
    if (!compra) return res.redirect("/admin");

    const user = await User.findById(compra.utilizadorId);
    if (!user) return res.redirect("/admin");

    const agora = new Date();
    const baseMs =
      user.statusSubscricao === "ativo" &&
      user.pagoAte &&
      new Date(user.pagoAte).getTime() > agora.getTime()
        ? new Date(user.pagoAte).getTime()
        : agora.getTime();
    const validoAte = new Date(baseMs + Number(compra.planoDias || 30) * 24 * 60 * 60 * 1000);

    await Compra.findOneAndUpdate(
      { _id: compra._id },
      {
        $set: {
          status: "confirmado",
          confirmadoPorAdmin: true,
          confirmadoPorAdminId: req.session.utilizador.id,
          confirmadoEm: agora,
          validoAte,
        },
      },
      { new: true },
    );

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
      valorConvertido: compra.valorConvertido || compra.valorFinal,
      moedaConvertida: compra.moedaConvertida || compra.moeda || "EUR",
      taxaCambioOntem: compra.taxaCambioOntem || 1,
      dataCambioOntem: compra.dataCambioOntem || obterDataOntemISO(),
      metodoPagamento: compra.metodoPagamento,
      entidadePagamento: compra.entidadePagamento || configAdmin.entidade,
      referenciaPagamento: compra.referenciaPagamento,
      chavePix: compra.chavePix || "",
      numeroMbway: compra.numeroMbway || "",
      iban: compra.iban || "",
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

app.post("/pagamento/:codigoRecibo/apagar", async (req, res) => {
  try {
    const sessUser = req.session?.utilizador;
    if (!sessUser || !sessUser.id) return res.redirect("/");

    const codigo = decodeURIComponent(String(req.params.codigoRecibo || "")).trim();
    const compra = await Compra.findOne({ codigoRecibo: codigo });
    if (!compra) {
      return res.redirect(isAdminSessao(req) ? "/admin" : "/subscricao");
    }

    const ehAdmin = isAdminSessao(req);
    const ehDono = String(compra.utilizadorId) === String(sessUser.id);
    const estaPendente =
      String(compra.status || "").toLowerCase() !== "confirmado" || compra.confirmadoPorAdmin !== true;

    if ((ehAdmin || ehDono) && estaPendente) {
      await Compra.deleteOne({ _id: compra._id });
    }

    return res.redirect(ehAdmin ? "/admin" : "/subscricao");
  } catch (erro) {
    console.error("Erro ao apagar pagamento pendente:", erro);
    return res.redirect(isAdminSessao(req) ? "/admin" : "/subscricao");
  }
});

app.post("/api/admin/contato-suporte", exigirAdminAtivo, (req, res) => {
  configAdmin.whatsapp = String(req.body.whatsapp || "").trim();
  configAdmin.telegram = String(req.body.telegram || "").trim();
  salvarConfigDisco();
  return res.json({ ok: true, configAdmin });
});

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
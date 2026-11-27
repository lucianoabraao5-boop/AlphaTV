const os = require("os");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const Compra = require("../models/Compra");
const {
  PLANOS_SUBSCRICAO,
  METODOS_PAGAMENTO,
  obterPlano,
  normalizarTelefonePorPais,
  gerarCodigoPromocional,
  gerarCodigoRecibo,
  gerarReferenciaPagamento,
} = require("../services/alphaService");

function isAdminRole(role) {
  return String(role || "").toLowerCase() === "administrador";
}

function compraConfirmadaPeloAdmin(compra) {
  if (!compra) return false;
  return (
    String(compra.status || "").toLowerCase() === "confirmado" &&
    compra.confirmadoPorAdmin === true
  );
}

function obterIpLocalRede() {
  const interfaces = os.networkInterfaces();
  for (const nome of Object.keys(interfaces)) {
    for (const net of interfaces[nome] || []) {
      if (net && net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

function construirBaseUrlAcessivel(req) {
  const xfProto = String(req.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const protocolo =
    xfProto === "https" || xfProto === "http" ? xfProto : req.protocol || "http";
  const hostAtual = String(req.get("host") || "localhost:3000").trim();

  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(hostAtual)) {
    const ipLocal = obterIpLocalRede();
    if (ipLocal) {
      const portaMatch = hostAtual.match(/:(\d+)$/);
      const porta = portaMatch ? portaMatch[1] : "3000";
      return `http://${ipLocal}:${porta}`;
    }
  }

  return `${protocolo}://${hostAtual}`;
}

function lerQrCookie(req) {
  if (req.cookies && req.cookies.alphatv_qr_rec) {
    try {
      const texto = Buffer.from(
        String(req.cookies.alphatv_qr_rec),
        "base64",
      ).toString("utf8");
      return JSON.parse(texto);
    } catch (e) {
      return null;
    }
  }

  const headerCookie =
    req.headers && req.headers.cookie ? req.headers.cookie : "";
  const match = headerCookie.match(/(?:^|;\s*)alphatv_qr_rec=([^;]+)/);
  if (!match) return null;

  try {
    const texto = Buffer.from(decodeURIComponent(match[1]), "base64").toString(
      "utf8",
    );
    return JSON.parse(texto);
  } catch (e) {
    return null;
  }
}

function renderIndex(req, res, statusCode, dados = {}) {
  const qrDados =
    dados.qrDados !== undefined ? dados.qrDados : lerQrCookie(req);
  return res.status(statusCode).render("index", {
    erro: dados.erro || null,
    sucesso: dados.sucesso || null,
    qrDados,
    abrirQrInicial: Boolean(dados.abrirQrInicial),
  });
}

function mostrarPaginaAcesso(req, res) {
  const qrDados = lerQrCookie(req);
  return renderIndex(req, res, 200, {
    qrDados,
    abrirQrInicial: Boolean(qrDados && req.query && req.query.qr === "1"),
  });
}

async function cadastrar(req, res) {
  try {
    const { nome, email, password, pais, telefone, codigoConvite } = req.body;

    if (!nome || !email || !password) {
      return renderIndex(req, res, 400, {
        erro: "Preencha nome, e-mail e palavra-passe.",
      });
    }

    const emailLimpo = String(email).trim().toLowerCase();
    const existente = await User.findOne({ email: emailLimpo });
    if (existente) {
      return renderIndex(req, res, 400, {
        erro: "Já existe uma conta registada com este e-mail.",
      });
    }

    const telValidado = normalizarTelefonePorPais(pais, telefone);
    if (!telValidado.valido) {
      return renderIndex(req, res, 400, {
        erro: telValidado.erro,
      });
    }

    let codigoValidoUsado = null;
    if (codigoConvite && String(codigoConvite).trim() !== "") {
      const codigoLimpo = String(codigoConvite).trim();
      const padrinho = await User.findOne({
        codigoPromocional: codigoLimpo,
        codigoPromocionalLiberado: true,
      });
      if (padrinho) {
        codigoValidoUsado = codigoLimpo;
        padrinho.convitesRealizados = (padrinho.convitesRealizados || 0) + 1;
        await padrinho.save();
      }
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000;

    const novoUser = await User.create({
      nome: String(nome).trim(),
      email: emailLimpo,
      password: passwordHash,
      role: "Utilizador",
      pais: telValidado.pais,
      telefone: telValidado.telefoneE164,
      trialEndsAt: new Date(Date.now() + seteDiasMs),
      statusSubscricao: "trial",
      convidadoPorCodigo: codigoValidoUsado,
    });

    req.session.utilizador = {
      id: novoUser._id,
      nome: novoUser.nome,
      email: novoUser.email,
      role: "Utilizador",
    };

    return res.redirect("/player");
  } catch (erro) {
    console.error("Erro no cadastro:", erro);
    return renderIndex(req, res, 500, {
      erro: "Erro interno ao criar conta.",
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const emailLimpo = String(email || "")
      .trim()
      .toLowerCase();

    const user = await User.findOne({ email: emailLimpo });
    if (!user) {
      return renderIndex(req, res, 401, {
        erro: "E-mail ou palavra-passe inválidos.",
      });
    }

    const senhaCorreta = await bcrypt.compare(
      String(password || ""),
      user.password,
    );
    if (!senhaCorreta) {
      return renderIndex(req, res, 401, {
        erro: "E-mail ou palavra-passe inválidos.",
      });
    }

    const admin = isAdminRole(user.role);
    req.session.utilizador = {
      id: user._id,
      nome: user.nome,
      email: user.email,
      role: admin ? "Administrador" : "Utilizador",
    };

    return res.redirect(admin ? "/admin" : "/player");
  } catch (erro) {
    console.error("Erro no login:", erro);
    return renderIndex(req, res, 500, {
      erro: "Erro ao iniciar sessão.",
    });
  }
}

async function logout(req, res) {
  try {
    const sessUser =
      req.session && req.session.utilizador ? req.session.utilizador : null;
    let dadosQr = null;

    if (sessUser && sessUser.id) {
      const userDoc = await User.findById(sessUser.id);
      if (userDoc) {
        const tokenBruto = crypto.randomBytes(20).toString("hex");
        const tokenHash = crypto
          .createHash("sha256")
          .update(tokenBruto)
          .digest("hex");

        userDoc.resetTokenHash = tokenHash;
        userDoc.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await userDoc.save();

        const baseUrl = construirBaseUrlAcessivel(req);
        const qrUrlRecuperacao = `${baseUrl}/recuperar-senha?token=${encodeURIComponent(tokenBruto)}&email=${encodeURIComponent(userDoc.email)}`;

        dadosQr = {
          id: String(userDoc._id),
          nome: userDoc.nome,
          email: userDoc.email,
          pais: userDoc.pais || "PT",
          telefone: userDoc.telefone || "",
          role: userDoc.role || "Utilizador",
          statusSubscricao: userDoc.statusSubscricao || "trial",
          pagoAte: userDoc.pagoAte
            ? new Date(userDoc.pagoAte).toISOString().slice(0, 10)
            : null,
          codigoPromocional:
            userDoc.codigoPromocionalLiberado && userDoc.codigoPromocional
              ? userDoc.codigoPromocional
              : null,
          token: tokenBruto,
          expiraEm: "30 minutos",
          qrUrl: qrUrlRecuperacao,
          logoutEm: new Date().toISOString(),
        };
      }
    }

    if (dadosQr) {
      const base64Payload = Buffer.from(
        JSON.stringify(dadosQr),
        "utf8",
      ).toString("base64");
      const xfProto = String(req.get("x-forwarded-proto") || "")
        .split(",")[0]
        .trim()
        .toLowerCase();
      const ehHttps = xfProto === "https" || req.protocol === "https";

      res.cookie("alphatv_qr_rec", base64Payload, {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: false,
        sameSite: "lax",
        secure: ehHttps,
        path: "/",
      });
    }

    req.session.destroy(() => {
      return res.redirect("/?qr=1");
    });
  } catch (erro) {
    console.error("Erro no logout:", erro);
    req.session.destroy(() => {
      return res.redirect("/");
    });
  }
}

async function mostrarNovaSenha(req, res) {
  try {
    const token = String(req.query.token || "").trim();
    const email = String(req.query.email || "")
      .trim()
      .toLowerCase();

    if (!token || !email) {
      return res.status(400).render("nova-senha", {
        erro: "Link de recuperação inválido ou incompleto. Gere um novo QR Code fazendo logout.",
        sucesso: null,
        token: "",
        email: "",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      email,
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).render("nova-senha", {
        erro: "Este link de QR Code expirou ou já foi utilizado. Faça logout novamente para gerar outro.",
        sucesso: null,
        token: "",
        email: "",
      });
    }

    return res.render("nova-senha", {
      erro: null,
      sucesso: null,
      token,
      email: user.email,
    });
  } catch (erro) {
    console.error("Erro ao abrir /recuperar-senha:", erro);
    return res.status(500).render("nova-senha", {
      erro: "Erro interno ao validar o QR Code de recuperação.",
      sucesso: null,
      token: "",
      email: "",
    });
  }
}

async function salvarNovaSenha(req, res) {
  try {
    const token = String(req.body.token || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const novaSenha = String(req.body.novaSenha || "");
    const confirmarSenha = String(req.body.confirmarSenha || "");

    if (!token || !email) {
      return res.status(400).render("nova-senha", {
        erro: "Token de recuperação inválido.",
        sucesso: null,
        token: "",
        email: "",
      });
    }

    if (novaSenha.length < 6) {
      return res.status(400).render("nova-senha", {
        erro: "A nova senha deve ter pelo menos 6 caracteres.",
        sucesso: null,
        token,
        email,
      });
    }

    if (novaSenha !== confirmarSenha) {
      return res.status(400).render("nova-senha", {
        erro: "A confirmação da nova senha não coincide.",
        sucesso: null,
        token,
        email,
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      email,
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).render("nova-senha", {
        erro: "Link expirado ou inválido. Gere um novo QR Code fazendo logout.",
        sucesso: null,
        token: "",
        email: "",
      });
    }

    user.password = await bcrypt.hash(novaSenha, 10);
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    await user.save();

    return res.render("nova-senha", {
      erro: null,
      sucesso:
        "Nova senha guardada com sucesso! Já pode entrar na conta com o seu e-mail e nova senha.",
      token: "",
      email: user.email,
    });
  } catch (erro) {
    console.error("Erro ao salvar nova senha:", erro);
    return res.status(500).render("nova-senha", {
      erro: "Erro ao atualizar a senha.",
      sucesso: null,
      token,
      email,
    });
  }
}

async function mostrarSubscricao(req, res) {
  try {
    const sessId = req.session?.utilizador?.id;
    if (!sessId) return res.redirect("/");

    const user = await User.findById(sessId);
    if (!user) return res.redirect("/");

    const comprasPendentes = await Compra.find({
      utilizadorId: user._id,
      status: "pendente",
    }).sort({ criadoEm: -1 });

    const historicoConfirmadoAdmin = (user.historicoCompras || []).filter(
      (c) => compraConfirmadaPeloAdmin(c),
    );

    return res.render("subscricao", {
      utilizador: user,
      planos: Object.values(PLANOS_SUBSCRICAO),
      metodos: METODOS_PAGAMENTO,
      comprasPendentes,
      historicoCompras: [...historicoConfirmadoAdmin].reverse(),
      erro: null,
    });
  } catch (erro) {
    console.error("Erro ao carregar /subscricao:", erro);
    return res.redirect("/player");
  }
}

async function iniciarPagamento(req, res) {
  try {
    const sessId = req.session?.utilizador?.id;
    if (!sessId) return res.redirect("/");

    const { planoDias, metodoPagamento, codigoPromocional } = req.body;
    const plano = obterPlano(planoDias);
    if (!plano) return res.redirect("/subscricao");

    const metodoValido = METODOS_PAGAMENTO.find(
      (m) => m.id === metodoPagamento,
    );
    const nomeMetodo = metodoValido ? metodoValido.nome : "Pagamento";

    const user = await User.findById(sessId);
    if (!user) return res.redirect("/");

    let desconto = 0;
    let codigoAplicado = null;

    if (codigoPromocional && String(codigoPromocional).trim() !== "") {
      const codLimpo = String(codigoPromocional).trim();
      const donoCodigo = await User.findOne({
        codigoPromocional: codLimpo,
        codigoPromocionalLiberado: true,
        _id: { $ne: user._id },
      });
      if (donoCodigo) {
        codigoAplicado = codLimpo;
        desconto = Number((plano.valorBase * 0.1).toFixed(2));
      }
    }

    const valorFinal = Number(
      Math.max(0.5, plano.valorBase - desconto).toFixed(2),
    );
    const codigoRecibo = gerarCodigoRecibo();
    const referenciaPagamento = gerarReferenciaPagamento(metodoPagamento);

    await Compra.create({
      utilizadorId: user._id,
      nomeUtilizador: user.nome,
      emailUtilizador: user.email,
      codigoRecibo,
      planoDias: plano.dias,
      nomePlano: plano.nome,
      valorBase: plano.valorBase,
      desconto,
      valorFinal,
      moeda: plano.moeda,
      metodoPagamento: nomeMetodo,
      referenciaPagamento,
      codigoPromocionalUsado: codigoAplicado,
      status: "pendente",
      confirmadoPorAdmin: false,
      criadoEm: new Date(),
    });

    return res.redirect("/subscricao");
  } catch (erro) {
    console.error("Erro ao iniciar pagamento:", erro);
    return res.redirect("/subscricao");
  }
}

// Confirmação de recebimento é exclusiva do administrador; o cliente apenas aguarda
async function confirmarPagamento(req, res) {
  try {
    const sessUser = req.session?.utilizador;
    if (!sessUser || !sessUser.id) return res.redirect("/");

    if (!isAdminRole(sessUser.role)) {
      return res.redirect("/subscricao");
    }

    const { codigoRecibo } = req.params;
    const compra = await Compra.findOne({ codigoRecibo });
    if (!compra) {
      return res.status(404).send("Pedido de pagamento não encontrado.");
    }

    const user = await User.findById(compra.utilizadorId);
    if (!user) {
      return res.status(404).send("Utilizador da compra não encontrado.");
    }

    if (!compraConfirmadaPeloAdmin(compra)) {
      const agora = new Date();
      const baseData =
        user.statusSubscricao === "ativo" &&
        user.pagoAte &&
        new Date(user.pagoAte) > agora
          ? new Date(user.pagoAte).getTime()
          : agora.getTime();
      const validoAte = new Date(
        baseData + compra.planoDias * 24 * 60 * 60 * 1000,
      );

      compra.status = "confirmado";
      compra.confirmadoPorAdmin = true;
      compra.confirmadoPorAdminId = sessUser.id;
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
        moeda: compra.moeda,
        metodoPagamento: compra.metodoPagamento,
        referenciaPagamento: compra.referenciaPagamento,
        codigoPromocionalUsado: compra.codigoPromocionalUsado,
        status: "confirmado",
        confirmadoPorAdmin: true,
        dataPagamento: agora,
        validoAte,
      };

      const indiceExistente = (user.historicoCompras || []).findIndex(
        (c) => c.codigoRecibo === compra.codigoRecibo,
      );
      if (indiceExistente >= 0) {
        user.historicoCompras[indiceExistente] = registoRecibo;
      } else {
        user.historicoCompras.push(registoRecibo);
      }
      await user.save();
    }

    return res.redirect(`/recibo/${encodeURIComponent(compra.codigoRecibo)}`);
  } catch (erro) {
    console.error("Erro ao confirmar pagamento:", erro);
    return res.redirect("/admin");
  }
}

async function verRecibo(req, res) {
  try {
    const sessUser = req.session?.utilizador;
    if (!sessUser || !sessUser.id) return res.redirect("/");

    const { codigoRecibo } = req.params;
    const compraDb = await Compra.findOne({ codigoRecibo });
    const donoOuAdmin =
      compraDb &&
      (String(compraDb.utilizadorId) === String(sessUser.id) ||
        isAdminRole(sessUser.role));

    if (!compraDb || !donoOuAdmin) {
      return res
        .status(403)
        .send("Recibo indisponível ou sem permissão de acesso.");
    }

    if (!compraConfirmadaPeloAdmin(compraDb)) {
      return res
        .status(403)
        .send(
          "O recibo só fica disponível após a confirmação do recebimento pelo administrador.",
        );
    }

    const user = await User.findById(compraDb.utilizadorId);
    if (!user) return res.redirect("/");

    return res.render("recibo", {
      utilizador: user,
      compra: compraDb,
    });
  } catch (erro) {
    console.error("Erro ao abrir recibo:", erro);
    return res.redirect("/subscricao");
  }
}

async function gerarCodigoConviteUtilizador(req, res) {
  try {
    const sessId = req.session?.utilizador?.id;
    if (!sessId) return res.redirect("/");

    const user = await User.findById(sessId);
    if (!user) return res.redirect("/");

    if (!user.codigoPromocionalLiberado) {
      user.codigoPromocional = null;
      await user.save();
      return res.redirect("/player");
    }

    user.codigoPromocional = gerarCodigoPromocional();
    await user.save();
    return res.redirect("/player");
  } catch (erro) {
    console.error("Erro ao gerar código promocional:", erro);
    return res.redirect("/player");
  }
}

module.exports = {
  mostrarPaginaAcesso,
  cadastrar,
  login,
  logout,
  mostrarNovaSenha,
  salvarNovaSenha,
  mostrarSubscricao,
  iniciarPagamento,
  confirmarPagamento,
  verRecibo,
  gerarCodigoConviteUtilizador,
};
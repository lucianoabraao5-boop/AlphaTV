const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Compra = require("../models/Compra");
const {
  PLANOS_SUBSCRICAO,
  METODOS_PAGAMENTO,
  obterPlano,
  normalizarTelefonePorPais,
  gerarCodigoVerificacao,
  gerarCodigoPromocional,
  gerarCodigoRecibo,
  gerarReferenciaPagamento,
  enviarMensagemRecuperacao,
} = require("../services/alphaService");

function isAdminRole(role) {
  return String(role || "").toLowerCase() === "administrador";
}

function renderIndex(req, res, statusCode, dados = {}) {
  return res.status(statusCode).render("index", {
    erro: dados.erro || null,
    sucesso: dados.sucesso || null,
    codigoDemo: dados.codigoDemo || null,
    passoRecuperacao: dados.passoRecuperacao || "solicitar",
    dadosRecuperacao: dados.dadosRecuperacao || {
      pais: "PT",
      telefone: "",
      email: "",
    },
  });
}
function lerCookieQr(req) {
  const headerCookie = req.headers && req.headers.cookie ? req.headers.cookie : "";
  const match = headerCookie.match(/(?:^|;\s*)alphatv_qr_rec=([^;]+)/);
  if (!match) return null;
  try {
    const jsonStr = Buffer.from(decodeURIComponent(match[1]), "base64").toString("utf8");
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

function mostrarPaginaAcesso(req, res) {
  let qrDados = null;
  const rawCookie = req.cookies && req.cookies.alphatv_qr_rec ? req.cookies.alphatv_qr_rec : null;

  if (rawCookie) {
    try {
      const decodificado = Buffer.from(String(rawCookie), "base64").toString("utf8");
      qrDados = JSON.parse(decodificado);
    } catch (e) {
      qrDados = null;
    }
  }

  
  return renderIndex(req, res, 200, {
    qrDados,
    abrirQrInicial: Boolean(qrDados && req.query && req.query.qr === "1"),
  });
}

    const emailLimpo = String(email).trim().toLowerCase();
    const existente = await User.findOne({ email: emailLimpo });
    if (existente) {
      return renderIndex(req, res, 400, {
        erro: "Já existe uma conta registada com este e-mail.",
        dadosRecuperacao: {
          pais: pais || "PT",
          telefone: telefone || "",
          email: emailLimpo,
        },
      });
    }

    const telValidado = normalizarTelefonePorPais(pais, telefone);
    if (!telValidado.valido) {
      return renderIndex(req, res, 400, {
        erro: telValidado.erro,
        dadosRecuperacao: {
          pais: pais || "PT",
          telefone: telefone || "",
          email: emailLimpo,
        },
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
        dadosRecuperacao: { pais: "PT", telefone: "", email: emailLimpo },
      });
    }

    const senhaCorreta = await bcrypt.compare(
      String(password || ""),
      user.password,
    );
    if (!senhaCorreta) {
      return renderIndex(req, res, 401, {
        erro: "E-mail ou palavra-passe inválidos.",
        dadosRecuperacao: {
          pais: user.pais || "PT",
          telefone: user.telefone || "",
          email: emailLimpo,
        },
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
    const sessUser = req.session && req.session.utilizador ? req.session.utilizador : null;
    let dadosQr = null;

    if (sessUser && sessUser.id) {
      const userDoc = await User.findById(sessUser.id).lean();
      if (userDoc) {
        dadosQr = {
          nome: userDoc.nome,
          email: userDoc.email,
          pais: userDoc.pais || "PT",
          telefone: userDoc.telefone || "",
          role: userDoc.role || "Utilizador",
          statusSubscricao: userDoc.statusSubscricao || "trial",
          pagoAte: userDoc.pagoAte ? new Date(userDoc.pagoAte).toISOString().slice(0, 10) : null,
          codigoPromocional:
            userDoc.codigoPromocionalLiberado && userDoc.codigoPromocional
              ? userDoc.codigoPromocional
              : null,
          geradoEm: new Date().toISOString(),
        };
      }
    }

    if (dadosQr) {
      res.cookie("alphatv_qr_rec", Buffer.from(JSON.stringify(dadosQr)).toString("base64"), {
        maxAge: 10 * 60 * 1000, // válido por 10 minutos após o logout
        httpOnly: false,
        sameSite: "lax",
      });
    }

    req.session.destroy(() => {
      return res.redirect("/?qr=1");
    });
  } catch (erro) {
    console.error("Erro no logout com QR:", erro);
    req.session.destroy(() => {
      return res.redirect("/");
    });
  }
}
    const codigo = gerarCodigoVerificacao();
    user.codigoRecuperacao = codigo;
    user.codigoRecuperacaoExpira = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const envio = await enviarMensagemRecuperacao({
      telefoneE164: telCheck.telefoneE164,
      pais: telCheck.pais,
      codigo,
      nome: user.nome,
    });

    const mensagemSucesso = envio.enviadoExterno
      ? `Código enviado por SMS para ${telCheck.telefoneE164} (${telCheck.pais}).`
      : `Código gerado para ${telCheck.telefoneE164} (${telCheck.pais}) (SMS externo não entregue — em conta Trial da Twilio, verifique o número de destino na consola).`;

    return renderIndex(req, res, 200, {
      sucesso: mensagemSucesso,
      codigoDemo: envio.enviadoExterno ? null : codigo,
      passoRecuperacao: "confirmar",
      dadosRecuperacao: {
        pais: telCheck.pais,
        telefone: telCheck.telefoneE164,
        email: user.email,
      },
    });
  } catch (erro) {
    console.error("Erro ao solicitar recuperação:", erro);
    return renderIndex(req, res, 500, {
      erro: "Erro ao enviar mensagem de recuperação.",
      passoRecuperacao: "solicitar",
    });
  }
}

async function confirmarRecuperacaoTelefone(req, res) {
  try {
    const { telefone, codigo, novaSenha } = req.body;
    const telLimpo = String(telefone || "").trim();

    if (!codigo || !novaSenha || String(novaSenha).length < 4) {
      return renderIndex(req, res, 400, {
        erro: "Informe o código recebido e uma nova palavra-passe (mínimo 4 caracteres).",
        passoRecuperacao: "confirmar",
        dadosRecuperacao: { pais: "PT", telefone: telLimpo, email: "" },
      });
    }

    const user = await User.findOne({ telefone: telLimpo });
    const agora = new Date();

    if (
      !user ||
      !user.codigoRecuperacao ||
      String(user.codigoRecuperacao).trim() !== String(codigo).trim() ||
      !user.codigoRecuperacaoExpira ||
      new Date(user.codigoRecuperacaoExpira) < agora
    ) {
      return renderIndex(req, res, 400, {
        erro: "Código inválido ou expirado.",
        passoRecuperacao: "confirmar",
        dadosRecuperacao: {
          pais: user ? user.pais : "PT",
          telefone: telLimpo,
          email: user ? user.email : "",
        },
      });
    }

    user.password = await bcrypt.hash(String(novaSenha), 10);
    user.codigoRecuperacao = null;
    user.codigoRecuperacaoExpira = null;
    await user.save();

    return renderIndex(req, res, 200, {
      sucesso: "Palavra-passe redefinida com sucesso! Já podes iniciar sessão.",
      passoRecuperacao: "solicitar",
      dadosRecuperacao: {
        pais: user.pais || "PT",
        telefone: telLimpo,
        email: user.email,
      },
    });
  } catch (erro) {
    console.error("Erro ao confirmar recuperação:", erro);
    return renderIndex(req, res, 500, {
      erro: "Erro ao redefinir a palavra-passe.",
      passoRecuperacao: "confirmar",
    });
  }
}

async function mostrarSubscricao(req, res) {
  try {
    const user = await User.findById(req.session.utilizador.id);
    if (!user) return res.redirect("/");

    const comprasPendentes = await Compra.find({
      utilizadorId: user._id,
      status: "pendente",
    }).sort({ criadoEm: -1 });

    return res.render("subscricao", {
      utilizador: user,
      planos: Object.values(PLANOS_SUBSCRICAO),
      metodos: METODOS_PAGAMENTO,
      comprasPendentes,
      historicoCompras: [...(user.historicoCompras || [])].reverse(),
      erro: null,
    });
  } catch (erro) {
    console.error("Erro ao carregar /subscricao:", erro);
    return res.redirect("/player");
  }
}

async function iniciarPagamento(req, res) {
  try {
    const { planoDias, metodoPagamento, codigoPromocional } = req.body;
    const plano = obterPlano(planoDias);
    if (!plano) return res.redirect("/subscricao");

    const metodoValido = METODOS_PAGAMENTO.find(
      (m) => m.id === metodoPagamento,
    );
    const nomeMetodo = metodoValido ? metodoValido.nome : "Pagamento";

    const user = await User.findById(req.session.utilizador.id);
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
      criadoEm: new Date(),
    });

    return res.redirect("/subscricao");
  } catch (erro) {
    console.error("Erro ao iniciar pagamento:", erro);
    return res.redirect("/subscricao");
  }
}

async function confirmarPagamento(req, res) {
  try {
    const { codigoRecibo } = req.params;
    const compra = await Compra.findOne({
      codigoRecibo,
      utilizadorId: req.session.utilizador.id,
    });
    if (!compra)
      return res.status(404).send("Pedido de pagamento não encontrado.");

    const user = await User.findById(req.session.utilizador.id);
    if (!user) return res.redirect("/");

    if (compra.status !== "confirmado") {
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
      compra.confirmadoEm = agora;
      compra.validoAte = validoAte;
      await compra.save();

      user.statusSubscricao = "ativo";
      user.pagoAte = validoAte;
      user.historicoCompras.push({
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
        dataPagamento: agora,
        validoAte,
      });
      await user.save();
    }

    return res.redirect(`/recibo/${encodeURIComponent(compra.codigoRecibo)}`);
  } catch (erro) {
    console.error("Erro ao confirmar pagamento:", erro);
    return res.redirect("/subscricao");
  }
}

async function verRecibo(req, res) {
  try {
    const { codigoRecibo } = req.params;
    const user = await User.findById(req.session.utilizador.id);
    if (!user) return res.redirect("/");

    const compra =
      (user.historicoCompras || []).find(
        (c) => c.codigoRecibo === codigoRecibo,
      ) || (await Compra.findOne({ codigoRecibo, utilizadorId: user._id }));

    if (!compra) return res.status(404).send("Recibo não encontrado.");

    return res.render("recibo", {
      utilizador: user,
      compra,
    });
  } catch (erro) {
    console.error("Erro ao abrir recibo:", erro);
    return res.redirect("/subscricao");
  }
}

async function gerarCodigoConviteUtilizador(req, res) {
  try {
    const user = await User.findById(req.session.utilizador.id);
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
  solicitarRecuperacaoTelefone,
  confirmarRecuperacaoTelefone,
  mostrarSubscricao,
  iniciarPagamento,
  confirmarPagamento,
  verRecibo,
  gerarCodigoConviteUtilizador,
};

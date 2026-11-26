const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Compra = require("../models/Compra");
const userController = require("../controllers/userController");
const {
  gerarCodigoPromocional,
  normalizarTelefonePorPais,
} = require("../services/alphaService");
const {
  verificarSessao,
  verificarAdmin,
} = require("../authMiddlewares/authMiddleware");

// Acesso e recuperação por telefone segundo país (PT / BR / OUTROS)
router.get("/", userController.mostrarPaginaAcesso);
router.get("/login", userController.mostrarPaginaAcesso);
router.post("/cadastrar", userController.cadastrar);
router.post("/login", userController.login);
router.get("/logout", userController.logout);

router.post(
  "/recuperar/enviar-codigo",
  userController.solicitarRecuperacaoTelefone,
);
router.post(
  "/recuperar/confirmar",
  userController.confirmarRecuperacaoTelefone,
);

// Planos (30, 60, 90, 180 dias), pagamento + confirmação, recibo e código promocional
router.get("/subscricao", verificarSessao, userController.mostrarSubscricao);
router.post(
  "/subscricao/pagar",
  verificarSessao,
  userController.iniciarPagamento,
);
router.post(
  "/subscricao/confirmar/:codigoRecibo",
  verificarSessao,
  userController.confirmarPagamento,
);
router.get("/recibo/:codigoRecibo", verificarSessao, userController.verRecibo);
router.post(
  "/convite/gerar",
  verificarSessao,
  userController.gerarCodigoConviteUtilizador,
);

// Rota administrativa
router.get("/admin", verificarAdmin, async (req, res) => {
  try {
    const utilizadores = await User.find().sort({ _id: -1 });
    let compras = [];
    try {
      compras = await Compra.find().sort({ criadoEm: -1 }).limit(30);
    } catch (errCompra) {
      console.error("Aviso ao buscar compras em /admin:", errCompra);
    }

    return res.render("admin", {
      utilizadores,
      compras,
      utilizador: req.session.utilizador,
    });
  } catch (erro) {
    console.error("Erro ao carregar /admin:", erro);
    return res.status(500).send("Erro ao carregar o painel de administração.");
  }
});

// Atualizar País e Telefone de um utilizador no Admin
router.post(
  "/admin/utilizadores/:id/contacto",
  verificarAdmin,
  async (req, res) => {
    try {
      const alvo = await User.findById(req.params.id);
      if (!alvo) return res.redirect("/admin");

      const { pais, telefone } = req.body;
      const paisEscolhido = ["PT", "BR", "OUTROS"].includes(
        String(pais).toUpperCase(),
      )
        ? String(pais).toUpperCase()
        : "PT";

      if (telefone && String(telefone).trim() !== "") {
        const check = normalizarTelefonePorPais(paisEscolhido, telefone);
        alvo.pais = paisEscolhido;
        alvo.telefone = check.valido
          ? check.telefoneE164
          : String(telefone).trim();
      } else {
        alvo.pais = paisEscolhido;
        alvo.telefone = "";
      }

      await alvo.save();
      return res.redirect("/admin");
    } catch (erro) {
      console.error("Erro ao atualizar contacto:", erro);
      return res.redirect("/admin");
    }
  },
);

// Administrador confirma pagamento pendente e libera acesso imediatamente
router.post(
  "/admin/compras/:codigoRecibo/confirmar",
  verificarAdmin,
  async (req, res) => {
    try {
      const compra = await Compra.findOne({
        codigoRecibo: req.params.codigoRecibo,
      });
      if (!compra) return res.redirect("/admin");

      const user = await User.findById(compra.utilizadorId);
      if (user && compra.status !== "confirmado") {
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

      return res.redirect("/admin");
    } catch (erro) {
      console.error("Erro ao confirmar compra no admin:", erro);
      return res.redirect("/admin");
    }
  },
);

// Administrador disponibiliza (gera 4 dígitos) ou bloqueia (remove) código promocional
router.post(
  "/admin/utilizadores/:id/promocional",
  verificarAdmin,
  async (req, res) => {
    try {
      const alvo = await User.findById(req.params.id);
      if (alvo) {
        const vaiDisponibilizar = !alvo.codigoPromocionalLiberado;
        if (vaiDisponibilizar) {
          alvo.codigoPromocionalLiberado = true;
          alvo.codigoPromocional = gerarCodigoPromocional();
        } else {
          alvo.codigoPromocionalLiberado = false;
          alvo.codigoPromocional = null;
        }
        await alvo.save();
      }
      return res.redirect("/admin");
    } catch (erro) {
      console.error("Erro ao alterar disponibilização do código:", erro);
      return res.redirect("/admin");
    }
  },
);

// Renovar dias de gratuidade
router.post(
  "/admin/utilizadores/:id/renovar-teste",
  verificarAdmin,
  async (req, res) => {
    try {
      const alvo = await User.findById(req.params.id);
      if (!alvo) return res.redirect("/admin");

      const diasRaw = parseInt(req.body.dias, 10);
      const diasGratuitos =
        Number.isFinite(diasRaw) && diasRaw > 0 ? diasRaw : 7;
      const agora = new Date();
      const trialAtual = alvo.trialEndsAt ? new Date(alvo.trialEndsAt) : null;
      const baseData =
        trialAtual && trialAtual > agora
          ? trialAtual.getTime()
          : agora.getTime();

      alvo.trialEndsAt = new Date(
        baseData + diasGratuitos * 24 * 60 * 60 * 1000,
      );
      if (alvo.statusSubscricao === "expirado") {
        alvo.statusSubscricao = "trial";
      }
      await alvo.save();
      return res.redirect("/admin");
    } catch (erro) {
      console.error("Erro ao renovar dias de gratuidade:", erro);
      return res.redirect("/admin");
    }
  },
);

// Alternar perfil
router.post(
  "/admin/utilizadores/:id/role",
  verificarAdmin,
  async (req, res) => {
    try {
      const alvo = await User.findById(req.params.id);
      if (alvo) {
        const atualAdmin =
          String(alvo.role || "").toLowerCase() === "administrador";
        alvo.role = atualAdmin ? "Utilizador" : "Administrador";
        await alvo.save();
      }
      res.redirect("/admin");
    } catch (erro) {
      console.error("Erro ao alterar perfil:", erro);
      res.redirect("/admin");
    }
  },
);

// Apagar utilizador
router.post(
  "/admin/utilizadores/:id/apagar",
  verificarAdmin,
  async (req, res) => {
    try {
      if (req.params.id !== String(req.session.utilizador.id)) {
        await User.findByIdAndDelete(req.params.id);
      }
      res.redirect("/admin");
    } catch (erro) {
      console.error("Erro ao apagar utilizador:", erro);
      res.redirect("/admin");
    }
  },
);

module.exports = router;

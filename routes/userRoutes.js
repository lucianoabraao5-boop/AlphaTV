// Página de cobrança / subscrição após os 7 dias
router.get("/subscricao", verificarSessao, async (req, res) => {
  try {
    const userAtual = await User.findById(req.session.utilizador.id);
    res.render("subscricao", {
      utilizador: userAtual || req.session.utilizador,
    });
  } catch (erro) {
    console.error("Erro ao carregar /subscricao:", erro);
    res.render("subscricao", {
      utilizador: req.session.utilizador,
    });
  }
});

// Ativar subscrição de 30 dias (após os 7 dias gratuitos)
router.post("/subscricao/ativar", verificarSessao, async (req, res) => {
  try {
    const user = await User.findById(req.session.utilizador.id);
    if (!user) {
      return res.redirect("/");
    }

    const agora = new Date();
    const baseData =
      user.pagoAte && new Date(user.pagoAte) > agora
        ? new Date(user.pagoAte).getTime()
        : agora.getTime();

    user.statusSubscricao = "ativo";
    user.pagoAte = new Date(baseData + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    return res.redirect("/player");
  } catch (erro) {
    console.error("Erro ao ativar subscrição:", erro);
    return res.redirect("/subscricao");
  }
});

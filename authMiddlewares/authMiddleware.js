exports.verificarSessao = (req, res, next) => {
  if (!req.session.utilizador) {
    return res.redirect("/");
  }
  next();
};

exports.verificarAdmin = (req, res, next) => {
  if (!req.session.utilizador) {
    return res.redirect("/");
  }
  if (req.session.utilizador.role !== "Administrador") {
    return res.redirect("/player");
  }
  next();
};

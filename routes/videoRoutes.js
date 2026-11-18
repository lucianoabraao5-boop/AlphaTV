const express = require("express");
const router = express.Router();
const videoController = require("../controllers/videoController");

// Middleware de proteção por PIN para a área de admin
const verificarPIN = (req, res, next) => {
  const pinInserido = (req.body && req.body.pin) || req.query.pin;
  const PIN_MESTRE = "1234"; // O teu PIN de 4 dígitos

  if (pinInserido === PIN_MESTRE) {
    return next();
  }

  res.send(`
        <!DOCTYPE html>
        <html lang="pt">
        <head>
            <meta charset="UTF-8">
            <title>Área Restrita | AlphaTV</title>
            <style>
                body { background-color: #0d1117; color: #c9d1d9; font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .box { background-color: #161b22; border: 1px solid #30363d; padding: 30px; border-radius: 8px; text-align: center; width: 300px; }
                input { width: 100%; padding: 10px; margin: 15px 0; background: #0d1117; border: 1px solid #30363d; color: white; border-radius: 4px; box-sizing: border-box; text-align: center; font-size: 1.2rem; letter-spacing: 5px; }
                button { background: #1f6feb; color: white; border: none; padding: 10px; width: 100%; border-radius: 4px; font-weight: bold; cursor: pointer; }
                button:hover { background: #388bfd; }
                .voltar { display: block; margin-top: 15px; color: #8b949e; text-decoration: none; font-size: 0.9rem; }
                .voltar:hover { color: #58a6ff; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2 style="color: #58a6ff; margin-top:0;">AlphaTV Admin 🔒</h2>
                <p>Introduza o PIN de 4 dígitos</p>
                <form action="/admin" method="GET">
                    <input type="password" name="pin" maxlength="4" placeholder="••••" required autofocus>
                    <button type="submit">Entrar no Painel</button>
                </form>
                <a href="/" class="voltar">← Voltar ao Catálogo Público</a>
            </div>
        </body>
        </html>
    `);
};

// Rotas Públicas (Utilizador)
router.get("/", videoController.renderCatalogo);
router.get("/api/videos", videoController.obterVideosJSON);

// Rotas Protegidas (Administrador)
router.get("/admin", verificarPIN, videoController.renderAdmin);
router.post("/videos/adicionar", videoController.adicionarVideoWeb);
router.get("/videos/apagar/:id", videoController.apagarVideo);
router.get("/videos/editar/:id", videoController.renderEditarVideo);
router.post("/videos/atualizar/:id", videoController.atualizarVideo);

module.exports = router;

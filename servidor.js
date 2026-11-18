import { createServer } from 'node:http';

const hostname = '127.0.0.1';
const port = 3000;

const servidor = createServer((req, res) => {
  // Se aceder à página principal
  if (req.method === 'GET' && req.url === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    // Enviamos o código HTML do formulário diretamente
    res.end(`
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="UTF-8">
        <title>Formulário Node.js</title>
      </head>
      <body>
        <h1>Formulário Ligado ao Node.js</h1>
        <form action="/enviar" method="POST">
          <label for="nome">Digita o teu nome:</label><br><br>
          <input type="text" id="nome" name="nome" placeholder="Escreve aqui..." required><br><br>
          <button type="submit">Guardar</button>
        </form>
      </body>
      </html>
    `);
    return;
  }

  // Se a rota for /enviar (quando clicas no botão do formulário)
  if (req.method === 'POST' && req.url === '/enviar') {
    let body = '';
    
    // Recolhe os dados enviados pelo formulário em pedaços (chunks)
    req.on('data', chunk => {
      body += chunk;
    });

    // Quando terminar de receber os dados
    req.on('end', () => {
      const dadosTratados = new URLSearchParams(body);
      const nomeDigitado = dadosTratados.get('nome');

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<h1>Obrigado, ${nomeDigitado}! O teu nome foi recebido com sucesso no servidor.</h1><a href="/">Voltar</a>`);
    });
    return;
  }

  // Rota 404 para qualquer outro endereço
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Página não encontrada.');
});

servidor.listen(port, hostname, () => {
  console.log(`Servidor a correr em http://${hostname}:${port}/`);
});
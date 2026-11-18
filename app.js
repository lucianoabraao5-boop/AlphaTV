import http from "http";

const hostname = "127.0.0.1";
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Bem-vindo ao meu primeiro servidor em Node.js!\n");
});

server.listen(port, hostname, () => {
  console.log(`O servidor já está a funcionar em http://${hostname}:${port}/`);
});

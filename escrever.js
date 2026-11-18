import fs from "fs/promises";

async function atualizarFicheiro() {
  try {
    const nomeFicheiro = "diario.txt";

    // Escreve aqui dentro das aspas TODO o texto que queres acrescentar:
    const novoTexto = `Estamos a ir passo a passo e o Node.js está a funcionar!\n
      precisa estar na mesma linha \n
      entao, tudo que eu escrever aqui vai aparecer la?\noutra dica eh que quando usar "crase"\n
      que nao tera problemas em quebras de linha. Dai, nao ficara com texto (codigo) grande.`;

    // Este comando adiciona o texto sem apagar o que já lá estava
    await fs.appendFile(nomeFicheiro, novoTexto, "utf-8");

    console.log('Texto adicionado com sucesso ao ficheiro "diario.txt"!');
  } catch (erro) {
    console.error("Erro ao atualizar o ficheiro:", erro);
  }
}

atualizarFicheiro();

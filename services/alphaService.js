const crypto = require("crypto");

const PLANOS_SUBSCRICAO = {
  30: {
    dias: 30,
    nome: "Plano Mensal (30 Dias)",
    valorBase: 9.99,
    moeda: "EUR",
    etiqueta: "30 Dias",
  },
  60: {
    dias: 60,
    nome: "Plano Bimestral (60 Dias)",
    valorBase: 18.99,
    moeda: "EUR",
    etiqueta: "60 Dias • Poupança 5%",
  },
  90: {
    dias: 90,
    nome: "Plano Trimestral (90 Dias)",
    valorBase: 26.99,
    moeda: "EUR",
    etiqueta: "90 Dias • Poupança 10%",
  },
  180: {
    dias: 180,
    nome: "Plano Semestral (180 Dias)",
    valorBase: 49.99,
    moeda: "EUR",
    etiqueta: "180 Dias • Poupança 17%",
  },
};

const METODOS_PAGAMENTO = [
  { id: "mbway", nome: "MB WAY (Portugal)" },
  { id: "multibanco", nome: "Referência Multibanco / Transferência" },
  { id: "pix", nome: "PIX (Brasil)" },
  { id: "cartao", nome: "Cartão de Crédito / Débito" },
];

function obterPlano(dias) {
  return PLANOS_SUBSCRICAO[Number(dias)] || null;
}

function normalizarTelefonePorPais(pais, telefoneBruto) {
  const digitos = String(telefoneBruto || "").replace(/\D/g, "");
  const codigoPais = String(pais || "OUTROS").toUpperCase();

  if (!digitos) {
    return {
      valido: false,
      telefoneE164: "",
      pais: codigoPais,
      erro: "Informe um número de telefone válido.",
    };
  }

  if (codigoPais === "PT") {
    const local = digitos.startsWith("351") ? digitos.slice(3) : digitos;
    if (local.length !== 9) {
      return {
        valido: false,
        telefoneE164: "",
        pais: "PT",
        erro: "Para Portugal (+351), o número deve ter 9 dígitos.",
      };
    }
    return {
      valido: true,
      telefoneE164: `+351${local}`,
      pais: "PT",
      erro: null,
    };
  }

  if (codigoPais === "BR") {
    const local = digitos.startsWith("55") ? digitos.slice(2) : digitos;
    if (local.length < 10 || local.length > 11) {
      return {
        valido: false,
        telefoneE164: "",
        pais: "BR",
        erro: "Para o Brasil (+55), informe DDD + número (10 ou 11 dígitos).",
      };
    }
    return {
      valido: true,
      telefoneE164: `+55${local}`,
      pais: "BR",
      erro: null,
    };
  }

  if (digitos.length < 7 || digitos.length > 15) {
    return {
      valido: false,
      telefoneE164: "",
      pais: "OUTROS",
      erro: "Informe um número internacional válido (7 a 15 dígitos).",
    };
  }

  return {
    valido: true,
    telefoneE164: `+${digitos}`,
    pais: "OUTROS",
    erro: null,
  };
}

function gerarCodigoVerificacao() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function gerarCodigoPromocional() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function gerarCodigoRecibo() {
  const dataParte = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randParte = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `REC-${dataParte}-${randParte}`;
}

function gerarReferenciaPagamento(metodoId) {
  const prefixo = String(metodoId || "PAY")
    .toUpperCase()
    .slice(0, 3);
  return `${prefixo}-${Date.now().toString().slice(-6)}-${crypto
    .randomBytes(2)
    .toString("hex")
    .toUpperCase()}`;
}

const twilio = require("twilio");

async function enviarMensagemRecuperacao({ telefoneE164, pais, codigo, nome }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  const corpoMensagem = `AlphaTV (${pais}): Ola ${nome}, o teu codigo de recuperacao e ${codigo} (valido por 15 minutos).`;

  if (accountSid && authToken && fromNumber) {
    try {
      const client = twilio(accountSid, authToken);
      const resposta = await client.messages.create({
        body: corpoMensagem,
        from: fromNumber,
        to: telefoneE164,
      });
      console.log(
        `[SMS TWILIO ENVIADO] SID: ${resposta.sid} | Para: ${telefoneE164}`,
      );
      return { enviadoExterno: true, erroDetalhe: null };
    } catch (erro) {
      console.error("[ERRO SMS TWILIO]", {
        codigo: erro.code,
        status: erro.status,
        message: erro.message,
        para: telefoneE164,
        de: fromNumber,
      });
      return {
        enviadoExterno: false,
        erroDetalhe: erro.message || "Falha no envio SMS pela Twilio",
      };
    }
  }

  console.log(
    `[RECUPERACAO ${pais}] Destino: ${telefoneE164} | Codigo: ${codigo}`,
  );
  return {
    enviadoExterno: false,
    erroDetalhe: "Credenciais Twilio nao configuradas",
  };
}

module.exports = {
  PLANOS_SUBSCRICAO,
  METODOS_PAGAMENTO,
  obterPlano,
  normalizarTelefonePorPais,
  gerarCodigoVerificacao,
  gerarCodigoPromocional,
  gerarCodigoRecibo,
  gerarReferenciaPagamento,
  enviarMensagemRecuperacao,
};

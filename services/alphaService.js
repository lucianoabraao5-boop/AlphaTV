const crypto = require("crypto");

const PLANOS_SUBSCRICAO = {
  30: {
    dias: 30,
    nome: "Plano Mensal (30 dias)",
    valorBase: 9.99,
    moeda: "EUR",
  },
  60: {
    dias: 60,
    nome: "Plano Bimestral (60 dias)",
    valorBase: 17.99,
    moeda: "EUR",
  },
  90: {
    dias: 90,
    nome: "Plano Trimestral (90 dias)",
    valorBase: 24.99,
    moeda: "EUR",
  },
  180: {
    dias: 180,
    nome: "Plano Semestral (180 dias)",
    valorBase: 44.99,
    moeda: "EUR",
  },
};

const METODOS_PAGAMENTO = [
  { id: "mbway", nome: "MB WAY" },
  { id: "multibanco", nome: "Referência Multibanco" },
  { id: "cartao", nome: "Cartão de Crédito / Débito" },
  { id: "pix", nome: "PIX" },
  { id: "paypal", nome: "PayPal" },
];

function obterPlano(dias) {
  const num = Number(dias);
  return PLANOS_SUBSCRICAO[num] || null;
}

function normalizarTelefonePorPais(pais, telefoneBruto) {
  const codigoPais = String(pais || "PT")
    .trim()
    .toUpperCase();
  const raw = String(telefoneBruto || "").trim();
  const digitos = raw.replace(/\D/g, "");

  if (codigoPais === "PT") {
    let local = digitos;
    if (local.startsWith("00351")) local = local.slice(5);
    else if (local.startsWith("351") && local.length > 9)
      local = local.slice(3);

    if (!/^[1-9]\d{8}$/.test(local)) {
      return {
        valido: false,
        erro: "Para Portugal (+351), informe um número válido de 9 dígitos (ex: 912345678).",
      };
    }
    return {
      valido: true,
      pais: "PT",
      telefoneE164: `+351${local}`,
    };
  }

  if (codigoPais === "BR") {
    let local = digitos;
    if (local.startsWith("0055")) local = local.slice(4);
    else if (local.startsWith("55") && local.length >= 12)
      local = local.slice(2);

    if (!/^\d{10,11}$/.test(local)) {
      return {
        valido: false,
        erro: "Para o Brasil (+55), informe DDD + número com 10 ou 11 dígitos (ex: 11987654321).",
      };
    }
    return {
      valido: true,
      pais: "BR",
      telefoneE164: `+55${local}`,
    };
  }

  if (digitos.length < 7 || digitos.length > 15) {
    return {
      valido: false,
      erro: "Para outros países, informe o número internacional completo (7 a 15 dígitos).",
    };
  }

  return {
    valido: true,
    pais: "OUTROS",
    telefoneE164: raw.startsWith("+") ? `+${digitos}` : `+${digitos}`,
  };
}

function gerarCodigoPromocional() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function gerarCodigoRecibo() {
  const sufixo = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ATVR-${Date.now().toString().slice(-6)}-${sufixo}`;
}

function gerarReferenciaPagamento(metodoId) {
  const prefixoMap = {
    mbway: "MBW",
    multibanco: "MB",
    cartao: "CRD",
    pix: "PIX",
    paypal: "PPL",
  };
  const prefixo = prefixoMap[String(metodoId || "").toLowerCase()] || "PAG";
  const digitos = String(Math.floor(100000000 + Math.random() * 900000000));
  return `${prefixo}-${digitos}`;
}

module.exports = {
  PLANOS_SUBSCRICAO,
  METODOS_PAGAMENTO,
  obterPlano,
  normalizarTelefonePorPais,
  gerarCodigoPromocional,
  gerarCodigoRecibo,
  gerarReferenciaPagamento,
};

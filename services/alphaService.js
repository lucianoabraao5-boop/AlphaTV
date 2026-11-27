const crypto = require("crypto");

const PLANOS_SUBSCRICAO = {
  30: { dias: 30, nome: "Plano 30 Dias", valorBase: 9.99, moeda: "EUR" },
  60: { dias: 60, nome: "Plano 60 Dias", valorBase: 17.99, moeda: "EUR" },
  90: { dias: 90, nome: "Plano 90 Dias", valorBase: 24.99, moeda: "EUR" },
  180: { dias: 180, nome: "Plano 180 Dias", valorBase: 44.99, moeda: "EUR" },
  270: { dias: 270, nome: "Plano 270 Dias", valorBase: 64.99, moeda: "EUR" },
  360: { dias: 360, nome: "Plano 360 Dias", valorBase: 79.99, moeda: "EUR" },
};

const METODOS_PAGAMENTO_PADRAO = [
  {
    id: "pix",
    tipo: "pix",
    nome: "PIX",
    entidade: "21478",
    chavePix: "",
    numeroMbway: "",
    iban: "",
    detalhe: "Chave PIX configurada pelo administrador",
    ativo: true,
  },
  {
    id: "mbway",
    tipo: "mbway",
    nome: "MB WAY",
    entidade: "21478",
    chavePix: "",
    numeroMbway: "",
    iban: "",
    detalhe: "Entidade, referência e número MB WAY",
    ativo: true,
  },
  {
    id: "transferencia",
    tipo: "transferencia",
    nome: "Transferência Bancária",
    entidade: "21478",
    chavePix: "",
    numeroMbway: "",
    iban: "",
    detalhe: "Transferência bancária via IBAN",
    ativo: true,
  },
  {
    id: "cartao",
    tipo: "cartao",
    nome: "Cartão de Crédito / Débito",
    entidade: "21478",
    chavePix: "",
    numeroMbway: "",
    iban: "",
    detalhe: "Cadastro completo dos dados do cartão",
    ativo: true,
  },
];

const MOEDAS_WISE = [
  { codigo: "EUR", nome: "Euro (EUR)", simbolo: "€" },
  { codigo: "USD", nome: "Dólar Americano (USD)", simbolo: "$" },
  { codigo: "BRL", nome: "Real Brasileiro (BRL)", simbolo: "R$" },
  { codigo: "GBP", nome: "Libra Esterlina (GBP)", simbolo: "£" },
  { codigo: "CHF", nome: "Franco Suíço (CHF)", simbolo: "CHF" },
  { codigo: "CAD", nome: "Dólar Canadiano (CAD)", simbolo: "CA$" },
  { codigo: "AUD", nome: "Dólar Australiano (AUD)", simbolo: "A$" },
  { codigo: "JPY", nome: "Iene Japonês (JPY)", simbolo: "¥" },
  { codigo: "SEK", nome: "Coroa Sueca (SEK)", simbolo: "kr" },
  { codigo: "NOK", nome: "Coroa Norueguesa (NOK)", simbolo: "kr" },
  { codigo: "PLN", nome: "Zloty Polaco (PLN)", simbolo: "zł" },
  { codigo: "AOA", nome: "Kwanza Angolano (AOA)", simbolo: "Kz" },
  { codigo: "MZN", nome: "Metical Moçambicano (MZN)", simbolo: "MT" },
  { codigo: "CVE", nome: "Escudo Cabo-Verdiano (CVE)", simbolo: "CVE" },
];

function obterPlano(dias, precosPersonalizados = null) {
  const chave = Number(dias);
  const base = PLANOS_SUBSCRICAO[chave];
  if (!base) return null;

  const precoCustom =
    precosPersonalizados && precosPersonalizados[chave] !== undefined
      ? Number(precosPersonalizados[chave])
      : null;

  return {
    ...base,
    valorBase: precoCustom && precoCustom > 0 ? Number(precoCustom.toFixed(2)) : base.valorBase,
  };
}

function obterListaPlanos(precosPersonalizados = null) {
  return [30, 60, 90, 180, 270, 360].map((d) => obterPlano(d, precosPersonalizados));
}

function normalizarTelefonePorPais(pais, telefone) {
  const paisNorm = String(pais || "PT").toUpperCase();
  const bruto = String(telefone || "").trim();
  const digitos = bruto.replace(/\D/g, "");

  if (paisNorm === "PT") {
    const semIndicativo = digitos.startsWith("351") && digitos.length === 12 ? digitos.slice(3) : digitos;
    if (!/^\d{9}$/.test(semIndicativo)) {
      return { valido: false, erro: "Portugal: insira 9 dígitos válidos (ex: 912345678)." };
    }
    return { valido: true, pais: "PT", telefoneE164: `+351${semIndicativo}` };
  }

  if (paisNorm === "BR") {
    const semIndicativo = digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)
      ? digitos.slice(2)
      : digitos;
    if (!/^\d{10,11}$/.test(semIndicativo)) {
      return { valido: false, erro: "Brasil: insira DDD + número com 10 ou 11 dígitos." };
    }
    return { valido: true, pais: "BR", telefoneE164: `+55${semIndicativo}` };
  }

  if (digitos.length < 8 || digitos.length > 15) {
    return { valido: false, erro: "Telefone internacional inválido." };
  }
  return { valido: true, pais: "OUTROS", telefoneE164: `+${digitos}` };
}

function gerarCodigoPromocional() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function gerarCodigoRecibo() {
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  const num = Math.floor(100000 + Math.random() * 900000);
  return `ATVR-${num}-${rand}`;
}

function gerarReferenciaPagamento(tipoOuMetodo = "mbway", prefixo = "900") {
  const prefLimpo = String(prefixo || "900").replace(/\D/g, "").slice(0, 3).padEnd(3, "0");
  const bloco1 = String(Math.floor(100 + Math.random() * 900));
  const bloco2 = String(Math.floor(100 + Math.random() * 900));
  const ref9 = `${prefLimpo}${bloco1}${bloco2}`;

  const norm = String(tipoOuMetodo || "").toLowerCase();
  if (norm.includes("mbway")) return `MBW-${ref9}`;
  if (norm.includes("pix")) return `PIX-${ref9}`;
  if (norm.includes("cartao") || norm.includes("cartão")) return `CRD-${ref9}`;
  if (norm.includes("transfer")) return `TRF-${ref9}`;
  return `${prefLimpo} ${bloco1} ${bloco2}`;
}

module.exports = {
  PLANOS_SUBSCRICAO,
  METODOS_PAGAMENTO_PADRAO,
  MOEDAS_WISE,
  obterPlano,
  obterListaPlanos,
  normalizarTelefonePorPais,
  gerarCodigoPromocional,
  gerarCodigoRecibo,
  gerarReferenciaPagamento,
};
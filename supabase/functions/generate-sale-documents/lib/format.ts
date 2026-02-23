export type SpanishDateParts = {
  day: string;
  month: string;
  year: string;
};

export type PaymentMethodLike = {
  code?: string | null;
  name?: string | null;
};

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const UNITS = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
] as const;

const SPECIAL_TENS: Record<number, string> = {
  10: "DIEZ",
  11: "ONCE",
  12: "DOCE",
  13: "TRECE",
  14: "CATORCE",
  15: "QUINCE",
  16: "DIECISEIS",
  17: "DIECISIETE",
  18: "DIECIOCHO",
  19: "DIECINUEVE",
  20: "VEINTE",
  21: "VEINTIUNO",
  22: "VEINTIDOS",
  23: "VEINTITRES",
  24: "VEINTICUATRO",
  25: "VEINTICINCO",
  26: "VEINTISEIS",
  27: "VEINTISIETE",
  28: "VEINTIOCHO",
  29: "VEINTINUEVE",
};

const TENS = [
  "",
  "",
  "VEINTE",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
] as const;

const HUNDREDS: Record<number, string> = {
  1: "CIENTO",
  2: "DOSCIENTOS",
  3: "TRESCIENTOS",
  4: "CUATROCIENTOS",
  5: "QUINIENTOS",
  6: "SEISCIENTOS",
  7: "SETECIENTOS",
  8: "OCHOCIENTOS",
  9: "NOVECIENTOS",
};

function toSafePositiveInteger(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.trunc(value);
}

function convertTens(value: number): string {
  if (value < 10) {
    return UNITS[value];
  }

  if (value in SPECIAL_TENS) {
    return SPECIAL_TENS[value];
  }

  const ten = Math.trunc(value / 10);
  const unit = value % 10;

  return unit === 0 ? TENS[ten] : `${TENS[ten]} Y ${UNITS[unit]}`;
}

function convertHundreds(value: number): string {
  if (value === 0) {
    return "";
  }

  if (value === 100) {
    return "CIEN";
  }

  if (value < 100) {
    return convertTens(value);
  }

  const hundred = Math.trunc(value / 100);
  const remainder = value % 100;
  const hundredPart = HUNDREDS[hundred];
  const remainderPart = convertTens(remainder);

  return remainderPart ? `${hundredPart} ${remainderPart}` : hundredPart;
}

function convertThousands(value: number): string {
  if (value < 1000) {
    return convertHundreds(value);
  }

  const thousands = Math.trunc(value / 1000);
  const remainder = value % 1000;

  const thousandsPart = thousands === 1
    ? "MIL"
    : `${convertHundreds(thousands)} MIL`;

  const remainderPart = convertHundreds(remainder);
  return remainderPart ? `${thousandsPart} ${remainderPart}` : thousandsPart;
}

function convertMillions(value: number): string {
  const millions = Math.trunc(value / 1_000_000);
  const remainder = value % 1_000_000;

  const millionsPart = millions === 1
    ? "UN MILLON"
    : `${convertHundreds(millions)} MILLONES`;

  const remainderPart = convertThousands(remainder);
  return remainderPart ? `${millionsPart} ${remainderPart}` : millionsPart;
}

export function safeUpper(s: string | null): string {
  if (typeof s !== "string") {
    return "";
  }

  return s.trim().toUpperCase();
}

export function formatCopNumber(value: number): string {
  const normalized = toSafePositiveInteger(value);
  if (normalized === null) {
    return "";
  }

  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(normalized);
}

export function copToWords(value: number): string {
  const normalized = toSafePositiveInteger(value);
  if (normalized === null || normalized > 999_999_999) {
    return "";
  }

  const words = normalized < 1_000_000
    ? convertThousands(normalized)
    : convertMillions(normalized);

  return `${words} DE PESOS M/CTE`;
}

export function formatDateISOToSpanish(saleDate: string): SpanishDateParts {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(saleDate);
  if (!match) {
    return { day: "", month: "", year: "" };
  }

  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;

  if (monthIndex < 0 || monthIndex > 11) {
    return { day: "", month: "", year: "" };
  }

  return {
    day,
    month: MONTHS_ES[monthIndex],
    year,
  };
}

export function mapPaymentMethodName(
  paymentMethodCode: string | null | undefined,
  paymentMethods: PaymentMethodLike[] | null | undefined,
): string {
  const code = safeUpper(paymentMethodCode ?? null);
  if (!code || !Array.isArray(paymentMethods)) {
    return "";
  }

  const found = paymentMethods.find((method) => safeUpper(method.code ?? null) === code);
  return safeUpper(found?.name ?? null);
}

/*
Self-check rápido (manual):

console.log(formatCopNumber(20000000)); // 20.000.000
console.log(formatCopNumber(1500000)); // 1.500.000
console.log(formatCopNumber(100000000)); // 100.000.000
console.log(formatCopNumber(0)); // ""

console.log(copToWords(20000000)); // VEINTE MILLONES DE PESOS M/CTE
console.log(copToWords(1500000)); // UN MILLON QUINIENTOS MIL DE PESOS M/CTE
console.log(copToWords(100000000)); // CIEN MILLONES DE PESOS M/CTE
console.log(copToWords(0)); // ""

console.log(formatDateISOToSpanish("2026-02-09")); // { day: "09", month: "febrero", year: "2026" }
console.log(safeUpper("  contado ")); // CONTADO
console.log(mapPaymentMethodName("cash", [{ code: "CASH", name: "Efectivo" }])); // EFECTIVO
*/

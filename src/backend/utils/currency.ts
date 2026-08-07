export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export const supportedCurrencies: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
];

export const defaultCurrency: CurrencyInfo = supportedCurrencies[0];

export const currencyMap = new Map(
  supportedCurrencies.map((currency) => [currency.code, currency]),
);

export const getCurrencyByCode = (code?: string | null): CurrencyInfo => {
  if (!code) return defaultCurrency;
  return currencyMap.get(code.toUpperCase()) || defaultCurrency;
};

export const normalizeCurrency = (
  currency?: string | Partial<CurrencyInfo> | null,
): CurrencyInfo => {
  if (!currency) return defaultCurrency;

  if (typeof currency === "string") {
    return getCurrencyByCode(currency);
  }

  const code = currency.code?.toUpperCase();
  if (code && currencyMap.has(code)) {
    const fallback = getCurrencyByCode(code);
    return {
      code,
      symbol: currency.symbol || fallback.symbol,
      name: currency.name || fallback.name,
    };
  }

  return defaultCurrency;
};

export const formatAmount = (
  amount: number,
  currency?: string | Partial<CurrencyInfo> | null,
  locale = "en-US",
) => {
  const normalized = normalizeCurrency(currency);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalized.code,
    currencyDisplay: "narrowSymbol",
  }).format(Number(amount || 0));
};

import type { AppCurrency } from "@/types/database";

const LOCALE_BY_CURRENCY: Record<AppCurrency, string> = {
  NGN: "en-NG",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

/**
 * Always format through Intl.NumberFormat - never manually concatenate a
 * currency symbol and never emit escaped unicode literals like \u20A6.
 */
export function formatCurrency(amount: number, currency: AppCurrency = "NGN", opts?: { showDecimals?: boolean }) {
  const showDecimals = opts?.showDecimals ?? false;
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount ?? 0);
}

export function formatCompactCurrency(amount: number, currency: AppCurrency = "NGN") {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount ?? 0);
}

export const CURRENCIES: AppCurrency[] = ["NGN", "USD", "EUR", "GBP"];

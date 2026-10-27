import { format } from "date-fns";

const pad = (n: number) => String(n).padStart(2, "0");

/** First and last day of a month as yyyy-MM-dd (used for <input type="date" min/max>). */
export function monthBounds(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this one
  return {
    min: `${year}-${pad(month)}-01`,
    max: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

export function isDateInMonth(date: string, year: number, month: number) {
  if (!date) return false;
  const { min, max } = monthBounds(year, month);
  return date >= min && date <= max; // ISO dates compare correctly as strings
}

/** Today if it falls inside the month, otherwise the first day of that month. */
export function defaultDateFor(year: number, month: number) {
  const today = format(new Date(), "yyyy-MM-dd");
  return isDateInMonth(today, year, month) ? today : monthBounds(year, month).min;
}

export function monthLabel(year: number, month: number) {
  return format(new Date(year, month - 1, 1), "MMMM yyyy");
}

import { useSyncExternalStore } from "react";

/**
 * App-wide month selection.
 *
 * One tiny module-level store (no provider needed) so every screen that shows
 * a month selector - Dashboard, History, Income, category pages, Reports -
 * reads and writes the SAME value. Pick "March" on the Dashboard and History
 * opens on March too.
 *
 * `month: null` means "All" (every month combined).
 * The choice is kept in sessionStorage so it survives a page refresh but a
 * fresh app session starts on the current month again.
 */
export interface MonthFilterState {
  year: number;
  /** 1-12, or null for "All" */
  month: number | null;
}

const STORAGE_KEY = "ked-finance:month-filter";

export function currentPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function load(): MonthFilterState {
  try {
    if (typeof window !== "undefined") {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MonthFilterState> | null;
        const year = parsed?.year;
        const month = parsed?.month;
        const yearOk = typeof year === "number" && Number.isInteger(year) && year >= 2000 && year <= 2100;
        const monthOk =
          month === null || (typeof month === "number" && Number.isInteger(month) && month >= 1 && month <= 12);
        if (yearOk && monthOk) return { year, month };
      }
    }
  } catch {
    // storage unavailable (private mode etc.) - fall through to the default
  }
  return currentPeriod();
}

let state: MonthFilterState = load();
const listeners = new Set<() => void>();

function emit(next: MonthFilterState) {
  if (next.year === state.year && next.month === state.month) return;
  state = next; // new object only when something changed, so snapshots stay stable
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore - selection just won't survive a refresh
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

/** Select one specific month. */
export function selectMonth(year: number, month: number) {
  emit({ year, month });
}

/** Select "All" (keeps the last year so the dropdown still has context). */
export function selectAllMonths() {
  emit({ year: state.year, month: null });
}

export function useMonthFilter() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    year: s.year,
    month: s.month,
    isAll: s.month === null,
    selectMonth,
    selectAllMonths,
  };
}

/**
 * For screens that can only work on one concrete month (Reports: closing a
 * month, the monthly overview...). It follows the shared selection, and while
 * the shared selection is "All" it simply shows the current month.
 */
export function useReportMonth() {
  const f = useMonthFilter();
  const cur = currentPeriod();
  return {
    year: f.isAll ? cur.year : f.year,
    month: f.month ?? cur.month,
  };
}

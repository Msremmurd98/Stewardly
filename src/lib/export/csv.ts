import Papa from "papaparse";
import { format, parseISO } from "date-fns";
import { CATEGORY_LABELS } from "@/lib/allocation";
import { formatCurrency } from "@/lib/currency";
import type { ExportBundle } from "./shared";
import { downloadBlob } from "./download";

/** Transaction-level CSV export (spec §24: "CSV: Transaction-level export."). */
export function exportTransactionsToCSV(bundle: ExportBundle) {
  const rows = bundle.transactions.map((t) => ({
    ID: t.id,
    Category: CATEGORY_LABELS[t.category],
    Amount: t.amount,
    "Amount (formatted)": formatCurrency(t.amount, bundle.currency, { showDecimals: true }),
    Date: format(parseISO(t.transaction_date), "yyyy-MM-dd"),
    Narration: t.narration ?? "",
    "Created At": t.created_at,
  }));

  const csv = Papa.unparse(rows);
  const filename = `KED-Finance_${bundle.monthLabel.replace(/\s+/g, "-")}_transactions.csv`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

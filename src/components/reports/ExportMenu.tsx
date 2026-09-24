import { useState } from "react";
import { FileText, FileSpreadsheet, FileDown } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import type { AppCurrency, MonthlyAccount } from "@/types/database";

interface ExportMenuProps {
  account: MonthlyAccount;
  currency: AppCurrency;
}

type Format = "pdf" | "csv" | "xlsx" | null;

export function ExportMenu({ account, currency }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Format>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(fmt: Exclude<Format, null>) {
    setError(null);
    setPending(fmt);
    try {
      // ExcelJS and jsPDF are large libraries only needed at export time, so
      // they're dynamically imported here rather than bundled into the main
      // app shell - keeps the PWA's precached app shell small and the
      // initial load fast (spec §29).
      const { buildExportBundle } = await import("@/lib/export/shared");
      const bundle = await buildExportBundle(account, currency);

      if (fmt === "csv") {
        const { exportTransactionsToCSV } = await import("@/lib/export/csv");
        exportTransactionsToCSV(bundle);
      }
      if (fmt === "xlsx") {
        const { exportMonthlyReportToExcel } = await import("@/lib/export/excel");
        await exportMonthlyReportToExcel(bundle);
      }
      if (fmt === "pdf") {
        const { exportMonthlyReportToPDF } = await import("@/lib/export/pdf");
        exportMonthlyReportToPDF(bundle);
      }
      setOpen(false);
    } catch (err) {
      setError((err as Error).message || "Export failed. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <FileDown className="mr-2 h-4 w-4" /> Export Report
      </Button>

      <ResponsiveModal open={open} onOpenChange={setOpen} title="Export Report">
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Exports use only this month's data from your own account — nothing from other users.
          </p>

          <ExportOption
            icon={FileText}
            label="PDF Report"
            description="Printable summary, categories, goals and transactions."
            loading={pending === "pdf"}
            disabled={pending !== null}
            onClick={() => handleExport("pdf")}
          />
          <ExportOption
            icon={FileSpreadsheet}
            label="Excel (.xlsx)"
            description="Summary, Transactions, Categories, Savings Goals & Comparison sheets."
            loading={pending === "xlsx"}
            disabled={pending !== null}
            onClick={() => handleExport("xlsx")}
          />
          <ExportOption
            icon={FileDown}
            label="CSV"
            description="Transaction-level export, one row per transaction."
            loading={pending === "csv"}
            disabled={pending !== null}
            onClick={() => handleExport("csv")}
          />

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </ResponsiveModal>
    </>
  );
}

function ExportOption({
  icon: Icon,
  label,
  description,
  loading,
  disabled,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  description: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-left disabled:opacity-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-foreground">{loading ? "Preparing..." : label}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
    </button>
  );
}

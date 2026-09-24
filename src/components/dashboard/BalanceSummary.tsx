import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import type { AppCurrency } from "@/types/database";

interface BalanceSummaryProps {
  currentBalance: number;
  income: number;
  outflows: number;
  changePercent?: number | null;
  currency: AppCurrency;
}

export function BalanceSummary({ currentBalance, income, outflows, changePercent, currency }: BalanceSummaryProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Total Balance</span>
        {changePercent != null && (
          <span className="flex items-center gap-1 text-sm font-semibold text-success">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            {changePercent >= 0 ? "+" : ""}
            {changePercent.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-4xl font-extrabold tracking-tight text-foreground">
        {formatCurrency(currentBalance, currency)}
      </p>

      <div className="mt-4 flex gap-3">
        <div className="flex-1 rounded-xl border-l-4 border-success bg-surface px-3 py-2">
          <span className="flex items-center gap-1 text-xs font-medium text-muted">
            <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden="true" /> Income
          </span>
          <p className="mt-0.5 text-lg font-bold text-foreground">{formatCurrency(income, currency)}</p>
        </div>
        <div className="flex-1 rounded-xl border-l-4 border-warning bg-surface px-3 py-2">
          <span className="flex items-center gap-1 text-xs font-medium text-muted">
            <TrendingDown className="h-3.5 w-3.5 text-warning" aria-hidden="true" /> Expense
          </span>
          <p className="mt-0.5 text-lg font-bold text-foreground">{formatCurrency(outflows, currency)}</p>
        </div>
      </div>
    </div>
  );
}

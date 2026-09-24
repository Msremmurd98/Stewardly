import { calculateAllocation } from "@/lib/finance";
import { formatCurrency } from "@/lib/currency";
import { CATEGORY_LABELS } from "@/lib/allocation";
import type { AppCurrency } from "@/types/database";

export function IncomeAllocationPreview({ amount, currency }: { amount: number; currency: AppCurrency }) {
  const allocation = calculateAllocation(amount);
  const rows: Array<[keyof typeof allocation, number]> = [
    ["tithe", 10],
    ["investment", 30],
    ["giving", 30],
    ["expense", 20],
    ["savings", 10],
  ];

  return (
    <div className="mt-4 rounded-2xl bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Allocation Preview</p>
      <ul className="mt-2 divide-y divide-border">
        {rows.map(([key, pct]) => (
          <li key={key} className="flex items-center justify-between py-2 text-sm">
            <span className="text-foreground">
              {CATEGORY_LABELS[key]} <span className="text-muted">{pct}%</span>
            </span>
            <span className="font-semibold text-foreground">{formatCurrency(allocation[key], currency)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">
        This split is fixed and cannot be changed. It's calculated automatically from your income.
      </p>
    </div>
  );
}

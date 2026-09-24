import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import type { AppCurrency } from "@/types/database";

interface IncomeCardProps {
  totalIncome: number;
  transactionCount: number;
  currency: AppCurrency;
}

/** Income never shows "remaining allocation" - it's the source, not a spend category. */
export function IncomeCard({ totalIncome, transactionCount, currency }: IncomeCardProps) {
  return (
    <Link
      to="/income"
      className="block rounded-2xl bg-category-income p-5 text-category-income-fg transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Income</h3>
          <p className="mt-0.5 text-xs opacity-70">{transactionCount} Transactions</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/60">
          <TrendingUp className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-2xl font-extrabold">{formatCurrency(totalIncome, currency)}</p>
    </Link>
  );
}

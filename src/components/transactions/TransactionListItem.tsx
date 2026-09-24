import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { CATEGORY_LABELS } from "@/lib/allocation";
import type { AppCurrency, Transaction } from "@/types/database";

interface TransactionListItemProps {
  transaction: Transaction;
  currency: AppCurrency;
  onClick?: () => void;
}

export function TransactionListItem({ transaction, currency, onClick }: TransactionListItemProps) {
  const isIncome = transaction.category === "income";
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-left transition-colors hover:bg-background"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {transaction.narration || CATEGORY_LABELS[transaction.category]}
        </p>
        <p className="text-xs text-muted">
          {CATEGORY_LABELS[transaction.category]} · {format(parseISO(transaction.transaction_date), "d MMM yyyy")}
        </p>
      </div>
      <span className={`shrink-0 pl-3 text-sm font-bold ${isIncome ? "text-success" : "text-foreground"}`}>
        {isIncome ? "+" : "-"}
        {formatCurrency(transaction.amount, currency)}
      </span>
    </button>
  );
}

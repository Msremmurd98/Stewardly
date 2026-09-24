import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { CircularProgress } from "@/components/dashboard/CircularProgress";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { TransactionDetailModal } from "@/components/transactions/TransactionDetailModal";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { useProfile } from "@/hooks/useProfile";
import { useMonthlyAccount } from "@/hooks/useMonthlyAccount";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/currency";
import { calculateUsagePercentage } from "@/lib/finance";
import { CATEGORY_LABELS, type AllocatableCategory } from "@/lib/allocation";
import type { Transaction } from "@/types/database";
import BalanceGauge from "@/components/dashboard/BalanceGauge";

export default function CategoryDetail() {
  const { category } = useParams<{ category: AllocatableCategory }>();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "NGN";
  const { data: account, isLoading } = useMonthlyAccount(year, month);
  const { data: transactions } = useTransactions(account?.id);

  const categoryTransactions = useMemo(
    () => (transactions ?? []).filter((t) => t.category === category),
    [transactions, category]
  );

  if (!category) return null;

  const allocated = account?.[`${category}_allocated` as const] ?? 0;
  const used = account?.[`${category}_used` as const] ?? 0;
  const remaining = allocated - used;
  const pct = calculateUsagePercentage(used, allocated);

  return (
    <AppShell>
      <header className="flex items-center justify-between pt-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold text-foreground">{CATEGORY_LABELS[category]}</h1>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </header>

      {isLoading ? (
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <>
          <section className="mt-6 flex flex-col items-center rounded-2xl bg-surface py-8 shadow-card">
         
<div className="mx-auto max-w-sm">
  <BalanceGauge  balance={remaining} pct={pct} />
</div>
            <div className="mt-6 flex w-full divide-x divide-border px-6">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted">Spent</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(used, currency)}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-muted">Allocated</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(allocated, currency)}</p>
              </div>
            </div>
          </section>

          <section className="mt-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Transactions</h2>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </section>

          <section className="mt-3 space-y-2">
            {categoryTransactions.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">No {CATEGORY_LABELS[category].toLowerCase()} transactions yet.</p>
            )}
            {categoryTransactions.map((t) => (
              <TransactionListItem key={t.id} transaction={t} currency={currency} onClick={() => setSelected(t)} />
            ))}
          </section>
        </>
      )}

      <TransactionDetailModal
        transaction={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        year={year}
        month={month}
        monthClosed={account?.status === "CLOSED"}
      />
      <AddTransactionModal
        open={addOpen}
        onOpenChange={setAddOpen}
        year={year}
        month={month}
        defaultTab="category"
        defaultCategory={category}
      />
    </AppShell>
  );
}

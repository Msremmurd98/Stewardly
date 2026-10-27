import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MonthFilterSelector } from "@/components/dashboard/MonthFilterSelector";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { TransactionDetailModal } from "@/components/transactions/TransactionDetailModal";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { useProfile } from "@/hooks/useProfile";
import { useMonthScope } from "@/hooks/useMonthScope";
import { formatCurrency } from "@/lib/currency";
import type { Transaction } from "@/types/database";

export default function Income() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "NGN";
  const { account, transactions, isLoading, isAll, periodFor, writePeriod } = useMonthScope();
  const selectedPeriod = periodFor(selected);
  const incomeTransactions = (transactions ?? []).filter((t) => t.category === "income");

  return (
    <AppShell>
      <header className="flex items-center justify-between pt-2">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Income</h1>
        <MonthFilterSelector />
      </header>

      {isLoading ? (
        <div className="mt-8 h-32 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <section className="mt-6 rounded-2xl bg-category-income p-6 text-category-income-fg shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Total Income</p>
          <p className="mt-1 text-3xl font-extrabold">{formatCurrency(account?.total_income ?? 0, currency)}</p>
          <p className="mt-1 text-xs opacity-70">{incomeTransactions.length} transactions {isAll ? "across all months" : "this month"}</p>
        </section>
      )}

      <section className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Transactions</h2>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add Income
        </button>
      </section>

      <section className="mt-3 space-y-2">
        {incomeTransactions.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">{isAll ? "No income recorded yet." : "No income recorded this month."}</p>
        )}
        {incomeTransactions.map((t) => (
          <TransactionListItem key={t.id} transaction={t} currency={currency} onClick={() => setSelected(t)} />
        ))}
      </section>

      <TransactionDetailModal
        transaction={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        year={selectedPeriod.year}
        month={selectedPeriod.month}
        monthClosed={selectedPeriod.closed}
      />
      <AddTransactionModal open={addOpen} onOpenChange={setAddOpen} year={writePeriod.year} month={writePeriod.month} defaultTab="income" />
    </AppShell>
  );
}

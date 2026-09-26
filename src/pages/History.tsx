import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { TransactionDetailModal } from "@/components/transactions/TransactionDetailModal";
import { useProfile } from "@/hooks/useProfile";
import { useMonthlyAccount } from "@/hooks/useMonthlyAccount";
import { useTransactions } from "@/hooks/useTransactions";
import { CATEGORY_LABELS } from "@/lib/allocation";
import type { Transaction, TransactionCategory } from "@/types/database";
import { CalendarDays, Search, X } from "lucide-react";

const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All Categories" },
  ...(["income", "tithe", "investment", "giving", "expense", "savings"] as TransactionCategory[]).map((c) => ({
    value: c,
    label: CATEGORY_LABELS[c],
  })),
];

export default function History() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);

  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "NGN";
  const { data: account } = useMonthlyAccount(year, month);
  const { data: transactions, isLoading } = useTransactions(account?.id);

  const filtered = useMemo(() => {
    return (transactions ?? []).filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (dateFilter && t.transaction_date !== dateFilter) return false;
      if (search && !(t.narration ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, categoryFilter, dateFilter, search]);

  return (
    <AppShell>
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-extrabold text-foreground">History</h1>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </header>

      <div className="mt-4 space-y-3">
        <Input
          placeholder="Search narration..."
          icon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter} options={CATEGORY_FILTER_OPTIONS} />
         <div className="relative">
  <CalendarDays
    className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted"
    aria-hidden="true"
  />

  <Input
    type="date"
    value={dateFilter}
    onChange={(e) => setDateFilter(e.target.value)}
    aria-label="Filter by date"
    className="pl-9 pr-9"
  />

  {dateFilter && (
    <button
      type="button"
      onClick={() => setDateFilter("")}
      aria-label="Clear date filter"
      className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted/10 active:bg-muted/20"
    >
      <X className="h-4 w-4" />
    </button>
  )}
</div>
        </div>
      </div>

      <section className="mt-5 space-y-2">
        {isLoading && <div className="h-24 animate-pulse rounded-xl bg-surface" />}
        {!isLoading && filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No transactions match your filters.</p>
        )}
        {filtered.map((t) => (
          <TransactionListItem key={t.id} transaction={t} currency={currency} onClick={() => setSelected(t)} />
        ))}
      </section>

      <TransactionDetailModal
        transaction={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        year={year}
        month={month}
        monthClosed={account?.status === "CLOSED"}
      />
    </AppShell>
  );
}

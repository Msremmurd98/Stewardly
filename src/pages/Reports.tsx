import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/reports/ExportMenu";
import { TrendChart } from "@/components/reports/TrendChart";
import { useProfile } from "@/hooks/useProfile";
import { useMonthlyAccount, useMonthlyAccounts } from "@/hooks/useMonthlyAccount";
import { useCloseMonth, useReopenMonth } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/currency";
import { calculateUsagePercentage } from "@/lib/finance";
import { CATEGORY_LABELS, type AllocatableCategory } from "@/lib/allocation";

const CATEGORIES: AllocatableCategory[] = ["tithe", "investment", "giving", "expense", "savings"];

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);

  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "NGN";
  const { data: account, isLoading } = useMonthlyAccount(year, month);
  const { data: allAccounts } = useMonthlyAccounts();
  const closeMonth = useCloseMonth(year, month);
  const reopenMonth = useReopenMonth(year, month);

  if (isLoading || !account) {
    return (
      <AppShell>
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface" />
      </AppShell>
    );
  }

  const monthLabel = new Date(year, month - 1).toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <AppShell>
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-extrabold text-foreground">Reports</h1>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </header>

      <section className="mt-6 rounded-2xl bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">Your {monthLabel} Financial Overview</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Opening Balance" value={formatCurrency(account.opening_balance, currency)} />
          <Row label="Income" value={formatCurrency(account.total_income, currency)} />
          <Row label="Spent / Transferred" value={formatCurrency(account.total_outflows, currency)} />
          <Row label="Current Balance" value={formatCurrency(account.current_balance, currency)} bold />
          {account.status === "CLOSED" && (
            <Row label="Closing Balance" value={formatCurrency(account.closing_balance ?? 0, currency)} bold />
          )}
        </dl>
      </section>

          <section className="mt-4">
       <TrendChart
  accounts={allAccounts ?? []}
  currency={currency}
  selectedYear={year}
  selectedMonth={month}
/>
      </section>


      <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">Category Breakdown</h2>
        <ul className="mt-3 divide-y divide-border">
          {CATEGORIES.map((c) => {
            const allocated = account[`${c}_allocated` as const];
            const used = account[`${c}_used` as const];
            const pct = calculateUsagePercentage(used, allocated);
            return (
              <li key={c} className="py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{CATEGORY_LABELS[c]}</span>
                  <span className="text-muted">{Math.round(pct)}%</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted">
                  <span>Allocated {formatCurrency(allocated, currency)}</span>
                  <span>Spent {formatCurrency(used, currency)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

     <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">Financial Health</h2>
        <p className="mt-1 text-xs text-muted">
          Factual allocation rates for this month. Not a subjective score — just what's actually allocated.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Tithe rate" value={`${Math.round(account.tithe_percentage * 100)}%`} />
          <Row label="Investment rate" value={`${Math.round(account.investment_percentage * 100)}%`} />
          <Row label="Giving rate" value={`${Math.round(account.giving_percentage * 100)}%`} />
          <Row label="Expense rate" value={`${Math.round(account.expense_percentage * 100)}%`} />
          <Row label="Savings rate" value={`${Math.round(account.savings_percentage * 100)}%`} />
        </dl>
      </section>

      <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">Month Closing</h2>
        <p className="mt-1 text-xs text-muted">
          {account.status === "OPEN"
            ? "Closing locks this month's transactions and carries the closing balance into next month as its opening balance."
            : "This month is closed. Reopening requires confirmation and unlocks transactions again."}
        </p>

        {account.status === "OPEN" && !confirmClose && (
          <Button className="mt-4 w-full" onClick={() => setConfirmClose(true)}>
            Close {monthLabel}
          </Button>
        )}
        {account.status === "OPEN" && confirmClose && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-foreground">
              Closing balance will be {formatCurrency(account.current_balance, currency)}. Confirm?
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmClose(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={closeMonth.isPending}
                onClick={async () => {
                  await closeMonth.mutateAsync(account.id);
                  setConfirmClose(false);
                }}
              >
                {closeMonth.isPending ? "Closing..." : "Confirm Close"}
              </Button>
            </div>
          </div>
        )}

        {account.status === "CLOSED" && !confirmReopen && (
          <Button variant="secondary" className="mt-4 w-full" onClick={() => setConfirmReopen(true)}>
            Reopen {monthLabel}
          </Button>
        )}
        {account.status === "CLOSED" && confirmReopen && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-foreground">Reopening allows transactions to be added, edited and deleted again. Confirm?</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmReopen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={reopenMonth.isPending}
                onClick={async () => {
                  await reopenMonth.mutateAsync(account.id);
                  setConfirmReopen(false);
                }}
              >
                {reopenMonth.isPending ? "Reopening..." : "Confirm Reopen"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4">
        <ExportMenu account={account} currency={currency} />
      </section>
    </AppShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={bold ? "font-bold text-foreground" : "font-medium text-foreground"}>{value}</dd>
    </div>
  );
}

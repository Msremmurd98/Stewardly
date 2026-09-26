import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { BalanceSummary } from "@/components/dashboard/BalanceSummary";
import { IncomeCard } from "@/components/dashboard/IncomeCard";
import { CategoryCard } from "@/components/dashboard/CategoryCard";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useMonthlyAccount } from "@/hooks/useMonthlyAccount";
import { useTransactions } from "@/hooks/useTransactions";
import { budgetWarningMessage } from "@/lib/finance";
import type { AllocatableCategory } from "@/lib/allocation";

const CATEGORIES: AllocatableCategory[] = [
  "tithe",
  "investment",
  "giving",
  "expense",
  "savings",
];

type WarningPhase = "visible" | "exiting" | "hidden";

export default function Dashboard() {
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [addOpen, setAddOpen] = useState(false);

  const [warningPhase, setWarningPhase] =
    useState<WarningPhase>("visible");

  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: account, isLoading } = useMonthlyAccount(
    year,
    month,
  );
  const { data: transactions } = useTransactions(account?.id);

  const currency = profile?.currency ?? "NGN";

  const firstName = (
    profile?.full_name ??
    user?.email ??
    "there"
  ).split(" ")[0];

  const counts = useMemo(() => {
    const map: Record<string, number> = {};

    for (const t of transactions ?? []) {
      map[t.category] =
        (map[t.category] ?? 0) + 1;
    }

    return map;
  }, [transactions]);

  const warnings = useMemo(() => {
    if (!account) return [];

    return CATEGORIES.map((c) => {
      const allocated =
        account[`${c}_allocated` as const];

      const used =
        account[`${c}_used` as const];

      const msg = budgetWarningMessage(
        c,
        used,
        allocated,
      );

      return msg
        ? {
            category: c,
            message: msg,
          }
        : null;
    }).filter(Boolean) as {
      category: string;
      message: string;
    }[];
  }, [account]);

  /*
   * Warning timing:
   *
   * 0 - 20 seconds:
   *     Warnings remain completely normal.
   *
   * At 20 seconds:
   *     Start the shake + disappearance animation.
   *
   * 20 - 23 seconds:
   *     Warning cards animate out.
   *
   * After 23 seconds:
   *     Remove them from the page.
   */
  useEffect(() => {
    if (warnings.length === 0) {
      setWarningPhase("hidden");
      return;
    }

    // Whenever the month/account changes,
    // bring warnings back and restart the timer.
    setWarningPhase("visible");

    const exitTimer = window.setTimeout(() => {
      setWarningPhase("exiting");
    }, 5000);

    const hideTimer = window.setTimeout(() => {
      setWarningPhase("hidden");
    }, 7500);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [year, month, warnings.length]);

  return (
    <AppShell>
      <header className="dashboard-stagger dashboard-delay-1 flex items-center justify-between pt-2">
        <div>
          <p className="text-sm text-muted">
            Hi {firstName},{" "}
            <span className="font-medium text-foreground">
              Here's
            </span>
          </p>

          <p className="text-sm text-muted">
            Your Account Summary
          </p>
        </div>

        <MonthSelector
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </header>

      {isLoading || !account ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <>
          <section className="dashboard-stagger dashboard-delay-2 mt-6">
            <BalanceSummary
              currentBalance={account.current_balance}
              income={account.total_income}
              outflows={account.total_outflows}
              currency={currency}
            />
          </section>

          {warningPhase !== "hidden" &&
            warnings.length > 0 && (
              <section
                className="mt-5 space-y-2"
                aria-label="Budget warnings"
              >
                {warnings.map((w, index) => (
                  <div
                    key={w.category}
                    className={
                      warningPhase === "exiting"
                        ? "dashboard-warning-exit rounded-xl bg-category-giving px-4 py-3 text-sm text-category-giving-fg"
                        : "rounded-xl bg-category-giving px-4 py-3 text-sm text-category-giving-fg"
                    }
                    style={
                      warningPhase === "exiting"
                        ? {
                            animationDelay: `${index * 180}ms`,
                          }
                        : undefined
                    }
                  >
                    ⚠️ {w.message}
                  </div>
                ))}
              </section>
            )}

          {account.status === "CLOSED" && (
            <section className="dashboard-stagger dashboard-delay-3 mt-5 rounded-xl bg-foreground px-4 py-3 text-sm text-white">
              This month is closed. Reopen it from Reports to
              make changes.
            </section>
          )}

          <section className="mt-6 space-y-3">
            <div className="dashboard-stagger dashboard-delay-4">
              <IncomeCard
                totalIncome={account.total_income}
                transactionCount={
                  counts.income ?? 0
                }
                currency={currency}
              />
            </div>

            {CATEGORIES.map((c, index) => (
              <div
                key={c}
                className="dashboard-stagger"
                style={{
                  animationDelay: `${650 + index * 150}ms`,
                }}
              >
                <CategoryCard
                  category={c}
                  allocated={
                    account[`${c}_allocated` as const]
                  }
                  used={
                    account[`${c}_used` as const]
                  }
                  transactionCount={
                    counts[c] ?? 0
                  }
                  currency={currency}
                />
              </div>
            ))}
          </section>
        </>
      )}

      <button
        onClick={() => setAddOpen(true)}
        className="dashboard-stagger dashboard-delay-6 fixed bottom-24 right-5 z-20 hidden h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-card sm:flex"
      >
        + Quick Add
      </button>

      {account && (
        <AddTransactionModal
          open={addOpen}
          onOpenChange={setAddOpen}
          year={year}
          month={month}
        />
      )}
    </AppShell>
  );
}

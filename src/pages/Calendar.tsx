import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { TransactionListItem } from "@/components/transactions/TransactionListItem";
import { TransactionDetailModal } from "@/components/transactions/TransactionDetailModal";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { useProfile } from "@/hooks/useProfile";
import { useMonthlyAccount } from "@/hooks/useMonthlyAccount";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransactionsByDate } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/database";

export default function CalendarPage() {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;

  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "NGN";
  const { data: account } = useMonthlyAccount(year, month);
  const { data: monthTransactions } = useTransactions(account?.id);

  const datesWithTransactions = useMemo(() => {
    const set = new Set<string>();
    for (const t of monthTransactions ?? []) set.add(t.transaction_date);
    return set;
  }, [monthTransactions]);

  const gridStart = startOfWeek(startOfMonth(cursor));
  const gridEnd = endOfWeek(endOfMonth(cursor));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined;
  const { data: dayTransactions } = useTransactionsByDate(selectedDateKey);

  return (
    <AppShell>
      <header className="flex items-center justify-between pt-2">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Calendar</h1>
        <div className="w-10" />
      </header>

      <section className="mt-4 rounded-2xl bg-surface p-4 shadow-card">
        <div className="flex items-center justify-between">
          <button onClick={() => setCursor((c) => subMonths(c, 1))} aria-label="Previous month" className="rounded-full p-2 hover:bg-background">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-foreground">{format(cursor, "MMMM yyyy")}</p>
          <button onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month" className="rounded-full p-2 hover:bg-background">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const hasTxns = datesWithTransactions.has(key);
            const inMonth = isSameMonth(day, cursor);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex h-10 flex-col items-center justify-center rounded-xl text-xs",
                  inMonth ? "text-foreground" : "text-muted/40",
                  isSelected && "bg-primary text-primary-foreground"
                )}
              >
                {format(day, "d")}
                <span
                  className={cn(
                    "mt-0.5 h-1 w-1 rounded-full",
                    hasTxns ? (isSelected ? "bg-white" : "bg-foreground") : "bg-transparent"
                  )}
                />
              </button>
            );
          })}
        </div>
      </section>

      <ResponsiveModal
        open={!!selectedDate}
        onOpenChange={(open) => !open && setSelectedDate(null)}
        title={selectedDate ? format(selectedDate, "MMMM d") : ""}
      >
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {(dayTransactions ?? []).length === 0 && <p className="py-6 text-center text-sm text-muted">No transactions on this day.</p>}
          {(dayTransactions ?? []).map((t) => (
            <TransactionListItem key={t.id} transaction={t} currency={currency} onClick={() => setSelectedTxn(t)} />
          ))}
        </div>
      </ResponsiveModal>

      <TransactionDetailModal
        transaction={selectedTxn}
        onOpenChange={(open) => !open && setSelectedTxn(null)}
        year={year}
        month={month}
        monthClosed={account?.status === "CLOSED"}
      />
      <AddTransactionModal open={addOpen} onOpenChange={setAddOpen} year={year} month={month} />
    </AppShell>
  );
}

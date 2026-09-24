import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useProfile } from "@/hooks/useProfile";
import { useMonthlyAccount } from "@/hooks/useMonthlyAccount";
import { formatCurrency } from "@/lib/currency";
import { calculateMonthlyComparison } from "@/lib/finance";
import { CATEGORY_LABELS } from "@/lib/allocation";

export default function Compare() {
  const navigate = useNavigate();
  const now = new Date();
  const [yearA, setYearA] = useState(now.getFullYear());
  const [monthA, setMonthA] = useState(now.getMonth() === 0 ? 12 : now.getMonth());
  const [yearB, setYearB] = useState(now.getFullYear());
  const [monthB, setMonthB] = useState(now.getMonth() + 1);

  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "NGN";
  const { data: accountA } = useMonthlyAccount(yearA, monthA);
  const { data: accountB } = useMonthlyAccount(yearB, monthB);

  const rows = useMemo(() => {
    if (!accountA || !accountB) return null;
    return calculateMonthlyComparison(accountA, accountB);
  }, [accountA, accountB]);

  const chartData = useMemo(() => {
    if (!rows) return [];
    const [a, b] = rows;
    return (["income", "tithe", "investment", "giving", "expense", "savings"] as const).map((key) => ({
      name: CATEGORY_LABELS[key],
      [a.label]: a[key as keyof typeof a] as number,
      [b.label]: b[key as keyof typeof b] as number,
    }));
  }, [rows]);

  return (
    <AppShell>
      <header className="flex items-center gap-3 pt-2">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Compare Months</h1>
      </header>

      <div className="mt-4 flex items-center justify-between gap-3">
        <MonthSelector year={yearA} month={monthA} onChange={(y, m) => { setYearA(y); setMonthA(m); }} />
        <span className="text-sm text-muted">vs</span>
        <MonthSelector year={yearB} month={monthB} onChange={(y, m) => { setYearB(y); setMonthB(m); }} />
      </div>

      {rows && (
        <>
          <section className="mt-6 h-64 rounded-2xl bg-surface p-4 shadow-card">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Legend />
                <Bar dataKey={rows[0].label} fill="#8A6FE0" radius={[6, 6, 0, 0]} />
                <Bar dataKey={rows[1].label} fill="#3F9142" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Metric</th>
                  <th className="pb-2 font-medium">{rows[0].label}</th>
                  <th className="pb-2 font-medium">{rows[1].label}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(["income", "tithe", "investment", "giving", "expense", "savings"] as const).map((key) => (
                  <tr key={key}>
                    <td className="py-2 text-foreground">{CATEGORY_LABELS[key]}</td>
                    <td className="py-2 text-foreground">{formatCurrency(rows[0][key as keyof typeof rows[0]] as number, currency)}</td>
                    <td className="py-2 text-foreground">{formatCurrency(rows[1][key as keyof typeof rows[1]] as number, currency)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-semibold text-foreground">Opening Balance</td>
                  <td className="py-2 font-semibold text-foreground">{formatCurrency(rows[0].openingBalance, currency)}</td>
                  <td className="py-2 font-semibold text-foreground">{formatCurrency(rows[1].openingBalance, currency)}</td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold text-foreground">Closing Balance</td>
                  <td className="py-2 font-semibold text-foreground">{formatCurrency(rows[0].closingBalance, currency)}</td>
                  <td className="py-2 font-semibold text-foreground">{formatCurrency(rows[1].closingBalance, currency)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      )}
    </AppShell>
  );
}

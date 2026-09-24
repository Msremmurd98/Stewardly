import { useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCompactCurrency, formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { AppCurrency, MonthlyAccount } from "@/types/database";

type TrendMetric = "income" | "expense" | "investment" | "savings";

const METRIC_CONFIG: Record<TrendMetric, { label: string; color: string; field: (a: MonthlyAccount) => number }> = {
  income: { label: "Income", color: "#3F9142", field: (a) => a.total_income },
  expense: { label: "Expenses", color: "#8A6FE0", field: (a) => a.expense_used },
  investment: { label: "Investment", color: "#E08A3C", field: (a) => a.investment_used },
  savings: { label: "Savings", color: "#C9B94A", field: (a) => a.savings_used },
};

interface TrendChartProps {
  accounts: MonthlyAccount[];
  currency: AppCurrency;
  monthsToShow?: number;
}

/**
 * Renders one metric at a time behind a tab switcher rather than four
 * separate always-visible charts, to stay uncluttered on mobile (spec §35)
 * while still covering all four series the spec calls for.
 */
export function TrendChart({ accounts, currency, monthsToShow = 12 }: TrendChartProps) {
  const [metric, setMetric] = useState<TrendMetric>("income");

  const sorted = useMemo(() => {
    return [...accounts]
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year))
      .slice(-monthsToShow);
  }, [accounts, monthsToShow]);

  const data = useMemo(
    () =>
      sorted.map((a) => ({
        label: new Date(a.year, a.month - 1).toLocaleString(undefined, { month: "short" }),
        value: METRIC_CONFIG[metric].field(a),
      })),
    [sorted, metric]
  );

  const config = METRIC_CONFIG[metric];
  const hasEnoughData = sorted.length >= 2;

  return (
    <div className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Trends</h2>
        <span className="text-xs text-muted">Last {sorted.length} month{sorted.length === 1 ? "" : "s"}</span>
      </div>

      <Tabs.Root value={metric} onValueChange={(v) => setMetric(v as TrendMetric)} className="mt-3">
        <Tabs.List className="grid grid-cols-4 gap-1.5 rounded-xl bg-background p-1" aria-label="Trend metric">
          {(Object.keys(METRIC_CONFIG) as TrendMetric[]).map((key) => (
            <Tabs.Trigger
              key={key}
              value={key}
              className={cn(
                "rounded-lg py-2 text-xs font-semibold text-muted transition-colors",
                "data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-card"
              )}
            >
              {METRIC_CONFIG[key].label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value={metric} className="mt-4">
          {!hasEnoughData ? (
            <p className="py-10 text-center text-sm text-muted">
              Not enough months of data yet — {config.label.toLowerCase()} trends will appear once you have at
              least two months recorded.
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECE9F2" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCompactCurrency(v, currency)}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v, currency), config.label]}
                    labelFormatter={(label) => label}
                    contentStyle={{ borderRadius: 12, border: "1px solid #ECE9F2", fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={config.color}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: config.color }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

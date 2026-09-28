import { useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatCompactCurrency, formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { AppCurrency, MonthlyAccount } from "@/types/database";

type TrendMetric = "income" | "expense" | "investment" | "savings";
type TrendRange = 1 | 3 | 6 | 12;

const METRIC_CONFIG: Record<
  TrendMetric,
  {
    label: string;
    color: string;
    field: (a: MonthlyAccount) => number;
  }
> = {
  income: {
    label: "Income",
    color: "#3F9142",
    field: (a) => a.total_income,
  },
  expense: {
    label: "Expenses",
    color: "#8A6FE0",
    field: (a) => a.expense_used,
  },
  investment: {
    label: "Investment",
    color: "#E08A3C",
    field: (a) => a.investment_used,
  },
  savings: {
    label: "Savings",
    color: "#C9B94A",
    field: (a) => a.savings_used,
  },
};

interface TrendChartProps {
  accounts: MonthlyAccount[];
  currency: AppCurrency;
  selectedYear: number;
  selectedMonth: number;
}

export function TrendChart({
  accounts,
  currency,
  selectedYear,
  selectedMonth,
}: TrendChartProps) {
  const [metric, setMetric] = useState<TrendMetric>("income");
  const [range, setRange] = useState<TrendRange>(6);

  const config = METRIC_CONFIG[metric];

  const data = useMemo(() => {
    return Array.from({ length: range }, (_, index) => {
      const date = new Date(
        selectedYear,
        selectedMonth - range + index,
        1
      );

      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const account = accounts.find(
        (a) => a.year === year && a.month === month
      );

      return {
        index,
        label: date.toLocaleString(undefined, {
          month: "short",
          year: range === 12 ? "2-digit" : undefined,
        }),
        value: account ? config.field(account) : 0,
      };
    });
  }, [
    accounts,
    selectedYear,
    selectedMonth,
    range,
    config,
  ]);

  const monthLabel = new Date(
    selectedYear,
    selectedMonth - 1
  ).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="grid grid-cols-3 items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Trends
        </h2>

        <span className="text-center text-xs font-medium text-muted">
          {monthLabel}
        </span>

        <div className="flex justify-end">
          <select
            value={range}
            onChange={(e) =>
              setRange(Number(e.target.value) as TrendRange)
            }
            aria-label="Trend range"
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground outline-none transition-colors focus:border-foreground"
          >
            <option value={1}>Month</option>
            <option value={3}>Last 3 Months</option>
            <option value={6}>Last 6 Months</option>
            <option value={12}>Last 12 Months</option>
          </select>
        </div>
      </div>

      <Tabs.Root
        value={metric}
        onValueChange={(value) =>
          setMetric(value as TrendMetric)
        }
        className="mt-4"
      >
     <Tabs.List
  className="grid grid-cols-4 gap-1.5 rounded-xl bg-background p-1"
  aria-label="Trend metric"
>
  {(Object.keys(METRIC_CONFIG) as TrendMetric[]).map((key) => (
    <Tabs.Trigger
      key={key}
      value={key}
      className={cn(
        "py-2 text-xs font-semibold text-muted transition-colors",
        "data-[state=active]:bg-surface",
        "data-[state=active]:text-foreground",
        "data-[state=active]:shadow-card",
        key === "income" && "rounded-l-lg",
        key === "savings" && "rounded-r-lg",
        key !== "income" && key !== "savings" && "rounded-lg"
      )}
    >
      {METRIC_CONFIG[key].label}
    </Tabs.Trigger>
  ))}
</Tabs.List>

        <Tabs.Content value={metric} className="mt-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{
                  top: 8,
                  right: 8,
                  left: -16,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#ECE9F2"
                />

                <XAxis
                  dataKey="index"
                  type="number"
                  domain={[0, range - 1]}
                  ticks={data.map((item) => item.index)}
                  tickFormatter={(index) =>
                    data[index]?.label ?? ""
                  }
                  tick={{
                    fontSize: range === 12 ? 9 : 10,
                  }}
                  axisLine={false}
                  tickLine={false}
                  padding={{
                    left: 8,
                    right: 8,
                  }}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) =>
                    formatCompactCurrency(value, currency)
                  }
                  width={56}
                />

                <Tooltip
                  formatter={(value: number) => [
                    formatCurrency(value, currency),
                    config.label,
                  ]}
                  labelFormatter={(index) =>
                    data[Number(index)]?.label ?? ""
                  }
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #ECE9F2",
                    fontSize: 12,
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={config.color}
                  strokeWidth={2.5}
                  dot={{
                    r: 3,
                    fill: config.color,
                  }}
                  activeDot={{
                    r: 5,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { format, setMonth } from "date-fns";
import { selectAllMonths, selectMonth, useMonthFilter, useReportMonth } from "@/lib/monthFilter";

interface MonthFilterSelectorProps {
  /** Show the "All" option. Turn off for screens that need one concrete month (Reports). */
  allowAll?: boolean;
  yearsBack?: number;
}

const ALL_VALUE = "all";

/**
 * Month dropdown wired to the app-wide selection (see lib/monthFilter.ts).
 * Same look as MonthSelector, plus an optional "All" entry. Because every
 * screen uses the same store, changing it here changes it everywhere.
 */
export function MonthFilterSelector({ allowAll = true, yearsBack = 2 }: MonthFilterSelectorProps) {
  const filter = useMonthFilter();
  const concrete = useReportMonth();

  const year = allowAll ? filter.year : concrete.year;
  const month = allowAll ? filter.month : concrete.month;

  const now = new Date();
  const years = Array.from({ length: yearsBack + 1 }, (_, i) => now.getFullYear() - yearsBack + i);
  const value = month === null ? ALL_VALUE : `${year}-${month}`;
  const label = month === null ? "All" : format(setMonth(new Date(year, 0), month - 1), "MMMM");

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(v) => {
        if (v === ALL_VALUE) {
          selectAllMonths();
          return;
        }
        const [y, m] = v.split("-").map(Number);
        selectMonth(y, m);
      }}
    >
      <SelectPrimitive.Trigger
        aria-label="Select month"
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground"
      >
        <SelectPrimitive.Value>{label}</SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-[60] max-h-72 overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
          position="popper"
          sideOffset={6}
        >
          <SelectPrimitive.Viewport className="max-h-72 overflow-y-auto p-1">
            {allowAll && (
              <SelectPrimitive.Item
                value={ALL_VALUE}
                className="relative flex h-10 cursor-pointer select-none items-center rounded-xl px-3 pr-8 text-sm font-semibold text-foreground outline-none data-[highlighted]:bg-background"
              >
                <SelectPrimitive.ItemText>All months</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3">
                  <Check className="h-4 w-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            )}
            {years.flatMap((y) =>
              Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectPrimitive.Item
                  key={`${y}-${m}`}
                  value={`${y}-${m}`}
                  className="relative flex h-10 cursor-pointer select-none items-center rounded-xl px-3 pr-8 text-sm text-foreground outline-none data-[highlighted]:bg-background"
                >
                  <SelectPrimitive.ItemText>
                    {format(setMonth(new Date(y, 0), m - 1), "MMMM yyyy")}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-3">
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              )),
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

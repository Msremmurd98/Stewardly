import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { format, setMonth } from "date-fns";

interface MonthSelectorProps {
  year: number;
  month: number; // 1-12
  onChange: (year: number, month: number) => void;
  yearsBack?: number;
}

export function MonthSelector({ year, month, onChange, yearsBack = 2 }: MonthSelectorProps) {
  const now = new Date();
  const years = Array.from({ length: yearsBack + 1 }, (_, i) => now.getFullYear() - yearsBack + i);
  const value = `${year}-${month}`;

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(v) => {
        const [y, m] = v.split("-").map(Number);
        onChange(y, m);
      }}
    >
      <SelectPrimitive.Trigger className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground">
        <SelectPrimitive.Value>{format(setMonth(new Date(year, 0), month - 1), "MMMM")}</SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="z-[60] max-h-72 overflow-hidden rounded-2xl border border-border bg-surface shadow-card" position="popper" sideOffset={6}>
          <SelectPrimitive.Viewport className="max-h-72 overflow-y-auto p-1">
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
              ))
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

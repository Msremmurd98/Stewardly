import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Tabs from "@radix-ui/react-tabs";
import { format } from "date-fns";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { IncomeAllocationPreview } from "./IncomeAllocationPreview";
import { incomeFormSchema, categoryFormSchema, type IncomeFormValues, type CategoryFormValues } from "@/lib/schemas";
import { useCreateIncomeTransaction, useCreateCategoryTransaction } from "@/hooks/useTransactions";
import { useProfile } from "@/hooks/useProfile";
import { CATEGORY_LABELS } from "@/lib/allocation";
import { cn } from "@/lib/utils";

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  defaultTab?: "income" | "category";
  defaultCategory?: CategoryFormValues["category"];
}

const CATEGORY_OPTIONS = (["tithe", "investment", "giving", "expense", "savings"] as const).map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}));

export function AddTransactionModal({
  open,
  onOpenChange,
  year,
  month,
  defaultTab = "income",
  defaultCategory = "expense",
}: AddTransactionModalProps) {
  const [tab, setTab] = useState<"income" | "category">(defaultTab);
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "NGN";

  const createIncome = useCreateIncomeTransaction(year, month);
  const createCategory = useCreateCategoryTransaction(year, month);

  const incomeForm = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: { amount: "", date: format(new Date(), "yyyy-MM-dd"), narration: "" },
  });
  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      category: defaultCategory,
      amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      narration: "",
    },
  });

  const watchedIncomeAmount = Number(incomeForm.watch("amount") || 0);

  async function submitIncome(values: IncomeFormValues) {
    try {
      await createIncome.mutateAsync({
        amount: Number(values.amount),
        date: values.date,
        narration: values.narration,
        year,
        month,
      });
      incomeForm.reset({ amount: "", date: format(new Date(), "yyyy-MM-dd"), narration: "" });
      onOpenChange(false);
    } catch (err) {
      incomeForm.setError("amount", { message: (err as Error).message });
    }
  }

  async function submitCategory(values: CategoryFormValues) {
    try {
      await createCategory.mutateAsync({
        category: values.category,
        amount: Number(values.amount),
        date: values.date,
        narration: values.narration,
        year,
        month,
      });
      categoryForm.reset({ category: values.category, amount: "", date: format(new Date(), "yyyy-MM-dd"), narration: "" });
      onOpenChange(false);
    } catch (err) {
      // Server rejects with "Insufficient X allocation. Available: Y" on overspend (spec §9)
      categoryForm.setError("amount", { message: (err as Error).message });
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Add Transaction">
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as "income" | "category")}>
        <Tabs.List className="grid grid-cols-2 gap-2 rounded-2xl bg-background p-1" aria-label="Transaction type">
          <Tabs.Trigger
            value="income"
            className={cn(
              "rounded-xl py-2.5 text-sm font-semibold text-muted transition-colors",
              "data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-card"
            )}
          >
            Income
          </Tabs.Trigger>
          <Tabs.Trigger
            value="category"
            className={cn(
              "rounded-xl py-2.5 text-sm font-semibold text-muted transition-colors",
              "data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-card"
            )}
          >
            Category Spend
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="income" className="mt-4">
          <form onSubmit={incomeForm.handleSubmit(submitIncome)} className="space-y-4">
            <Controller
              control={incomeForm.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Input
                  label="Amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />
            <Controller
              control={incomeForm.control}
              name="date"
              render={({ field, fieldState }) => (
                <Input type="date" label="Date" error={fieldState.error?.message} {...field} />
              )}
            />
            <Controller
              control={incomeForm.control}
              name="narration"
              render={({ field }) => <Input label="Narration (optional)" placeholder="e.g. September salary" {...field} />}
            />

            {watchedIncomeAmount > 0 && <IncomeAllocationPreview amount={watchedIncomeAmount} currency={currency} />}

            <Button type="submit" className="w-full" disabled={createIncome.isPending}>
              {createIncome.isPending ? "Saving..." : "Add Income"}
            </Button>
          </form>
        </Tabs.Content>

        <Tabs.Content value="category" className="mt-4">
          <form onSubmit={categoryForm.handleSubmit(submitCategory)} className="space-y-4">
            <Controller
              control={categoryForm.control}
              name="category"
              render={({ field }) => (
                <Select label="Category" value={field.value} onValueChange={field.onChange} options={CATEGORY_OPTIONS} />
              )}
            />
            <Controller
              control={categoryForm.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Input
                  label="Amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />
            <Controller
              control={categoryForm.control}
              name="date"
              render={({ field, fieldState }) => (
                <Input type="date" label="Date" error={fieldState.error?.message} {...field} />
              )}
            />
            <Controller
              control={categoryForm.control}
              name="narration"
              render={({ field }) => <Input label="Narration (optional)" placeholder="What was this for?" {...field} />}
            />

            <p className="text-xs text-muted">
              This is checked against your remaining allocation on save — you can't spend more than what's left in a
              category.
            </p>

            <Button type="submit" className="w-full" disabled={createCategory.isPending}>
              {createCategory.isPending ? "Saving..." : "Add Transaction"}
            </Button>
          </form>
        </Tabs.Content>
      </Tabs.Root>
    </ResponsiveModal>
  );
}

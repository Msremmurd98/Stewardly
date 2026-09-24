import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import {
  useSavingsGoals,
  useCreateSavingsGoal,
  useUpdateSavingsGoal,
  useDeleteSavingsGoal,
} from "@/hooks/useSavingsGoals";
import { formatCurrency } from "@/lib/currency";
import { calculateSavingsGoalProgress, calculateRequiredMonthlyContribution } from "@/lib/finance";
import type { SavingsGoal } from "@/types/database";

export default function Goals() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "NGN";
  const { data: goals, isLoading } = useSavingsGoals();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);

  return (
    <AppShell>
      <header className="flex items-center justify-between pt-2">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Financial Goals</h1>
        <button
          onClick={() => setCreateOpen(true)}
          aria-label="New goal"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <section className="mt-6 space-y-3">
        {isLoading && <div className="h-24 animate-pulse rounded-2xl bg-surface" />}
        {!isLoading && (goals ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No goals yet. Create your first savings goal.</p>
        )}
        {(goals ?? []).map((goal) => {
          const progress = calculateSavingsGoalProgress(goal);
          const monthly = calculateRequiredMonthlyContribution(goal);
          const remaining = goal.target_amount - goal.current_amount;
          return (
            <button
              key={goal.id}
              onClick={() => setEditing(goal)}
              className="block w-full rounded-2xl bg-surface p-5 text-left shadow-card"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">{goal.name}</h3>
                <span className="text-sm font-semibold text-foreground">{Math.round(progress)}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>{formatCurrency(goal.current_amount, currency)} of {formatCurrency(goal.target_amount, currency)}</span>
                {goal.target_date && <span>Target {new Date(goal.target_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>}
              </div>
              {remaining > 0 && monthly > 0 && (
                <p className="mt-2 text-xs text-foreground">
                  You need approximately {formatCurrency(monthly, currency)}/month to reach this goal.
                </p>
              )}
            </button>
          );
        })}
      </section>

      <GoalFormModal open={createOpen} onOpenChange={setCreateOpen} />
      {editing && <GoalFormModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} goal={editing} />}
    </AppShell>
  );
}

function GoalFormModal({ open, onOpenChange, goal }: { open: boolean; onOpenChange: (o: boolean) => void; goal?: SavingsGoal }) {
  const create = useCreateSavingsGoal();
  const update = useUpdateSavingsGoal();
  const remove = useDeleteSavingsGoal();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(String(goal?.target_amount ?? ""));
  const [current, setCurrent] = useState(String(goal?.current_amount ?? "0"));
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!name.trim()) return setError("Give this goal a name.");
    if (!target || Number(target) <= 0) return setError("Enter a target amount greater than zero.");
    try {
      if (goal) {
        await update.mutateAsync({
          id: goal.id,
          patch: { name, target_amount: Number(target), current_amount: Number(current), target_date: targetDate || null },
        });
      } else {
        await create.mutateAsync({ name, target_amount: Number(target), current_amount: Number(current), target_date: targetDate || null });
      }
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={goal ? "Edit Goal" : "New Goal"}>
      <div className="space-y-4">
        <Input label="Goal name" placeholder="Emergency Fund" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Target amount" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        <Input label="Current amount" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input type="date" label="Target date (optional)" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={create.isPending || update.isPending}>
          {goal ? "Save Changes" : "Create Goal"}
        </Button>
        {goal && (
          <Button
            variant="danger"
            className="w-full"
            disabled={remove.isPending}
            onClick={async () => {
              await remove.mutateAsync(goal.id);
              onOpenChange(false);
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete Goal
          </Button>
        )}
      </div>
    </ResponsiveModal>
  );
}

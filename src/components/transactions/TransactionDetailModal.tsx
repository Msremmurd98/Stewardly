import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEditTransaction, useDeleteTransaction } from "@/hooks/useTransactions";
import { useProfile } from "@/hooks/useProfile";
import { formatCurrency } from "@/lib/currency";
import { CATEGORY_LABELS } from "@/lib/allocation";
import type { Transaction } from "@/types/database";

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  monthClosed: boolean;
}

export function TransactionDetailModal({ transaction, onOpenChange, year, month, monthClosed }: TransactionDetailModalProps) {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "NGN";
  const editTxn = useEditTransaction(year, month);
  const deleteTxn = useDeleteTransaction(year, month);

  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [narration, setNarration] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount));
      setDate(transaction.transaction_date);
      setNarration(transaction.narration ?? "");
      setMode("view");
      setError(null);
    }
  }, [transaction]);

  if (!transaction) return null;

  async function handleSave() {
    setError(null);
    try {
      await editTxn.mutateAsync({ id: transaction!.id, amount: Number(amount), date, narration });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await deleteTxn.mutateAsync(transaction!.id);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ResponsiveModal open={!!transaction} onOpenChange={onOpenChange} title={CATEGORY_LABELS[transaction.category]}>
      {monthClosed && (
        <p className="mb-4 rounded-xl bg-background px-3 py-2 text-xs text-muted">
          This month is closed. Reopen it from Reports to edit or delete this transaction.
        </p>
      )}

      {mode === "view" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted">Amount</p>
            <p className="text-2xl font-extrabold text-foreground">{formatCurrency(transaction.amount, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Date</p>
            <p className="text-sm font-medium text-foreground">{transaction.transaction_date}</p>
          </div>
          {transaction.narration && (
            <div>
              <p className="text-xs text-muted">Narration</p>
              <p className="text-sm font-medium text-foreground">{transaction.narration}</p>
            </div>
          )}

          {!monthClosed && (
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("edit")}>
                Edit
              </Button>
              <Button
                variant="danger"
                size="icon"
                aria-label="Delete transaction"
                onClick={() => setMode("confirm-delete")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {mode === "edit" && (
        <div className="space-y-4">
          <Input label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setMode("view")}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={editTxn.isPending}>
              {editTxn.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {mode === "confirm-delete" && (
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Delete this {formatCurrency(transaction.amount, currency)} {CATEGORY_LABELS[transaction.category].toLowerCase()}{" "}
            transaction? This can't be undone.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setMode("view")}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleteTxn.isPending}>
              {deleteTxn.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
}

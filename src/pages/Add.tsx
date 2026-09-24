import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";

export default function Add() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const now = new Date();

  return (
    <AppShell>
      <AddTransactionModal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) navigate(-1);
        }}
        year={now.getFullYear()}
        month={now.getMonth() + 1}
      />
    </AppShell>
  );
}

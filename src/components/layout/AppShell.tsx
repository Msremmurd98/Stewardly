import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <main className="mx-auto max-w-md px-5 pt-safe pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}

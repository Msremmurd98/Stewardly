import { NavLink } from "react-router-dom";
import { LayoutGrid, Clock, Plus, BarChart2, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/history", label: "History", icon: Clock },
  { to: "/add", label: "Add", icon: Plus, isCentral: true },
  { to: "/reports", label: "Reports", icon: BarChart2 },
  { to: "/more", label: "More", icon: Menu },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur pb-safe"
    >
      <ul className="mx-auto flex max-w-md items-center justify-between px-6 pt-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, isCentral }) => (
          <li key={to}>
            <NavLink
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium text-muted transition-colors",
                  isActive && !isCentral && "text-foreground",
                  isCentral && "-mt-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-card"
                )
              }
            >
              <Icon className={cn("h-5 w-5", isCentral && "h-6 w-6")} aria-hidden="true" />
              {!isCentral && <span>{label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

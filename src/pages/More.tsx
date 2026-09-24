import { Link } from "react-router-dom";
import { Settings as SettingsIcon, Target, Calendar as CalendarIcon, GitCompare, Bell } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

const ITEMS = [
  { to: "/goals", label: "Financial Goals", icon: Target, desc: "Track savings targets and progress" },
  { to: "/calendar", label: "Financial Calendar", icon: CalendarIcon, desc: "See transactions by date" },
  { to: "/compare", label: "Monthly Comparison", icon: GitCompare, desc: "Compare two months side by side" },
  { to: "/notifications", label: "Notifications", icon: Bell, desc: "Reminders and budget alerts" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, desc: "Profile, password, currency" },
];

export default function More() {
  return (
    <AppShell>
      <header className="pt-2">
        <h1 className="text-2xl font-extrabold text-foreground">More</h1>
      </header>
      <section className="mt-6 space-y-3">
        {ITEMS.map(({ to, label, icon: Icon, desc }) => (
          <Link key={to} to={to} className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-card">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background text-foreground">
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{label}</span>
              <span className="block text-xs text-muted">{desc}</span>
            </span>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}

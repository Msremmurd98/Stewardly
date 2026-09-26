import { Link } from "react-router-dom";
import {
  Settings as SettingsIcon,
  Target,
  Calendar as CalendarIcon,
  GitCompare,
  Bell,
  Megaphone,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

const ITEMS = [
  {
    to: "/goals",
    label: "Financial Goals",
    icon: Target,
    desc: "Track savings targets and progress",
  },
  {
    to: "/calendar",
    label: "Financial Calendar",
    icon: CalendarIcon,
    desc: "See transactions by date",
  },
  {
    to: "/compare",
    label: "Monthly Comparison",
    icon: GitCompare,
    desc: "Compare two months side by side",
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: Bell,
    desc: "Reminders and budget alerts",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    desc: "Profile, password, currency",
  },
];

export default function More() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user!.id)
        .single();

      if (error) throw error;

      return data;
    },
  });

  const { data: unreadCount = 0 } =
    useUnreadNotifications();

  const hasUnreadNotifications = unreadCount > 0;

  const isAdmin = profile?.is_admin === true;

  return (
    <AppShell>
      <header className="pt-2">
        <h1 className="text-2xl font-extrabold text-foreground">
          More
        </h1>
      </header>

      <section className="mt-6 space-y-3">
        {ITEMS.map(
          ({ to, label, icon: Icon, desc }) => {
            const isNotifications =
              to === "/notifications";

            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-card"
              >
                <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-background text-foreground">
                  <Icon className="h-5 w-5" />

                  {isNotifications &&
                    hasUnreadNotifications && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface"
                        aria-label="Unread notifications"
                      />
                    )}
                </span>

                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {label}
                  </span>

                  <span className="block text-xs text-muted">
                    {desc}
                  </span>
                </span>
              </Link>
            );
          },
        )}

        {/* Admin-only Broadcast */}
        {isAdmin && (
          <Link
            to="/broadcast"
            className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-card"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background text-foreground">
              <Megaphone className="h-5 w-5" />
            </span>

            <span>
              <span className="block text-sm font-semibold text-foreground">
                Broadcast Message
              </span>

              <span className="block text-xs text-muted">
                Send a message to all KED Finance users
              </span>
            </span>
          </Link>
        )}
      </section>
    </AppShell>
  );
}

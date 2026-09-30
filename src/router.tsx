import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import Dashboard from "@/pages/Dashboard";
import History from "@/pages/History";
import Add from "@/pages/Add";
import Reports from "@/pages/Reports";
import CategoryDetail from "@/pages/CategoryDetail";
import Income from "@/pages/Income";
import Settings from "@/pages/Settings";
import Goals from "@/pages/Goals";
import CalendarPage from "@/pages/Calendar";
import Compare from "@/pages/Compare";
import MonthDetail from "@/pages/MonthDetail";
import More from "@/pages/More";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/NotFound";
import Broadcast from "@/pages/Broadcast";
import { eventRoutes } from "@/router.events";

function withAuth(element: JSX.Element) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

export const router = createBrowserRouter([
  { path: "/", element: withAuth(<Dashboard />) },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/forgot-password", element: <ForgotPassword /> },

  { path: "/dashboard", element: withAuth(<Dashboard />) },
  { path: "/history", element: withAuth(<History />) },
  { path: "/add", element: withAuth(<Add />) },
  { path: "/reports", element: withAuth(<Reports />) },
  { path: "/calendar", element: withAuth(<CalendarPage />) },
  { path: "/goals", element: withAuth(<Goals />) },
  { path: "/settings", element: withAuth(<Settings />) },
  { path: "/category/:category", element: withAuth(<CategoryDetail />) },
  { path: "/income", element: withAuth(<Income />) },
  { path: "/month/:month", element: withAuth(<MonthDetail />) },
  { path: "/compare", element: withAuth(<Compare />) },
  { path: "/more", element: withAuth(<More />) },
  { path: "/broadcast", element: withAuth(<Broadcast />) },
  { path: "/notifications", element: withAuth(<Notifications />) },
...eventRoutes,

{ path: "*", element: <NotFound /> },
]);

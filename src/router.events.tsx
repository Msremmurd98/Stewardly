import type { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Events from "@/pages/events/Events";
import EventDetails from "@/pages/events/EventDetails";
import EventRegister from "@/pages/events/EventRegister";
import MyRegistrations from "@/pages/events/MyRegistrations";
import RegistrationDetails from "@/pages/events/RegistrationDetails";
import AdminEvents from "@/pages/admin-events/AdminEvents";
import AdminEventForm from "@/pages/admin-events/AdminEventForm";
import AdminEventRegistrations from "@/pages/admin-events/AdminEventRegistrations";
import AdminRegistrationReview from "@/pages/admin-events/AdminRegistrationReview";

function withAuth(element: JSX.Element) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

/**
 * Spread into the existing router:  createBrowserRouter([ ...existing, ...eventRoutes, { path: "*", ... } ])
 * Admin pages are additionally guarded by <AdminGate> (UI) and by RLS / RPC checks (real enforcement).
 */
export const eventRoutes: RouteObject[] = [
  { path: "/events", element: withAuth(<Events />) },
  { path: "/events/mine", element: withAuth(<MyRegistrations />) },
  { path: "/events/mine/:registrationId", element: withAuth(<RegistrationDetails />) },
  { path: "/events/:eventId", element: withAuth(<EventDetails />) },
  { path: "/events/:eventId/register", element: withAuth(<EventRegister />) },

  { path: "/admin/events", element: withAuth(<AdminEvents />) },
  { path: "/admin/events/new", element: withAuth(<AdminEventForm />) },
  { path: "/admin/events/:eventId", element: withAuth(<AdminEventRegistrations />) },
  { path: "/admin/events/:eventId/edit", element: withAuth(<AdminEventForm />) },
  {
    path: "/admin/events/:eventId/registrations/:registrationId",
    element: withAuth(<AdminRegistrationReview />),
  },
];

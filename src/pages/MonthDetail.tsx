import { Navigate, useParams } from "react-router-dom";

/**
 * /month/:month deep-links to a specific period. Accepts "YYYY-MM" and
 * redirects into the dashboard filtered to that month via query params,
 * keeping a single source of truth for the month view instead of a
 * parallel page.
 */
export default function MonthDetail() {
  const { month } = useParams<{ month: string }>();
  const [year, m] = (month ?? "").split("-");
  if (year && m) {
    return <Navigate to={`/dashboard?year=${year}&month=${m}`} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

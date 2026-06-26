/** Sidebar visibility — route and components stay; set true to show Dashboard again. */
export const SHOW_DASHBOARD_IN_NAV = false;

export const DEFAULT_LOGGED_IN_ROUTE = SHOW_DASHBOARD_IN_NAV ? "/dashboard" : "/attendance";

export function getAppNavItems({ isAdmin = false } = {}) {
  return [
    ...(SHOW_DASHBOARD_IN_NAV ? [{ id: "dashboard", label: "Dashboard" }] : []),
    { id: "attendance", label: "Events" },
    { id: "attendance_students", label: "Students" },
    { id: "payment", label: "Payments" },
    { id: "events", label: "Manage Event" },
    ...(isAdmin ? [{ id: "import", label: "Import" }, { id: "users", label: "Users" }] : []),
  ];
}

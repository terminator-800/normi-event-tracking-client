/** Sidebar visibility — route and components stay; set true to show Dashboard again. */
export const SHOW_DASHBOARD_IN_NAV = false;

export const DEFAULT_LOGGED_IN_ROUTE = SHOW_DASHBOARD_IN_NAV ? "/dashboard" : "/attendance";

export type AppNavId =
  | "dashboard"
  | "attendance"
  | "payment"
  | "events"
  | "import"
  | "users"
  | "students"
  | "attendance_students";

export type AppNavItem = { id: AppNavId; label: string };

export function getAppNavItems({ isAdmin = false }: { isAdmin?: boolean } = {}): AppNavItem[] {
  return [
    ...(SHOW_DASHBOARD_IN_NAV ? [{ id: "dashboard" as const, label: "Dashboard" }] : []),
    { id: "attendance", label: "Events" },
    { id: "attendance_students", label: "Students" },
    { id: "payment", label: "Payments" },
    { id: "events", label: "Manage Event" },
    ...(isAdmin ? [{ id: "import" as const, label: "Import" }, { id: "users" as const, label: "Users" }] : []),
  ];
}

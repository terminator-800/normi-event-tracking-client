/** Sidebar visibility — route and components stay; set true to show Dashboard again. */
export const SHOW_DASHBOARD_IN_NAV = false;

export const APP_ROUTES = {
  events: "/events",
  students: "/students",
  payments: "/payments",
  manageEvents: "/manage-events",
  import: "/import",
  users: "/users",
  academicSettings: "/academic-settings",
  dashboard: "/dashboard",
} as const;

export const DEFAULT_LOGGED_IN_ROUTE = SHOW_DASHBOARD_IN_NAV
  ? APP_ROUTES.dashboard
  : APP_ROUTES.events;

export type AppNavId =
  | "dashboard"
  | "events"
  | "students"
  | "payment"
  | "manage_events"
  | "import"
  | "users"
  | "academic_settings";

export type AppNavItem = { id: AppNavId; label: string };

export function eventsEventPath(eventId: string | number): string {
  return `${APP_ROUTES.events}/${encodeURIComponent(String(eventId))}`;
}

export function eventsEventStudentsPath(eventId: string | number): string {
  return `${eventsEventPath(eventId)}/students`;
}

/** Map sidebar nav id (and legacy ids) to app routes. */
export function resolveNavRoute(navId: string): string | null {
  const id = String(navId ?? "").toLowerCase().trim();
  const routes: Record<string, string> = {
    dashboard: APP_ROUTES.dashboard,
    events: APP_ROUTES.events,
    students: APP_ROUTES.students,
    payment: APP_ROUTES.payments,
    manage_events: APP_ROUTES.manageEvents,
    import: APP_ROUTES.import,
    users: APP_ROUTES.users,
    academic_settings: APP_ROUTES.academicSettings,
    // legacy nav ids (pre-rename)
    attendance: APP_ROUTES.events,
    attendance_students: APP_ROUTES.students,
  };
  return routes[id] ?? null;
}

export function getAppNavItems({
  isAdmin = false,
  isSuperAdmin = false,
}: { isAdmin?: boolean; isSuperAdmin?: boolean } = {}): AppNavItem[] {
  const deskNav: AppNavItem[] = [
    ...(SHOW_DASHBOARD_IN_NAV ? [{ id: "dashboard" as const, label: "Dashboard" }] : []),
    { id: "events", label: "Events" },
    { id: "students", label: "Students" },
    { id: "payment", label: "Payments" },
    { id: "manage_events", label: "Manage Event" },
    ...(isAdmin || isSuperAdmin
      ? [{ id: "import" as const, label: "Import" }, { id: "users" as const, label: "Users" }]
      : []),
  ];

  if (isSuperAdmin) {
    return [...deskNav, { id: "academic_settings", label: "Academic Settings" }];
  }

  return deskNav;
}

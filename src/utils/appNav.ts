export const SHOW_DASHBOARD_IN_NAV = true;

export const APP_ROUTES = {
  events: "/events",
  students: "/students",
  payments: "/payments",
  manageEvents: "/manage-events",
  import: "/import",
  users: "/users",
  academicSettings: "/academic-settings",
  dashboard: "/dashboard",
  // CSG President exclusive
  exportSecurity: "/export-security",
  // Super Admin exclusive
  adminManagement: "/admin-management",
  rolesPermissions: "/roles-permissions",
  systemSettings: "/system-settings",
  auditLogs: "/audit-logs",
  reports: "/reports",
} as const;

export const DEFAULT_LOGGED_IN_ROUTE = APP_ROUTES.dashboard;

export type AppNavId =
  | "dashboard"
  | "events"
  | "students"
  | "payment"
  | "manage_events"
  | "import"
  | "users"
  | "academic_settings"
  // CSG President exclusive
  | "export_security"
  // Super Admin exclusive
  | "admin_management"
  | "roles_permissions"
  | "system_settings"
  | "audit_logs"
  | "reports";

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
    // CSG President exclusive
    export_security: APP_ROUTES.exportSecurity,
    // Super Admin exclusive
    admin_management: APP_ROUTES.adminManagement,
    roles_permissions: APP_ROUTES.rolesPermissions,
    system_settings: APP_ROUTES.systemSettings,
    audit_logs: APP_ROUTES.auditLogs,
    reports: APP_ROUTES.reports,
    // legacy nav ids (pre-rename)
    attendance: APP_ROUTES.events,
    attendance_students: APP_ROUTES.students,
  };
  return routes[id] ?? null;
}

/** Shared nav items visible to both Admin and Super Admin. */
const SHARED_NAV_ITEMS: AppNavItem[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "events", label: "Events" },
  { id: "students", label: "Students" },
  { id: "payment", label: "Payments" },
  { id: "manage_events", label: "Manage Events" },
  { id: "import", label: "Import" },
  { id: "users", label: "Users" },
];

/** Additional nav items visible only to CSG President. */
const CSG_PRESIDENT_ONLY_NAV_ITEMS: AppNavItem[] = [
  { id: "export_security", label: "Export Security" },
];

/** Additional nav items visible only to Super Admin. */
const SUPER_ADMIN_ONLY_NAV_ITEMS: AppNavItem[] = [
  { id: "admin_management", label: "Admin Management" },
  { id: "roles_permissions", label: "Roles & Permissions" },
  { id: "system_settings", label: "System Settings" },
  { id: "audit_logs", label: "Audit Logs" },
  { id: "reports", label: "Reports & Analytics" },
];

export function getAppNavItems({
  isAdmin = false,
  isSuperAdmin = false,
  isCsgPresident = false,
}: { isAdmin?: boolean; isSuperAdmin?: boolean; isCsgPresident?: boolean } = {}): AppNavItem[] {
  if (isSuperAdmin) {
    return [...SHARED_NAV_ITEMS, ...SUPER_ADMIN_ONLY_NAV_ITEMS];
  }
  if (isAdmin) {
    return SHARED_NAV_ITEMS;
  }
  // Governor / CSG President — shared items minus Import and Users
  const base = SHARED_NAV_ITEMS.filter((item) => item.id !== "import" && item.id !== "users");
  if (isCsgPresident) {
    return [...base, ...CSG_PRESIDENT_ONLY_NAV_ITEMS];
  }
  return base;
}

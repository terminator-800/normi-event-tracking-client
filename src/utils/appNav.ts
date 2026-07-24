export const SHOW_DASHBOARD_IN_NAV = true;

export const APP_ROUTES = {
  events: "/events",
  students: "/students",
  payments: "/payments",
  paymentStation: "/payment-station",
  manageEvents: "/manage-events",
  import: "/import",
  users: "/users",
  academicSettings: "/academic-settings",
  dashboard: "/dashboard",
  reportsAttendance: "/reports/attendance",
  reportsCollection: "/reports/collection",
  reportsCollectionAll: "/reports/collection/all",
  reportsCollectionUnpaid: "/reports/collection/unpaid",
  reportsCollectionPartial: "/reports/collection/partial",
  /** Public attendance landing (same UI as guest `/`). */
  live: "/live",
  // CSG President exclusive
  exportSecurity: "/export-security",
  // Super Admin exclusive
  adminManagement: "/admin-management",
  rolesPermissions: "/roles-permissions",
  rolesList: "/roles-list",
  systemSettings: "/system-settings",
  auditLogs: "/audit-logs",
  reports: "/reports",
  backup: "/backup",
  updateStudentRfid: "/update-student-rfid",
  updatePassword: "/update-password",
} as const;

export const DEFAULT_LOGGED_IN_ROUTE = APP_ROUTES.dashboard;

export type AppNavId =
  | "dashboard"
  | "manage_event"
  | "events"
  | "students_nav"
  | "students"
  | "cashier"
  | "payment"
  | "payment_station"
  | "manage_events"
  | "import"
  | "users_nav"
  | "users"
  | "academic_settings"
  | "settings"
  | "reports_nav"
  | "reports_attendance"
  | "reports_collection_nav"
  | "reports_collection"
  | "reports_collection_all"
  | "reports_collection_unpaid"
  | "reports_collection_partial"
  // CSG President exclusive
  | "export_security"
  // Super Admin exclusive
  | "admin_management"
  | "roles_permissions"
  | "roles_list"
  | "system_settings"
  | "audit_logs"
  | "reports"
  | "backup"
  | "update_student_rfid"
  | "update_password";

export type AppNavItem = {
  id: AppNavId;
  label: string;
  /** Nested sidebar items (parent is expandable, not a route). */
  children?: AppNavItem[];
};

export function eventsEventPath(eventId: string | number): string {
  return `${APP_ROUTES.events}/${encodeURIComponent(String(eventId))}`;
}

export function eventsEventStudentsPath(eventId: string | number): string {
  return `${eventsEventPath(eventId)}/students`;
}

/** Public / live attendance landing focused on a specific event when possible. */
export function liveEventPath(eventId?: string | number | null): string {
  if (eventId == null || String(eventId).trim() === "") return APP_ROUTES.live;
  return `${APP_ROUTES.live}/${encodeURIComponent(String(eventId))}`;
}

/** Map sidebar nav id (and legacy ids) to app routes. */
export function resolveNavRoute(navId: string): string | null {
  const id = String(navId ?? "").toLowerCase().trim();
  const routes: Record<string, string> = {
    dashboard: APP_ROUTES.dashboard,
    events: APP_ROUTES.events,
    students: APP_ROUTES.students,
    payment: APP_ROUTES.payments,
    payment_station: APP_ROUTES.paymentStation,
    manage_events: APP_ROUTES.manageEvents,
    import: APP_ROUTES.import,
    users: APP_ROUTES.users,
    academic_settings: APP_ROUTES.academicSettings,
    reports_attendance: APP_ROUTES.reportsAttendance,
    reports_collection: APP_ROUTES.reportsCollection,
    reports_collection_all: APP_ROUTES.reportsCollectionAll,
    reports_collection_unpaid: APP_ROUTES.reportsCollectionUnpaid,
    reports_collection_partial: APP_ROUTES.reportsCollectionPartial,
    // CSG President exclusive
    export_security: APP_ROUTES.exportSecurity,
    // Super Admin exclusive
    admin_management: APP_ROUTES.adminManagement,
    roles_permissions: APP_ROUTES.rolesPermissions,
    roles_list: APP_ROUTES.rolesList,
    system_settings: APP_ROUTES.systemSettings,
    audit_logs: APP_ROUTES.auditLogs,
    reports: APP_ROUTES.reports,
    backup: APP_ROUTES.backup,
    update_student_rfid: APP_ROUTES.updateStudentRfid,
    update_password: APP_ROUTES.updatePassword,
    // legacy nav ids (pre-rename)
    attendance: APP_ROUTES.events,
    attendance_students: APP_ROUTES.students,
  };
  return routes[id] ?? null;
}

function buildSettingsNavItem({
  includeExportSecurity = false,
  isSuperAdmin = false,
  includeAllConfigurable = false,
  includeImport = false,
}: {
  includeExportSecurity?: boolean;
  isSuperAdmin?: boolean;
  includeAllConfigurable?: boolean;
  includeImport?: boolean;
} = {}): AppNavItem | null {
  const children: AppNavItem[] = [];
  if (isSuperAdmin || includeAllConfigurable) {
    children.push(
      { id: "roles_permissions", label: "Role Permission" },
      { id: "roles_list", label: "List" },
      { id: "system_settings", label: "School Year" },
      { id: "audit_logs", label: "Audit Logs" },
      { id: "reports", label: "Reports & Analytics" },
    );
  }
  if (includeImport || includeAllConfigurable || isSuperAdmin) {
    children.push({ id: "import", label: "Import" });
  }
  if (includeExportSecurity || includeAllConfigurable) {
    children.push({ id: "export_security", label: "Export Security" });
  }
  // Always listed; RBAC (nav.settings.backup) controls who sees it — governors get college-scoped backup.
  children.push({ id: "backup", label: "Backup" });
  children.push({ id: "update_student_rfid", label: "Update Student" });
  children.push({ id: "update_password", label: "Update Password" });
  if (children.length === 0) return null;
  return {
    id: "settings",
    label: "Settings",
    children,
  };
}

function buildUsersNavItem(isSuperAdmin: boolean, includeAllConfigurable = false): AppNavItem {
  if (includeAllConfigurable || isSuperAdmin) {
    return {
      id: "users_nav",
      label: "Users",
      children: [{ id: "admin_management", label: "List" }],
    };
  }
  return { id: "users", label: "Users" };
}

const REPORTS_NAV_ITEM: AppNavItem = {
  id: "reports_nav",
  label: "Reports",
  children: [
    { id: "reports_attendance", label: "Event Attendance" },
    {
      id: "reports_collection_nav",
      label: "Receivables",
      children: [
        { id: "reports_collection_all", label: "Collections" },
        { id: "reports_collection", label: "Cash Received" },
        { id: "reports_collection_partial", label: "Partial Payments" },
        { id: "reports_collection_unpaid", label: "Accounts Receivable" },
      ],
    },
  ],
};

const STUDENT_NAV_ITEM: AppNavItem = {
  id: "students_nav",
  label: "Student",
  children: [{ id: "students", label: "List" }],
};

/** Shared operational nav (Users / Settings assembled per role). */
const SHARED_NAV_ITEMS_WITHOUT_USERS: AppNavItem[] = [
  { id: "dashboard", label: "Dashboard" },
  {
    id: "manage_event",
    label: "Manage Event",
    children: [
      { id: "manage_events", label: "Create Event" },
      { id: "events", label: "List Events" },
    ],
  },
  {
    id: "cashier",
    label: "Cashier",
    children: [
      { id: "payment", label: "Payments" },
      { id: "payment_station", label: "Payment Station" },
    ],
  },
  STUDENT_NAV_ITEM,
  REPORTS_NAV_ITEM,
];

export function getAppNavItems({
  isAdmin = false,
  isSuperAdmin = false,
  isCsgPresident = false,
  /** When true, include Settings/Users items that RBAC may grant to any role. */
  includeAllConfigurable = false,
}: {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isCsgPresident?: boolean;
  includeAllConfigurable?: boolean;
} = {}): AppNavItem[] {
  const settings = buildSettingsNavItem({
    includeExportSecurity: Boolean(isCsgPresident) || includeAllConfigurable,
    isSuperAdmin: Boolean(isSuperAdmin) || includeAllConfigurable,
    includeAllConfigurable,
    includeImport: Boolean(isAdmin) || Boolean(isSuperAdmin) || includeAllConfigurable,
  });
  const withSettings = (items: AppNavItem[]) => (settings ? [...items, settings] : items);

  if (includeAllConfigurable) {
    return withSettings([
      ...SHARED_NAV_ITEMS_WITHOUT_USERS,
      buildUsersNavItem(Boolean(isSuperAdmin), true),
    ]);
  }

  if (isSuperAdmin || isAdmin) {
    return withSettings([
      ...SHARED_NAV_ITEMS_WITHOUT_USERS,
      buildUsersNavItem(Boolean(isSuperAdmin)),
    ]);
  }
  // Governor / CSG President — shared items minus Users
  return withSettings(SHARED_NAV_ITEMS_WITHOUT_USERS);
}

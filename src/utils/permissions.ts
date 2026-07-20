import type { AppNavId, AppNavItem } from "./appNav";

/** Mirrors API `PERMISSION_CATALOG` keys used for nav + actions. */
export const NAV_PERMISSION_BY_ID: Partial<Record<AppNavId, string | string[]>> = {
  dashboard: "nav.dashboard",
  manage_events: ["action.event.create", "nav.manage_event.create"],
  events: "nav.manage_event.list",
  payment: "nav.cashier.payments",
  payment_station: "nav.cashier.station",
  reports_attendance: "nav.reports.attendance",
  reports_collection: "nav.reports.collection",
  students: "nav.reports.students",
  import: "nav.import",
  users: "nav.users",
  admin_management: ["nav.users.list", "nav.users"],
  roles_permissions: "nav.settings.role",
  roles_list: "nav.settings.role",
  system_settings: "nav.settings.school_year",
  audit_logs: "nav.settings.audit_logs",
  reports: "nav.settings.reports_analytics",
  export_security: "nav.settings.export_security",
  academic_settings: "nav.settings.school_year",
};

/** Route path → permission key(s). Any match grants access. */
export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  "/dashboard": "nav.dashboard",
  "/manage-events": ["action.event.create", "nav.manage_event.create"],
  "/events": "nav.manage_event.list",
  "/payments": "nav.cashier.payments",
  "/payment-station": "nav.cashier.station",
  "/reports/attendance": "nav.reports.attendance",
  "/reports/collection": "nav.reports.collection",
  "/students": "nav.reports.students",
  "/import": "nav.import",
  "/users": ["nav.users", "nav.users.list"],
  "/admin-management": ["nav.users.list", "nav.users"],
  "/roles-permissions": "nav.settings.role",
  "/roles-list": "nav.settings.role",
  "/system-settings": "nav.settings.school_year",
  "/academic-settings": "nav.settings.school_year",
  "/audit-logs": "nav.settings.audit_logs",
  "/reports": "nav.settings.reports_analytics",
  "/export-security": "nav.settings.export_security",
};

export function permissionSetHas(
  permissions: Iterable<string> | null | undefined,
  required: string | string[] | null | undefined,
): boolean {
  if (required == null) return true;
  if (!permissions) return false;
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  const keys = Array.isArray(required) ? required : [required];
  return keys.some((k) => set.has(k));
}

export function filterNavItemsByPermissions(
  items: AppNavItem[],
  permissions: Iterable<string> | null | undefined,
): AppNavItem[] {
  if (!permissions) return items;
  const set = permissions instanceof Set ? permissions : new Set(permissions);

  const filterItem = (item: AppNavItem): AppNavItem | null => {
    if (item.children?.length) {
      const children = item.children
        .map(filterItem)
        .filter((c): c is AppNavItem => c != null);
      if (children.length === 0) return null;
      return { ...item, children };
    }
    const required = NAV_PERMISSION_BY_ID[item.id];
    if (!permissionSetHas(set, required)) return null;
    return item;
  };

  return items.map(filterItem).filter((i): i is AppNavItem => i != null);
}

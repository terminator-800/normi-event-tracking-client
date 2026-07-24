/**
 * Desk roles. Governors share one role; college scope comes from users.department_id.
 */
import type { AuthSession } from "../types/api";

/** Unified governor role (+ legacy per-college values still accepted until migrated). */
export const GOVERNOR_ROLE = "governor";

export const LEGACY_GOVERNOR_ROLES = [
  "it_governor",
  "cba_governor",
  "ceas_governor",
  "coc_governor",
  "chm_governor",
] as const;

export const GOVERNOR_ROLES = [GOVERNOR_ROLE, ...LEGACY_GOVERNOR_ROLES] as const;

export function getRoleFromSession(session: AuthSession | null | undefined): string {
  if (!session || typeof session !== "object") return "";
  const rawRole =
    session.role ??
    session.user?.role ??
    session.data?.role ??
    session.data?.user?.role ??
    session.user?.data?.role ??
    session.profile?.role ??
    session.me?.role ??
    session.claims?.role ??
    session.departmentSession?.role ??
    session.departmentSession?.user?.role ??
    "";
  return String(rawRole).toLowerCase().trim();
}

export function getFullNameFromSession(session: AuthSession | null | undefined): string {
  if (!session || typeof session !== "object") return "";
  const raw =
    session.full_name ??
    session.fullName ??
    session.user?.full_name ??
    session.user?.fullName ??
    session.data?.full_name ??
    session.data?.user?.full_name ??
    session.profile?.full_name ??
    "";
  return String(raw ?? "").trim();
}

/** Navbar label: prefer full name, fall back to username. */
export function getNavDisplayNameFromSession(session: AuthSession | null | undefined): string {
  const fullName = getFullNameFromSession(session);
  if (fullName) return fullName;
  if (!session || typeof session !== "object") return "";
  const username =
    session.username ??
    session.user?.username ??
    session.data?.username ??
    session.data?.user?.username ??
    "";
  return String(username ?? "").trim();
}

/** Normalize for comparisons: spaces/underscores/hyphens collapsed. */
export function normalizeRoleKey(role: unknown): string {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

/**
 * CSG President — API may send csg_president, "CSG President", CSGPresident, etc.
 */
export function isCsgPresident(role: unknown): boolean {
  const n = normalizeRoleKey(role);
  if (!n) return false;
  if (n === "csg_president" || n === "president_csg") return true;
  const compact = n.replace(/_/g, "");
  if (compact === "csgpresident") return true;
  return false;
}

/** System administrator — full access; not a department governor. */
export function isAdminRole(role: unknown): boolean {
  return normalizeRoleKey(role) === "admin";
}

/** Super administrator — full system access including all events. */
export function isSuperAdminRole(role: unknown): boolean {
  return normalizeRoleKey(role) === "super_admin";
}

/** Desk users who operate within the active academic period. */
export function isOperationalDeskRole(role: unknown): boolean {
  return (
    isAdminRole(role) ||
    isCsgPresident(role) ||
    isDepartmentGovernorRole(role) ||
    isCashierRole(role)
  );
}

export function isCashierRole(role: unknown): boolean {
  const n = normalizeRoleKey(role);
  return n === "cashier" || n === "csg_cashier" || n === "dept_cashier";
}

/** Dept Cashier has a college; CSG Cashier is institution-wide (no department). */
export function getCashierAccountLabel(user: {
  role?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  department?: string | null;
}): string {
  const role = normalizeRoleKey(user.role);
  if (role === "dept_cashier") return "Dept Cashier";
  if (role === "csg_cashier") return "CSG Cashier";
  if (!isCashierRole(user.role)) return "Cashier";
  const hasDept =
    (user.department_id != null && Number.isFinite(Number(user.department_id))) ||
    Boolean(String(user.department_name ?? user.department ?? "").trim());
  return hasDept ? "Dept Cashier" : "CSG Cashier";
}

/**
 * True when the role should load all departments’ events (admins + super admins on the API).
 * CSG presidents see only events they created, like governors — not institution-wide listings.
 */
export function seesInstitutionWideEventData(role: string): boolean {
  return isAdminRole(role) || isSuperAdminRole(role);
}

export function isDepartmentGovernorRole(role: unknown): boolean {
  const n = normalizeRoleKey(role);
  return (GOVERNOR_ROLES as readonly string[]).includes(n);
}

/** Sidebar / reports badge and welcome fallback when session has no email */
export function getDashboardRoleLabel(
  isGovernor: boolean,
  governorScope: { label?: string } | null | undefined,
  role: unknown,
): string {
  if (isSuperAdminRole(role)) return "Super Admin";
  if (isGovernor && governorScope?.label) return governorScope.label;
  if (isDepartmentGovernorRole(role)) return "Governor";
  if (isCsgPresident(role)) return "CSG President";
  if (isCashierRole(role)) {
    const n = normalizeRoleKey(role);
    if (n === "dept_cashier") return "Dept Cashier";
    if (n === "csg_cashier") return "CSG Cashier";
    return "Cashier";
  }
  return "Admin";
}

/** Create User is restricted to admins only (not department governors, not CSG president). */
export function canOpenCreateUser(isGovernor: boolean, role: unknown): boolean {
  return isAdminRole(role) && !isGovernor;
}

/** Course codes typically offered under a college department code. */
const DEPARTMENT_CODE_TO_COURSES: Record<string, string[]> = {
  CIT: ["BSIT"],
  BSIT: ["BSIT"],
  CBA: ["BSBA"],
  CEAS: ["BEED", "BSED"],
  CCJE: ["BSCRIM"],
  COC: ["BSCRIM"],
  CHM: ["BSHM"],
};

/**
 * Scope for a governor: prefer assigned department from session.
 * Legacy role names still map when department is missing.
 */
export function getGovernorScopeFromSession(
  session: AuthSession | null | undefined,
  role: unknown,
): { label: string; courses: string[]; departmentCode?: string; departmentName?: string } | null {
  if (!isDepartmentGovernorRole(role)) return null;

  const deptCode = String(
    session?.department_code ??
      session?.user?.department_code ??
      session?.departmentSession?.department_code ??
      session?.data?.department_code ??
      "",
  )
    .trim()
    .toUpperCase();
  const deptName = String(
    session?.department_name ??
      session?.user?.department_name ??
      session?.departmentSession?.department_name ??
      session?.data?.department_name ??
      "",
  ).trim();

  if (deptCode || deptName) {
    const courses = DEPARTMENT_CODE_TO_COURSES[deptCode] ?? [];
    const label = deptCode
      ? `Governor (${deptCode})`
      : deptName
        ? `Governor (${deptName})`
        : "Governor";
    return { label, courses, departmentCode: deptCode || undefined, departmentName: deptName || undefined };
  }

  // Legacy fallback from old role names
  const normalized = normalizeRoleKey(role);
  switch (normalized) {
    case "it_governor":
      return { label: "Governor (CIT)", courses: ["BSIT"], departmentCode: "CIT" };
    case "cba_governor":
      return { label: "Governor (CBA)", courses: ["BSBA"], departmentCode: "CBA" };
    case "ceas_governor":
      return { label: "Governor (CEAS)", courses: ["BEED", "BSED"], departmentCode: "CEAS" };
    case "coc_governor":
      return { label: "Governor (CCJE)", courses: ["BSCRIM"], departmentCode: "CCJE" };
    case "chm_governor":
      return { label: "Governor (CHM)", courses: ["BSHM"], departmentCode: "CHM" };
    default:
      return { label: "Governor", courses: [] };
  }
}

/** @deprecated Prefer getGovernorScopeFromSession */
export function getGovernorScopeFromRole(role: unknown): { label: string; courses: string[] } | null {
  return getGovernorScopeFromSession(null, role);
}

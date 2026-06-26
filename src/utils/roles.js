/**
 * Department governor roles (scoped to their college). Must match API/session values.
 * Also: csg_president, admin — see helpers below.
 */
export const GOVERNOR_ROLES = [
  "it_governor",
  "cba_governor",
  "ceas_governor",
  "coc_governor",
  "chm_governor",
];

export function getRoleFromSession(session) {
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

export function getFullNameFromSession(session) {
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
export function getNavDisplayNameFromSession(session) {
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
export function normalizeRoleKey(role) {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

/**
 * CSG President — API may send csg_president, "CSG President", CSGPresident, etc.
 */
export function isCsgPresident(role) {
  const n = normalizeRoleKey(role);
  if (!n) return false;
  if (n === "csg_president" || n === "president_csg") return true;
  const compact = n.replace(/_/g, "");
  if (compact === "csgpresident") return true;
  return false;
}

/** System administrator — full access; not a department governor. */
export function isAdminRole(role) {
  return normalizeRoleKey(role) === "admin";
}

/**
 * True when the role should load all departments’ events (admins only on the API).
 * CSG presidents see only events they created, like governors — not institution-wide listings.
 */
export function seesInstitutionWideEventData(role) {
  return isAdminRole(role);
}

export function isDepartmentGovernorRole(role) {
  const n = normalizeRoleKey(role);
  return GOVERNOR_ROLES.includes(n);
}

/** Sidebar / reports badge and welcome fallback when session has no email */
export function getDashboardRoleLabel(isGovernor, governorScope, role) {
  if (isGovernor && governorScope?.label) return governorScope.label;
  if (isCsgPresident(role)) return "CSG President";
  return "Admin";
}

/** Create User is restricted to admins only (not department governors, not CSG president). */
export function canOpenCreateUser(isGovernor, role) {
  return isAdminRole(role) && !isGovernor;
}

export function getGovernorScopeFromRole(role) {
  const normalized = normalizeRoleKey(role);
  switch (normalized) {
    case "it_governor":
      return { label: "Governor IT", courses: ["BSIT"] };
    case "cba_governor":
      return { label: "Governor CBA", courses: ["BSBA"] };
    case "ceas_governor":
      return { label: "Governor CEAS", courses: ["BEED", "BSED"] };
    case "coc_governor":
      return { label: "Governor COC", courses: ["BSCRIM"] };
    case "chm_governor":
      return { label: "Governor CHM", courses: ["BSHM"] };
    default:
      return null;
  }
}

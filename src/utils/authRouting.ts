import { APP_ROUTES, DEFAULT_LOGGED_IN_ROUTE } from "./appNav";

export const SUPER_ADMIN_DEFAULT_ROUTE = APP_ROUTES.academicSettings;

export function getDefaultRouteForRole(role: unknown): string {
  const normalized = String(role ?? "").toLowerCase().trim();
  if (normalized === "super_admin") return SUPER_ADMIN_DEFAULT_ROUTE;
  return DEFAULT_LOGGED_IN_ROUTE;
}

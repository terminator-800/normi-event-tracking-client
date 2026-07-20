import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "../api/axiosInstance";
import { getAppNavItems, type AppNavItem } from "../utils/appNav";
import { filterNavItemsByPermissions, permissionSetHas } from "../utils/permissions";
import { useAuthSession } from "./auth";
import { getRoleFromSession, isAdminRole, isCsgPresident, isSuperAdminRole } from "../utils/roles";

export const MY_PERMISSIONS_QUERY_KEY = ["rbac", "my-permissions"] as const;

type MyPermissionsResponse = {
  role: string;
  permissions: string[];
};

export function useMyPermissions(enabled = true) {
  const { data: session, isLoading: sessionLoading } = useAuthSession();
  const role = getRoleFromSession(session);
  const isLoggedIn = Boolean(session);
  const isSuperAdmin = isSuperAdminRole(role);

  const query = useQuery<MyPermissionsResponse>({
    queryKey: [...MY_PERMISSIONS_QUERY_KEY, role],
    enabled: enabled && isLoggedIn && !sessionLoading,
    queryFn: async () => {
      const res = await axios.get("/rbac/my-permissions");
      return {
        role: String(res.data?.role ?? role ?? ""),
        permissions: Array.isArray(res.data?.permissions)
          ? (res.data.permissions as string[])
          : [],
      };
    },
    staleTime: 30_000,
    retry: 1,
  });

  const permissionSet = useMemo(() => {
    if (isSuperAdmin) return null; // null = unrestricted in helpers when combined with isSuperAdmin
    return new Set(query.data?.permissions ?? []);
  }, [isSuperAdmin, query.data?.permissions]);

  const has = (key: string | string[] | null | undefined): boolean => {
    if (isSuperAdmin) return true;
    if (!query.data) return false;
    return permissionSetHas(query.data.permissions, key);
  };

  return {
    ...query,
    role,
    isSuperAdmin,
    permissions: query.data?.permissions ?? [],
    permissionSet,
    has,
    isReady: isSuperAdmin || Boolean(query.data) || (!isLoggedIn && !sessionLoading),
  };
}

/** Sidebar nav filtered by the current user's RBAC permissions. */
export function useAppNavItems(): AppNavItem[] {
  const { data: session } = useAuthSession();
  const role = getRoleFromSession(session);
  const isAdmin = isAdminRole(role);
  const isSuperAdmin = isSuperAdminRole(role);
  const isCsg = isCsgPresident(role);
  const { permissions, isSuperAdmin: sa, isSuccess } = useMyPermissions();

  const base = useMemo(
    () =>
      getAppNavItems({
        isAdmin: isAdmin || isSuperAdmin,
        isSuperAdmin,
        isCsgPresident: isCsg,
        /** Full settings/users tree so Super Admin can grant them via RBAC. */
        includeAllConfigurable: true,
      }),
    [isAdmin, isSuperAdmin, isCsg],
  );

  return useMemo(() => {
    if (sa) return base;
    if (!isSuccess) {
      // While loading, use role-shaped tree without extra configurable items.
      return getAppNavItems({
        isAdmin: isAdmin || isSuperAdmin,
        isSuperAdmin,
        isCsgPresident: isCsg,
      });
    }
    return filterNavItemsByPermissions(base, permissions);
  }, [base, sa, isSuccess, permissions, isAdmin, isSuperAdmin, isCsg]);
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SuperAdminShell from "./SuperAdminShell";
import { useUpdateUser, useUsersList } from "../hooks/useUsersManagement";
import { MY_PERMISSIONS_QUERY_KEY } from "../hooks/useMyPermissions";
import axios from "../api/axiosInstance";
import { getApiErrorMessage, type UserRecord } from "../types/api";
import type { DeskPageProps } from "../types/desk-pages";

type RoleDefinition = {
  role: string;
  label: string;
  description: string;
  color: string;
};

type PermissionDefinition = {
  key: string;
  label: string;
  module: string;
  description?: string;
};

type MatrixResponse = {
  catalog: PermissionDefinition[];
  modules?: string[];
  roles: string[];
  matrix: Record<string, Record<string, boolean>>;
};

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "super_admin",
    label: "Super Admin",
    description: "Full system access.",
    color: "bg-amber-100 text-amber-900 ring-amber-200",
  },
  {
    role: "admin",
    label: "Admin",
    description: "Full operational access.",
    color: "bg-green-100 text-green-900 ring-green-200",
  },
  {
    role: "csg_president",
    label: "CSG President",
    description: "Institution-wide events they create.",
    color: "bg-blue-100 text-blue-900 ring-blue-200",
  },
  {
    role: "governor",
    label: "Governor",
    description: "College-scoped access based on assigned department.",
    color: "bg-purple-100 text-purple-900 ring-purple-200",
  },
  {
    role: "cashier",
    label: "Cashier",
    description: "Payment collection and cashier station access.",
    color: "bg-teal-100 text-teal-900 ring-teal-200",
  },
];

const ROLE_OPTIONS = ROLE_DEFINITIONS.map((d) => ({ value: d.role, label: d.label }));

const DEFAULT_MODULE_ORDER = [
  "Dashboard",
  "Event Management",
  "Attendance Management",
  "Students",
  "Collection",
  "Cashier",
  "Import",
  "Users",
  "Settings",
];

function roleLabel(role: string | undefined): string {
  const normalized = String(role ?? "").toLowerCase();
  if (
    normalized === "governor" ||
    normalized.endsWith("_governor")
  ) {
    return "Governor";
  }
  const found = ROLE_DEFINITIONS.find((d) => d.role === normalized);
  return found?.label ?? (role || "—");
}

const MATRIX_QUERY_KEY = ["rbac", "matrix"] as const;

type TabId = "permissions" | "list";

type RolesPermissionsPageProps = DeskPageProps & {
  /** Which Role Settings view to show (driven by sidebar / route). */
  view?: TabId;
};

export default function RolesPermissionsPage({
  view = "permissions",
  ...props
}: RolesPermissionsPageProps) {
  const tab: TabId = view === "list" ? "list" : "permissions";
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | number | null>(null);
  const [selectedRole, setSelectedRole] = useState("admin");
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useUsersList(true);
  const updateUser = useUpdateUser();
  const isSuperAdminSelected = selectedRole === "super_admin";

  const matrixQuery = useQuery<MatrixResponse>({
    queryKey: MATRIX_QUERY_KEY,
    queryFn: async () => {
      const res = await axios.get("/rbac/matrix");
      return res.data as MatrixResponse;
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!matrixQuery.data) return;
    const roleMatrix = matrixQuery.data.matrix[selectedRole] ?? {};
    setDraft({ ...roleMatrix });
    setDirty(false);
  }, [matrixQuery.data, selectedRole]);

  const saveMatrix = useMutation({
    mutationFn: async (updates: Array<{ role: string; permission_key: string; enabled: boolean }>) => {
      const res = await axios.put("/rbac/matrix", { updates });
      return res.data;
    },
    onSuccess: async () => {
      setActionSuccess("Permissions saved. Affected users will see updated menus on next refresh.");
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: MATRIX_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: MY_PERMISSIONS_QUERY_KEY });
    },
    onError: (err) => {
      setActionError(getApiErrorMessage(err, "Failed to save permissions."));
    },
  });

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return [...users]
      .sort((a, b) => String(a.full_name || a.username || "").localeCompare(String(b.full_name || b.username || "")))
      .filter((u) => {
        const role = String(u.role ?? "").toLowerCase();
        const matchesRole =
          filterRole === "all" ||
          role === filterRole ||
          (filterRole === "governor" && (role === "governor" || role.endsWith("_governor")));
        const matchesSearch =
          !q ||
          String(u.username ?? "").toLowerCase().includes(q) ||
          String(u.full_name ?? "").toLowerCase().includes(q) ||
          role.includes(q) ||
          (filterRole === "governor" && role.includes("governor"));
        return matchesRole && matchesSearch;
      });
  }, [users, searchQuery, filterRole]);

  const modulesWithActions = useMemo(() => {
    const catalog = matrixQuery.data?.catalog ?? [];
    const order = matrixQuery.data?.modules?.length ? matrixQuery.data.modules : DEFAULT_MODULE_ORDER;
    const groups = new Map<string, PermissionDefinition[]>();
    for (const item of catalog) {
      const list = groups.get(item.module) ?? [];
      list.push(item);
      groups.set(item.module, list);
    }
    const ordered: Array<[string, PermissionDefinition[]]> = [];
    for (const name of order) {
      const items = groups.get(name);
      if (items?.length) ordered.push([name, items]);
      groups.delete(name);
    }
    for (const [name, items] of groups) {
      ordered.push([name, items]);
    }
    return ordered;
  }, [matrixQuery.data?.catalog, matrixQuery.data?.modules]);

  const assignRole = (user: UserRecord, nextRole: string) => {
    const current = String(user.role ?? "").toLowerCase();
    const normalizedCurrent =
      current === "governor" || current.endsWith("_governor") ? "governor" : current;
    if (!user.id || nextRole === normalizedCurrent) return;
    setActionError("");
    setActionSuccess("");
    setPendingUserId(user.id);
    const payload: Record<string, unknown> = { role: nextRole };
    if (nextRole === "governor") {
      const dept =
        (user as UserRecord & { department_name?: string }).department_name ||
        user.department ||
        "";
      if (String(dept).trim()) payload.department = String(dept).trim();
    }
    updateUser.mutate(
      { id: user.id, payload },
      {
        onSuccess: () => {
          setActionSuccess(
            `Assigned ${roleLabel(nextRole)} to ${user.full_name || user.username || "user"}.`,
          );
          setPendingUserId(null);
        },
        onError: (err) => {
          setActionError(getApiErrorMessage(err, "Failed to assign role."));
          setPendingUserId(null);
        },
      },
    );
  };

  const togglePermission = (key: string) => {
    if (isSuperAdminSelected) return;
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
    setActionError("");
    setActionSuccess("");
  };

  const setModuleAll = (keys: string[], enabled: boolean) => {
    if (isSuperAdminSelected) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = enabled;
      return next;
    });
    setDirty(true);
    setActionError("");
    setActionSuccess("");
  };

  const handleSavePermissions = () => {
    if (isSuperAdminSelected) return;
    setActionError("");
    setActionSuccess("");
    const catalog = matrixQuery.data?.catalog ?? [];
    const updates = catalog.map((p) => ({
      role: selectedRole,
      permission_key: p.key,
      enabled: Boolean(draft[p.key]),
    }));
    saveMatrix.mutate(updates);
  };

  const handleResetDraft = () => {
    const roleMatrix = matrixQuery.data?.matrix[selectedRole] ?? {};
    setDraft({ ...roleMatrix });
    setDirty(false);
    setActionError("");
    setActionSuccess("");
  };

  const allPermissionKeys = useMemo(
    () => modulesWithActions.flatMap(([, actions]) => actions.map((a) => a.key)),
    [modulesWithActions],
  );

  const allSelected =
    allPermissionKeys.length > 0 && allPermissionKeys.every((k) => Boolean(draft[k]));
  const someSelected = allPermissionKeys.some((k) => Boolean(draft[k]));

  /** Login access mirrors Dashboard View (entry point into the app). */
  const allowLogin = Boolean(draft["nav.dashboard"]);

  const toggleAllowLogin = () => {
    if (isSuperAdminSelected) return;
    setDraft((prev) => ({ ...prev, "nav.dashboard": !prev["nav.dashboard"] }));
    setDirty(true);
    setActionError("");
    setActionSuccess("");
  };

  const toggleSelectAll = () => {
    if (isSuperAdminSelected) return;
    setModuleAll(allPermissionKeys, !allSelected);
  };

  const menuItemLabel = (moduleName: string, perm: PermissionDefinition) => {
    if (moduleName === "Dashboard" && perm.label === "View") return "Dashboard";
    return `${moduleName} · ${perm.label}`;
  };

  return (
    <SuperAdminShell
      {...props}
      activeNavId={tab === "list" ? "roles_list" : "roles_permissions"}
      pageTitle={tab === "list" ? "List" : "Role Permission"}
      pageSubtitle={
        tab === "list" ? "Assign a system role to each user" : "Configure module access for each role"
      }
    >
      {actionError ? (
        <p className="mb-4 text-sm text-red-600">{actionError}</p>
      ) : null}
      {actionSuccess ? (
        <p className="mb-4 text-sm text-[#07713c]">{actionSuccess}</p>
      ) : null}

      {tab === "list" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="min-w-[200px] max-w-xs flex-1 border-0 border-b border-gray-300 bg-transparent px-0 py-2 text-sm focus:border-[#07713c] focus:outline-none"
            />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="border-0 border-b border-gray-300 bg-transparent py-2 text-sm focus:border-[#07713c] focus:outline-none"
            >
              <option value="all">All roles</option>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-400">
              {filtered.length}/{users.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2.5 pr-3 font-medium">Name</th>
                  <th className="py-2.5 pr-3 font-medium">Username</th>
                  <th className="py-2.5 pr-3 font-medium">Department</th>
                  <th className="py-2.5 pr-3 font-medium">Current</th>
                  <th className="min-w-[12rem] py-2.5 font-medium">Assign</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((user) => {
                    const currentRoleRaw = String(user.role ?? "").toLowerCase();
                    const currentRole =
                      currentRoleRaw === "governor" || currentRoleRaw.endsWith("_governor")
                        ? "governor"
                        : currentRoleRaw;
                    const isPending = pendingUserId === user.id && updateUser.isPending;
                    return (
                      <tr key={String(user.id)} className="border-b border-gray-100">
                        <td className="py-2.5 pr-3 text-black">{user.full_name || "—"}</td>
                        <td className="py-2.5 pr-3 text-gray-700">{user.username || "—"}</td>
                        <td className="py-2.5 pr-3 text-gray-700">
                          {(user as UserRecord & { department_name?: string }).department_name ||
                            user.department ||
                            "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-700">{roleLabel(currentRoleRaw)}</td>
                        <td className="py-2.5">
                          <select
                            value={currentRole}
                            disabled={isPending}
                            onChange={(e) => assignRole(user, e.target.value)}
                            className="w-full max-w-[14rem] border-0 border-b border-gray-300 bg-transparent py-1 text-sm text-black focus:border-[#07713c] focus:outline-none disabled:opacity-50"
                            aria-label={`Assign role for ${user.username || user.full_name || "user"}`}
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mx-auto w-full max-w-xl">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Edit Role</h2>
            </div>

            <div className="space-y-5 px-6 py-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">Role Name</span>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-gray-900 outline-none focus:border-[#07713c] focus:ring-1 focus:ring-[#07713c]/25"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={isSuperAdminSelected}
                onClick={toggleAllowLogin}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  allowLogin
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-gray-200 bg-gray-50"
                } ${isSuperAdminSelected ? "cursor-default opacity-90" : "hover:border-emerald-300"}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    allowLogin
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                  aria-hidden
                >
                  {allowLogin ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <svg
                      className={`h-4 w-4 ${allowLogin ? "text-emerald-700" : "text-gray-400"}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"
                      />
                    </svg>
                    Allow system login
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                    Users with this role can sign in to the Normi Event Tracking System.
                  </span>
                </span>
              </button>

              <div className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <svg
                        className="h-4 w-4 text-gray-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        aria-hidden
                      >
                        <rect x="3" y="4" width="7" height="7" rx="1" />
                        <rect x="14" y="4" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                      Menus, buttons & tables
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Only checked items are visible as menus, buttons, or tables for this role.
                    </p>
                  </div>
                  <label
                    className={`inline-flex shrink-0 items-center gap-2 text-sm text-gray-700 ${
                      isSuperAdminSelected ? "cursor-default opacity-60" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allSelected && someSelected;
                      }}
                      disabled={isSuperAdminSelected || matrixQuery.isLoading}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-[#07713c] focus:ring-[#07713c]"
                    />
                    Select all
                  </label>
                </div>

                <div className="max-h-[22rem] overflow-y-auto px-4 py-3">
                  {isSuperAdminSelected ? (
                    <p className="py-2 text-sm text-gray-500">
                      Super Admin always has full access. This role cannot be edited.
                    </p>
                  ) : null}

                  {matrixQuery.isLoading ? (
                    <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
                  ) : matrixQuery.isError ? (
                    <p className="py-6 text-center text-sm text-red-600">
                      {getApiErrorMessage(matrixQuery.error, "Failed to load permissions.")}
                    </p>
                  ) : (
                    <div className="space-y-5">
                      {modulesWithActions.map(([moduleName, actions]) => (
                        <div key={moduleName}>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            {moduleName}
                          </p>
                          <ul className="space-y-2.5">
                            {actions.map((perm) => {
                              const checked = Boolean(draft[perm.key]);
                              return (
                                <li key={perm.key}>
                                  <label
                                    className={`inline-flex items-center gap-2.5 text-sm text-gray-800 ${
                                      isSuperAdminSelected ? "cursor-default" : "cursor-pointer"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={isSuperAdminSelected}
                                      onChange={() => togglePermission(perm.key)}
                                      className="h-4 w-4 rounded border-gray-300 text-[#07713c] focus:ring-[#07713c]"
                                    />
                                    <span>{menuItemLabel(moduleName, perm)}</span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                disabled={isSuperAdminSelected || !dirty || saveMatrix.isPending}
                onClick={handleResetDraft}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={isSuperAdminSelected || !dirty || saveMatrix.isPending}
                onClick={handleSavePermissions}
                className="flex-1 rounded-xl bg-[#07713c] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#055a2e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saveMatrix.isPending ? "Updating…" : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
}

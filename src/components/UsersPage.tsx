import { useEffect, useMemo, useState } from "react";
import SidebarNavIcon from "./SidebarNavIcon";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import UserCircleIcon from "./UserCircleIcon";
import CreateUserModal from "./CreateUserModal";
import { getAppNavItems } from "../utils/appNav";
import { getDashboardRoleLabel } from "../utils/roles";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { useDeleteUser, useUpdateUser, useUsersList } from "../hooks/useUsersManagement";
import { getApiErrorMessage, type UserRecord } from "../types/api";
import type { DeskPageProps } from "../types/desk-pages";

type ManagedUserRecord = UserRecord & {
  department_name?: string;
};

type UserEditForm = {
  fullName: string;
  username: string;
  password: string;
};

type UserUpdatePayload = {
  fullName?: string;
  username?: string;
  password?: string;
};

/** Users page main content text (sidebar + top header excluded). */
const USERS_PAGE_TEXT = "text-black";
const USERS_TH_TEXT = "font-bold text-black";
const TABLE_CELL_NOWRAP = "[&_th]:whitespace-nowrap [&_tbody_td]:whitespace-nowrap";

export default function UsersPage({ onNavigate, onLogout }: DeskPageProps) {
  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const normalizedRole = String(role || "").toLowerCase().trim();
  const isAdmin = normalizedRole === "admin";
  const isSuperAdmin = normalizedRole === "super_admin";
  const canManage = isAdmin || isSuperAdmin;
  const [showLogout, setShowLogout] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<UserEditForm>({ fullName: "", username: "", password: "" });
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const { data: users = [], isLoading, refetch } = useUsersList(canManage);
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const navItems = getAppNavItems({ isAdmin: canManage, isSuperAdmin });

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => Number(a.id) - Number(b.id)),
    [users],
  );

  const roleLabelForUsersPage = (rawRole: string | undefined) => {
    const normalized = String(rawRole || "").trim().toLowerCase();
    if (normalized === "coc_governor") return "ccje_governor";
    return rawRole;
  };

  useEffect(() => {
    if (canManage) return;
    onNavigate?.("events");
  }, [canManage, onNavigate]);

  if (!canManage) {
    return null;
  }

  const startEdit = (user: ManagedUserRecord) => {
    setActionError("");
    setActionSuccess("");
    setEditingUserId(user.id ?? null);
    setEditForm({ fullName: user.full_name || "", username: user.username || "", password: "" });
  };

  const saveEdit = () => {
    setActionError("");
    setActionSuccess("");
    if (!editingUserId) return;
    const payload: UserUpdatePayload = {};
    if (editForm.fullName.trim()) payload.fullName = editForm.fullName.trim();
    if (editForm.username.trim()) payload.username = editForm.username.trim();
    if (editForm.password.trim()) payload.password = editForm.password.trim();
    if (!payload.fullName && !payload.username && !payload.password) {
      setActionError("Provide a full name, username, or password to update.");
      return;
    }
    updateUserMutation.mutate(
      { id: editingUserId, payload },
      {
        onSuccess: () => {
          setActionSuccess("User updated successfully.");
          setEditingUserId(null);
          setEditForm({ fullName: "", username: "", password: "" });
        },
        onError: (err) => {
          setActionError(getApiErrorMessage(err, "Failed to update user."));
        },
      },
    );
  };

  const removeUser = (id: string | number) => {
    setActionError("");
    setActionSuccess("");
    if (!window.confirm("Remove this user? This cannot be undone.")) return;
    deleteUserMutation.mutate(id, {
      onSuccess: () => setActionSuccess("User removed successfully."),
      onError: (err) => setActionError(getApiErrorMessage(err, "Failed to remove user.")),
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col [&_p]:text-white">
        <SidebarBrand />
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                item.id === "users" ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
              }`}
            >
              <SidebarNavIcon navId={item.id} />
              {item.label}
            </button>
          ))}
        </nav>
        <SidebarUserFullName />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">
                User Management
              </h1>
              <NavbarAcademicPeriod className="mt-1" />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogout((prev) => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center text-[#07713c] rounded-lg hover:bg-green-50"
                aria-label="Account menu"
              >
                <UserCircleIcon />
              </button>
              {showLogout && (
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[100px] z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogout(false);
                      onLogout?.();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`flex-1 overflow-auto p-6 ${USERS_PAGE_TEXT} [&_th]:font-bold [&_th]:!text-white`}>
          <div className="mx-auto w-full min-w-0 max-w-7xl">
            <section className="min-w-0 overflow-hidden rounded-lg border border-[#07713c]/30 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07713c]/20 px-4 pb-3 pt-4">
                <div>
                  <h2 className="text-lg font-bold text-black">Users</h2>
                  <p className="text-sm text-black/75">
                    {canManage
                      ? "Manage registered users. Update username, password, and remove accounts."
                      : "You can view users, but only admin can edit."}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="rounded-lg border bg-[#07713c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e6a100]"
                  >
                    + Add User
                  </button>
                )}
              </div>
              <div className="space-y-1 border-b border-[#07713c]/20 px-4 py-3">
                <p className="text-xs text-black/75">Role: {isSuperAdmin ? "Super Admin" : roleLabel}</p>
                {actionError && <p className="text-sm text-black">{actionError}</p>}
                {actionSuccess && <p className="text-sm text-black">{actionSuccess}</p>}
              </div>

              <div className="min-w-0 overflow-x-auto">
                <table className={`w-full min-w-0 table-fixed text-sm font-[Inter,sans-serif] ${TABLE_CELL_NOWRAP}`}>
                  <thead className={`border-b border-[#07713c]/30 bg-[#07713c] text-xs uppercase tracking-wide ${USERS_TH_TEXT}`}>
                    <tr>
                      <th className="w-[7%] px-3 py-2.5 text-left align-middle">ID</th>
                      <th className="w-[18%] px-3 py-2.5 text-left align-middle">Full Name</th>
                      <th className="w-[14%] px-3 py-2.5 text-left align-middle">Username</th>
                      <th className="w-[14%] px-3 py-2.5 text-left align-middle">Password</th>
                      <th className="w-[16%] px-3 py-2.5 text-left align-middle">Role</th>
                      <th className="w-[19%] px-3 py-2.5 text-left align-middle">Department</th>
                      <th className="px-3 py-2.5 text-left align-middle">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td className="px-3 py-3 text-sm text-black/85" colSpan={7}>
                          Loading users...
                        </td>
                      </tr>
                    ) : sortedUsers.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-sm text-black/85" colSpan={7}>
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      sortedUsers.map((user: ManagedUserRecord) => {
                        const isEditing = editingUserId === user.id;
                        return (
                          <tr key={user.id} className="border-b border-[#07713c]/15 hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-left leading-snug text-black">{user.id}</td>
                            <td className="px-3 py-1.5 text-left leading-snug text-black">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.fullName}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
                                  className="w-full rounded-lg border border-[#07713c]/40 bg-white px-2.5 py-1.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                                  placeholder="Enter full name"
                                />
                              ) : (
                                <span className="block truncate" title={user.full_name || "-"}>
                                  {user.full_name || "-"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-left leading-snug text-black">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.username}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
                                  className="w-full rounded-lg border border-[#07713c]/40 bg-white px-2.5 py-1.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                                />
                              ) : (
                                <span className="block truncate" title={user.username}>
                                  {user.username}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-left leading-snug text-black">
                              {isEditing && isAdmin ? (
                                <input
                                  type="password"
                                  value={editForm.password}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                                  className="w-full rounded-lg border border-[#07713c]/40 bg-white px-2.5 py-1.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                                  placeholder="Enter new password"
                                />
                              ) : (
                                <span className="text-black/65">••••••••</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-left leading-snug text-black truncate" title={roleLabelForUsersPage(user.role)}>
                              {roleLabelForUsersPage(user.role)}
                            </td>
                            <td className="px-3 py-1.5 text-left leading-snug text-black truncate" title={user.department_name || user.department || "-"}>
                              {user.department_name || user.department || "-"}
                            </td>
                            <td className="px-3 py-1.5 text-left">
                              {!isAdmin ? (
                                <span className="text-xs text-black/60">View only</span>
                              ) : isEditing ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={saveEdit}
                                    disabled={updateUserMutation.isPending}
                                    className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#07713c]/15 disabled:opacity-60"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUserId(null);
                                      setEditForm({ fullName: "", username: "", password: "" });
                                    }}
                                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-black"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(user)}
                                    className="rounded-lg border border-[#07713C]/40 px-3 py-1.5 text-xs font-medium text-black hover:bg-[#07713C]/10"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => user.id != null && removeUser(user.id)}
                                    disabled={deleteUserMutation.isPending}
                                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-black hover:bg-red-100 disabled:opacity-60"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>

      <CreateUserModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          refetch();
        }}
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import SuperAdminShell from "./SuperAdminShell";
import CreateUserModal from "./CreateUserModal";
import { useDeleteUser, useUpdateUser, useUsersList } from "../hooks/useUsersManagement";
import { getApiErrorMessage, type UserRecord } from "../types/api";
import type { DeskPageProps } from "../types/desk-pages";

type UserEditForm = { fullName: string; username: string; password: string };
type UpdatePayload = { fullName?: string; username?: string; password?: string };

const TH = "px-3 py-2.5 text-left align-middle font-bold text-black text-xs uppercase tracking-wide";
const TD = "px-3 py-2 text-left leading-snug text-black text-sm";

function roleBadge(role: string | undefined) {
  const r = String(role ?? "").toLowerCase();
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold";
  if (r === "super_admin") return <span className={`${base} bg-amber-100 text-amber-800 ring-1 ring-amber-200`}>Super Admin</span>;
  if (r === "admin") return <span className={`${base} bg-green-100 text-green-800 ring-1 ring-green-200`}>Admin</span>;
  if (r === "csg_president") return <span className={`${base} bg-blue-100 text-blue-800 ring-1 ring-blue-200`}>CSG President</span>;
  if (r.includes("governor")) return <span className={`${base} bg-purple-100 text-purple-800 ring-1 ring-purple-200`}>{role}</span>;
  return <span className={`${base} bg-gray-100 text-gray-700`}>{role ?? "—"}</span>;
}

export default function AdminManagementPage(props: DeskPageProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<UserEditForm>({ fullName: "", username: "", password: "" });
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  const { data: users = [], isLoading, refetch } = useUsersList(true);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...users]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .filter((u) => {
        const matchesRole = filterRole === "all" || String(u.role ?? "").toLowerCase() === filterRole;
        const matchesSearch =
          !q ||
          String(u.username ?? "").toLowerCase().includes(q) ||
          String(u.full_name ?? "").toLowerCase().includes(q) ||
          String(u.role ?? "").toLowerCase().includes(q);
        return matchesRole && matchesSearch;
      });
  }, [users, searchQuery, filterRole]);

  const startEdit = (user: UserRecord) => {
    setActionError("");
    setActionSuccess("");
    setEditingId(user.id ?? null);
    setEditForm({ fullName: user.full_name || "", username: user.username || "", password: "" });
  };

  const saveEdit = () => {
    setActionError("");
    setActionSuccess("");
    if (!editingId) return;
    const payload: UpdatePayload = {};
    if (editForm.fullName.trim()) payload.fullName = editForm.fullName.trim();
    if (editForm.username.trim()) payload.username = editForm.username.trim();
    if (editForm.password.trim()) payload.password = editForm.password.trim();
    if (!Object.keys(payload).length) {
      setActionError("Provide at least one field to update.");
      return;
    }
    updateUser.mutate(
      { id: editingId, payload },
      {
        onSuccess: () => {
          setActionSuccess("User updated successfully.");
          setEditingId(null);
        },
        onError: (err) => setActionError(getApiErrorMessage(err, "Failed to update user.")),
      },
    );
  };

  const removeUser = (id: string | number) => {
    setActionError("");
    setActionSuccess("");
    if (!window.confirm("Remove this user? This cannot be undone.")) return;
    deleteUser.mutate(id, {
      onSuccess: () => setActionSuccess("User removed successfully."),
      onError: (err) => setActionError(getApiErrorMessage(err, "Failed to remove user.")),
    });
  };

  const roleOptions = [
    { value: "all", label: "All Roles" },
    { value: "super_admin", label: "Super Admin" },
    { value: "admin", label: "Admin" },
    { value: "csg_president", label: "CSG President" },
    { value: "it_governor", label: "IT Governor" },
    { value: "cba_governor", label: "CBA Governor" },
    { value: "ceas_governor", label: "CEAS Governor" },
    { value: "coc_governor", label: "COC Governor" },
    { value: "chm_governor", label: "CHM Governor" },
  ];

  return (
    <SuperAdminShell
      {...props}
      activeNavId="admin_management"
      pageTitle="Admin Management"
      pageSubtitle="View and manage all user accounts across the system"
      headerRight={
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg border border-[#e6a100] bg-[#ffb300] px-4 py-2 text-xs font-semibold text-black hover:bg-[#e6a100]"
        >
          + Add User
        </button>
      }
    >
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, username, or role..."
          className="flex-1 min-w-[200px] max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-[#07713c] focus:outline-none"
        >
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="text-xs text-[#36454F]/60">
          {filtered.length} of {users.length} users
        </span>
      </div>

      {/* Status messages */}
      {actionError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{actionError}</div>
      )}
      {actionSuccess && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{actionSuccess}</div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#07713c]/25 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] table-auto text-sm font-[Inter,sans-serif]">
            <thead className="border-b border-[#07713c]/30 bg-[#ffb300]">
              <tr>
                <th className={`${TH} w-[6%]`}>ID</th>
                <th className={`${TH} w-[18%]`}>Full Name</th>
                <th className={`${TH} w-[15%]`}>Username</th>
                <th className={`${TH} w-[12%]`}>Password</th>
                <th className={`${TH} w-[16%]`}>Role</th>
                <th className={`${TH} w-[17%]`}>Department</th>
                <th className={`${TH}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-sm text-[#36454F]/70 text-center">Loading users...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-sm text-[#36454F]/70 text-center">No users found.</td></tr>
              ) : (
                filtered.map((user) => {
                  const isEditing = editingId === user.id;
                  return (
                    <tr key={user.id} className="border-b border-[#07713c]/10 hover:bg-gray-50">
                      <td className={TD}>{user.id}</td>
                      <td className={TD}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.fullName}
                            onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                            className="w-full rounded border border-[#07713c]/40 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                            placeholder="Full name"
                          />
                        ) : (
                          <span className="block truncate max-w-[140px]" title={user.full_name || "—"}>{user.full_name || "—"}</span>
                        )}
                      </td>
                      <td className={TD}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.username}
                            onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
                            className="w-full rounded border border-[#07713c]/40 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                          />
                        ) : (
                          <span className="block truncate max-w-[120px]" title={user.username}>{user.username}</span>
                        )}
                      </td>
                      <td className={TD}>
                        {isEditing ? (
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                            className="w-full rounded border border-[#07713c]/40 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                            placeholder="New password"
                          />
                        ) : (
                          <span className="text-[#36454F]/50">••••••••</span>
                        )}
                      </td>
                      <td className={TD}>{roleBadge(user.role)}</td>
                      <td className={`${TD} truncate max-w-[120px]`} title={(user as { department_name?: string }).department_name || user.department || "—"}>
                        {(user as { department_name?: string }).department_name || user.department || "—"}
                      </td>
                      <td className={TD}>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={updateUser.isPending}
                              className="rounded border border-[#07713c] bg-[#07713c]/10 px-2.5 py-1 text-xs font-semibold text-black hover:bg-[#07713c]/20 disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-black"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(user)}
                              className="rounded border border-[#07713c]/40 px-2.5 py-1 text-xs font-medium text-black hover:bg-[#07713c]/10"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => user.id != null && removeUser(user.id)}
                              disabled={deleteUser.isPending}
                              className="rounded border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
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
      </div>

      <CreateUserModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); refetch(); }}
      />
    </SuperAdminShell>
  );
}

import SuperAdminShell from "./SuperAdminShell";
import type { DeskPageProps } from "../types/desk-pages";

type RoleDefinition = {
  role: string;
  label: string;
  description: string;
  color: string;
  permissions: string[];
};

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "super_admin",
    label: "Super Admin",
    description: "Full system access. Can manage all data, users, roles, and configuration.",
    color: "border-amber-300 bg-amber-50",
    permissions: [
      "View & manage all admin accounts",
      "Configure academic periods (school year/semester)",
      "Access all events, students, payments, and reports",
      "View audit logs",
      "Manage roles and permissions",
      "Configure system settings",
      "Import student data",
      "Manage users",
    ],
  },
  {
    role: "admin",
    label: "Admin",
    description: "Full access to operational data within their account/organization.",
    color: "border-green-300 bg-green-50",
    permissions: [
      "View & manage events",
      "View & manage students",
      "Record and manage payments",
      "Manage events (create, edit, delete)",
      "Import student CSV data",
      "Manage operational users (governors, CSG president)",
    ],
  },
  {
    role: "csg_president",
    label: "CSG President",
    description: "Institution-wide event operations but limited to events they created.",
    color: "border-blue-300 bg-blue-50",
    permissions: [
      "Create and manage events",
      "View event attendance",
      "View students",
      "Record payments for their events",
    ],
  },
  {
    role: "governor",
    label: "Department Governor",
    description: "Scoped to their assigned department/college. (IT, CBA, CEAS, COC, CHM)",
    color: "border-purple-300 bg-purple-50",
    permissions: [
      "Create and manage department events",
      "View department students",
      "Record payments for department events",
      "Manage event attendance",
    ],
  },
];

function PermissionBadge({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#36454F]">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#07713C]" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      {text}
    </li>
  );
}

export default function RolesPermissionsPage(props: DeskPageProps) {
  return (
    <SuperAdminShell
      {...props}
      activeNavId="roles_permissions"
      pageTitle="Roles & Permissions"
      pageSubtitle="Overview of system roles and their access levels"
    >
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Role assignments are managed through user accounts</p>
            <p className="mt-0.5 text-xs text-amber-700">
              To change a user's role, go to <strong>Admin Management</strong> and edit the user record. Role permissions below are system-defined and apply to all accounts.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {ROLE_DEFINITIONS.map((def) => (
          <div
            key={def.role}
            className={`rounded-xl border-2 ${def.color} p-5 shadow-sm`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#36454F]">{def.label}</h2>
              <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-[#36454F]/70 ring-1 ring-[#36454F]/20">
                {def.role}
              </span>
            </div>
            <p className="mb-4 text-sm text-[#36454F]/70">{def.description}</p>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#36454F]/50">Permissions</h3>
            <ul className="space-y-1.5">
              {def.permissions.map((p) => (
                <PermissionBadge key={p} text={p} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Role hierarchy */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-[#36454F] mb-4">Role Hierarchy</h2>
        <div className="flex flex-col items-center gap-2">
          {[
            { label: "Super Admin", desc: "Full system control", color: "bg-amber-100 border-amber-300 text-amber-900" },
            { label: "Admin", desc: "Full operational access", color: "bg-green-100 border-green-300 text-green-900" },
            { label: "CSG President", desc: "Institution events", color: "bg-blue-100 border-blue-300 text-blue-900" },
            { label: "Department Governors", desc: "Department-scoped", color: "bg-purple-100 border-purple-300 text-purple-900" },
          ].map((level, i) => (
            <div key={level.label} className="flex flex-col items-center w-full max-w-sm">
              <div className={`w-full rounded-xl border-2 ${level.color} px-4 py-3 text-center`}>
                <p className="font-semibold text-sm">{level.label}</p>
                <p className="text-xs opacity-70">{level.desc}</p>
              </div>
              {i < 3 && (
                <div className="h-4 w-0.5 bg-gray-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    </SuperAdminShell>
  );
}

import type { ReactNode, SVGProps } from "react";
import csgLogo from "../assets/CSG LOGO.jpg";
import { useAuthSession } from "../hooks/auth";
import type { AppNavId } from "../utils/appNav";
import { getNavDisplayNameFromSession } from "../utils/roles";

type IconProps = SVGProps<SVGSVGElement>;

const common: IconProps = {
  className: "h-5 w-5 shrink-0",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function IconDashboard(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconEvents(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 11h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <circle cx="8" cy="16" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconStudents(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
    </svg>
  );
}

function IconAnalytics(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M4 20V8 M10 20V5 M16 20V12 M22 20V3" />
    </svg>
  );
}

function IconPayment(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <circle cx="8" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <path d="M16 14h3" />
    </svg>
  );
}

function IconImport(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <rect x="4" y="17" width="16" height="4" rx="1.5" />
    </svg>
  );
}

function IconUsers(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 18a5.5 5.5 0 0 1 11 0" />
      <circle cx="17.5" cy="9.5" r="2.5" />
      <path d="M14.5 18a4.5 4.5 0 0 1 7 0" />
    </svg>
  );
}

function IconAcademicSettings(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconAdminManagement(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
      <path d="M17 3l1.5 1.5L21 2" />
    </svg>
  );
}

function IconRolesPermissions(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconSystemSettings(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconAuditLogs(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconReports(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconExportSecurity(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.5C16.5 22.15 20 17.25 20 12V6l-8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

const NAV_ICON_MAP = {
  dashboard: IconDashboard,
  events: IconAnalytics,
  students: IconStudents,
  payment: IconPayment,
  manage_events: IconEvents,
  import: IconImport,
  users: IconUsers,
  academic_settings: IconAcademicSettings,
  admin_management: IconAdminManagement,
  roles_permissions: IconRolesPermissions,
  system_settings: IconSystemSettings,
  audit_logs: IconAuditLogs,
  reports: IconReports,
  export_security: IconExportSecurity,
} as const;

export type SidebarNavId = AppNavId;

export function SidebarBrand() {
  return (
    <div className="p-6 space-y-4">
      <img
        src={csgLogo}
        alt="Central Student Government"
        className="mx-auto h-16 w-16 rounded-full bg-white/10 object-contain"
      />
      <p className="text-center text-xs font-medium uppercase tracking-wider font-[Inter,sans-serif] text-white">
        Central Student Government
      </p>
    </div>
  );
}

export function SidebarNavIcon({ navId }: { navId: SidebarNavId }) {
  const Cmp = NAV_ICON_MAP[navId] ?? IconDashboard;
  return <Cmp />;
}

export function SidebarUserFullName() {
  const { data: session } = useAuthSession();
  const displayName = getNavDisplayNameFromSession(session);

  if (!displayName) return null;

  return (
    <div className="shrink-0 border-t border-white/20 px-4 py-4 text-center">
      <p className="truncate text-sm font-medium text-white" title={displayName}>
        {displayName}
      </p>
    </div>
  );
}

export interface SidebarNavItem {
  id: AppNavId;
  label: string;
}

interface SidebarProps {
  navItems?: SidebarNavItem[];
  onNavigate?: (id: string) => void;
  activeNavId?: string;
  className?: string;
  brand?: ReactNode;
}

export default function Sidebar({ navItems = [], onNavigate, activeNavId = "dashboard", className, brand }: SidebarProps) {
  return (
    <aside className={`sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col ${className ?? ""}`.trim()}>
      {brand ?? <SidebarBrand />}
      <nav className="flex-1 px-4 space-y-1 pb-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate?.(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
              item.id === activeNavId ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
            }`}
          >
            <SidebarNavIcon navId={item.id} />
            {item.label}
          </button>
        ))}
      </nav>
      <SidebarUserFullName />
    </aside>
  );
}

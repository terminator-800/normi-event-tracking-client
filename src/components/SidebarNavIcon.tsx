import type { SVGProps } from "react";
import type { AppNavId } from "../utils/appNav";

/**
 * Line icons for governor/admin sidebar nav — distinct shapes per section.
 */
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

/** Single-student silhouette — Students nav. */
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

const MAP = {
  dashboard: IconDashboard,
  events: IconAnalytics,
  students: IconStudents,
  payment: IconPayment,
  manage_events: IconEvents,
  import: IconImport,
  users: IconUsers,
} as const;

export type SidebarNavId = AppNavId;

export default function SidebarNavIcon({ navId }: { navId: SidebarNavId }) {
  const Cmp = MAP[navId] ?? IconDashboard;
  return <Cmp />;
}

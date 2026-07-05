import { useMemo, useState } from "react";
import SidebarNavIcon from "./SidebarNavIcon";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import UserCircleIcon from "./UserCircleIcon";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import { getAppNavItems } from "../utils/appNav";
import { getDashboardRoleLabel, getNavDisplayNameFromSession, isSuperAdminRole, isAdminRole, isCsgPresident } from "../utils/roles";
import { useAuthSession } from "../hooks/auth";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { useGetEvents, formatEventDateForDisplay } from "../hooks/useGetEvents";
import { useSuperAdminStats } from "../hooks/useSuperAdminData";
import EventCard from "./EventCard";
import { Chart as ChartJS, type ChartOptions } from "chart.js/auto";
import { Line, Doughnut } from "react-chartjs-2";
import type { DeskPageProps } from "../types/desk-pages";
import type { DisplayEvent } from "../types/events";

void ChartJS;

function eventDateMs(d: string | null | undefined) {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

function parseStartEndFromTimeSlots(timeSlots: string | null | undefined) {
  if (!timeSlots || typeof timeSlots !== "string") return { start: "—", end: "—" };
  const re = /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[\u2013\u2014\-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/gi;
  const ranges: { start: string; end: string }[] = [];
  let m = re.exec(timeSlots);
  while (m) {
    ranges.push({ start: m[1].replace(/\s+/g, " ").trim(), end: m[2].replace(/\s+/g, " ").trim() });
    m = re.exec(timeSlots);
  }
  if (ranges.length === 0) return { start: "—", end: "—" };
  return { start: ranges[0].start, end: ranges[ranges.length - 1].end };
}

function UpcomingEventStrip({ ev, onOpen }: { ev: DisplayEvent; onOpen: () => void }) {
  const { start, end } = parseStartEndFromTimeSlots(ev.timeSlots);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View full details for ${ev.name || "event"}`}
      className="group w-full rounded-xl bg-[#C8E6C9] px-5 py-5 sm:px-8 shadow-md text-left transition hover:brightness-[0.97] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008000] focus-visible:ring-offset-2"
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Event", value: ev.name || "—" },
          { label: "Date", value: formatEventDateForDisplay(ev.date) },
          { label: "Start time", value: start },
          { label: "End time", value: end },
          { label: "Venue", value: ev.venue || "—" },
          { label: "Status", value: ev.status || "—", bold: true },
        ].map((col) => (
          <div key={col.label} className="min-w-0 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#36454F]/65">{col.label}</p>
            <p className={`mt-1.5 text-sm text-gray-900 leading-snug break-words ${col.bold ? "font-bold" : "font-medium"}`}>
              {col.value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-[#36454F]/50 group-hover:text-[#36454F]/70">
        Click for full details
      </p>
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = "text-[#008000]",
  icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#008000]/30 bg-white p-4 shadow-sm flex flex-col gap-1">
      {icon && <div className="mb-1 text-[#07713C]">{icon}</div>}
      <p className="text-xs font-semibold uppercase tracking-wide text-[#36454F]/70">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#36454F]/60">{sub}</p>}
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#36454F]/50">{title}</p>
      {subtitle && <p className="text-xs text-[#36454F]/40 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function MainDashboard({ onLogout, onNavigate }: DeskPageProps) {
  const { data: apiEvents = [] } = useGetEvents();
  const { data: session } = useAuthSession();
  const { role, isGovernor, governorScope } = useGovernorScope();

  const normalizedRole = String(role ?? "").toLowerCase().trim();
  const isSuperAdmin = isSuperAdminRole(normalizedRole);
  const isAdmin = isAdminRole(normalizedRole);
  const isCsg = isCsgPresident(normalizedRole);

  const { data: superAdminStats } = useSuperAdminStats(isSuperAdmin);

  const upcomingEvents = useMemo(() => {
    const norm = (s: string | undefined) => String(s || "").toLowerCase();
    return [...apiEvents]
      .filter((e) => norm(e.status) === "upcoming")
      .sort((a, b) => eventDateMs(a.date) - eventDateMs(b.date));
  }, [apiEvents]);

  const eventSummaryCards = useMemo(() => {
    const list = apiEvents;
    const norm = (s: string | undefined) => String(s || "").toLowerCase();
    const total = list.length;
    const upcoming = list.filter((e) => norm(e.status) === "upcoming").length;
    const active = list.filter((e) => norm(e.status) === "active").length;
    const completed = list.filter((e) => norm(e.status) === "completed").length;
    const mandatory = list.filter((e) => e.is_mandatory).length;
    const allDept = list.filter((e) => e.is_all_departments).length;
    return [
      { label: "Total Events", value: total, sub: "All periods", color: "text-[#008000]" },
      { label: "Upcoming", value: upcoming, sub: "Scheduled", color: "text-blue-600" },
      { label: "Active", value: active, sub: "In progress", color: "text-orange-600" },
      { label: "Completed", value: completed, sub: "Past events", color: "text-green-700" },
      { label: "Mandatory", value: mandatory, sub: "Required attendance", color: "text-gray-800" },
      { label: "All Departments", value: allDept, sub: "Open to everyone", color: "text-gray-800" },
    ];
  }, [apiEvents]);

  const overviewLineData = useMemo(() => ({
    labels: ["Total", "Upcoming", "Active", "Completed", "Mandatory", "All Depts"],
    datasets: [
      {
        label: "Event Overview",
        data: eventSummaryCards.map((c) => c.value),
        borderColor: "#008000",
        backgroundColor: "rgba(0,128,0,0.12)",
        pointBackgroundColor: "#FFC90B",
        pointBorderColor: "#36454F",
        pointHoverBackgroundColor: "#36454F",
        pointHoverBorderColor: "#FFC90B",
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 3,
        tension: 0.35,
        fill: true,
      },
    ],
  }), [eventSummaryCards]);

  const lineOptions = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: "top" as const, labels: { color: "#36454F", boxWidth: 12, usePointStyle: true, pointStyle: "circle" } },
      },
      scales: {
        x: { grid: { color: "rgba(54,69,79,0.12)" }, ticks: { color: "#36454F", font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: "rgba(54,69,79,0.12)" }, ticks: { color: "#36454F", precision: 0 } },
      },
    }),
    [],
  );

  const superAdminUsersDoughnut = useMemo(() => {
    if (!superAdminStats) return null;
    const { total_admins, total_csg_presidents, total_governors } = superAdminStats.users;
    return {
      labels: ["Admins", "CSG Presidents", "Governors"],
      datasets: [
        {
          data: [Number(total_admins), Number(total_csg_presidents), Number(total_governors)],
          backgroundColor: ["#07713C", "#FFC90B", "#4A90D9"],
          borderColor: ["#ffffff", "#ffffff", "#ffffff"],
          borderWidth: 2,
        },
      ],
    };
  }, [superAdminStats]);

  const doughnutOptions = useMemo<ChartOptions<"doughnut">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" as const, labels: { color: "#36454F", boxWidth: 12, padding: 12, font: { size: 11 } } },
      },
      cutout: "65%",
    }),
    [],
  );

  const [showLogout, setShowLogout] = useState(false);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedUpcomingEvent, setSelectedUpcomingEvent] = useState<DisplayEvent | null>(null);

  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const sessionDisplayName = getNavDisplayNameFromSession(session);
  const headerName = sessionDisplayName
    ? `Welcome, ${sessionDisplayName}`
    : isSuperAdmin
    ? "Welcome, Super Admin"
    : `Welcome, ${roleLabel}`;

  const navItems = getAppNavItems({ isAdmin: isAdmin || isSuperAdmin, isSuperAdmin, isCsgPresident: isCsg });

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      {/* Sidebar */}
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col">
        <SidebarBrand />
        <nav className="flex-1 px-4 space-y-1 pb-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                item.id === "dashboard" ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
              }`}
            >
              <SidebarNavIcon navId={item.id} />
              {item.label}
            </button>
          ))}
        </nav>
        <SidebarUserFullName />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 max-w-7xl mx-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">
              {headerName}
            </h1>
            <NavbarAcademicPeriod className="mt-1" />
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Super Admin
              </span>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogout((prev) => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center text-[#008000] rounded-lg hover:bg-green-50"
                aria-label="Account menu"
                aria-expanded={showLogout}
              >
                <UserCircleIcon />
              </button>
              {showLogout && (
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[120px] z-10">
                  <button
                    type="button"
                    onClick={() => { setShowLogout(false); onLogout?.(); }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto bg-[#f6f8f9]">

          {/* ── Super Admin combined stats ── */}
          {isSuperAdmin && superAdminStats && (
            <>
              <SectionHeading
                title="System Overview"
                subtitle="Combined statistics across all accounts"
              />
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard
                  label="Total Users"
                  value={Number(superAdminStats.users.total_users)}
                  sub="All accounts"
                  color="text-[#07713C]"
                />
                <StatCard
                  label="Total Admins"
                  value={Number(superAdminStats.users.total_admins)}
                  sub="Admin accounts"
                  color="text-blue-600"
                />
                <StatCard
                  label="Total Students"
                  value={Number(superAdminStats.students.total_students)}
                  sub="Enrolled"
                  color="text-indigo-600"
                />
                <StatCard
                  label="Total Events"
                  value={Number(superAdminStats.events.total_events)}
                  sub="All periods"
                  color="text-orange-600"
                />
                <StatCard
                  label="Payments Collected"
                  value={Number(superAdminStats.payments.total_payments)}
                  sub="Paid transactions"
                  color="text-green-700"
                />
              </div>

              {/* User role breakdown chart */}
              {superAdminUsersDoughnut && (
                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-[#36454F]/20 bg-white p-5 shadow-sm lg:col-span-1">
                    <h3 className="text-sm font-semibold text-[#36454F] mb-1">User Role Breakdown</h3>
                    <p className="text-xs text-[#36454F]/60 mb-4">Distribution of user roles</p>
                    <div className="h-[200px]">
                      <Doughnut data={superAdminUsersDoughnut} options={doughnutOptions} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#36454F]/20 bg-white p-5 shadow-sm lg:col-span-2">
                    <h3 className="text-sm font-semibold text-[#36454F] mb-1">Event Status Summary</h3>
                    <p className="text-xs text-[#36454F]/60 mb-4">All events across the system</p>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 h-[200px] content-center">
                      {[
                        { label: "Total", value: superAdminStats.events.total_events, color: "text-[#07713C]", bg: "bg-green-50" },
                        { label: "Upcoming", value: superAdminStats.events.upcoming_events, color: "text-blue-600", bg: "bg-blue-50" },
                        { label: "Active", value: superAdminStats.events.active_events, color: "text-orange-600", bg: "bg-orange-50" },
                        { label: "Completed", value: superAdminStats.events.completed_events, color: "text-gray-700", bg: "bg-gray-50" },
                      ].map((item) => (
                        <div key={item.label} className={`${item.bg} rounded-xl p-4 text-center`}>
                          <p className={`text-2xl font-bold ${item.color}`}>{Number(item.value)}</p>
                          <p className="text-xs text-[#36454F]/70 mt-1 font-medium">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Upcoming events ── */}
          <section className="mb-6">
            <SectionHeading
              title="Upcoming Events"
              subtitle={isSuperAdmin ? "All upcoming events across the system" : undefined}
            />
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.slice(0, 5).map((ev) => (
                  <UpcomingEventStrip
                    key={ev.id ?? `${ev.name}-${ev.date}`}
                    ev={ev}
                    onOpen={() => {
                      setSelectedUpcomingEvent(ev);
                      setShowEventDetailModal(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center text-sm text-[#36454F]/65">
                No upcoming events scheduled.
              </div>
            )}
          </section>

          {/* ── Event statistics cards ── */}
          <section className="mb-6">
            <SectionHeading
              title="Event Statistics"
              subtitle={isSuperAdmin ? "Loaded from all accounts" : "Current period"}
            />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {eventSummaryCards.map((item, i) => (
                <StatCard key={i} label={item.label} value={item.value} sub={item.sub} color={item.color} />
              ))}
            </div>
          </section>

          {/* ── Attendance overview chart ── */}
          <section className="rounded-xl border border-[#36454F]/20 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-[#36454F]">Attendance Overview</h3>
            <p className="mt-1 text-xs text-[#36454F]/70">Event statistics visualized across categories.</p>
            <div className="mt-4 h-[320px]">
              <Line data={overviewLineData} options={lineOptions} />
            </div>
          </section>

          {/* ── Super admin quick actions ── */}
          {isSuperAdmin && (
            <section className="mt-6">
              <SectionHeading title="Quick Actions" subtitle="Super Admin shortcuts" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Admin Management", nav: "admin_management", desc: "Manage admin accounts", color: "border-[#07713C]/40 hover:bg-green-50" },
                  { label: "Roles & Permissions", nav: "roles_permissions", desc: "Configure access control", color: "border-blue-200 hover:bg-blue-50" },
                  { label: "System Settings", nav: "system_settings", desc: "Configure the system", color: "border-orange-200 hover:bg-orange-50" },
                  { label: "Audit Logs", nav: "audit_logs", desc: "View system activity", color: "border-purple-200 hover:bg-purple-50" },
                ].map((action) => (
                  <button
                    key={action.nav}
                    type="button"
                    onClick={() => onNavigate?.(action.nav)}
                    className={`rounded-xl border bg-white p-4 text-left transition-colors ${action.color}`}
                  >
                    <p className="font-semibold text-sm text-[#36454F]">{action.label}</p>
                    <p className="text-xs text-[#36454F]/60 mt-1">{action.desc}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Event detail modal */}
      {showEventDetailModal && selectedUpcomingEvent && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 py-6"
          role="presentation"
          onClick={() => setShowEventDetailModal(false)}
        >
          <div
            className="relative flex max-h-[min(92vh,960px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 flex-col gap-0.5 border-b border-gray-100 bg-[#f8faf8] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 id="event-detail-title" className="text-base font-semibold text-[#36454F]">
                Event Details
              </h3>
              <button
                type="button"
                onClick={() => setShowEventDetailModal(false)}
                className="mt-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm sm:mt-0"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
              <EventCard variant="modalHorizontal" event={selectedUpcomingEvent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

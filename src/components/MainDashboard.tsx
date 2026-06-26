import { useEffect, useMemo, useState, type FormEvent } from "react";
import SidebarNavIcon from "./SidebarNavIcon";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import UserCircleIcon from "./UserCircleIcon";
import { getAppNavItems, SHOW_DASHBOARD_IN_NAV } from "../utils/appNav";
import { getDashboardRoleLabel, getNavDisplayNameFromSession } from "../utils/roles";
import { useAuthSession, useCreateDepartmentUser } from "../hooks/auth";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { useGetEvents, formatEventDateForDisplay } from "../hooks/useGetEvents";
import EventCard from "./EventCard";
import { Chart as ChartJS, type ChartOptions } from "chart.js/auto";
import { Line } from "react-chartjs-2";
import { getApiErrorMessage } from "../types/api";
import type { DeskPageProps } from "../types/desk-pages";
import type { DisplayEvent } from "../types/events";

void ChartJS;

type UpcomingEventStripProps = {
  ev: DisplayEvent;
  onOpen: () => void;
};

type CreatedAccountInfo = {
  username: string;
  email: string;
  password: string;
  role: string;
};

function CreatedAccountSuccess({ account }: { account: CreatedAccountInfo }) {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1">
      <p className="text-xs font-semibold text-green-700">
        {account.role === "csg_president"
          ? "CSG President created successfully."
          : "User created successfully."}
      </p>
      <p className="text-xs text-green-700">Email: {account.email}</p>
      <p className="text-xs text-green-700">Username: {account.username}</p>
      <p className="text-xs text-green-700">Password: {account.password}</p>
      <p className="text-xs text-green-700">Role: {account.role}</p>
    </div>
  );
}

function renderCreatedAccountSuccess(account: CreatedAccountInfo | null) {
  if (!account) return null;
  return <CreatedAccountSuccess account={account} />;
}

function eventDateMs(d: string | null | undefined) {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** First slot start → last slot end from API `timeSlots` text (AM/PM lines). */
function parseStartEndFromTimeSlots(timeSlots: string | null | undefined) {
  if (!timeSlots || typeof timeSlots !== "string") {
    return { start: "—", end: "—" };
  }
  const re =
    /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[\u2013\u2014\-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/gi;
  const ranges = [];
  let m = re.exec(timeSlots);
  while (m) {
    ranges.push({ start: m[1].replace(/\s+/g, " ").trim(), end: m[2].replace(/\s+/g, " ").trim() });
    m = re.exec(timeSlots);
  }
  if (ranges.length === 0) return { start: "—", end: "—" };
  return { start: ranges[0].start, end: ranges[ranges.length - 1].end };
}

function UpcomingEventStrip({ ev, onOpen }: UpcomingEventStripProps) {
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
          {
            label: "Status",
            value: ev.status || "—",
            bold: true,
          },
        ].map((col) => (
          <div key={col.label} className="min-w-0 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#36454F]/65">
              {col.label}
            </p>
            <p
              className={`mt-1.5 text-sm text-gray-900 leading-snug break-words ${
                col.bold ? "font-bold" : "font-medium"
              }`}
            >
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

const DEPARTMENT_OPTIONS = [
  {
    value: "College of Information Technology",
    majors: [],
  },
  {
    value: "College of Business Administration",
    majors: ["Marketing Management", "Financial Management", "Human Resource Management"],
  },
  {
    value: "College of Education, Arts and Sciences",
    majors: ["English", "Filipino", "Mathematics", "BEED"],
  },
  {
    value: "College of Criminology",
    majors: [],
  },
  {
    value: "College of Hospitality Management",
    majors: [],
  },
];

const DEPARTMENT_USERNAME_BASE: Record<string, string> = {
  "College of Information Technology": "gov-IT",
  "College of Business Administration": "gov-CBA",
  "College of Education, Arts and Sciences": "gov-CEAS",
  "College of Criminology": "gov-CRIM",
  "College of Hospitality Management": "gov-CHM",
};

function isValidAllowedEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[a-z0-9._-]+@(normi\.edu\.ph|gmail\.com)$/.test(email);
}

export default function MainDashboard({ onLogout, onNavigate }: DeskPageProps) {
  const { data: apiEvents = [] } = useGetEvents();
  console.log(apiEvents, ": API EVENTS")
  const { data: session } = useAuthSession();
  const { role, isGovernor, governorScope } = useGovernorScope();

  /** Upcoming events sorted by nearest date first. */
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
      { label: "Total events", value: total, sub: "From server (/get-events)", color: "text-[#008000]" },
      { label: "Upcoming", value: upcoming, sub: "Scheduled", color: "text-blue-600" },
      { label: "Active", value: active, sub: "In progress", color: "text-orange-600" },
      { label: "Completed", value: completed, sub: "Past events", color: "text-green-600" },
      { label: "Mandatory", value: mandatory, sub: "Required attendance", color: "text-gray-800" },
      { label: "All departments", value: allDept, sub: "Open to everyone", color: "text-gray-800" },
    ];
  }, [apiEvents]);
  const overviewLineData = useMemo(() => {
    const total = eventSummaryCards[0]?.value ?? 0;
    const upcoming = eventSummaryCards[1]?.value ?? 0;
    const active = eventSummaryCards[2]?.value ?? 0;
    const completed = eventSummaryCards[3]?.value ?? 0;
    const mandatory = eventSummaryCards[4]?.value ?? 0;
    const allDepartments = eventSummaryCards[5]?.value ?? 0;

    return {
      labels: ["Total", "Upcoming", "Active", "Completed", "Mandatory", "All Departments"],
      datasets: [
        {
          label: "Event Overview",
          data: [total, upcoming, active, completed, mandatory, allDepartments],
          borderColor: "#008000",
          backgroundColor: "rgba(0,128,0,0.15)",
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
    };
  }, [eventSummaryCards]);

  const overviewLineOptions = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            color: "#36454F",
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(54,69,79,0.12)" },
          ticks: { color: "#36454F", font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(54,69,79,0.12)" },
          ticks: { color: "#36454F", precision: 0 },
        },
      },
    }),
    [],
  );

  const [showLogout, setShowLogout] = useState(false);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedUpcomingEvent, setSelectedUpcomingEvent] = useState<DisplayEvent | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [, setShowCreateUserModal] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);
  const [reportMode] = useState("export");
  const [createUserError, setCreateUserError] = useState("");
  const [createdAccount, setCreatedAccount] = useState<CreatedAccountInfo | null>(null);
  const [createUserForm, setCreateUserForm] = useState({
    department: "",
    major: "",
    email: "",
    password: "",
    confirmPassword: "",
    accountType: "department",
  });

  useEffect(() => {
    if (!showEventDetailModal) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setShowEventDetailModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEventDetailModal]);

  useEffect(() => {
    if (!showEventDetailModal) return;
    if (!selectedUpcomingEvent && upcomingEvents.length > 0) {
      setSelectedUpcomingEvent(upcomingEvents[0]);
    }
  }, [showEventDetailModal, selectedUpcomingEvent, upcomingEvents]);

  const activeNav = SHOW_DASHBOARD_IN_NAV ? "dashboard" : "events";
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const isAdmin = String(role || "").toLowerCase().trim() === "admin";
  const sessionDisplayName = getNavDisplayNameFromSession(session);
  const headerName = sessionDisplayName ? `Welcome, ${sessionDisplayName}` : `Welcome, ${roleLabel}`;
  const { mutate: createDepartmentUser, isPending: isCreatingDepartmentUser } =
    useCreateDepartmentUser();

  const normalizedDepartment = createUserForm.department
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const normalizedMajor = createUserForm.major
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const generatedUsername = useMemo(() => {
    if (createUserForm.accountType === "csg_president") {
      return "csg-president".slice(0, 28);
    }
    const selectedDepartment = DEPARTMENT_OPTIONS.find(
      (item) => item.value === createUserForm.department,
    );
    const requiresMajor = (selectedDepartment?.majors?.length || 0) > 0;
    const departmentBase =
      DEPARTMENT_USERNAME_BASE[createUserForm.department] ||
      (normalizedDepartment ? `gov-${normalizedDepartment}` : "");

    if (!departmentBase) return "";
    if (!requiresMajor) return departmentBase.slice(0, 28);
    if (!normalizedMajor) return "";
    return `${departmentBase}-${normalizedMajor}`.slice(0, 28);
  }, [normalizedDepartment, normalizedMajor, createUserForm.department, createUserForm.accountType]);

  const emailValue = (createUserForm.email || "").trim();
  const isEmailValid = !emailValue || isValidAllowedEmail(emailValue);
  const passwordValue = createUserForm.password || "";
  const confirmPasswordValue = createUserForm.confirmPassword || "";
  const isPasswordValid = !passwordValue || passwordValue.length >= 6;
  const doPasswordsMatch =
    !passwordValue || !confirmPasswordValue || passwordValue === confirmPasswordValue;
  const isCreateUserDisabled =
    isCreatingDepartmentUser ||
    !emailValue ||
    !isEmailValid ||
    !passwordValue ||
    !confirmPasswordValue ||
    !isPasswordValid ||
    !doPasswordsMatch;
  const majorOptions = useMemo(() => {
    const selected = DEPARTMENT_OPTIONS.find(
      (item) => item.value === createUserForm.department,
    );
    return selected?.majors || [];
  }, [createUserForm.department]);

  const navItems = getAppNavItems({ isAdmin });


  const closeCreateUserModal = () => {
    if (isCreatingDepartmentUser) return;
    setShowCreateUserModal(false);
    setCreateUserError("");
  };

  // Create user modal is controlled globally from App.jsx (CreateUserModal).

  const handleCreateDepartmentUser = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateUserError("");
    setCreatedAccount(null);

    const isPresident = createUserForm.accountType === "csg_president";
    const requiresMajor = !isPresident && majorOptions.length > 0;

    if (!isPresident) {
      if (!createUserForm.department.trim()) {
        setCreateUserError("Department is required.");
        return;
      }

      if (requiresMajor && !createUserForm.major.trim()) {
        setCreateUserError("Major is required for the selected department.");
        return;
      }
    }

    if (!generatedUsername) {
      setCreateUserError("Unable to generate credentials. Check your inputs.");
      return;
    }

    const finalEmail = emailValue;
    if (!finalEmail) {
      setCreateUserError("Email is required.");
      return;
    }
    if (!isValidAllowedEmail(finalEmail)) {
      setCreateUserError("Email must end with @normi.edu.ph or @gmail.com.");
      return;
    }
    if (!passwordValue || !confirmPasswordValue) {
      setCreateUserError("Password and confirm password are required.");
      return;
    }
    if (passwordValue.length < 6) {
      setCreateUserError("Password must be at least 6 characters.");
      return;
    }
    if (passwordValue !== confirmPasswordValue) {
      setCreateUserError("Password and confirm password do not match.");
      return;
    }
    createDepartmentUser(
      {
        username: generatedUsername,
        password: passwordValue,
        department: isPresident ? "" : createUserForm.department.trim(),
        major: isPresident ? "" : requiresMajor ? createUserForm.major.trim() : "",
        role: createUserForm.accountType,
      },
      {
        onSuccess: () => {
          setCreatedAccount({
            username: generatedUsername,
            email: finalEmail,
            password: passwordValue,
            role: createUserForm.accountType,
          });
        },
        onError: (err) => {
          setCreateUserError(getApiErrorMessage(err, "Failed to create department user."));
        },
      },
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      {/* Sidebar */}
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col">
        <SidebarBrand />
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate && onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                activeNav === item.id ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#008000] leading-tight">
            {headerName}
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogout((prev) => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center text-[#008000] rounded-lg hover:bg-green-50"
                aria-label="Account menu"
                aria-expanded={showLogout}
                aria-haspopup="true"
              >
                <UserCircleIcon />
              </button>
              {showLogout && (
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[100px]">
                  <button onClick={() => { setShowLogout(false); onLogout?.(); }} className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto bg-[#f6f8f9]">
          <section className="mb-6">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#36454F]/45">
              Upcoming events
            </p>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((ev) => (
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
                No upcoming event scheduled.
              </div>
            )}
          </section>

          <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {eventSummaryCards.map((item, i) => (
              <div key={i} className="rounded-xl border border-[#008000]/40 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#36454F]/70">{item.label}</p>
                <p className={`mt-2 text-3xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-[11px] text-[#36454F]/70">{item.sub}</p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-[#36454F]/20 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-[#36454F]">Attendance Overview</h3>
            <p className="mt-1 text-xs text-[#36454F]/70">Overview of current event statistics using line graph.</p>
            <div className="mt-4 h-[320px]">
              <Line data={overviewLineData} options={overviewLineOptions} />
            </div>
          </section>
        </main>
      </div>

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
            <div className="flex shrink-0 flex-col gap-0.5 border-b border-gray-100 bg-[#f8faf8] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-3.5">
              <h3 id="event-detail-title" className="text-base font-semibold text-[#36454F]">
                Event details
              </h3>
              <button
                type="button"
                onClick={() => setShowEventDetailModal(false)}
                className="mt-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm sm:mt-0"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6 [scrollbar-width:thin] [scrollbar-color:rgba(7,113,60,0.28)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#07713c]/30 [&::-webkit-scrollbar-thumb]:hover:bg-[#07713c]/40 [&::-webkit-scrollbar-track]:bg-transparent">
              <EventCard variant="modalHorizontal" event={selectedUpcomingEvent} />
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">
                {reportMode === "settings"
                  ? `${roleLabel} Settings`
                  : reportMode === "import"
                    ? "Import Data"
                    : "Export Data"}
              </h3>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-gray-600">
                {reportMode === "settings"
                  ? "Settings are not implemented yet (this is a placeholder)."
                  : reportMode === "import"
                    ? "Choose what you want to import."
                    : "Choose what you want to export."}
              </p>
              {reportMode !== "settings" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-gray-300 p-4 text-left hover:border-[#008000] hover:bg-green-50 transition-colors"
                    onClick={() => setShowReportModal(false)}
                  >
                    <p className="font-semibold text-gray-900">
                      {reportMode === "import" ? "Import Attendance" : "Export Attendance"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {reportMode === "import"
                        ? "Import attendance records into the system."
                        : "Download attendance records for reports."}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-gray-300 p-4 text-left hover:border-[#008000] hover:bg-green-50 transition-colors"
                    onClick={() => setShowReportModal(false)}
                  >
                    <p className="font-semibold text-gray-900">
                      {reportMode === "import" ? "Import Students" : "Export Students"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {reportMode === "import"
                        ? "Import student records into the system."
                        : "Download student or department records."}
                    </p>
                  </button>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <button type="button" onClick={() => setShowReportModal(false)} className="px-4 py-2 rounded-lg bg-[#008000] text-white cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">Create User</h3>
            </div>
            <form
              onSubmit={handleCreateDepartmentUser}
              className="p-5 space-y-4 text-sm"
            >
              {createUserError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-700">
                  {createUserError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Account Type
                  </label>
                  <select
                    value={createUserForm.accountType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setCreateUserForm((prev) => ({
                        ...prev,
                        accountType: nextType,
                        ...(nextType === "csg_president"
                          ? { department: "", major: "" }
                          : null),
                      }));
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="department">Department User</option>
                    <option value="csg_president">CSG President</option>
                  </select>
                </div>
                {createUserForm.accountType !== "csg_president" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Department
                      </label>
                      <select
                        value={createUserForm.department}
                        onChange={(e) =>
                          setCreateUserForm((prev) => ({
                            ...prev,
                            department: e.target.value,
                            major: "",
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value="">Select Department</option>
                        {DEPARTMENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Major
                      </label>
                      <select
                        value={createUserForm.major}
                        onChange={(e) =>
                          setCreateUserForm((prev) => ({
                            ...prev,
                            major: e.target.value,
                          }))
                        }
                        disabled={!createUserForm.department || majorOptions.length === 0}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white disabled:bg-gray-100"
                      >
                        <option value="">
                          {createUserForm.department && majorOptions.length === 0
                            ? "No Major Required"
                            : createUserForm.department
                            ? "Select Major"
                            : "Select Department First"}
                        </option>
                        {majorOptions.map((major) => (
                          <option key={major} value={major}>
                            {major}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={createUserForm.email}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className={`w-full border rounded-lg px-3 py-2 bg-white ${
                      isEmailValid ? "border-gray-300" : "border-red-400"
                    }`}
                    placeholder="Enter email (e.g. gov-it@normi.edu.ph)"
                    inputMode="email"
                  />
                  {!isEmailValid && (
                    <p className="text-[11px] text-red-600 mt-1">
                      Invalid email. Use @normi.edu.ph or @gmail.com only.
                    </p>
                  )}
                  {emailValue && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Allowed domains:{" "}
                      <span className="font-medium text-gray-700">
                        @normi.edu.ph, @gmail.com
                      </span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? "text" : "password"}
                      value={createUserForm.password}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      className={`w-full border rounded-lg px-3 py-2 pr-14 bg-white ${
                        isPasswordValid ? "border-gray-300" : "border-red-400"
                      }`}
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 text-[11px] text-green-700 hover:text-green-800"
                    >
                      {showCreatePassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {!isPasswordValid && (
                    <p className="text-[11px] text-red-600 mt-1">
                      Password must be at least 6 characters.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCreateConfirmPassword ? "text" : "password"}
                      value={createUserForm.confirmPassword}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      className={`w-full border rounded-lg px-3 py-2 pr-14 bg-white ${
                        doPasswordsMatch ? "border-gray-300" : "border-red-400"
                      }`}
                      placeholder="Confirm password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 text-[11px] text-green-700 hover:text-green-800"
                    >
                      {showCreateConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {!doPasswordsMatch && (
                    <p className="text-[11px] text-red-600 mt-1">
                      Passwords do not match.
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
                <p className="text-xs text-gray-600">
                  Generated username:{" "}
                  <span className="font-semibold text-gray-800">
                    {generatedUsername || "—"}
                  </span>
                </p>
              </div>
              {renderCreatedAccountSuccess(createdAccount)}
              <div className="px-1 pt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateUserModal}
                  disabled={isCreatingDepartmentUser}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreateUserDisabled}
                  className={`px-4 py-2 rounded-lg ${
                    isCreateUserDisabled
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-[#008000] text-white"
                  }`}
                >
                  {isCreatingDepartmentUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

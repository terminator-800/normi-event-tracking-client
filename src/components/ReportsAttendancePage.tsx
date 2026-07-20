import { useEffect, useMemo, useState } from "react";
import AppSidebarNav from "./AppSidebarNav";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import PaginationBar from "./PaginationBar";
import SearchMagnifierIcon from "./SearchMagnifierIcon";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import { useAttendancePageEventDetail } from "../hooks/useAttendancePageEventDetail";
import { useAttendancePageEvents } from "../hooks/useAttendancePageEvents";
import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import { fetchExportKey } from "../hooks/useExportSecurity";
import { useDepartmentsList } from "../hooks/useUsersManagement";
import { useAppNavItems, useMyPermissions } from "../hooks/useMyPermissions";
import { downloadPdfTable } from "../utils/downloadPdfTable";
import { getDashboardRoleLabel } from "../utils/roles";
import { useGovernorScope } from "../hooks/useGovernorScope";
import type { DeskPageProps } from "../types/desk-pages";

type AttendanceStatusFilter = "all" | "present" | "absent";

type EventSummary = {
  id: string;
  name: string;
  date: string;
  status: string;
  totalStudents: number;
  attended: number;
  absent: number;
  venue?: string;
  audiences?: unknown;
  isAllDepartments?: boolean;
  is_all_departments?: boolean | number;
};

type StudentRow = {
  id: string;
  name: string;
  course?: string | null;
  department?: string | null;
  yearLevel?: number | null;
  status: "attended" | "absent" | string;
  amIn?: string | null;
  amOut?: string | null;
  pmIn?: string | null;
  pmOut?: string | null;
  finePhp?: number;
};

const PAGE_SIZE = 15;

function normalizeEvents(data: unknown): EventSummary[] {
  const events = (data as { events?: EventSummary[] } | undefined)?.events;
  return Array.isArray(events) ? events : [];
}

function normalizeStudents(detail: unknown): StudentRow[] {
  const students = (detail as { students?: StudentRow[] } | undefined)?.students;
  return Array.isArray(students) ? students : [];
}

function normalizeAudiences(raw: unknown): Array<Record<string, unknown>> {
  if (raw == null) return [];
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  }
  return list.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function eventMatchesDepartment(ev: EventSummary, departmentName: string): boolean {
  if (!departmentName || departmentName === "all") return true;
  const allDepts =
    ev.isAllDepartments === true ||
    ev.is_all_departments === true ||
    Number(ev.is_all_departments) === 1;
  if (allDepts) return true;
  const want = departmentName.trim().toLowerCase();
  return normalizeAudiences(ev.audiences).some((a) => {
    const name = String(a.department_name ?? a.department ?? a.name ?? "").trim().toLowerCase();
    const code = String(a.department_code ?? a.code ?? "").trim().toLowerCase();
    return name === want || code === want;
  });
}

function downloadTextFile(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function statusLabel(filter: AttendanceStatusFilter): string {
  if (filter === "present") return "Present";
  if (filter === "absent") return "Absent";
  return "All statuses";
}

export default function ReportsAttendancePage({ onLogout, onNavigate }: DeskPageProps) {
  const [eventFilter, setEventFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const navItems = useAppNavItems();
  const { has: hasPermission } = useMyPermissions();
  const canExportAttendance = hasPermission("action.attendance.export");
  const canPrintAttendance = hasPermission("action.attendance.print");
  const canShowExportMenu = canExportAttendance || canPrintAttendance;

  const { data: pageData, isLoading: isEventsLoading, isError: isEventsError } =
    useAttendancePageEvents({ enableStream: false });
  const events = useMemo(() => normalizeEvents(pageData), [pageData]);
  const { data: departmentsFromApi = [] } = useDepartmentsList(true);

  const selectedEventId = eventFilter !== "all" ? eventFilter : "";
  const { data: detailData, isLoading: isDetailLoading, isError: isDetailError } =
    useAttendancePageEventDetail(selectedEventId, {
      enabled: Boolean(selectedEventId),
    });

  const students = useMemo(() => normalizeStudents(detailData), [detailData]);
  const selectedEvent = useMemo(
    () => events.find((e) => String(e.id) === String(eventFilter)) ?? null,
    [events, eventFilter],
  );

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    for (const d of departmentsFromApi) {
      const name = String(d.name ?? "").trim();
      if (name) names.add(name);
    }
    for (const s of students) {
      const name = String(s.department ?? "").trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [departmentsFromApi, students]);

  useEffect(() => {
    setPage(1);
  }, [eventFilter, departmentFilter, statusFilter, search]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (!eventMatchesDepartment(ev, departmentFilter)) return false;
      if (statusFilter === "present" && Number(ev.attended) <= 0) return false;
      if (statusFilter === "absent" && Number(ev.absent) <= 0) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        String(ev.name ?? "").toLowerCase().includes(q) ||
        String(ev.venue ?? "").toLowerCase().includes(q) ||
        formatEventDateForDisplay(ev.date).toLowerCase().includes(q)
      );
    });
  }, [events, departmentFilter, statusFilter, search]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (
        departmentFilter !== "all" &&
        String(s.department ?? "").trim() !== departmentFilter
      ) {
        return false;
      }
      const isPresent = s.status === "attended";
      if (statusFilter === "present" && !isPresent) return false;
      if (statusFilter === "absent" && isPresent) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        String(s.name ?? "").toLowerCase().includes(q) ||
        String(s.id ?? "").toLowerCase().includes(q) ||
        String(s.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [students, departmentFilter, statusFilter, search]);

  const showingStudents = eventFilter !== "all";
  const rows = showingStudents ? filteredStudents : filteredEvents;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE) || 1);
  const pageSafe = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, pageSafe]);

  const presentCount = showingStudents
    ? filteredStudents.filter((s) => s.status === "attended").length
    : filteredEvents.reduce((sum, e) => sum + Number(e.attended || 0), 0);
  const absentCount = showingStudents
    ? filteredStudents.filter((s) => s.status !== "attended").length
    : filteredEvents.reduce((sum, e) => sum + Number(e.absent || 0), 0);

  const reportSubtitle = useMemo(() => {
    const parts = [
      `Generated ${new Date().toLocaleString("en-PH")}`,
      showingStudents
        ? selectedEvent
          ? `Event: ${selectedEvent.name}`
          : "Selected event"
        : "All events",
      departmentFilter !== "all" ? `Department: ${departmentFilter}` : "All departments",
      `Filter: ${statusLabel(statusFilter)}`,
      `${rows.length} record(s)`,
    ];
    if (search.trim()) parts.push(`Search: ${search.trim()}`);
    return parts.join(" · ");
  }, [showingStudents, selectedEvent, departmentFilter, statusFilter, rows.length, search]);

  const buildExportTable = () => {
    if (showingStudents) {
      const head = ["Student ID", "Student", "Department", "Year", "Status", "Fine PHP"];
      const body = filteredStudents.map((s) => [
        String(s.id || ""),
        String(s.name || ""),
        String(s.department || "—"),
        s.yearLevel != null ? String(s.yearLevel) : "—",
        s.status === "attended" ? "Present" : "Absent",
        Number(s.finePhp ?? 0),
      ]);
      return { head, body };
    }
    const head = ["Event", "Date", "Status", "Present", "Absent", "Total"];
    const body = filteredEvents.map((ev) => [
      String(ev.name || ""),
      formatEventDateForDisplay(ev.date),
      String(ev.status || ""),
      Number(ev.attended || 0),
      Number(ev.absent || 0),
      Number(ev.totalStudents || 0),
    ]);
    return { head, body };
  };

  const downloadCsv = () => {
    const { head, body } = buildExportTable();
    if (body.length === 0) {
      alert("No records match the current filters.");
      return;
    }
    const lines = [
      head.map(csvEscape).join(","),
      ...body.map((row) => row.map(csvEscape).join(",")),
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    const scope = showingStudents
      ? `event-${selectedEventId || "selected"}`
      : "all-events";
    downloadTextFile(`attendance-report-${scope}-${stamp}.csv`, lines.join("\n"));
    setExportMenuOpen(false);
  };

  const downloadPdf = async () => {
    const { head, body } = buildExportTable();
    if (body.length === 0) {
      alert("No records match the current filters.");
      return;
    }
    setExportBusy(true);
    try {
      const exportPassword = await fetchExportKey();
      const stamp = new Date().toISOString().slice(0, 10);
      const scope = showingStudents
        ? `event-${selectedEventId || "selected"}`
        : "all-events";
      await downloadPdfTable({
        filename: `attendance-report-${scope}-${stamp}.pdf`,
        title: "Attendance Report",
        subtitle: reportSubtitle,
        head,
        body,
        exportPassword,
        orientation: "portrait",
      });
      setExportMenuOpen(false);
    } catch {
      alert("Failed to download PDF. Please try again.");
    } finally {
      setExportBusy(false);
    }
  };

  const printReport = () => {
    const { head, body } = buildExportTable();
    if (body.length === 0) {
      alert("No records match the current filters.");
      return;
    }
    const w = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!w) {
      alert("Pop-up blocked. Allow pop-ups to print the report.");
      return;
    }
    const th = head.map((h) => `<th>${h}</th>`).join("");
    const trs = body
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${String(cell)}</td>`).join("")}</tr>`,
      )
      .join("");
    w.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Attendance Report</title>
    <style>
      body { font-family: Arial, sans-serif; color: #16331f; margin: 24px; }
      h1 { color: #07713c; font-size: 20px; margin: 0 0 6px; }
      p { color: #4b5563; font-size: 12px; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #07713c; color: #fff; text-align: left; padding: 8px; }
      td { border-bottom: 1px solid #e5e7eb; padding: 7px 8px; }
      tr:nth-child(even) td { background: #f1faf4; }
      @media print { body { margin: 12px; } }
    </style>
  </head>
  <body>
    <h1>Attendance Report</h1>
    <p>${reportSubtitle.replace(/</g, "&lt;")}</p>
    <table>
      <thead><tr>${th}</tr></thead>
      <tbody>${trs}</tbody>
    </table>
  </body>
</html>`);
    w.document.close();
    w.focus();
    window.setTimeout(() => {
      w.print();
    }, 250);
    setExportMenuOpen(false);
  };

  const canExport =
    canShowExportMenu &&
    !isEventsLoading &&
    !isEventsError &&
    !(showingStudents && (isDetailLoading || isDetailError)) &&
    rows.length > 0;

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="sticky top-0 flex h-screen max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto bg-[#07713C] text-white [&_p]:text-white">
        <SidebarBrand />
        <AppSidebarNav items={navItems} activeNavId="reports_attendance" onNavigate={onNavigate} />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="font-[Inter,sans-serif] text-[30px] font-extrabold leading-tight text-[#07713c]">
                Attendance
              </h1>
              <NavbarAcademicPeriod className="mt-1" />
              <p className="mt-1 text-xs text-black/60">{roleLabel} · Reports</p>
            </div>
            <div className="flex items-center gap-3">
              {canShowExportMenu ? (
              <div className="relative">
                <button
                  type="button"
                  disabled={!canExport || exportBusy}
                  onClick={() => setExportMenuOpen((open) => !open)}
                  className="rounded-lg border bg-[#07713C] px-3 py-2 text-sm font-medium text-white hover:bg-[#055a2e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportBusy ? "Preparing…" : "Print / Download"}
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-[#07713c]/30 bg-white py-1 shadow-lg">
                    {canExportAttendance ? (
                      <>
                    <button
                      type="button"
                      onClick={() => void downloadPdf()}
                      className="block w-full px-4 py-2 text-left text-sm text-black hover:bg-[#07713c]/10"
                    >
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={downloadCsv}
                      className="block w-full px-4 py-2 text-left text-sm text-black hover:bg-[#07713c]/10"
                    >
                      Download CSV
                    </button>
                      </>
                    ) : null}
                    {canPrintAttendance ? (
                    <button
                      type="button"
                      onClick={printReport}
                      className="block w-full px-4 py-2 text-left text-sm text-black hover:bg-[#07713c]/10"
                    >
                      Print
                    </button>
                    ) : null}
                  </div>
                )}
              </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 text-black">
          <div className="mx-auto w-full max-w-7xl space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    showingStudents ? "Search student or ID" : "Search event or venue"
                  }
                  className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-3 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                />
              </div>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="min-w-[180px] rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                aria-label="Filter by department"
              >
                <option value="all">All departments</option>
                {departmentOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="min-w-[200px] rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                aria-label="Filter by event"
              >
                <option value="all">All events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={String(ev.id)}>
                    {ev.name} — {formatEventDateForDisplay(ev.date)}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AttendanceStatusFilter)}
                className="min-w-[160px] rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                aria-label="Filter by attendance status"
              >
                <option value="all">All statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#07713c]/25 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-black/55">Present</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#07713c]">{presentCount}</p>
              </div>
              <div className="rounded-xl border border-[#07713c]/25 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-black/55">Absent</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-black">{absentCount}</p>
              </div>
              <div className="rounded-xl border border-[#07713c]/25 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-black/55">
                  {showingStudents ? "Students shown" : "Events shown"}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-black">{rows.length}</p>
              </div>
            </div>

            {selectedEvent && (
              <p className="text-sm text-black/70">
                Viewing <span className="font-semibold text-black">{selectedEvent.name}</span> ·{" "}
                {formatEventDateForDisplay(selectedEvent.date)} · {selectedEvent.status}
              </p>
            )}

            <div className="overflow-hidden rounded-xl border border-[#07713c]/30 bg-white shadow-sm">
              {isEventsLoading && (
                <p className="px-4 py-6 text-sm text-black/70">Loading events…</p>
              )}
              {isEventsError && (
                <p className="px-4 py-6 text-sm text-red-700">Could not load events.</p>
              )}
              {!isEventsLoading && !isEventsError && showingStudents && isDetailLoading && (
                <p className="px-4 py-6 text-sm text-black/70">Loading attendance…</p>
              )}
              {!isEventsLoading && !isEventsError && showingStudents && isDetailError && (
                <p className="px-4 py-6 text-sm text-red-700">Could not load attendance for this event.</p>
              )}

              {!isEventsLoading && !isEventsError && !(showingStudents && isDetailLoading) && (
                <>
                  <div className="overflow-x-auto">
                    {showingStudents ? (
                      <table className="w-full min-w-[720px] border-collapse text-sm">
                        <thead className="border-b border-[#07713c]/30 bg-[#07713c] text-xs uppercase tracking-wide text-white">
                          <tr>
                            <th className="px-3 py-3 text-left">Student</th>
                            <th className="px-3 py-3 text-left">ID</th>
                            <th className="px-3 py-3 text-left">Department</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3 text-right">Fine</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pagedRows as StudentRow[]).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-black/60">
                                No students match the selected filters.
                              </td>
                            </tr>
                          ) : (
                            (pagedRows as StudentRow[]).map((s) => {
                              const present = s.status === "attended";
                              return (
                                <tr key={s.id} className="border-b border-[#07713c]/10 hover:bg-[#07713c]/[0.04]">
                                  <td className="px-3 py-2.5 font-medium text-black">{s.name}</td>
                                  <td className="px-3 py-2.5 tabular-nums text-black/80">{s.id}</td>
                                  <td className="px-3 py-2.5 text-black/80">{s.department || "—"}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                        present
                                          ? "bg-green-100 text-green-800"
                                          : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {present ? "Present" : "Absent"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-black">
                                    ₱{Number(s.finePhp ?? 0).toLocaleString("en-PH")}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full min-w-[720px] border-collapse text-sm">
                        <thead className="border-b border-[#07713c]/30 bg-[#07713c] text-xs uppercase tracking-wide text-white">
                          <tr>
                            <th className="px-3 py-3 text-left">Event</th>
                            <th className="px-3 py-3 text-left">Date</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3 text-right">Present</th>
                            <th className="px-3 py-3 text-right">Absent</th>
                            <th className="px-3 py-3 text-right">Total</th>
                            <th className="px-3 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pagedRows as EventSummary[]).length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-black/60">
                                No events match the selected filters.
                              </td>
                            </tr>
                          ) : (
                            (pagedRows as EventSummary[]).map((ev) => (
                              <tr key={ev.id} className="border-b border-[#07713c]/10 hover:bg-[#07713c]/[0.04]">
                                <td className="px-3 py-2.5 font-medium text-black">{ev.name}</td>
                                <td className="px-3 py-2.5 text-black/80">
                                  {formatEventDateForDisplay(ev.date)}
                                </td>
                                <td className="px-3 py-2.5 text-center capitalize text-black/80">
                                  {ev.status}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-[#07713c]">
                                  {ev.attended}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-black">
                                  {ev.absent}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-black">
                                  {ev.totalStudents}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setEventFilter(String(ev.id))}
                                    className="rounded-md px-2 py-1 text-xs font-medium text-[#07713c] hover:bg-[#07713c]/10"
                                  >
                                    View students
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <PaginationBar
                    totalCount={rows.length}
                    page={page}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    itemLabel={showingStudents ? "students" : "events"}
                    className="!text-black"
                  />
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

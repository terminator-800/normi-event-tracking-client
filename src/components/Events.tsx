import { useEffect, useMemo, useState } from "react";
import { Chart as ChartJS } from "chart.js/auto";
import { Pie } from "react-chartjs-2";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PaginationBar from "./PaginationBar";
import SearchMagnifierIcon from "./SearchMagnifierIcon";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import SidebarNavIcon from "./SidebarNavIcon";
import SidebarBrand from "./SidebarBrand";
import UserCircleIcon from "./UserCircleIcon";
import SidebarUserFullName from "./SidebarUserFullName";
import {
  APP_ROUTES,
  eventsEventStudentsPath,
  getAppNavItems,
} from "../utils/appNav";
import { getDashboardRoleLabel } from "../utils/roles";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { useAttendancePageEvents } from "../hooks/useAttendancePageEvents";
import { fetchAttendancePageEventDetail, useAttendancePageEventDetail } from "../hooks/useAttendancePageEventDetail";
import { formatEventDateForDisplay, formatSqlTimeForDisplay } from "../hooks/useGetEvents";
import { formatDurationForEventsListWithSessionHint } from "../utils/eventDurationDisplay";
import { formatGraceDurationLabel } from "../utils/eventTimeOptions";
import { getAudienceScopeLabel } from "../utils/eventAudienceLabel";
import { downloadPdfTable } from "../utils/downloadPdfTable";
import { fetchExportKey } from "../hooks/useExportSecurity";
import { isCsgPresident } from "../utils/roles";
import axiosApi from "../api/axiosInstance";
import type {
  AttendanceEvent,
  AttendanceStudent,
  DetailEventMeta,
  DeskPageProps,
} from "../types/desk-pages";

void ChartJS;

/** Default rows per page for the event list table */
const DEFAULT_EVENT_LIST_PAGE_SIZE = 10;
const EVENT_LIST_ROWS_PER_PAGE_OPTIONS = [5, 10, 15, 20, 50];
/** Attendance page content text (excludes green sidebar nav). */
const ATTENDANCE_TEXT = "text-black";
const ATTENDANCE_TH_TEXT = "font-bold text-black";
const TABLE_CELL_NOWRAP = "[&_th]:whitespace-nowrap [&_tbody_td]:whitespace-nowrap";
const ATTENDANCE_MAJOR_OPTIONS_BY_COURSE: Record<string, readonly string[]> = {
  BSED: ["English", "Math", "Filipino"],
  BSBA: ["Financial Management", "Human Resource Development Management", "Marketing Management"],
};

/** College / course filters — shown when roster includes department data from import. */
const SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS = true;

/** Default fine per absence (₱) — mock only */
const MOCK_FINE_PER_ABSENCE_PHP = 50;

function formatPhp(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  return `₱${v.toLocaleString("en-PH")}`;
}

function ratePct(attended: number, total: number): number {
  if (!total) return 0;
  return Math.round((attended / total) * 1000) / 10;
}

function getMockCourse(studentId: string | number | null | undefined): string {
  const courses = ["BSCS", "BSIT", "BSIS", "BSEMC", "ACT"];
  const num = Number(String(studentId || "").replace(/\D/g, "")) || 0;
  return courses[num % courses.length];
}

function getCourse(student: AttendanceStudent | null | undefined): string {
  if (student?.course) return student.course;
  return getMockCourse(student?.id);
}

/** Program major when present (API); null if none */
function getMajor(student: AttendanceStudent | null | undefined): string | null {
  const m = student?.major;
  if (m == null || String(m).trim() === "") return null;
  return String(m).trim();
}

/** Enrollment year level from API (`yearLevel`); null if missing */
function getYearLevel(student: AttendanceStudent | null | undefined): number | null {
  const y = student?.yearLevel ?? student?.year_level;
  if (y == null || y === "") return null;
  const n = Number(y);
  return Number.isFinite(n) ? n : null;
}

function getCollegeFromCourse(courseRaw: string | null | undefined): string {
  const course = String(courseRaw || "").toUpperCase();
  if (course.startsWith("BEED") || course.startsWith("BSED")) return "College of Education, Arts and Sciences";
  if (course.startsWith("BSIT")) return "College of Information Technology";
  if (course.startsWith("BSCRIM")) return "College of Criminal Justice Education";
  if (course.startsWith("BSHM")) return "College of Hospitality Management";
  if (course.startsWith("BSBA")) return "College of Business Administration";
  return "Unassigned";
}

function getStudentDepartmentName(student: AttendanceStudent | null | undefined): string {
  const fromApi = String(student?.department ?? "").trim();
  if (fromApi) return fromApi;
  return getCollegeFromCourse(getCourse(student));
}

function getStudentDepartmentLabel(student: AttendanceStudent | null | undefined): string {
  const name = getStudentDepartmentName(student);
  return name && name !== "Unassigned" ? name : "—";
}

function getCourseWithMajorCode(student: AttendanceStudent | null | undefined): string {
  const course = String(getCourse(student) || "").toUpperCase();
  const major = String(getMajor(student) || "").trim().toLowerCase();
  if (!major) return course;

  if (course === "BSBA") {
    if (major === "financial management") return "BSBA — FM";
    if (major === "human resource development management") return "BSBA — HRDM";
    if (major === "marketing management") return "BSBA — MM";
  }

  if (course === "BSED") {
    if (major === "filipino") return "BSED — FIL";
    if (major === "math") return "BSED — MATH";
    if (major === "english") return "BSED — ENG";
  }

  return course;
}

function getEventSessionType(event: AttendanceEvent | null | undefined): string {
  return event?.sessionType || "whole_day";
}

/** Times + late grace from attendance detail API (snake_case) or mapped camelCase. */
function eventTimingFromDetail(ev: AttendanceEvent | null | undefined) {
  if (!ev || typeof ev !== "object") return null;
  return {
    amIn: ev.am_time_in ?? ev.amTimeIn ?? null,
    amOut: ev.am_time_out ?? ev.amTimeOut ?? null,
    pmIn: ev.pm_time_in ?? ev.pmTimeIn ?? null,
    pmOut: ev.pm_time_out ?? ev.pmTimeOut ?? null,
    amGraceIn: ev.am_grace_in ?? ev.amGraceInMinutes ?? null,
    pmGraceIn: ev.pm_grace_in ?? ev.pmGraceInMinutes ?? null,
  };
}

function sessionRangeLabel(startRaw: string | null | undefined, endRaw: string | null | undefined): string | null {
  const start = formatSqlTimeForDisplay(startRaw);
  const end = formatSqlTimeForDisplay(endRaw);
  if (!start && !end) return null;
  return `${start ?? "—"}–${end ?? "—"}`;
}

function eventAudienceNotesLabel(ev: AttendanceEvent | null | undefined): string {
  const raw = ev?.audience_notes ?? ev?.audienceNotes;
  if (raw == null || String(raw).trim() === "") return "—";
  return String(raw).trim();
}

function getStudentSessionRecord(student: AttendanceStudent | null | undefined, event: AttendanceEvent | null | undefined) {
  const sessionType = getEventSessionType(event);
  const hasAmSession = sessionType === "whole_day" || sessionType === "am";
  const hasPmSession = sessionType === "whole_day" || sessionType === "pm";
  if (event?.status === "upcoming") {
    return {
      amIn: hasAmSession ? "No record" : "—",
      amOut: hasAmSession ? "No record" : "—",
      pmIn: hasPmSession ? "No record" : "—",
      pmOut: hasPmSession ? "No record" : "—",
      penalty: 0,
    };
  }
  if (student?.fromServer) {
    return {
      amIn: student.amIn ?? "No record",
      amOut: student.amOut ?? "No record",
      pmIn: student.pmIn ?? "No record",
      pmOut: student.pmOut ?? "No record",
      penalty: Number(student.penalty ?? student.finePhp) || 0,
    };
  }
  const idNum = Number(String(student?.id || "").replace(/\D/g, "")) || 0;
  const isPresent = student?.status === "attended";
  const hasAmIn = isPresent && idNum % 7 !== 0;
  const hasAmOut = isPresent && idNum % 5 !== 0;
  const hasPmIn = isPresent && idNum % 6 !== 0;
  const hasPmOut = isPresent && idNum % 4 !== 0;
  const checks = [
    hasAmSession ? hasAmIn : true,
    hasAmSession ? hasAmOut : true,
    hasPmSession ? hasPmIn : true,
    hasPmSession ? hasPmOut : true,
  ];
  const missingCount = checks.filter((v) => !v).length;
  const baseFine = Number(event?.finePerAbsence) || MOCK_FINE_PER_ABSENCE_PHP;
  const penalty = missingCount === 0 ? 0 : baseFine * missingCount;
  return {
    amIn: hasAmSession ? (hasAmIn ? "6:05 AM" : "No record") : "—",
    amOut: hasAmSession ? (hasAmOut ? "11:40 AM" : "No record") : "—",
    pmIn: hasPmSession ? (hasPmIn ? "1:05 PM" : "No record") : "—",
    pmOut: hasPmSession ? (hasPmOut ? "5:00 PM" : "No record") : "—",
    penalty,
  };
}

function eventTotalFine(ev: AttendanceEvent | null | undefined): number {
  const f = ev?.finePerAbsence ?? MOCK_FINE_PER_ABSENCE_PHP;
  return (ev?.absent || 0) * f;
}

/** Attendance page API may send `audiences` as JSON array or string — normalize for {@link getAudienceScopeLabel}. */
function normalizeAttendanceAudiences(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const p = JSON.parse(s);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function attendanceEventListAudienceLabel(ev: AttendanceEvent | null | undefined): string {
  if (!ev) return "—";
  const instituteWide =
    ev.isAllDepartments === true ||
    ev.is_all_departments === true ||
    Number(ev.is_all_departments) === 1;
  return getAudienceScopeLabel({
    ...ev,
    audiences: normalizeAttendanceAudiences(ev.audiences),
    isAllDepartments: instituteWide,
    is_all_departments: instituteWide ? 1 : 0,
  });
}

/** Utility to trigger a blob file download in the browser. */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
void triggerBlobDownload; // suppress unused lint warning — kept as shared utility

type EventsPageProps = DeskPageProps;

export default function Events({ onLogout, onNavigate }: EventsPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { role, isGovernor, governorScope } = useGovernorScope();
  void getDashboardRoleLabel(isGovernor, governorScope, role);
  const normalizedRole = String(role || "").toLowerCase().trim();
  const isAdmin = normalizedRole === "admin";
  const isSuperAdmin = normalizedRole === "super_admin";
  const isCsg = isCsgPresident(normalizedRole);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showLogout, setShowLogout] = useState(false);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);

  const {
    data: pageData,
    isLoading: isPageLoading,
    isError: isPageError,
    refetch: refetchAttendancePage,
  } = useAttendancePageEvents();

  const { data: detailFromApi } = useAttendancePageEventDetail(detailEventId ?? "", {
    enabled: Boolean(detailEventId),
  });
  const events: AttendanceEvent[] =
    (pageData as { events?: AttendanceEvent[] } | undefined)?.events ?? [];
  const [exportOpen, setExportOpen] = useState(false);
  // ── Import Event state (CSG President only) ────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<
    "upload" | "previewing" | "preview" | "importing" | "result"
  >("upload");
  const [importPreviewData, setImportPreviewData] = useState<{
    valid: boolean;
    message: string;
    eventName?: string;
    eventDate?: string;
    department?: string;
    studentCount?: number;
    attendanceCount?: number;
    paymentCount?: number;
    exportedBy?: string;
    exportDate?: string;
    fingerprintMatch?: boolean;
    isDuplicate?: boolean;
    duplicateEventId?: number | null;
    existingEventName?: string | null;
  } | null>(null);
  const [importResultData, setImportResultData] = useState<{
    success: boolean;
    message: string;
    skipped?: boolean;
    eventId?: number | null;
    eventName?: string | null;
    department?: string | null;
    eventCreated?: boolean;
    studentsImported?: number;
    studentsFound?: number;
    attendanceCreated?: number;
    attendanceSkipped?: number;
    finesCreated?: number;
    paymentsCreated?: number;
    failedRecords?: number;
    errors?: string[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDragging, setImportDragging] = useState(false);
  // ── End import state ───────────────────────────────────────────────────────
  const [eventListPage, setEventListPage] = useState(1);
  const [eventListPageSize, setEventListPageSize] = useState(DEFAULT_EVENT_LIST_PAGE_SIZE);
  const [studentListSearch, setStudentListSearch] = useState("");
  const [studentListCollege, setStudentListCollege] = useState("all");
  const [studentListCourse, setStudentListCourse] = useState("all");
  const [studentListMajor, setStudentListMajor] = useState("all");
  const [studentListYearLevel, setStudentListYearLevel] = useState("all");
  const [studentListAttendance, setStudentListAttendance] = useState("all");
  const [exportEventSearch, setExportEventSearch] = useState("");
  const [exportEventCollege, setExportEventCollege] = useState("all");
  const [exportEventCourse, setExportEventCourse] = useState("all");
  const [exportEventMajor, setExportEventMajor] = useState("all");
  const [exportEventYearLevel, setExportEventYearLevel] = useState("all");
  const [exportEventAttendance, setExportEventAttendance] = useState("all");
  const [exportAllEventId, setExportAllEventId] = useState("all");
  const [exportAllEventStatus, setExportAllEventStatus] = useState("all");
  const [exportAllCollege, setExportAllCollege] = useState("all");
  const [exportAllCourse, setExportAllCourse] = useState("all");
  const [studentListPageSize, setStudentListPageSize] = useState(10);
  const [studentListPage, setStudentListPage] = useState(1);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const isStudentListPath = Boolean(detailEventId) && location.pathname.endsWith("/students");
  const exportEventDetailId = exportAllEventId === "all" ? null : exportAllEventId;
  const { data: exportDetailFromApi } = useAttendancePageEventDetail(exportEventDetailId ?? "", {
    enabled: Boolean(exportEventDetailId),
  });

  useEffect(() => {
    setDetailEventId(eventId || null);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    if (!location.pathname.endsWith("/students")) {
      navigate(eventsEventStudentsPath(eventId), { replace: true });
    }
  }, [eventId, location.pathname, navigate]);

  useEffect(() => {
    setSelectedStudentId(null);
  }, [detailEventId]);

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (statusFilter !== "all" && ev.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (q) {
        const nameOk = String(ev.name).toLowerCase().includes(q);
        const audienceOk = attendanceEventListAudienceLabel(ev).toLowerCase().includes(q);
        if (!nameOk && !audienceOk) return false;
      }
      return true;
    });
  }, [events, statusFilter, search]);

  const eventsTotal = filtered.length;
  const eventsTotalPages = Math.max(1, Math.ceil(eventsTotal / eventListPageSize) || 1);
  const eventsPageSafe = Math.min(eventListPage, eventsTotalPages);

  const paginatedFiltered = useMemo(() => {
    const start = (eventsPageSafe - 1) * eventListPageSize;
    return filtered.slice(start, start + eventListPageSize);
  }, [filtered, eventsPageSafe, eventListPageSize]);

  useEffect(() => {
    setEventListPage(1);
  }, [search, statusFilter, eventListPageSize]);

  useEffect(() => {
    setEventListPage((p) => Math.min(p, eventsTotalPages));
  }, [eventsTotalPages]);

  const detailEvent = useMemo((): AttendanceEvent | null => {
    if (!detailEventId) return null;
    if (detailFromApi) return detailFromApi as AttendanceEvent;
    return (events.find((e: AttendanceEvent) => String(e.id) === String(detailEventId)) ?? null) as AttendanceEvent | null;
  }, [detailEventId, detailFromApi, events]);

  const detailEventMeta = useMemo((): DetailEventMeta | null => {
    if (!detailEvent) return null;
    const sessionType = getEventSessionType(detailEvent);
    const hasAmSession = sessionType === "whole_day" || sessionType === "am";
        const hasPmSession = sessionType === "whole_day" || sessionType === "pm";
        const timing = eventTimingFromDetail(detailEvent);
        const amRange = hasAmSession && timing ? sessionRangeLabel(timing.amIn, timing.amOut) : null;
        const pmRange = hasPmSession && timing ? sessionRangeLabel(timing.pmIn, timing.pmOut) : null;

        const rawAmG = timing?.amGraceIn;
        const rawPmG = timing?.pmGraceIn;
        const lateAmIn =
          hasAmSession && rawAmG != null && rawAmG !== "" && Number.isFinite(Number(rawAmG))
            ? Math.max(0, Number(rawAmG))
            : null;
        const latePmIn =
          hasPmSession && rawPmG != null && rawPmG !== "" && Number.isFinite(Number(rawPmG))
            ? Math.max(0, Number(rawPmG))
            : null;

        const scheduleAm =
          amRange && lateAmIn != null
            ? `${amRange} (late in ${formatGraceDurationLabel(lateAmIn)})`
            : amRange;
        const schedulePm =
          pmRange && latePmIn != null
            ? `${pmRange} (late in ${formatGraceDurationLabel(latePmIn)})`
            : pmRange;

        return {
          sessionType,
          hasAmSession,
          hasPmSession,
          type: "Mandatory",
          requiresRegistration: "No",
          audience: getAudienceScopeLabel(detailEvent),
          duration: formatDurationForEventsListWithSessionHint(detailEvent),
          scheduleAmRange: amRange,
          schedulePmRange: pmRange,
          scheduleAm,
          schedulePm,
          lateAmIn,
          latePmIn,
          notes: eventAudienceNotesLabel(detailEvent),
        };
  }, [detailEvent]);

  const filteredStudentList = useMemo(() => {
    if (!detailEvent) return [];
    const q = studentListSearch.trim().toLowerCase();
    return (detailEvent.students || []).filter((s) => {
      const sid = String(s.id || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const course = getCourse(s);
      const college = getStudentDepartmentName(s);
      const majorLabel = getMajor(s);
      const majorQ = (majorLabel || "").toLowerCase();
      const attendance = detailEvent.status === "upcoming" ? "no_record" : s.status === "attended" ? "attended" : "absent";
      const yearLevel = getYearLevel(s);
      const yearLevelQ = yearLevel != null ? String(yearLevel) : "";
      if (
        q &&
        !sid.includes(q) &&
        !name.includes(q) &&
        !course.toLowerCase().includes(q) &&
        !majorQ.includes(q) &&
        !college.toLowerCase().includes(q) &&
        !(yearLevelQ && yearLevelQ.includes(q))
      ) {
        return false;
      }
      if (studentListCollege !== "all" && college !== studentListCollege) return false;
      if (studentListCourse !== "all" && course !== studentListCourse) return false;
      if (studentListMajor !== "all") {
        if (!majorLabel || majorLabel !== studentListMajor) return false;
      }
      if (studentListYearLevel !== "all") {
        const want = Number(studentListYearLevel);
        if (!Number.isFinite(want) || yearLevel !== want) return false;
      }
      if (
        detailEvent.status !== "upcoming" &&
        studentListAttendance !== "all" &&
        attendance !== studentListAttendance
      ) {
        return false;
      }
      return true;
    });
  }, [
    detailEvent,
    studentListSearch,
    studentListCollege,
    studentListCourse,
    studentListMajor,
    studentListYearLevel,
    studentListAttendance,
  ]);

  const studentListYearLevelOptions = useMemo(() => {
    if (!detailEvent) return [];
    const set = new Set<number>();
    for (const s of detailEvent.students || []) {
      const yl = getYearLevel(s);
      if (yl != null) set.add(yl);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [detailEvent]);

  const studentListCollegeOptions = useMemo(() => {
    if (!detailEvent) return [];
    const set = new Set<string>();
    for (const s of detailEvent.students || []) {
      const dept = getStudentDepartmentName(s);
      if (dept && dept !== "Unassigned") set.add(dept);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [detailEvent]);

  const studentListCourses = useMemo(() => {
    if (!detailEvent) return [];
    const courses = Array.from(new Set((detailEvent.students || []).map((s) => getCourse(s)))).sort();
    if (studentListCollege === "all") return courses;
    return courses.filter((c) => getCollegeFromCourse(c) === studentListCollege);
  }, [detailEvent, studentListCollege]);

  const studentListMajorOptions = useMemo(() => {
    if (!detailEvent) return [];
    const selectedCourse = String(studentListCourse || "").toUpperCase();
    if (selectedCourse && selectedCourse !== "ALL" && ATTENDANCE_MAJOR_OPTIONS_BY_COURSE[selectedCourse]) {
      return ATTENDANCE_MAJOR_OPTIONS_BY_COURSE[selectedCourse];
    }
    const set = new Set<string>();
    const studentsScoped =
      studentListCollege === "all"
        ? detailEvent.students || []
        : (detailEvent.students || []).filter((s) => getStudentDepartmentName(s) === studentListCollege);
    for (const s of studentsScoped) {
      const m = getMajor(s);
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [detailEvent, studentListCourse, studentListCollege]);

  const showStudentListMajorFilter =
    SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS && studentListMajorOptions.length > 0;

  const exportEventCourses = useMemo(() => {
    if (!detailEvent) return [];
    const courses = Array.from(new Set((detailEvent.students || []).map((s) => getCourse(s)))).sort();
    if (exportEventCollege === "all") return courses;
    return courses.filter((c) => getCollegeFromCourse(c) === exportEventCollege);
  }, [detailEvent, exportEventCollege]);

  const exportEventMajorOptions = useMemo(() => {
    if (!detailEvent) return [];
    const selectedCourse = String(exportEventCourse || "").toUpperCase();
    if (selectedCourse && selectedCourse !== "ALL" && ATTENDANCE_MAJOR_OPTIONS_BY_COURSE[selectedCourse]) {
      return ATTENDANCE_MAJOR_OPTIONS_BY_COURSE[selectedCourse];
    }
    const set = new Set<string>();
    const studentsScoped =
      exportEventCollege === "all"
        ? detailEvent.students || []
        : (detailEvent.students || []).filter((s) => getStudentDepartmentName(s) === exportEventCollege);
    for (const s of studentsScoped) {
      const m = getMajor(s);
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [detailEvent, exportEventCourse, exportEventCollege]);

  const exportFilteredEventStudents = useMemo(() => {
    if (!detailEvent) return [];
    const q = exportEventSearch.trim().toLowerCase();
    return (detailEvent.students || []).filter((s) => {
      const sid = String(s.id || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const course = getCourse(s);
      const college = getStudentDepartmentName(s);
      const majorLabel = getMajor(s);
      const majorQ = (majorLabel || "").toLowerCase();
      const ylExport = getYearLevel(s);
      const yearLevelQ = ylExport != null ? String(ylExport) : "";
      const attendance = detailEvent.status === "upcoming" ? "no_record" : s.status === "attended" ? "attended" : "absent";

      if (
        q &&
        !sid.includes(q) &&
        !name.includes(q) &&
        !course.toLowerCase().includes(q) &&
        !majorQ.includes(q) &&
        !college.toLowerCase().includes(q) &&
        !(yearLevelQ && yearLevelQ.includes(q))
      ) {
        return false;
      }
      if (exportEventCollege !== "all" && college !== exportEventCollege) return false;
      if (exportEventCourse !== "all" && course !== exportEventCourse) return false;
      if (exportEventMajor !== "all") {
        if (!majorLabel || majorLabel !== exportEventMajor) return false;
      }
      if (exportEventYearLevel !== "all") {
        const want = Number(exportEventYearLevel);
        const yl = getYearLevel(s);
        if (!Number.isFinite(want) || yl !== want) return false;
      }
      if (
        detailEvent.status !== "upcoming" &&
        exportEventAttendance !== "all" &&
        attendance !== exportEventAttendance
      ) {
        return false;
      }
      return true;
    });
  }, [
    detailEvent,
    exportEventSearch,
    exportEventCollege,
    exportEventCourse,
    exportEventMajor,
    exportEventYearLevel,
    exportEventAttendance,
  ]);

  const studentListTotal = filteredStudentList.length;
  const studentListTotalPages = Math.max(1, Math.ceil(studentListTotal / studentListPageSize) || 1);
  const studentListPageSafe = Math.min(studentListPage, studentListTotalPages);
  const visibleStudentRows = useMemo(() => {
    const start = (studentListPageSafe - 1) * studentListPageSize;
    return filteredStudentList.slice(start, start + studentListPageSize);
  }, [filteredStudentList, studentListPageSafe, studentListPageSize]);

  useEffect(() => {
    setStudentListCollege("all");
    setStudentListMajor("all");
    setStudentListYearLevel("all");
  }, [detailEventId]);

  useEffect(() => {
    if (studentListYearLevel === "all") return;
    if (!studentListYearLevelOptions.includes(Number(studentListYearLevel))) {
      setStudentListYearLevel("all");
    }
  }, [studentListYearLevel, studentListYearLevelOptions]);

  useEffect(() => {
    if (studentListMajor === "all") return;
    if (!studentListMajorOptions.includes(studentListMajor)) {
      setStudentListMajor("all");
    }
  }, [studentListMajor, studentListMajorOptions]);

  useEffect(() => {
    if (studentListCourse === "all") return;
    if (!studentListCourses.includes(studentListCourse)) {
      setStudentListCourse("all");
    }
  }, [studentListCourse, studentListCourses]);

  useEffect(() => {
    setStudentListPage(1);
  }, [
    studentListSearch,
    studentListCollege,
    studentListCourse,
    studentListMajor,
    studentListYearLevel,
    studentListAttendance,
    studentListPageSize,
    detailEventId,
  ]);

  useEffect(() => {
    setStudentListPage((p) => Math.min(p, studentListTotalPages));
  }, [studentListTotalPages]);

  useEffect(() => {
    if (!exportOpen || !detailEvent) return;
    setExportEventSearch(studentListSearch);
    setExportEventCollege(studentListCollege);
    setExportEventCourse(studentListCourse);
    setExportEventMajor(studentListMajor);
    setExportEventYearLevel(studentListYearLevel);
    setExportEventAttendance(studentListAttendance);
  }, [
    exportOpen,
    detailEvent,
    studentListSearch,
    studentListCollege,
    studentListCourse,
    studentListMajor,
    studentListYearLevel,
    studentListAttendance,
  ]);

  useEffect(() => {
    if (exportEventYearLevel === "all") return;
    if (!studentListYearLevelOptions.includes(Number(exportEventYearLevel))) {
      setExportEventYearLevel("all");
    }
  }, [exportEventYearLevel, studentListYearLevelOptions]);

  useEffect(() => {
    if (exportEventMajor === "all") return;
    if (!exportEventMajorOptions.includes(exportEventMajor)) {
      setExportEventMajor("all");
    }
  }, [exportEventMajor, exportEventMajorOptions]);

  useEffect(() => {
    if (exportEventCourse === "all") return;
    if (!exportEventCourses.includes(exportEventCourse)) {
      setExportEventCourse("all");
    }
  }, [exportEventCourse, exportEventCourses]);

  const exportAllCollegeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      for (const s of ev.students || []) {
        const dept = getStudentDepartmentName(s);
      if (dept && dept !== "Unassigned") set.add(dept);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const exportAllCourseOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      for (const s of ev.students || []) {
        const course = getCourseWithMajorCode(s);
        if (exportAllCollege === "all" || getStudentDepartmentName(s) === exportAllCollege) {
          set.add(course);
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events, exportAllCollege]);

  const exportCompletedEventOptions = useMemo(
    () => events.filter((ev) => ev.status === "completed"),
    [events],
  );

  const exportAllFilteredRows = useMemo(() => {
    const rows = [];
    for (const ev of events) {
      if (exportAllEventId !== "all" && String(ev.id) !== String(exportAllEventId)) continue;
      if (exportAllEventStatus !== "all" && ev.status !== exportAllEventStatus) continue;
      const scopedStudents =
        exportEventDetailId && String(ev.id) === String(exportEventDetailId)
          ? (exportDetailFromApi as AttendanceEvent | undefined)?.students || ev.students || []
          : ev.students || [];
      for (const s of scopedStudents) {
        const course = getCourseWithMajorCode(s);
        const college = getStudentDepartmentName(s);
        if (exportAllCollege !== "all" && college !== exportAllCollege) continue;
        if (exportAllCourse !== "all" && course !== exportAllCourse) continue;
        const attendance = ev.status === "upcoming" ? "no_record" : s.status === "attended" ? "attended" : "absent";
        rows.push({ ev, s, course, college, attendance });
      }
    }
    return rows;
  }, [events, exportAllEventId, exportAllEventStatus, exportAllCollege, exportAllCourse, exportEventDetailId, exportDetailFromApi]);

  useEffect(() => {
    if (exportAllCourse === "all") return;
    if (!exportAllCourseOptions.includes(exportAllCourse)) {
      setExportAllCourse("all");
    }
  }, [exportAllCourse, exportAllCourseOptions]);

  useEffect(() => {
    if (exportAllEventId === "all") return;
    const stillExists = exportCompletedEventOptions.some((ev) => String(ev.id) === String(exportAllEventId));
    if (!stillExists) {
      setExportAllEventId("all");
    }
  }, [exportAllEventId, exportCompletedEventOptions]);

  const navItems = getAppNavItems({ isAdmin: isAdmin || isSuperAdmin, isSuperAdmin, isCsgPresident: isCsg });


  const handleNav = (itemId: string) => {
    onNavigate?.(itemId);
  };

  const openEventDetails = (id: string | number | null | undefined) => {
    if (!id) return;
    navigate(eventsEventStudentsPath(id));
  };

  const openEventStudents = (id: string | number | null | undefined) => {
    openEventDetails(id);
  };

  const closeEventDetails = () => {
    navigate(APP_ROUTES.events);
  };

  const downloadExcelAll = async () => {
    try {
      const response = await axiosApi.get("/export/events/excel", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `all-events-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download Excel export. Please try again.");
    }
  };

  // ── Import Event handlers (CSG President only) ──────────────────────────────
  const resetImportModal = () => {
    setImportFile(null);
    setImportStep("upload");
    setImportPreviewData(null);
    setImportResultData(null);
    setImportError(null);
    setImportDragging(false);
  };

  const handleImportFileSelect = async (file: File) => {
    setImportFile(file);
    setImportStep("previewing");
    setImportError(null);
    setImportPreviewData(null);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axiosApi.post("/export/event/import-preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportPreviewData(res.data as typeof importPreviewData);
      setImportStep("preview");
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      if (data && typeof data === "object") {
        setImportPreviewData(data as typeof importPreviewData);
      }
      setImportError(
        (data as { message?: string })?.message ??
          "Failed to validate the file. Please try again.",
      );
      setImportStep("preview");
    }
  };

  const handleImportConfirm = async (
    action: "skip" | "replace" | "copy",
  ) => {
    if (!importFile) return;
    setImportStep("importing");

    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("action", action);
    try {
      const res = await axiosApi.post("/export/event/import-full", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResultData(res.data as typeof importResultData);
      setImportStep("result");
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      setImportResultData(
        data && typeof data === "object"
          ? (data as typeof importResultData)
          : { success: false, message: "Import failed. Please try again." },
      );
      setImportStep("result");
    }
  };
  // ── End import handlers ──────────────────────────────────────────────────────

  const buildEventExportRows = (
    ev: AttendanceEvent,
    students: AttendanceStudent[] | null = null,
  ) => {
    const list = Array.isArray(students) ? students : ev.students || [];
    const header = ["Student ID", "Student", "Department", "Course", "Major", "Year Level", "Status", "Fine PHP"];
    const body = list.map((s: AttendanceStudent) => {
      const yl = getYearLevel(s);
      return [
        String(s.id || ""),
        String(s.name || ""),
        String(getStudentDepartmentLabel(s)),
        String(getCourse(s)),
        String(getMajor(s) || "—"),
        yl != null ? yl : "—",
        ev.status === "upcoming" ? "No record" : String(s.status || ""),
        Number(s.finePhp) || 0,
      ];
    });
    return { header, body };
  };
  void buildEventExportRows; // suppress unused — kept for future CSV export use

  const downloadExcelEvent = async (ev: AttendanceEvent) => {
    if (!ev.id) return;
    try {
      const response = await axiosApi.get(`/export/event/${ev.id}/excel`, { responseType: "blob" });
      const disposition = String(response.headers?.["content-disposition"] ?? "");
      const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = filenameMatch?.[1]?.trim() || `event-${ev.id}-${ev.date ?? "export"}.xlsx`;
      const url = URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download Excel export. Please try again.");
    }
  };

  const buildEventExportRowsForPdf = (
    ev: AttendanceEvent,
    students: AttendanceStudent[] | null = null,
  ) => {
    const list = Array.isArray(students) ? students : ev.students || [];
    const header = ["Student ID", "Student", "Department", "Year Level", "Status", "Fine PHP"];
    const body = list.map((s: AttendanceStudent) => {
      const yl = getYearLevel(s);
      return [
        String(s.id || ""),
        String(s.name || ""),
        String(getStudentDepartmentLabel(s)),
        yl != null ? yl : "—",
        ev.status === "upcoming" ? "No record" : String(s.status || ""),
        Number(s.finePhp) || 0,
      ];
    });
    return { header, body };
  };

  const exportPdfEvent = async (ev: AttendanceEvent, students: AttendanceStudent[] | null = null) => {
    const { header, body } = buildEventExportRowsForPdf(ev, students);
    const exportPassword = await fetchExportKey();
    await downloadPdfTable({
      filename: `attendance-${ev.id}-${ev.date}.pdf`,
      title: "Attendance Report",
      subtitle: `${ev.name || "Event"} · ${formatEventDateForDisplay(ev.date)} · ${ev.status || ""}`,
      head: header,
      body,
      exportPassword,
    });
  };

  const exportPdfAll = async () => {
    const selectedEvents = events.filter((ev) => {
      if (exportAllEventId !== "all" && String(ev.id) !== String(exportAllEventId)) return false;
      if (exportAllEventStatus !== "all" && ev.status !== exportAllEventStatus) return false;
      return true;
    });
    const detailedEvents: AttendanceEvent[] = await Promise.all(
      selectedEvents.map(async (ev): Promise<AttendanceEvent> => {
        const id = ev.id;
        if (id == null) return ev;
        try {
          const full = await fetchAttendancePageEventDetail(id);
          return (full as AttendanceEvent | null) || ev;
        } catch {
          return ev;
        }
      }),
    );
    const header = [
      "Event",
      "Date",
      "Event Status",
      "Student ID",
      "Student Name",
      "Department",
      "Year Level",
      "Attendance",
      "Fine PHP",
    ];
    const body: (string | number)[][] = [];
    for (const ev of detailedEvents) {
      for (const s of ev.students || []) {
        const course = getCourseWithMajorCode(s);
        const college = getStudentDepartmentName(s);
        if (exportAllCollege !== "all" && college !== exportAllCollege) continue;
        if (exportAllCourse !== "all" && course !== exportAllCourse) continue;
        const attendance = ev.status === "upcoming" ? "no_record" : s.status === "attended" ? "attended" : "absent";
        const yl = getYearLevel(s);
        body.push([
          String(ev.name || ""),
          ev.date ?? "",
          ev.status ?? "",
          String(s.id || ""),
          String(s.name || ""),
          college,
          yl != null ? yl : "—",
          attendance === "no_record" ? "No record" : attendance,
          Number(s.finePhp) || 0,
        ]);
      }
    }
    const exportPassword = await fetchExportKey();
    await downloadPdfTable({
      filename: `attendance-report-students-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Attendance Report — All Events",
      subtitle: `Generated ${new Date().toLocaleString("en-PH")} · ${body.length} student record(s)`,
      head: header,
      body,
      exportPassword,
    });
  };

  const statusBadgeClass = (st: string | undefined) => {
    if (st === "completed") return "bg-emerald-100 text-black";
    if (st === "ongoing") return "bg-amber-100 text-black";
    if (st === "upcoming") return "bg-sky-100 text-black";
    return "bg-[#07713c]/10 text-black";
  };

  return (
    <div className="flex min-h-screen bg-[#07713c]/[0.04] [&_button]:cursor-pointer">
      <aside className="sticky top-0 flex h-screen max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto bg-[#07713c] text-white [&_p]:text-white">
        <SidebarBrand />
       <nav
          className="
            flex-1
            space-y-1
            px-4

            /* Mobile */
            max-[767px]:px-2
            max-[767px]:space-y-0.5
          "
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`
                  flex w-full items-center gap-3
                  rounded-lg
                  px-4 py-3
                  text-left text-sm font-medium
                  transition-colors

                  /* ==========================
                    Mobile adjustments (<768px)
                    ========================== */
                  max-[767px]:gap-2
                  max-[767px]:px-3
                  max-[767px]:py-2
                  max-[767px]:text-xs

                  ${
                    item.id === "events"
                      ? "bg-[#055a2e] text-white"
                      : "text-green-100 hover:bg-white/15"
                  }
                `}
              >
              <SidebarNavIcon navId={item.id} />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
        <SidebarUserFullName />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-[Inter,sans-serif] text-[30px] font-extrabold leading-tight text-[#07713c]">
                Events
              </h1>
              <NavbarAcademicPeriod className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              {isCsg && (
                <button
                  type="button"
                  onClick={() => {
                    resetImportModal();
                    setImportOpen(true);
                  }}
                  className="rounded-lg border border-[#07713c] bg-white px-3 py-2 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/10"
                >
                  Import Event
                </button>
              )}
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="rounded-lg border bg-[#07713C] px-3 py-2 text-sm font-medium text-white"
              >
                Export / Reports
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLogout((p) => !p)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#07713c]"
                  aria-label="Account menu"
                >
                  <UserCircleIcon />
                </button>
                {showLogout && (
                  <div className="absolute right-0 top-full z-10 mt-1 min-w-[100px] rounded-lg border border-[#07713c]/30 bg-white py-1 shadow-lg">
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
          </div>
        </header>

        <main className={`flex-1 overflow-auto p-6 ${ATTENDANCE_TEXT} [&_th]:font-bold [&_th]:text-white`}>
          <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
          {isPageError && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-black"
              role="alert"
            >
              Could not load attendance data.{" "}
              <button
                type="button"
                className="font-semibold text-black underline"
                onClick={() => refetchAttendancePage()}
              >
                Retry
              </button>
            </div>
          )}
          {isPageLoading && events.length === 0 && !isPageError && (
            <p className="text-sm font-medium text-black">Loading events…</p>
          )}
          {detailEvent && isStudentListPath ? (
            <section className="min-w-0 rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={closeEventDetails}
                className="mb-3 rounded-lg border border-[#07713c]/40 bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-[#07713c]/10"
              >
                ← Back to event list
              </button>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-semibold text-black sm:text-3xl">{detailEvent.name}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(detailEvent.status)}`}>
                      {detailEvent.status === "ongoing" ? "Ongoing" : detailEvent.status === "completed" ? "Completed" : "Upcoming"}
                    </span>
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-black">
                      {detailEventMeta!.type}
                    </span>
                    <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-black">
                      Fines: {formatPhp(detailEvent.finePerAbsence ?? MOCK_FINE_PER_ABSENCE_PHP)} per absence
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-black">Students</p>
                  <p className="mt-1 text-3xl font-semibold text-black">{detailEvent.totalStudents}</p>
                  <p className="mt-1 text-sm text-black">{detailEventMeta!.audience}</p>
                </div>
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-black">Attended</p>
                  <p className="mt-1 text-3xl font-semibold text-black">{detailEvent.attended}</p>
                  <p className="mt-1 text-sm text-black">{ratePct(detailEvent.attended ?? 0, detailEvent.totalStudents ?? 0)}% attendance</p>
                </div>
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-black">Absent</p>
                  <p className="mt-1 text-3xl font-semibold text-black">{detailEvent.absent}</p>
                  <p className="mt-1 text-sm text-black">{ratePct(detailEvent.absent ?? 0, detailEvent.totalStudents ?? 0)}% of students</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3">
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-5">
                  <h4 className="text-lg font-semibold text-black">Schedule</h4>
                  <div className="mt-3 rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.06] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-black/75">Event date</p>
                    <p className="mt-0.5 text-base font-semibold text-black">{formatEventDateForDisplay(detailEvent.date)}</p>
                  </div>
                  <div className="mt-4 space-y-4 text-sm">
                    {detailEventMeta!.scheduleAmRange && (
                      <div className="rounded-lg border border-[#07713c]/20 bg-[#07713c]/5 p-3">
                        <p className="font-semibold text-black">AM Session</p>
                        <p className="mt-1 text-black">{detailEventMeta!.scheduleAmRange}</p>
                        <p className="mt-1 text-xs text-black">
                          Late in:{" "}
                          {detailEventMeta!.lateAmIn != null
                            ? formatGraceDurationLabel(detailEventMeta!.lateAmIn)
                            : "—"}
                        </p>
                      </div>
                    )}
                    {detailEventMeta!.schedulePmRange && (
                      <div className="rounded-lg border border-[#07713c]/20 bg-[#07713c]/5 p-3">
                        <p className="font-semibold text-black">PM Session</p>
                        <p className="mt-1 text-black">{detailEventMeta!.schedulePmRange}</p>
                        <p className="mt-1 text-xs text-black">
                          Late in:{" "}
                          {detailEventMeta!.latePmIn != null
                            ? formatGraceDurationLabel(detailEventMeta!.latePmIn)
                            : "—"}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#07713c]/20 pt-4">
                    <button
                      type="button"
                      onClick={() => downloadExcelEvent(detailEvent)}
                      className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-3 py-2 text-sm font-medium text-black hover:bg-[#07713c]/15"
                    >
                      Export Excel (CSV) — this event
                    </button>
                    <button
                      type="button"
                      onClick={() => exportPdfEvent(detailEvent)}
                      className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-3 py-2 text-sm font-medium text-black hover:bg-[#07713c]/15"
                    >
                      Export PDF — this event
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-[#07713c]/20 pt-5">
                <h4 className="text-lg font-semibold text-black">Students</h4>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-[#07713c]/30 bg-[#07713c]/[0.06] p-3">
                <div className="relative min-w-[220px] flex-1">
                  <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                  <input
                    type="search"
                    value={studentListSearch}
                    onChange={(e) => setStudentListSearch(e.target.value)}
                    placeholder="Search name, ID, or year level"
                    className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-10 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] [&::-webkit-search-cancel-button]:hidden"
                  />
                  {studentListSearch.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => setStudentListSearch("")}
                      className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-black/85 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                      aria-label="Clear students list search"
                    >
                      ×
                    </button>
                  )}
                </div>
                {SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS && (
                <label className="min-w-[200px] max-w-[min(100%,320px)] shrink-0 text-xs text-black">
                  Department
                  <select
                    value={studentListCollege}
                    onChange={(e) => setStudentListCollege(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All colleges</option>
                    {studentListCollegeOptions.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
                )}
                {showStudentListMajorFilter && (
                  <label className="w-[260px] text-xs text-black">
                    Major
                    <select
                      value={studentListMajor}
                      onChange={(e) => setStudentListMajor(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                    >
                      <option value="all">All majors</option>
                      {studentListMajorOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="text-xs text-black">
                  Year level
                  <select
                    value={studentListYearLevel}
                    onChange={(e) => setStudentListYearLevel(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All year levels</option>
                    {studentListYearLevelOptions.map((yl) => (
                      <option key={yl} value={String(yl)}>
                        {yl}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-black">
                  Status
                  <select
                    value={studentListAttendance}
                    onChange={(e) => setStudentListAttendance(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All statuses</option>
                    <option value="attended">Attended</option>
                    <option value="absent">Absent</option>
                  </select>
                </label>
                <label className="ml-auto text-xs text-black">
                  Rows per page
                  <select
                    value={studentListPageSize}
                    onChange={(e) => setStudentListPageSize(Number(e.target.value))}
                    className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    {[5, 10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 min-w-0 overflow-x-auto rounded-lg border border-[#07713c]/30">
                <table className={`w-full border-collapse text-sm ${TABLE_CELL_NOWRAP}`}>
                  <thead className={`border-b border-[#07713c]/30 text-center text-xs uppercase ${ATTENDANCE_TH_TEXT}`}>
                    <tr>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Student ID</th>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Name</th>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Department</th>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Year level</th>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Attendance</th>
                      {detailEventMeta!.hasAmSession && detailEventMeta!.hasPmSession ? (
                        <>
                          <th colSpan={2} className="border-b border-l border-r border-[#07713c]/30 px-3 py-2 text-center">AM</th>
                          <th colSpan={2} className="border-b border-r border-[#07713c]/30 px-3 py-2 text-center">PM</th>
                        </>
                      ) : detailEventMeta!.hasAmSession ? (
                        <th colSpan={2} className="border-b border-l border-r border-[#07713c]/30 px-3 py-2 text-center">AM</th>
                      ) : (
                        <th colSpan={2} className="border-b border-l border-r border-[#07713c]/30 px-3 py-2 text-center">PM</th>
                      )}
                      <th rowSpan={2} className={`border-b border-l border-r border-[#07713c]/30 px-3 py-2 text-center align-middle ${ATTENDANCE_TH_TEXT}`}>Fines / penalty</th>
                    </tr>
                    <tr>
                      {detailEventMeta!.hasAmSession && (
                        <>
                          <th className="border-b border-l border-[#07713c]/30 px-3 py-2 text-center">Time in</th>
                          <th className="border-b border-r border-[#07713c]/30 px-3 py-2 text-center">Time out</th>
                        </>
                      )}
                      {detailEventMeta!.hasPmSession && (
                        <>
                          <th className="border-b border-l border-[#07713c]/30 px-3 py-2 text-center">Time in</th>
                          <th className="border-b border-r border-[#07713c]/30 px-3 py-2 text-center">Time out</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudentList.length === 0 ? (
                      <tr>
                        <td
                        colSpan={6 + (detailEventMeta!.hasAmSession ? 2 : 0) + (detailEventMeta!.hasPmSession ? 2 : 0)}
                        className="border border-[#07713c]/30 px-3 py-6 text-center text-sm text-black"
                      >
                          No students match the current filters.
                        </td>
                      </tr>
                    ) : (
                      visibleStudentRows.map((s) => {
                        const rec = getStudentSessionRecord(s, detailEvent);
                        const isNoRecordAttendance = detailEvent.status === "upcoming";
                        const isAttended = s.status === "attended";
                        const rowYearLevel = getYearLevel(s);
                        const rowSelected = String(selectedStudentId) === String(s.id);
                        return (
                          <tr
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedStudentId(s.id != null ? String(s.id) : null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedStudentId(s.id != null ? String(s.id) : null);
                              }
                            }}
                            className={`cursor-pointer transition-colors ${rowSelected ? "bg-[#07713c]/12" : ""}`}
                          >
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center text-black">
                              {String(s.id).toUpperCase()}
                            </td>
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center text-black">{s.name}</td>
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center text-black">
                              {getStudentDepartmentLabel(s)}
                            </td>
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center tabular-nums text-black">
                              {rowYearLevel != null ? rowYearLevel : "—"}
                            </td>
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  isNoRecordAttendance
                                    ? "bg-amber-100 text-black"
                                    : isAttended
                                      ? "bg-green-100 text-black"
                                      : "bg-red-100 text-black"
                                }`}
                              >
                                {isNoRecordAttendance ? "No record" : isAttended ? "Attended" : "Absent"}
                              </span>
                            </td>
                            {detailEventMeta!.hasAmSession && (
                              <td className="border-b border-l border-[#07713c]/30 px-3 py-1.5 text-center text-xs">
                                {rec.amIn === "No record" ? (
                                  <span className="text-xs text-black">
                                    No record
                                  </span>
                                ) : (
                                  <span className="text-black">{rec.amIn}</span>
                                )}
                              </td>
                            )}
                            {detailEventMeta!.hasAmSession && (
                              <td className="border-b border-r border-[#07713c]/30 px-3 py-1.5 text-center text-xs">
                                {rec.amOut === "No record" ? (
                                  <span className="text-xs text-black">
                                    No record
                                  </span>
                                ) : (
                                  <span className="text-black">{rec.amOut}</span>
                                )}
                              </td>
                            )}
                            {detailEventMeta!.hasPmSession && (
                              <td className="border-b border-l border-[#07713c]/30 px-3 py-1.5 text-center text-xs">
                                {rec.pmIn === "No record" ? (
                                  <span className="text-xs text-black">
                                    No record
                                  </span>
                                ) : (
                                  <span className="text-black">{rec.pmIn}</span>
                                )}
                              </td>
                            )}
                            {detailEventMeta!.hasPmSession && (
                              <td className="border-b border-r border-[#07713c]/30 px-3 py-1.5 text-center text-xs">
                                {rec.pmOut === "No record" ? (
                                  <span className="text-xs text-black">
                                    No record
                                  </span>
                                ) : (
                                  <span className="text-black">{rec.pmOut}</span>
                                )}
                              </td>
                            )}
                            <td className="border-b border-l border-r border-[#07713c]/30 px-3 py-1.5 text-center tabular-nums text-black">
                              {Number(rec.penalty) ? formatPhp(Number(rec.penalty) || 0) : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                totalCount={studentListTotal}
                page={studentListPage}
                pageSize={studentListPageSize}
                onPageChange={setStudentListPage}
                emptyLabel="No students to show."
                itemLabel="students"
                className="!text-black"
              />
            </section>
          ) : detailEvent ? (
            <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={closeEventDetails}
                className="mb-3 rounded-lg border border-[#07713c]/40 bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-[#07713c]/10"
              >
                ← Back to event list
              </button>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-4xl font-semibold text-black">{detailEvent.name}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(detailEvent.status)}`}>
                      {detailEvent.status === "ongoing" ? "Ongoing" : detailEvent.status === "completed" ? "Completed" : "Upcoming"}
                    </span>
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-black">
                      {detailEventMeta!.type}
                    </span>
                    <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-black">
                      Fines: {formatPhp(detailEvent.finePerAbsence ?? MOCK_FINE_PER_ABSENCE_PHP)} per absence
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-black">Students</p>
                  <p className="mt-1 text-4xl font-semibold text-black">{detailEvent.totalStudents}</p>
                  <p className="mt-1 text-sm text-black">{detailEventMeta!.audience}</p>
                </div>
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-black">Attended</p>
                  <p className="mt-1 text-4xl font-semibold text-black">{detailEvent.attended}</p>
                  <p className="mt-1 text-sm text-black">{ratePct(detailEvent.attended ?? 0, detailEvent.totalStudents ?? 0)}% attendance</p>
                </div>
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-black">Absent</p>
                  <p className="mt-1 text-4xl font-semibold text-black">{detailEvent.absent}</p>
                  <p className="mt-1 text-sm text-black">{ratePct(detailEvent.absent ?? 0, detailEvent.totalStudents ?? 0)}% of students</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3">
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-5">
                  <h4 className="text-lg font-semibold text-black">Schedule</h4>
                  <div className="mt-3 rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.06] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-black/75">Event date</p>
                    <p className="mt-0.5 text-base font-semibold text-black">{formatEventDateForDisplay(detailEvent.date)}</p>
                  </div>
                  <div className="mt-4 space-y-4 text-sm">
                    {detailEventMeta!.scheduleAmRange && (
                      <div className="rounded-lg border border-[#07713c]/20 bg-[#07713c]/5 p-3">
                        <p className="font-semibold text-black">AM Session</p>
                        <p className="mt-1 text-black">{detailEventMeta!.scheduleAmRange}</p>
                        <p className="mt-1 text-xs text-black">
                          Late in:{" "}
                          {detailEventMeta!.lateAmIn != null
                            ? formatGraceDurationLabel(detailEventMeta!.lateAmIn)
                            : "—"}
                        </p>
                      </div>
                    )}
                    {detailEventMeta!.schedulePmRange && (
                      <div className="rounded-lg border border-[#07713c]/20 bg-[#07713c]/5 p-3">
                        <p className="font-semibold text-black">PM Session</p>
                        <p className="mt-1 text-black">{detailEventMeta!.schedulePmRange}</p>
                        <p className="mt-1 text-xs text-black">
                          Late in:{" "}
                          {detailEventMeta!.latePmIn != null
                            ? formatGraceDurationLabel(detailEventMeta!.latePmIn)
                            : "—"}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#07713c]/20 pt-4">
                    <button
                      type="button"
                      onClick={() => openEventStudents(detailEvent.id)}
                      className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-3 py-2 text-sm font-medium text-black hover:bg-[#07713c]/15"
                    >
                      Students list
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadExcelEvent(detailEvent)}
                      className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-3 py-2 text-sm font-medium text-black hover:bg-[#07713c]/15"
                    >
                      Export Excel (CSV) — this event
                    </button>
                    <button
                      type="button"
                      onClick={() => exportPdfEvent(detailEvent)}
                      className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-3 py-2 text-sm font-medium text-black hover:bg-[#07713c]/15"
                    >
                      Export PDF — this event
                    </button>
                  </div>
                </div>
              </div>

              {detailEvent.status !== "upcoming" && (
                <>
                </>
              )}

              {detailEvent.status === "upcoming" && (
                <p className="mt-4 text-sm text-black">No attendance recorded yet for this event.</p>
              )}

            </section>
          ) : (
          <>
          {/* Search + event list */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-[#07713c]/30 bg-white shadow-sm">
            <div className="border-b border-[#07713c]/20 px-4 py-3">
              <h2 className="text-sm font-semibold text-black">Event list</h2>
            </div>
            <div className="border-b border-[#07713c]/20 p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-96 max-w-full shrink-0 sm:w-[28rem]">
                  <label className="mb-1 block text-xs font-medium text-black">Search event</label>
                  <div className="relative">
                    <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter by event name…"
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-4 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-black">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                    >
                      <option value="all">All</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <label className="flex shrink-0 flex-col">
                    <span className="mb-1 block text-xs font-medium text-black">Rows per page</span>
                    <select
                      value={eventListPageSize}
                      onChange={(e) => {
                        setEventListPageSize(Number(e.target.value));
                        setEventListPage(1);
                      }}
                      className="rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                      aria-label="Rows per page for event list"
                    >
                      {EVENT_LIST_ROWS_PER_PAGE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("all");
                      setSearch("");
                      setEventListPageSize(DEFAULT_EVENT_LIST_PAGE_SIZE);
                      setEventListPage(1);
                    }}
                    className="rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-black hover:bg-[#07713c]/10 focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
            <div className="min-w-0 overflow-x-auto">
              <table className={`w-full text-sm ${TABLE_CELL_NOWRAP}`}>
                <thead
                 className={`border-b text-white border-[#07713c]/30 bg-[#07713c] text-left text-xs uppercase tracking-wide ${ATTENDANCE_TH_TEXT}`}>
                  <tr>
                    <th className="px-4 py-2.5 align-middle">Event name</th>
                    <th className="px-4 py-2.5 align-middle">Date</th>
                    <th className="px-4 py-2.5 align-middle">Session</th>
                    <th className="px-4 py-2.5 align-middle">Status</th>
                    <th className="px-4 py-2.5 text-right align-middle tabular-nums">Attended</th>
                    <th className="px-4 py-2.5 text-right align-middle tabular-nums">Absent</th>
                    <th className="hidden px-4 py-2.5 text-right align-middle tabular-nums">Rate</th>
                    <th className="px-4 py-2.5 text-right align-middle tabular-nums">Fines</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-black">
                        No events match the current filters.
                      </td>
                    </tr>
                  )}
                  {paginatedFiltered.map((ev) => (
                    <tr
                      key={ev.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEventDetails(ev.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openEventDetails(ev.id);
                        }
                      }}
                      className="cursor-pointer border-t border-[#07713c]/20 hover:bg-[#07713c]/10"
                    >
                      <td className="px-4 py-2.5 text-black">{ev.name}</td>
                      <td className="px-4 py-2.5 text-black">
                        {formatEventDateForDisplay(ev.date)}
                      </td>
                      <td className="px-4 py-2.5 text-black">
                        {formatDurationForEventsListWithSessionHint(ev)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(ev.status)}`}>
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-black">{ev.attended}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-black">{ev.absent}</td>
                      <td className="hidden px-4 py-2.5 text-right tabular-nums text-black">
                        {ev.status === "upcoming" ? "—" : `${ratePct(ev.attended ?? 0, ev.totalStudents ?? 0)}%`}
                      </td>
                      <td className="px-4 py-2.5 text-right text-black">
                        {formatPhp(ev.finePerAbsence ?? MOCK_FINE_PER_ABSENCE_PHP)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              totalCount={eventsTotal}
              page={eventListPage}
              pageSize={eventListPageSize}
              onPageChange={setEventListPage}
              emptyLabel="No events to show."
              itemLabel="events"
              className="!text-black"
            />
          </section>
          </>
          )}
          </div>
        </main>
      </div>

      {/* Drill-down */}
      {false && detailEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-black">{detailEvent!.name}</h3>
                <p className="text-sm text-black">
                  {formatEventDateForDisplay(detailEvent!.date)} · <span className="capitalize">{detailEvent!.status}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailEventId(null)}
                className="rounded-lg px-2 py-1 text-sm text-black hover:bg-[#07713c]/12"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
              <div className="rounded-lg bg-[#07713c]/5 p-2">
                <span className="text-xs text-black">Students</span>
                <p className="font-semibold">{detailEvent!.totalStudents}</p>
              </div>
              <div className="rounded-lg bg-[#07713c]/10 p-2">
                <span className="text-xs text-black">Attended</span>
                <p className="font-semibold">{detailEvent!.attended}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-2">
                <span className="text-xs text-black">Absent</span>
                <p className="font-semibold">{detailEvent!.absent}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-2">
                <span className="text-xs text-black">Total fines</span>
                <p className="font-semibold text-black">{formatPhp(eventTotalFine(detailEvent))}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-black">
              Fine rule: {detailEvent!.absent} absences × {formatPhp(detailEvent!.finePerAbsence ?? MOCK_FINE_PER_ABSENCE_PHP)} ={" "}
              {formatPhp(eventTotalFine(detailEvent))}
            </p>

            <div className="mt-4 rounded-lg border border-[#07713c]/30 bg-[#07713c]/[0.08] p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-black capitalize">
                  {detailEvent!.status}
                </span>
                <span className="rounded-full bg-[#07713c]/10 px-2 py-0.5 text-xs text-black">{detailEventMeta!.type}</span>
                <span className="rounded-full bg-[#07713c]/10 px-2 py-0.5 text-xs text-black">
                  Registration: {detailEventMeta!.requiresRegistration}
                </span>
                <span className="rounded-full bg-[#07713c]/10 px-2 py-0.5 text-xs text-black">{detailEventMeta!.audience}</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-black">
                  Fines: {formatPhp(eventTotalFine(detailEvent))}
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-[#07713c]/30 p-3">
              <h4 className="text-sm font-semibold text-black">Schedule &amp; details</h4>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-black">Session</p>
                  <p className="font-medium">{detailEventMeta!.duration}</p>
                </div>
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-black">Schedule</p>
                  {detailEventMeta!.hasAmSession && (
                    <>
                      <p className="font-medium">AM</p>
                      <p className="text-xs text-black">{detailEventMeta!.scheduleAm ?? "—"}</p>
                    </>
                  )}
                  {detailEventMeta!.hasPmSession && (
                    <>
                      <p className={detailEventMeta!.hasAmSession ? "mt-1 font-medium" : "font-medium"}>PM</p>
                      <p className="text-xs text-black">{detailEventMeta!.schedulePm ?? "—"}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-[#07713c]/30 p-3">
              <h4 className="text-sm font-semibold text-black">Late (time in)</h4>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-black">AM late in</p>
                  <p className="font-medium">
                    {detailEventMeta!.lateAmIn != null
                      ? formatGraceDurationLabel(detailEventMeta!.lateAmIn)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-black">PM late in</p>
                  <p className="font-medium">
                    {detailEventMeta!.latePmIn != null
                      ? formatGraceDurationLabel(detailEventMeta!.latePmIn)
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-[#07713c]/30 p-3">
              <h4 className="text-sm font-semibold text-black">Audience &amp; notes</h4>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-black">Audience</p>
                  <p className="font-medium">{detailEventMeta!.audience}</p>
                </div>
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-black">Notes</p>
                  <p className="whitespace-pre-wrap font-medium">{detailEventMeta!.notes}</p>
                </div>
              </div>
            </div>

            {detailEvent!.status !== "upcoming" && (
              <>
                <div className="mt-4 h-48 max-w-md mx-auto">
                  <Pie
                    data={{
                      labels: ["Attended", "Absent"],
                      datasets: [
                        {
                          data: [detailEvent!.attended, detailEvent!.absent],
                          backgroundColor: ["rgba(7, 113, 60, 0.85)", "rgba(220, 38, 38, 0.7)"],
                        },
                      ],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
                  />
                </div>

                <h4 className="mt-4 text-sm font-semibold text-black">Student list</h4>
                <div className="mt-2 overflow-x-auto rounded-lg border border-[#07713c]/30">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead className="border-b border-[#07713c]/30 bg-[#ffb300] text-left text-xs font-semibold uppercase text-black">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Fine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailEvent!.students || []).map((s) => (
                        <tr key={s.id} className="border-t border-[#07713c]/20">
                          <td className="px-3 py-1.5 text-black">{s.name}</td>
                          <td className="px-3 py-1.5 capitalize text-black">{s.status}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{s.finePhp ? formatPhp(s.finePhp) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {detailEvent!.status === "upcoming" && (
              <p className="mt-4 text-sm text-black">No attendance recorded yet for this event.</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[#07713c]/20 pt-4">
              <button
                type="button"
                onClick={() => onNavigate?.("students")}
                className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm font-medium hover:bg-[#07713c]/10"
              >
                Students list
              </button>
              <button
                type="button"
                onClick={() => downloadExcelEvent(detailEvent!)}
                className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm font-medium hover:bg-[#07713c]/10"
              >
                Export Excel (CSV) — this event
              </button>
              <button
                type="button"
                onClick={() =>
                  exportPdfEvent(
                    detailEvent!,
                    isStudentListPath ? filteredStudentList : detailEvent!.students,
                  )
                }
                className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm font-medium hover:bg-[#07713c]/10"
              >
                Export PDF — this event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export panel */}
      {/* ── Import Event Modal (CSG President only) ─────────────────────── */}
      {importOpen && isCsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-black">Import Event</h2>
                <p className="mt-0.5 text-xs text-black/60">
                  Import a system-exported .xlsx event file
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-lg p-1.5 text-black/50 hover:bg-[#07713c]/10 hover:text-black"
              >
                ✕
              </button>
            </div>

            {/* Step: upload */}
            {importStep === "upload" && (
              <div
                onDragOver={(e) => { e.preventDefault(); setImportDragging(true); }}
                onDragLeave={() => setImportDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setImportDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) void handleImportFileSelect(f);
                }}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                  importDragging
                    ? "border-[#07713c] bg-[#07713c]/5"
                    : "border-[#07713c]/30 bg-[#07713c]/[0.02]"
                }`}
              >
                <div className="text-4xl">📂</div>
                <p className="text-sm font-medium text-black">
                  Drag &amp; drop a <span className="font-bold">.xlsx</span> event file here
                </p>
                <p className="text-xs text-black/50">or</p>
                <label className="cursor-pointer rounded-lg border border-[#07713c] bg-white px-4 py-2 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/10">
                  Browse file
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleImportFileSelect(f);
                    }}
                  />
                </label>
                <p className="mt-1 text-xs text-black/40">
                  Only system-exported .xlsx files are accepted
                </p>
              </div>
            )}

            {/* Step: previewing */}
            {importStep === "previewing" && (
              <div className="flex flex-col items-center gap-4 py-10">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#07713c]/20 border-t-[#07713c]" />
                <p className="text-sm font-medium text-black">Validating file…</p>
                {importFile && (
                  <p className="text-xs text-black/50">{importFile.name}</p>
                )}
              </div>
            )}

            {/* Step: preview */}
            {importStep === "preview" && (
              <div className="space-y-4">
                {/* Validation badge */}
                {importPreviewData?.valid ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <span className="text-base">✅</span>
                    <span className="text-sm font-medium text-black">
                      File validated successfully
                    </span>
                    {importPreviewData.fingerprintMatch && (
                      <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Password verified
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-800">
                      ❌ Validation Failed
                    </p>
                    <p className="mt-1 text-xs text-red-700">
                      {importError ?? importPreviewData?.message ?? "Unknown error"}
                    </p>
                  </div>
                )}

                {/* Duplicate warning */}
                {importPreviewData?.valid && importPreviewData.isDuplicate && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-800">
                      ⚠️ Duplicate Event Detected
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      An event named &ldquo;<strong>{importPreviewData.existingEventName}</strong>&rdquo; already exists
                      for this date. Choose how to proceed:
                    </p>
                  </div>
                )}

                {/* Event preview info */}
                {importPreviewData?.valid && (
                  <div className="rounded-xl border border-[#07713c]/20 bg-[#07713c]/[0.03] p-4 text-sm">
                    <h3 className="mb-3 font-semibold text-black">
                      {importPreviewData.eventName ?? "Event Details"}
                    </h3>
                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                      {importPreviewData.eventDate && (
                        <>
                          <span className="text-black/60">Date</span>
                          <span className="font-medium text-black">{importPreviewData.eventDate}</span>
                        </>
                      )}
                      {importPreviewData.department && (
                        <>
                          <span className="text-black/60">Department</span>
                          <span className="font-medium text-black">{importPreviewData.department}</span>
                        </>
                      )}
                      <span className="text-black/60">Total Students</span>
                      <span className="font-medium text-black">{importPreviewData.studentCount ?? 0}</span>
                      <span className="text-black/60">Attended</span>
                      <span className="font-medium text-black">{importPreviewData.attendanceCount ?? 0}</span>
                      <span className="text-black/60">Payment Records</span>
                      <span className="font-medium text-black">{importPreviewData.paymentCount ?? 0}</span>
                      {importPreviewData.exportedBy && (
                        <>
                          <span className="text-black/60">Exported By</span>
                          <span className="font-medium text-black">{importPreviewData.exportedBy}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {importPreviewData?.valid ? (
                  importPreviewData.isDuplicate ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-black">Choose an action:</p>
                      <button
                        type="button"
                        onClick={() => void handleImportConfirm("copy")}
                        className="w-full rounded-lg border border-[#07713c] bg-[#07713c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#055a2e]"
                      >
                        Create a New Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleImportConfirm("replace")}
                        className="w-full rounded-lg border border-amber-500 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
                      >
                        Replace Existing Event
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleImportConfirm("skip")}
                        className="w-full rounded-lg border border-[#07713c]/30 px-4 py-2.5 text-sm font-medium text-black hover:bg-[#07713c]/10"
                      >
                        Skip Import
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleImportConfirm("copy")}
                      className="w-full rounded-lg border border-[#07713c] bg-[#07713c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#055a2e]"
                    >
                      Import Event Data
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={resetImportModal}
                    className="w-full rounded-lg border border-[#07713c]/30 px-4 py-2.5 text-sm font-medium text-black hover:bg-[#07713c]/10"
                  >
                    Try Another File
                  </button>
                )}
              </div>
            )}

            {/* Step: importing */}
            {importStep === "importing" && (
              <div className="flex flex-col items-center gap-4 py-10">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#07713c]/20 border-t-[#07713c]" />
                <p className="text-sm font-medium text-black">Importing event data…</p>
                <p className="text-xs text-black/50">
                  Creating event, students, attendance, and payment records
                </p>
              </div>
            )}

            {/* Step: result */}
            {importStep === "result" && importResultData && (
              <div className="space-y-4">
                {importResultData.success ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <span className="text-base">✅</span>
                    <span className="text-sm font-medium text-black">
                      {importResultData.skipped
                        ? "Import skipped — event already exists."
                        : "Event imported successfully!"}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-800">❌ Import Failed</p>
                    <p className="mt-1 text-xs text-red-700">
                      {importResultData.message}
                    </p>
                  </div>
                )}

                {importResultData.success && !importResultData.skipped && (
                  <div className="rounded-xl border border-[#07713c]/20 bg-[#07713c]/[0.03] p-4 text-sm">
                    <h3 className="mb-3 font-semibold text-black">Import Summary</h3>
                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                      {importResultData.eventName && (
                        <>
                          <span className="text-black/60">Event Name</span>
                          <span className="font-medium text-black">{importResultData.eventName}</span>
                        </>
                      )}
                      {importResultData.department && (
                        <>
                          <span className="text-black/60">Department</span>
                          <span className="font-medium text-black">{importResultData.department}</span>
                        </>
                      )}
                      <span className="text-black/60">New Students Created</span>
                      <span className="font-medium text-black">{importResultData.studentsImported ?? 0}</span>
                      <span className="text-black/60">Existing Students Found</span>
                      <span className="font-medium text-black">{importResultData.studentsFound ?? 0}</span>
                      <span className="text-black/60">Attendance Records</span>
                      <span className="font-medium text-black">{importResultData.attendanceCreated ?? 0}</span>
                      <span className="text-black/60">Fine Records</span>
                      <span className="font-medium text-black">{importResultData.finesCreated ?? 0}</span>
                      <span className="text-black/60">Payment Records</span>
                      <span className="font-medium text-black">{importResultData.paymentsCreated ?? 0}</span>
                      {(importResultData.failedRecords ?? 0) > 0 && (
                        <>
                          <span className="text-red-600">Failed Records</span>
                          <span className="font-medium text-red-700">{importResultData.failedRecords}</span>
                        </>
                      )}
                    </div>
                    {importResultData.errors && importResultData.errors.length > 0 && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="mb-1 text-xs font-semibold text-amber-800">Warnings</p>
                        <ul className="space-y-0.5 text-xs text-amber-700">
                          {importResultData.errors.map((e, i) => (
                            <li key={i}>• {e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetImportModal}
                    className="flex-1 rounded-lg border border-[#07713c]/30 px-4 py-2.5 text-sm font-medium text-black hover:bg-[#07713c]/10"
                  >
                    Import Another File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportOpen(false)}
                    className="flex-1 rounded-lg border border-[#07713c] bg-[#07713c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#055a2e]"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── End Import Event Modal ──────────────────────────────────────────── */}

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`w-full max-w-md rounded-xl bg-white p-5 shadow-xl ${ATTENDANCE_TEXT}`}>
            <h3 className="text-lg font-semibold text-black">Export / reports</h3>
            <p className="mt-2 text-sm text-black">
              Download attendance data as CSV (Excel) or PDF. Filters below apply to both formats.
            </p>
            <div className="mt-3 rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-black">
                All-events student export filters
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={exportAllEventId}
                  onChange={(e) => setExportAllEventId(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30 sm:col-span-2"
                >
                  <option value="all">All events</option>
                  {exportCompletedEventOptions.map((ev) => (
                    <option key={ev.id} value={String(ev.id)}>
                      {ev.name} - {formatEventDateForDisplay(ev.date)}
                    </option>
                  ))}
                </select>
                <select
                  value={exportAllEventStatus}
                  onChange={(e) => setExportAllEventStatus(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All event statuses</option>
                  <option value="completed">Completed</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="upcoming">Upcoming</option>
                </select>
                {SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS && (
                <select
                  value={exportAllCollege}
                  onChange={(e) => setExportAllCollege(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All colleges</option>
                  {exportAllCollegeOptions.map((college) => (
                    <option key={college} value={college}>
                      {college}
                    </option>
                  ))}
                </select>
                )}
                <select
                  value={exportAllCourse}
                  onChange={(e) => setExportAllCourse(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All courses</option>
                  {exportAllCourseOptions.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-xs text-black/80">
                {exportAllFilteredRows.length} student record(s) match these filters.
              </p>
            </div>
            {detailEvent ? (
              <div className="mt-3 rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-black">
                  Current event filters - {detailEvent.name}
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="search"
                    value={exportEventSearch}
                    onChange={(e) => setExportEventSearch(e.target.value)}
                    placeholder="Search name, ID, or year level"
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30 sm:col-span-2"
                  />
                  {SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS && (
                  <select
                    value={exportEventCollege}
                    onChange={(e) => setExportEventCollege(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30 sm:col-span-2"
                  >
                    <option value="all">All colleges</option>
                    {studentListCollegeOptions.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  )}
                  <select
                    value={exportEventCourse}
                    onChange={(e) => setExportEventCourse(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All courses</option>
                    {exportEventCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS && (
                  <select
                    value={exportEventMajor}
                    onChange={(e) => setExportEventMajor(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All majors</option>
                    {exportEventMajorOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  )}
                  <select
                    value={exportEventYearLevel}
                    onChange={(e) => setExportEventYearLevel(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30 sm:col-span-2"
                  >
                    <option value="all">All year levels</option>
                    {studentListYearLevelOptions.map((yl) => (
                      <option key={yl} value={String(yl)}>
                        {yl}
                      </option>
                    ))}
                  </select>
                  <select
                    value={exportEventAttendance}
                    onChange={(e) => setExportEventAttendance(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All statuses</option>
                    <option value="attended">Attended</option>
                    <option value="absent">Absent</option>
                    {detailEvent.status === "upcoming" ? <option value="no_record">No record</option> : null}
                  </select>
                </div>
                <p className="mt-2 text-xs text-black/80">
                  {exportFilteredEventStudents.length} student(s) match these filters.
                </p>
              </div>
            ) : null}
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  void downloadExcelAll();
                  setExportOpen(false);
                }}
                className="w-full rounded-lg border border-[#07713c] bg-[#07713c]/10 px-4 py-2.5 text-sm font-medium text-black hover:bg-[#07713c]/15"
              >
                Download Excel (.xlsx) — all events
              </button>
              <button
                type="button"
                onClick={() => {
                  exportPdfAll();
                  setExportOpen(false);
                }}
                className="w-full rounded-lg border border-[#07713c]/40 px-4 py-2.5 text-sm font-medium text-black hover:bg-[#07713c]/10"
              >
                Download PDF — all events (students)
              </button>
              <button
                type="button"
                disabled={!detailEvent}
                onClick={() => {
                  if (!detailEvent) return;
                  void downloadExcelEvent(detailEvent);
                  setExportOpen(false);
                }}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium ${
                  detailEvent
                    ? "border-[#07713c]/40 text-black hover:bg-[#07713c]/10"
                    : "border-[#07713c]/20 text-black/50"
                }`}
              >
                Download Excel (.xlsx) — current event
              </button>
              <button
                type="button"
                disabled={!detailEvent}
                onClick={() => {
                  if (!detailEvent) return;
                  exportPdfEvent(detailEvent, exportFilteredEventStudents);
                  setExportOpen(false);
                }}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium ${
                  detailEvent
                    ? "border-[#07713c]/40 text-black hover:bg-[#07713c]/10"
                    : "border-[#07713c]/20 text-black/50"
                }`}
              >
                Download PDF — current event (filtered students)
              </button>
            </div>
            <button
              type="button"
              onClick={() => setExportOpen(false)}
              className="mt-4 w-full rounded-lg border border-[#07713c]/30 py-2 text-sm text-black hover:bg-[#07713c]/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

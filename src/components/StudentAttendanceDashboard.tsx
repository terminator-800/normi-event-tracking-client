import { useEffect, useMemo, useState } from "react";
import { Chart as ChartJS, type ChartOptions } from "chart.js/auto";
import { Pie } from "react-chartjs-2";
import PaginationBar from "./PaginationBar";
import SearchMagnifierIcon from "./SearchMagnifierIcon";
import { useStudentDashboardDetail, useStudentDashboardList } from "../hooks/useStudentDashboard";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { normalizeRoleKey } from "../utils/roles";
import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import {
  buildCollegeFilterOptionsFromStudents,
  departmentMatchesFilter,
  studentMatchesDepartmentCodes,
} from "../utils/departmentFilter";

void ChartJS;

/** College / course filters — shown when roster includes department data from import. */
const SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS = true;

const STUDENTS_TH_TEXT = "font-bold text-black";
const TABLE_CELL_NOWRAP = "[&_th]:whitespace-nowrap [&_tbody_td]:whitespace-nowrap";

type RosterCourseCatalogEntry = {
  id: string;
  code: string;
  college: string;
  collegeCode: string;
  label: string;
  full: string;
  filterValue: string;
  major?: string;
};

type StudentRosterRecord = {
  id: string;
  name: string;
  course: string;
  department?: string;
  yearLevel?: number | string | null;
  year_level?: number | string | null;
  attendanceRate: number;
};

type StudentEventRef = {
  name?: string;
  date?: string;
};

type StudentAlert = {
  tone?: string;
  text?: string;
};

type StudentHistoryEvent = {
  name?: string;
  date?: string;
  sessionType?: string;
  attended?: boolean;
  finePhp?: number;
  eventMode?: string;
  timeInOnly?: boolean;
  timeIn?: string | null;
  timeOut?: string | null;
  checkIn?: string | null;
  amTimeIn?: string | null;
  amTimeOut?: string | null;
  pmTimeIn?: string | null;
  pmTimeOut?: string | null;
  schedule?: string;
  session?: string;
  period?: string;
};

type StudentDetailRecord = StudentRosterRecord & {
  participationTrend?: string;
  streak?: number;
  lastAttendedEvent?: StudentEventRef | null;
  lastMissedEvent?: StudentEventRef | null;
  mostMissedEventType?: string;
  eventHistory?: StudentHistoryEvent[];
  eventTypeBreakdown?: unknown[];
  alerts?: StudentAlert[];
  totalEvents?: number;
  eventsAttended?: number;
  eventsMissed?: number;
};

type StudentAttendanceDashboardProps = {
  onRegisterExportOpen?: (register: (() => void) | null) => void;
};

type TimeSlotProps = {
  value?: string | null;
};

function parseAttendanceRate(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseStudentRosterRow(raw: Record<string, unknown>): StudentRosterRecord {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    course: String(raw.course ?? ""),
    department: raw.department != null ? String(raw.department) : undefined,
    yearLevel: (raw.yearLevel ?? raw.year_level) as number | string | null | undefined,
    year_level: (raw.year_level ?? raw.yearLevel) as number | string | null | undefined,
    attendanceRate: parseAttendanceRate(raw.attendanceRate),
  };
}

function parseStudentEventRef(raw: unknown): StudentEventRef | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    name: o.name != null ? String(o.name) : undefined,
    date: o.date != null ? String(o.date) : undefined,
  };
}

function parseStudentAlert(raw: unknown): StudentAlert {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    tone: o.tone != null ? String(o.tone) : undefined,
    text: o.text != null ? String(o.text) : undefined,
  };
}

function parseStudentHistoryEvent(raw: unknown): StudentHistoryEvent {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const fineRaw = o.finePhp ?? o.fine_php;
  const fineN = fineRaw != null ? Number(fineRaw) : NaN;
  const mode = String(o.eventMode ?? o.event_mode ?? "").trim().toUpperCase();
  const timeInOnly =
    o.timeInOnly === true ||
    o.time_in_only === true ||
    mode === "TIME_IN_ONLY";
  return {
    name: o.name != null ? String(o.name) : undefined,
    date: o.date != null ? String(o.date) : undefined,
    sessionType: o.sessionType != null ? String(o.sessionType) : undefined,
    attended: o.attended === true || o.attended === 1,
    finePhp: Number.isFinite(fineN) ? fineN : undefined,
    eventMode: mode || undefined,
    timeInOnly,
    timeIn: o.timeIn != null ? String(o.timeIn) : null,
    timeOut: o.timeOut != null ? String(o.timeOut) : null,
    checkIn: o.checkIn != null ? String(o.checkIn) : null,
    amTimeIn: o.amTimeIn != null ? String(o.amTimeIn) : null,
    amTimeOut: o.amTimeOut != null ? String(o.amTimeOut) : null,
    pmTimeIn: o.pmTimeIn != null ? String(o.pmTimeIn) : null,
    pmTimeOut: o.pmTimeOut != null ? String(o.pmTimeOut) : null,
    schedule: o.schedule != null ? String(o.schedule) : undefined,
    session: o.session != null ? String(o.session) : undefined,
    period: o.period != null ? String(o.period) : undefined,
  };
}

function parseStudentDetail(raw: unknown): StudentDetailRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const base = parseStudentRosterRow(o);
  return {
    ...base,
    participationTrend: o.participationTrend != null ? String(o.participationTrend) : undefined,
    streak: typeof o.streak === "number" ? o.streak : Number(o.streak) || 0,
    lastAttendedEvent: parseStudentEventRef(o.lastAttendedEvent),
    lastMissedEvent: parseStudentEventRef(o.lastMissedEvent),
    mostMissedEventType: o.mostMissedEventType != null ? String(o.mostMissedEventType) : undefined,
    eventHistory: Array.isArray(o.eventHistory) ? o.eventHistory.map(parseStudentHistoryEvent) : [],
    eventTypeBreakdown: Array.isArray(o.eventTypeBreakdown) ? o.eventTypeBreakdown : [],
    alerts: Array.isArray(o.alerts) ? o.alerts.map(parseStudentAlert) : [],
    totalEvents: typeof o.totalEvents === "number" ? o.totalEvents : Number(o.totalEvents) || 0,
    eventsAttended: typeof o.eventsAttended === "number" ? o.eventsAttended : Number(o.eventsAttended) || 0,
    eventsMissed: typeof o.eventsMissed === "number" ? o.eventsMissed : Number(o.eventsMissed) || 0,
  };
}

type CollegeFilterOption = { value: string; label: string };

function getActivityTier(rate: number) {
  if (rate >= 90) return { key: "active", label: "Active", emoji: "🟢", range: "90–100%" };
  if (rate >= 70) return { key: "moderate", label: "Moderate", emoji: "🟡", range: "70–89%" };
  return { key: "inactive", label: "Inactive", emoji: "🔴", range: "<70%" };
}

/** Charged per missing time-in or time-out when an event is whole day or half day. */
export const PENALTY_MISSING_TIME_RECORD_PHP = 50;

/**
 * Registrar-aligned programs for roster filter (`student.course` stores `filterValue`).
 * BSED majors: Eng, Math, Fil · BSBA tracks: MM, HRDM, FM
 */
export const ROSTER_COURSE_CATALOG: RosterCourseCatalogEntry[] = [
  {
    id: "1",
    code: "BEED",
    college: "College of Education, Arts and Sciences",
    collegeCode: "CEAS",
    label: "BEED",
    full: "Bachelor of Elementary Education",
    filterValue: "BEED",
  },
  {
    id: "2",
    code: "BSED",
    college: "College of Education, Arts and Sciences",
    collegeCode: "CEAS",
    label: "BSED — Eng",
    major: "English",
    full: "Bachelor of Secondary Education Major in English",
    filterValue: "BSED_ENG",
  },
  {
    id: "3",
    code: "BSED",
    college: "College of Education, Arts and Sciences",
    collegeCode: "CEAS",
    label: "BSED — Math",
    major: "Math",
    full: "Bachelor of Secondary Education Major in Math",
    filterValue: "BSED_MATH",
  },
  {
    id: "4",
    code: "BSED",
    college: "College of Education, Arts and Sciences",
    collegeCode: "CEAS",
    label: "BSED — Fil",
    major: "Filipino",
    full: "Bachelor of Secondary Education Major in Filipino",
    filterValue: "BSED_FIL",
  },
  {
    id: "5",
    code: "BSIT",
    college: "College of Information Technology",
    collegeCode: "CIT",
    label: "BSIT",
    full: "Bachelor of Science in Information Technology",
    filterValue: "BSIT",
  },
  {
    id: "6",
    code: "BSCRIM",
    college: "College of Criminal Justice Education",
    collegeCode: "CCJE",
    label: "BSCRIM",
    full: "Bachelor of Science in Criminology",
    filterValue: "BSCRIM",
  },
  {
    id: "7",
    code: "BSHM",
    college: "College of Hospitality Management",
    collegeCode: "CHM",
    label: "BSHM",
    full: "Bachelor of Science in Hospitality Management",
    filterValue: "BSHM",
  },
  {
    id: "8",
    code: "BSBA",
    college: "College of Business Administration",
    collegeCode: "CBA",
    label: "BSBA — MM",
    major: "Marketing Management",
    full: "BSBA Marketing Management",
    filterValue: "BSBA-MM",
  },
  {
    id: "9",
    code: "BSBA",
    college: "College of Business Administration",
    collegeCode: "CBA",
    label: "BSBA — HRDM",
    major: "Human Resource Development Management",
    full: "BSBA Human Resource Development Management",
    filterValue: "BSBA-HRDM",
  },
  {
    id: "10",
    code: "BSBA",
    college: "College of Business Administration",
    collegeCode: "CBA",
    label: "BSBA — FM",
    major: "Financial Management",
    full: "BSBA Financial Management",
    filterValue: "BSBA-FM",
  },
];

/** Course filter: all BSED tracks (Eng, Math, Filipino), excluding BEED — CEAS governor only. */
const ROSTER_BSED_ALL_FILTER_VALUE = "BSED_ALL";

function getRosterCourseRow(filterValue: string): RosterCourseCatalogEntry | undefined {
  return ROSTER_COURSE_CATALOG.find((r) => r.filterValue === filterValue);
}

function getRosterCourseDisplayLabel(filterValue: string) {
  if (filterValue === ROSTER_BSED_ALL_FILTER_VALUE) return "BSED (all majors)";
  return getRosterCourseRow(filterValue)?.label ?? String(filterValue ?? "—");
}

function rosterBsedAllOption() {
  return {
    id: "ceas-bsed-all-majors",
    code: "BSED",
    college: "College of Education, Arts and Sciences",
    collegeCode: "CEAS",
    label: "BSED — all majors (Eng, Math, Filipino)",
    full: "Bachelor of Secondary Education (all majors)",
    filterValue: ROSTER_BSED_ALL_FILTER_VALUE,
  };
}

/** Insert “all BSED” before individual BSED rows when present. */
function withCeasBsedAllCourseOption(catalog: RosterCourseCatalogEntry[], enabled: boolean) {
  if (!enabled || !catalog.length) return catalog;
  if (!catalog.some((c) => c.code === "BSED")) return catalog;
  const i = catalog.findIndex((c) => c.code === "BSED");
  if (i < 0) return catalog;
  const opt = rosterBsedAllOption();
  return [...catalog.slice(0, i), opt, ...catalog.slice(i)];
}

function studentMatchesRosterCourseFilter(studentCourse: string, filterValue: string) {
  if (filterValue === "all") return true;
  if (filterValue === ROSTER_BSED_ALL_FILTER_VALUE) {
    return getRosterCourseRow(studentCourse)?.code === "BSED";
  }
  return studentCourse === filterValue;
}

function getRosterYearLevel(student: Pick<StudentRosterRecord, "yearLevel" | "year_level">) {
  const y = student?.yearLevel ?? student?.year_level;
  if (y == null || y === "") return null;
  const n = Number(y);
  return Number.isFinite(n) ? n : null;
}

function getStudentDepartmentName(student: Pick<StudentRosterRecord, "department" | "course">) {
  const fromApi = String(student?.department ?? "").trim();
  if (fromApi) return fromApi;
  return getRosterCourseRow(student?.course)?.college ?? "";
}

function getStudentDepartmentLabel(student: Pick<StudentRosterRecord, "department" | "course">) {
  const name = getStudentDepartmentName(student);
  return name || "—";
}

function downloadTextFile(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeGovernorCourseCodeKey(code: string | null | undefined) {
  return String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/** Catalog rows for a governor's `courses` list (matches `ROSTER_COURSE_CATALOG.code`, case-insensitive). */
function rosterCatalogEntriesForGovernorCourses(courseCodes: string[]) {
  if (!Array.isArray(courseCodes) || !courseCodes.length) return [];
  const wanted = new Set(courseCodes.map((c) => normalizeGovernorCourseCodeKey(c)));
  return ROSTER_COURSE_CATALOG.filter((entry) => wanted.has(normalizeGovernorCourseCodeKey(entry.code)));
}

function rosterDepartmentCodesForGovernorCourses(courseCodes: string[]) {
  const rows = rosterCatalogEntriesForGovernorCourses(courseCodes);
  return Array.from(new Set(rows.map((r) => r.collegeCode))).filter(Boolean);
}

function rosterCourseMatchesSearchQuery(student: StudentRosterRecord, qLower: string) {
  if (!qLower) return true;
  if (student.name.toLowerCase().includes(qLower)) return true;
  if (student.id.toLowerCase().includes(qLower)) return true;
  if (String(student.course ?? "").toLowerCase().includes(qLower)) return true;
  if (getStudentDepartmentName(student).toLowerCase().includes(qLower)) return true;
  const yl = getRosterYearLevel(student);
  if (yl != null && String(yl).includes(qLower)) return true;
  const row = getRosterCourseRow(student.course);
  if (!row) return false;
  const blob = [row.label, row.full, row.major, row.code, row.filterValue].filter(Boolean).join(" ").toLowerCase();
  return blob.includes(qLower);
}

function normalizeHistoryEvent(ev: StudentHistoryEvent) {
  const raw = String(ev?.sessionType ?? "").trim().toLowerCase();
  const sessionType =
    raw === "whole day"
      ? "Whole day"
      : raw === "am only"
        ? "AM Only"
        : raw === "pm only"
          ? "PM Only"
          : raw === "half day"
            ? "AM Only"
            : "Whole day";
  if (sessionType !== "Whole day") {
    return {
      ...ev,
      sessionType,
      timeIn: ev.timeIn ?? ev.checkIn ?? null,
      timeOut: ev.timeOut ?? null,
    };
  }
  return {
    ...ev,
    sessionType,
    amTimeIn: ev.amTimeIn ?? null,
    amTimeOut: ev.amTimeOut ?? null,
    pmTimeIn: ev.pmTimeIn ?? null,
    pmTimeOut: ev.pmTimeOut ?? null,
  };
}

/**
 * Prefer server fine totals (already exclude Time Out fines for TIME_IN_ONLY).
 * Fallback client estimate: Time-In Only only counts Time In slots (no Time Out penalty).
 */
function isHistoryTimeInOnly(ev: StudentHistoryEvent | null | undefined): boolean {
  if (!ev) return false;
  if (ev.timeInOnly === true) return true;
  return String(ev.eventMode ?? "").trim().toUpperCase() === "TIME_IN_ONLY";
}

function getEventFinePhp(ev: StudentHistoryEvent | null | undefined) {
  if (ev != null && ev.finePhp != null && Number.isFinite(Number(ev.finePhp))) {
    return Math.max(0, Number(ev.finePhp));
  }
  const n = normalizeHistoryEvent(ev ?? {});
  const timeInOnly = isHistoryTimeInOnly(ev);
  if (!n.attended) {
    if (n.sessionType !== "Whole day") {
      // AM/PM only: Time-In Only → 1 slot; Time In/Out → 2 slots
      return PENALTY_MISSING_TIME_RECORD_PHP * (timeInOnly ? 1 : 2);
    }
    // Whole day: Time-In Only → AM in + PM in; otherwise 4 slots
    return PENALTY_MISSING_TIME_RECORD_PHP * (timeInOnly ? 2 : 4);
  }
  if (n.sessionType !== "Whole day") {
    let fine = 0;
    if (!String(n.timeIn ?? "").trim()) fine += PENALTY_MISSING_TIME_RECORD_PHP;
    if (!timeInOnly && !String(n.timeOut ?? "").trim()) {
      fine += PENALTY_MISSING_TIME_RECORD_PHP;
    }
    return fine;
  }
  const slots = timeInOnly
    ? [n.amTimeIn, n.pmTimeIn]
    : [n.amTimeIn, n.amTimeOut, n.pmTimeIn, n.pmTimeOut];
  return slots.reduce(
    (acc, v) => acc + (!String(v ?? "").trim() ? PENALTY_MISSING_TIME_RECORD_PHP : 0),
    0,
  );
}

function TimeSlot({ value }: TimeSlotProps) {
  const v = String(value ?? "").trim();
  if (v) return <span className="text-xs text-black">{v}</span>;
  return (
    <span className="text-xs font-medium text-black">
      No record
    </span>
  );
}

function TimeOutSlot({
  value,
  timeInOnly,
}: {
  value?: string | null;
  timeInOnly?: boolean;
}) {
  if (timeInOnly) {
    return <span className="text-xs text-black/55">—</span>;
  }
  return <TimeSlot value={value} />;
}

function getHistorySessionKey(ev: StudentHistoryEvent) {
  const normalized = normalizeHistoryEvent(ev);
  if (normalized.sessionType === "AM Only") return "AM Session";
  if (normalized.sessionType === "PM Only") return "PM Session";
  return "Whole day";
}

/** Half day only: infer AM vs PM from time-in or time-out (mock uses e.g. "8:00 AM"). */
function getHalfDayAmPm(ev: StudentHistoryEvent) {
  const normalized = normalizeHistoryEvent(ev);
  if (normalized.sessionType === "Whole day") return null;
  if (normalized.sessionType === "AM Only") return "AM";
  if (normalized.sessionType === "PM Only") return "PM";
  const pick = (raw: string | null | undefined) => {
    const t = String(raw ?? "").trim();
    if (!t) return null;
    if (/\bam\b/i.test(t)) return "AM";
    if (/\bpm\b/i.test(t)) return "PM";
    return null;
  };
  return pick(ev.timeIn ?? ev.checkIn) ?? pick(ev.timeOut);
}

function getHistorySessionLabel(ev: StudentHistoryEvent, normalizedEvent: ReturnType<typeof normalizeHistoryEvent>) {
  if (normalizedEvent.sessionType === "AM Only") return "AM Session";
  if (normalizedEvent.sessionType === "PM Only") return "PM Session";
  if (normalizedEvent.sessionType !== "Half day") return normalizedEvent.sessionType;
  const scheduleRaw = String(ev?.schedule ?? ev?.session ?? ev?.period ?? "").trim();
  if (/\bam\b/i.test(scheduleRaw)) return "AM Session";
  if (/\bpm\b/i.test(scheduleRaw)) return "PM Session";
  const halfDayPeriod = getHalfDayAmPm(ev);
  if (halfDayPeriod === "AM") return "AM Session";
  if (halfDayPeriod === "PM") return "PM Session";
  return normalizedEvent.sessionType;
}

/**
 * Period narrows half day rows by AM/PM. Whole day rows include both segments, so they stay visible for AM or PM.
 */
function matchesHistoryPeriodFilter(ev: StudentHistoryEvent, periodFilter: string) {
  if (periodFilter === "all") return true;
  if (getHistorySessionKey(ev) === "Whole day") return true;
  const slot = getHalfDayAmPm(ev);
  if (periodFilter === "AM") return slot === "AM";
  if (periodFilter === "PM") return slot === "PM";
  return true;
}


const ROSTER_PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50];

export default function StudentAttendanceDashboard({ onRegisterExportOpen }: StudentAttendanceDashboardProps) {
  const { role, isGovernor, governorScope } = useGovernorScope();
  const isCeasGovernor = normalizeRoleKey(role) === "ceas_governor";
  const { data: rawRosterList = [], isPending: rosterLoading, isError: rosterError } = useStudentDashboardList();
  const rosterList = useMemo(
    () => rawRosterList.map((row) => parseStudentRosterRow(row)),
    [rawRosterList],
  );
  const [selectedId, setSelectedId] = useState("");
  const { data: detailData } = useStudentDashboardDetail(selectedId);
  const studentDetail = useMemo(() => {
    if (!selectedId) return undefined;
    const parsed = parseStudentDetail(detailData);
    return parsed?.id === selectedId ? parsed : undefined;
  }, [detailData, selectedId]);

  const [search, setSearch] = useState("");
  const [rosterCourseFilter, setRosterCourseFilter] = useState("all");
  const [rosterCollegeFilter, setRosterCollegeFilter] = useState("all");
  const [rosterYearLevelFilter, setRosterYearLevelFilter] = useState("all");
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterPageSize, setRosterPageSize] = useState(15);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyEventSearch, setHistoryEventSearch] = useState("");
  const [debouncedEventSearch, setDebouncedEventSearch] = useState("");
  const [historySessionFilter, setHistorySessionFilter] = useState("all");
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState("all");
  const [isStudentDetailModalOpen, setIsStudentDetailModalOpen] = useState(false);
  const [showInlineEventHistory, setShowInlineEventHistory] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSearch, setExportSearch] = useState("");
  const [exportCollegeFilter, setExportCollegeFilter] = useState("all");
  const [exportCourseFilter, setExportCourseFilter] = useState("all");
  const [exportYearLevelFilter, setExportYearLevelFilter] = useState("all");
  const [exportStatusFilter, setExportStatusFilter] = useState("all");

  const openStudentDetailModal = (studentId: string) => {
    setSelectedId(studentId);
    setShowInlineEventHistory(false);
    setIsStudentDetailModalOpen(true);
  };

  const governorDepartmentCodes = useMemo(() => {
    if (!isGovernor || !governorScope?.courses?.length) return null;
    return rosterDepartmentCodesForGovernorCourses(governorScope.courses);
  }, [isGovernor, governorScope]);

  const rosterCollegeSelectOptions = useMemo((): CollegeFilterOption[] => {
    const scopedStudents =
      isGovernor && governorDepartmentCodes?.length
        ? rosterList.filter((s) =>
            studentMatchesDepartmentCodes(getStudentDepartmentName(s), governorDepartmentCodes),
          )
        : rosterList;
    return buildCollegeFilterOptionsFromStudents(scopedStudents, getStudentDepartmentName, {
      allLabel: isGovernor && governorDepartmentCodes?.length ? "All (my department)" : "All colleges",
    }) as CollegeFilterOption[];
  }, [rosterList, isGovernor, governorDepartmentCodes]);

  const showCollegeFilterSelect = SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS;

  useEffect(() => {
    if (!isGovernor || rosterCollegeSelectOptions.length !== 2) return;
    const only = rosterCollegeSelectOptions[1]?.value;
    if (!only || only === "all") return;
    const onlyValue = String(only);
    setRosterCollegeFilter((prev) => (prev === onlyValue ? prev : onlyValue));
    setExportCollegeFilter((prev) => (prev === onlyValue ? prev : onlyValue));
  }, [isGovernor, rosterCollegeSelectOptions]);

  useEffect(() => {
    if (rosterCollegeFilter === "all") return;
    if (!rosterCollegeSelectOptions.some((o) => o.value === rosterCollegeFilter)) {
      setRosterCollegeFilter("all");
    }
  }, [rosterCollegeFilter, rosterCollegeSelectOptions]);

  useEffect(() => {
    if (exportCollegeFilter === "all") return;
    if (!rosterCollegeSelectOptions.some((o) => o.value === exportCollegeFilter)) {
      setExportCollegeFilter("all");
    }
  }, [exportCollegeFilter, rosterCollegeSelectOptions]);

  useEffect(() => {
    const ms = 280;
    const id = window.setTimeout(() => setDebouncedEventSearch(historyEventSearch), ms);
    return () => window.clearTimeout(id);
  }, [historyEventSearch]);

  const student = useMemo((): StudentDetailRecord | null => {
    if (studentDetail && studentDetail.id === selectedId) return studentDetail;
    const row = rosterList.find((s) => s.id === selectedId);
    if (!row) return null;
    return {
      ...row,
      participationTrend: "Increasing",
      streak: 0,
      lastAttendedEvent: null,
      lastMissedEvent: null,
      mostMissedEventType: "—",
      eventHistory: [],
      eventTypeBreakdown: [],
      alerts: [],
      totalEvents: 0,
      eventsAttended: 0,
      eventsMissed: 0,
    };
  }, [studentDetail, rosterList, selectedId]);

  const rosterYearLevelOptions = useMemo(() => {
    const set = new Set<number>();
    for (const s of rosterList) {
      const yl = getRosterYearLevel(s);
      if (yl != null) set.add(yl);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [rosterList]);

  const filteredRoster = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rosterList.filter((s) => {
      const college = getStudentDepartmentName(s);
      if (isGovernor && governorDepartmentCodes?.length) {
        if (!studentMatchesDepartmentCodes(college, governorDepartmentCodes)) return false;
      }
      if (!studentMatchesRosterCourseFilter(s.course, rosterCourseFilter)) return false;
      if (!departmentMatchesFilter(college, rosterCollegeFilter)) return false;
      if (rosterYearLevelFilter !== "all") {
        const want = Number(rosterYearLevelFilter);
        const yl = getRosterYearLevel(s);
        if (!Number.isFinite(want) || yl !== want) return false;
      }
      return rosterCourseMatchesSearchQuery(s, q);
    });
  }, [
    rosterList,
    search,
    rosterCourseFilter,
    rosterCollegeFilter,
    rosterYearLevelFilter,
    isGovernor,
    governorDepartmentCodes,
  ]);

  useEffect(() => {
    if (!showInlineEventHistory || !selectedId) return;
    if (!filteredRoster.some((s) => s.id === selectedId)) {
      setShowInlineEventHistory(false);
    }
  }, [filteredRoster, selectedId, showInlineEventHistory]);

  const availableCourseOptions = useMemo(() => {
    let catalog = ROSTER_COURSE_CATALOG;
    if (isGovernor && governorDepartmentCodes?.length) {
      catalog = catalog.filter((c) => governorDepartmentCodes.includes(c.collegeCode));
    }
    if (rosterCollegeFilter === "all") {
      return withCeasBsedAllCourseOption(catalog, isCeasGovernor);
    }
    const narrowed = catalog.filter((course) => departmentMatchesFilter(course.college, rosterCollegeFilter));
    return withCeasBsedAllCourseOption(narrowed, isCeasGovernor);
  }, [isGovernor, governorDepartmentCodes, rosterCollegeFilter, isCeasGovernor]);

  const exportCourseOptions = useMemo(() => {
    let catalog = ROSTER_COURSE_CATALOG;
    if (isGovernor && governorDepartmentCodes?.length) {
      catalog = catalog.filter((c) => governorDepartmentCodes.includes(c.collegeCode));
    }
    if (exportCollegeFilter === "all") {
      return withCeasBsedAllCourseOption(catalog, isCeasGovernor);
    }
    const narrowed = catalog.filter((course) => departmentMatchesFilter(course.college, exportCollegeFilter));
    return withCeasBsedAllCourseOption(narrowed, isCeasGovernor);
  }, [isGovernor, governorDepartmentCodes, exportCollegeFilter, isCeasGovernor]);

  const rosterTotal = filteredRoster.length;
  const rosterTotalPages = Math.max(1, Math.ceil(rosterTotal / rosterPageSize) || 1);
  const rosterPageSafe = Math.min(rosterPage, rosterTotalPages);

  const paginatedRoster = useMemo(() => {
    const start = (rosterPageSafe - 1) * rosterPageSize;
    return filteredRoster.slice(start, start + rosterPageSize);
  }, [filteredRoster, rosterPageSafe, rosterPageSize]);

  useEffect(() => {
    setRosterPage(1);
  }, [search, rosterCourseFilter, rosterCollegeFilter, rosterYearLevelFilter]);

  useEffect(() => {
    if (rosterYearLevelFilter === "all") return;
    if (!rosterYearLevelOptions.includes(Number(rosterYearLevelFilter))) {
      setRosterYearLevelFilter("all");
    }
  }, [rosterYearLevelFilter, rosterYearLevelOptions]);

  useEffect(() => {
    if (rosterCourseFilter === "all") return;
    const isCourseAllowed = availableCourseOptions.some((course) => course.filterValue === rosterCourseFilter);
    if (!isCourseAllowed) {
      setRosterCourseFilter("all");
    }
  }, [availableCourseOptions, rosterCourseFilter]);

  useEffect(() => {
    if (!exportOpen) return;
    setExportSearch(search);
    setExportCollegeFilter(rosterCollegeFilter);
    setExportCourseFilter(rosterCourseFilter);
    setExportYearLevelFilter(rosterYearLevelFilter);
    setExportStatusFilter("all");
  }, [exportOpen, search, rosterCollegeFilter, rosterCourseFilter, rosterYearLevelFilter]);

  useEffect(() => {
    if (!onRegisterExportOpen) return undefined;
    onRegisterExportOpen(() => () => setExportOpen(true));
    return () => onRegisterExportOpen(null);
  }, [onRegisterExportOpen]);

  useEffect(() => {
    if (exportCourseFilter === "all") return;
    const isCourseAllowed = exportCourseOptions.some((course) => course.filterValue === exportCourseFilter);
    if (!isCourseAllowed) {
      setExportCourseFilter("all");
    }
  }, [exportCourseFilter, exportCourseOptions]);

  useEffect(() => {
    if (exportYearLevelFilter === "all") return;
    if (!rosterYearLevelOptions.includes(Number(exportYearLevelFilter))) {
      setExportYearLevelFilter("all");
    }
  }, [exportYearLevelFilter, rosterYearLevelOptions]);

  useEffect(() => {
    setRosterPage((p) => Math.min(p, rosterTotalPages));
  }, [rosterTotalPages]);

  const tier = student ? getActivityTier(student.attendanceRate) : getActivityTier(0);
  const showLowMsg = student && student.attendanceRate < 70;
  const selectedStudentYearLevel = student ? getRosterYearLevel(student) : null;

  const exportFilteredRoster = useMemo(() => {
    const q = exportSearch.toLowerCase().trim();
    return rosterList.filter((s) => {
      const college = getStudentDepartmentName(s);
      if (isGovernor && governorDepartmentCodes?.length) {
        if (!studentMatchesDepartmentCodes(college, governorDepartmentCodes)) return false;
      }
      if (!departmentMatchesFilter(college, exportCollegeFilter)) return false;
      if (!studentMatchesRosterCourseFilter(s.course, exportCourseFilter)) return false;
      if (exportYearLevelFilter !== "all") {
        const want = Number(exportYearLevelFilter);
        const yl = getRosterYearLevel(s);
        if (!Number.isFinite(want) || yl !== want) return false;
      }
      if (exportStatusFilter !== "all" && getActivityTier(s.attendanceRate).key !== exportStatusFilter) return false;
      return rosterCourseMatchesSearchQuery(s, q);
    });
  }, [
    rosterList,
    exportSearch,
    exportCollegeFilter,
    exportCourseFilter,
    exportYearLevelFilter,
    exportStatusFilter,
    isGovernor,
    governorDepartmentCodes,
  ]);

  const exportRosterCsv = () => {
    const header = [
      "Student ID",
      "Student Name",
      "Department",
      "Course",
      "Year Level",
      "Attendance Rate",
      "Status",
    ];
    const body = exportFilteredRoster.map((s) => {
      const status = getActivityTier(s.attendanceRate);
      const yl = getRosterYearLevel(s);
      return [
        `"${s.id}"`,
        `"${String(s.name ?? "").replace(/"/g, '""')}"`,
        `"${String(getStudentDepartmentLabel(s)).replace(/"/g, '""')}"`,
        `"${String(getRosterCourseDisplayLabel(s.course)).replace(/"/g, '""')}"`,
        yl != null ? String(yl) : "—",
        `"${s.attendanceRate}%"`,
        `"${status.label}"`,
      ];
    });
    downloadTextFile(
      `students-roster-${new Date().toISOString().slice(0, 10)}.csv`,
      [header.join(","), ...body.map((r) => r.join(","))].join("\n"),
    );
  };

  const sortedEventHistory = useMemo(() => {
    const hist = student?.eventHistory ?? [];
    return [...hist].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [student?.eventHistory]);

  const filteredEventHistory = useMemo(() => {
    let list = sortedEventHistory;
    const q = debouncedEventSearch.toLowerCase().trim();
    if (q) {
      list = list.filter((ev) => {
        const name = String(ev.name ?? "").toLowerCase();
        const dateRaw = String(ev.date ?? "");
        const dateLower = dateRaw.toLowerCase();
        const displayDate = formatEventDateForDisplay(ev.date).toLowerCase();
        return name.includes(q) || dateLower.includes(q) || displayDate.includes(q);
      });
    }
    if (historySessionFilter !== "all") {
      list = list.filter((ev) => getHistorySessionKey(ev) === historySessionFilter);
    }
    if (historyPeriodFilter !== "all") {
      list = list.filter((ev) => matchesHistoryPeriodFilter(ev, historyPeriodFilter));
    }
    return list;
  }, [sortedEventHistory, debouncedEventSearch, historySessionFilter, historyPeriodFilter]);

  const totalEventHistoryFinesPhp = useMemo(
    () => filteredEventHistory.reduce((sum, ev) => sum + getEventFinePhp(ev), 0),
    [filteredEventHistory],
  );

  const historyTotal = filteredEventHistory.length;
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize) || 1);
  const historyPageSafe = Math.min(historyPage, historyTotalPages);

  const historyFiltersActive =
    debouncedEventSearch.trim() !== "" ||
    historySessionFilter !== "all" ||
    historyPeriodFilter !== "all";

  /**
   * Two time columns (one period) when:
   * - Session filter is AM Session or PM Session (hide the other period’s columns), or
   * - Period filter is AM/PM (row filter; same column layout).
   */
  const narrowTimeColumns =
    historySessionFilter === "AM Session" ||
    historySessionFilter === "PM Session" ||
    historyPeriodFilter === "AM" ||
    historyPeriodFilter === "PM";
  const historyShowPmTimePair =
    historySessionFilter === "PM Session" || historyPeriodFilter === "PM";
  const historyTimeColumnCount = narrowTimeColumns ? 2 : 4;
  const historyTableColCount = 4 + historyTimeColumnCount + 1;

  const paginatedEventHistory = useMemo(() => {
    const start = (historyPageSafe - 1) * historyPageSize;
    return filteredEventHistory.slice(start, start + historyPageSize);
  }, [filteredEventHistory, historyPageSafe, historyPageSize]);

  useEffect(() => {
    setHistoryEventSearch("");
    setDebouncedEventSearch("");
    setHistorySessionFilter("all");
    setHistoryPeriodFilter("all");
    setHistoryPage(1);
  }, [selectedId]);

  useEffect(() => {
    setHistoryPage(1);
  }, [debouncedEventSearch, historySessionFilter, historyPeriodFilter]);

  useEffect(() => {
    setHistoryPage((p) => Math.min(p, historyTotalPages));
  }, [historyTotalPages]);

  useEffect(() => {
    if (!isStudentDetailModalOpen) return undefined;

    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = prevBodyOverflow;
      documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isStudentDetailModalOpen]);

  const pieSharePct = useMemo(() => {
    if (!student?.totalEvents) return { attended: 0, absent: 0 };
    const totalEvents = student.totalEvents ?? 0;
    const eventsAttended = student.eventsAttended ?? 0;
    const eventsMissed = student.eventsMissed ?? 0;
    return {
      attended: Math.round((eventsAttended / totalEvents) * 100),
      absent: Math.round((eventsMissed / totalEvents) * 100),
    };
  }, [student]);

  const pieData = student
    ? {
        labels: [`Attended (${pieSharePct.attended}%)`, `Absent (${pieSharePct.absent}%)`],
        datasets: [
          {
            data: [student.eventsAttended ?? 0, student.eventsMissed ?? 0],
            backgroundColor: ["#16a34a", "#f87171"],
            borderWidth: 0,
          },
        ],
      }
    : null;

  const pieOptions: ChartOptions<"pie"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { boxWidth: 12, font: { size: 11 } } },
    },
  };

  if (rosterLoading) {
    return (
      <div className="rounded-xl border border-[#07713c]/30 bg-white p-8 text-center text-sm text-black">
        Loading students…
      </div>
    );
  }

  if (rosterError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm text-black">
        Could not load student roster. Check that you are signed in and the API is running.
      </div>
    );
  }

  if (!rosterList.length) {
    return (
      <div className="rounded-xl border border-[#07713c]/30 bg-white p-8 text-center text-sm text-black">
        No students found for your account scope.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* All students summary */}
      <section className="min-w-0 bg-white rounded-lg border border-[#07713c]/30 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-[#07713c]/20">
          <h3 className="text-lg font-bold text-black">All students</h3>
        </div>

        <div className="p-4 border-b border-[#07713c]/20">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
              <div className="relative min-w-0 w-full max-w-md sm:min-w-[240px] sm:flex-1">
                <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, ID, or year level"
                  className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-10 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] [&::-webkit-search-cancel-button]:hidden"
                  aria-label="Search students by name, ID, or year level"
                />
                {search.trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-black/85 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                    aria-label="Clear student search"
                  >
                    ×
                  </button>
                )}
              </div>
              {showCollegeFilterSelect && (
                <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-black">
                  Colleges
                  <select
                    value={rosterCollegeFilter}
                    onChange={(e) => setRosterCollegeFilter(e.target.value)}
                    className="h-9 min-w-[12rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                    aria-label="Filter by college"
                  >
                    {rosterCollegeSelectOptions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-black">
                Year level
                <select
                  value={rosterYearLevelFilter}
                  onChange={(e) => setRosterYearLevelFilter(e.target.value)}
                  className="h-9 min-w-[9rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                  aria-label="Filter by year level"
                >
                  <option value="all">All year levels</option>
                  {rosterYearLevelOptions.map((yl) => (
                    <option key={yl} value={String(yl)}>
                      {yl}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-black">
                Rows per page
                <select
                  value={rosterPageSize}
                  onChange={(e) => {
                    setRosterPageSize(Number(e.target.value));
                    setRosterPage(1);
                  }}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2 py-1.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                  aria-label="Rows per page for student roster"
                >
                  {ROSTER_PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
          </div>
        </div>

        <div className="min-w-0 overflow-x-auto">
          <table className={`w-full min-w-0 table-fixed text-sm ${TABLE_CELL_NOWRAP}`}>
            <thead className={`border-b border-[#07713c]/30 bg-[#07713c] text-left text-xs uppercase tracking-wide ${STUDENTS_TH_TEXT}`}>
              <tr>
                <th className="w-[14%] px-3 py-2.5 text-left align-middle">Student ID</th>
                <th className="w-[26%] px-3 py-2.5 text-left align-middle">Name</th>
                <th className="w-[30%] px-3 py-2.5 text-left align-middle">Department</th>
                <th className="w-[12%] px-3 py-2.5 text-left align-middle tabular-nums">Year level</th>
                <th className="hidden w-[10%] px-3 py-2.5 text-left align-middle tabular-nums">Attendance</th>
                <th className="hidden px-3 py-2.5 text-left align-middle">Status</th>
                <th className="hidden px-3 py-2.5 text-left align-middle">Select</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRoster.map((s) => {
                const t = getActivityTier(s.attendanceRate);
                const rowYl = getRosterYearLevel(s);
                return (
                  <tr
                    key={s.id}
                    tabIndex={0}
                    onClick={() => openStudentDetailModal(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openStudentDetailModal(s.id);
                      }
                    }}
                    className={`cursor-pointer border-b border-[#07713c]/15 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#07713c]/40 hover:bg-[#07713c]/[0.08] ${
                      s.id === selectedId ? "bg-[#07713c]/10" : "hover:bg-gray-50"
                    }`}
                    aria-selected={s.id === selectedId}
                    title="Click row to view this student"
                  >
                    <td className="px-3 py-1.5 text-left leading-snug text-black">{s.id}</td>
                    <td className="px-3 py-1.5 text-left leading-snug text-black truncate" title={s.name}>{s.name}</td>
                    <td className="px-3 py-1.5 text-left leading-snug text-black truncate" title={getStudentDepartmentLabel(s)}>
                      {getStudentDepartmentLabel(s)}
                    </td>
                    <td className="px-3 py-1.5 text-left tabular-nums leading-snug text-black">
                      {rowYl != null ? rowYl : "—"}
                    </td>
                    <td className="hidden px-3 py-1.5 text-left tabular-nums font-semibold leading-snug text-black whitespace-nowrap">
                      {s.attendanceRate}%
                    </td>
                    <td className="hidden px-3 py-1.5 text-left">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span>{t.emoji}</span>
                        <span className="text-black">{t.label}</span>
                      </span>
                    </td>
                    <td className="hidden px-3 py-1.5 text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(s.id);
                          setShowInlineEventHistory(true);
                          setIsStudentDetailModalOpen(false);
                        }}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#07713c]/30 ${
                          s.id === selectedId
                            ? "border border-[#07713c] bg-[#07713c]/15 text-black"
                            : "border border-[#07713c]/40 bg-white text-black hover:bg-[#07713c]/10"
                        }`}
                        aria-label={`Select ${s.name} for event history`}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRoster.length === 0 && (
          <p className="py-10 px-4 text-center text-sm text-black/85">No students match this search.</p>
        )}
        <PaginationBar
          totalCount={rosterTotal}
          page={rosterPage}
          pageSize={rosterPageSize}
          onPageChange={setRosterPage}
          emptyLabel="No students to show."
          itemLabel="students"
          className="!text-black border-[#07713c]/20"
        />
      </section>

      {showInlineEventHistory && selectedId && student && !isStudentDetailModalOpen && (
          <section className="min-w-0 bg-white rounded-lg border border-[#07713c]/30 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-[#07713c]/20">
              <h3 className="text-lg font-bold text-black">Event history</h3>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                <div className="relative min-w-0 w-full max-w-md sm:min-w-[240px] sm:flex-1">
                  <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                  <input
                    type="search"
                    value={historyEventSearch}
                    onChange={(e) => setHistoryEventSearch(e.target.value)}
                    placeholder="Search by event name or date"
                    className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-10 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] [&::-webkit-search-cancel-button]:hidden"
                    aria-label="Search events by name or date"
                  />
                  {historyEventSearch.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryEventSearch("");
                        setDebouncedEventSearch("");
                      }}
                      className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-black/85 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                      aria-label="Clear event search"
                    >
                      ×
                    </button>
                  )}
                </div>
                <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-black">
                  <span className="whitespace-nowrap">Session</span>
                  <select
                    value={historySessionFilter}
                    onChange={(e) => setHistorySessionFilter(e.target.value)}
                    className="h-9 w-[9.5rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All</option>
                    <option value="Whole day">Whole day</option>
                    <option value="AM Session">AM Session</option>
                    <option value="PM Session">PM Session</option>
                  </select>
                </label>
                <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-black whitespace-nowrap">
                  Events per page
                  <select
                    value={historyPageSize}
                    onChange={(e) => {
                      setHistoryPageSize(Number(e.target.value));
                      setHistoryPage(1);
                    }}
                    className="h-9 min-w-[4.75rem] rounded-lg border border-[#07713c]/40 bg-white px-2 text-sm tabular-nums focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                  >
                    {ROSTER_PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="min-w-0 overflow-x-auto">
              <table
                className={`w-full text-sm ${TABLE_CELL_NOWRAP} ${narrowTimeColumns ? "min-w-[720px]" : "min-w-[960px]"}`}
              >
                <thead className={`border-b border-[#07713c]/20 bg-[#ffb300] text-center text-xs uppercase ${STUDENTS_TH_TEXT}`}>
                  <tr>
                    <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom" rowSpan={2}>
                      Event name
                    </th>
                    <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom whitespace-nowrap" rowSpan={2}>
                      Date
                    </th>
                    <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom whitespace-nowrap" rowSpan={2}>
                      Session
                    </th>
                    <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom" rowSpan={2}>
                      Status
                    </th>
                    {narrowTimeColumns ? (
                      <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                        {historyShowPmTimePair ? "PM" : "AM"}
                      </th>
                    ) : (
                      <>
                        <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                          AM
                        </th>
                        <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                          PM
                        </th>
                      </>
                    )}
                    <th className="border-l border-[#07713c]/30 px-4 py-2 align-bottom text-right whitespace-nowrap" rowSpan={2}>
                      Fines / penalty
                    </th>
                  </tr>
                  <tr>
                    {narrowTimeColumns ? (
                      <>
                        <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                        <th className="px-3 py-1.5">Time out</th>
                      </>
                    ) : (
                      <>
                        <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                        <th className="px-3 py-1.5">Time out</th>
                        <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                        <th className="px-3 py-1.5">Time out</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedEventHistory.length === 0 ? (
                    <tr>
                      <td colSpan={historyTableColCount} className="px-4 py-10 text-center text-sm text-black/85">
                        No event records in history.
                      </td>
                    </tr>
                  ) : filteredEventHistory.length === 0 ? (
                    <tr>
                      <td colSpan={historyTableColCount} className="px-4 py-10 text-center text-sm text-black/85">
                        No events match the current filters.
                      </td>
                    </tr>
                  ) : (
                  paginatedEventHistory.map((ev, i) => {
                    const row = normalizeHistoryEvent(ev);
                    const fine = getEventFinePhp(ev);
                    const timeInOnly = isHistoryTimeInOnly(ev);
                    const isHalf = row.sessionType !== "Whole day";
                    const sessionLabel = getHistorySessionLabel(ev, row);
                    const halfDayPeriod = isHalf ? getHalfDayAmPm(ev) : null;
                    const emptyTimeCell = <span className="text-black">—</span>;
                    const rowIndex = (historyPageSafe - 1) * historyPageSize + i;
                    return (
                      <tr key={`${ev.name}-${ev.date}-${rowIndex}`} className="border-t border-[#07713c]/20">
                        <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center text-black">{ev.name}</td>
                        <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center whitespace-nowrap text-black">{formatEventDateForDisplay(ev.date)}</td>
                        <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center whitespace-nowrap text-black">{sessionLabel}</td>
                        <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              ev.attended ? "bg-[#07713c]/10 text-black" : "bg-red-100 text-black"
                            }`}
                          >
                            {ev.attended ? "Attended" : "Absent"}
                          </span>
                        </td>
                        {narrowTimeColumns ? (
                          historyShowPmTimePair ? (
                            <>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                <TimeSlot value={isHalf ? row.timeIn : row.pmTimeIn} />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <TimeOutSlot
                                  timeInOnly={timeInOnly}
                                  value={isHalf ? row.timeOut : row.pmTimeOut}
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                <TimeSlot value={isHalf ? row.timeIn : row.amTimeIn} />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <TimeOutSlot
                                  timeInOnly={timeInOnly}
                                  value={isHalf ? row.timeOut : row.amTimeOut}
                                />
                              </td>
                            </>
                          )
                        ) : isHalf ? (
                          halfDayPeriod === "PM" ? (
                            <>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">{emptyTimeCell}</td>
                              <td className="px-3 py-2.5 text-center">{emptyTimeCell}</td>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                <TimeSlot value={row.timeIn} />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <TimeOutSlot timeInOnly={timeInOnly} value={row.timeOut} />
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                <TimeSlot value={row.timeIn} />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <TimeOutSlot timeInOnly={timeInOnly} value={row.timeOut} />
                              </td>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">{emptyTimeCell}</td>
                              <td className="px-3 py-2.5 text-center">{emptyTimeCell}</td>
                            </>
                          )
                        ) : (
                          <>
                            <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                              <TimeSlot value={row.amTimeIn} />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <TimeOutSlot timeInOnly={timeInOnly} value={row.amTimeOut} />
                            </td>
                            <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                              <TimeSlot value={row.pmTimeIn} />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <TimeOutSlot timeInOnly={timeInOnly} value={row.pmTimeOut} />
                            </td>
                          </>
                        )}
                        <td className="border-l border-[#07713c]/30 px-4 py-2.5 text-center tabular-nums">
                          {fine > 0 ? (
                            <span className="text-black">₱{fine.toLocaleString("en-PH")}</span>
                          ) : (
                            <span className="text-black">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#07713c]/30 bg-gray-50">
                    <td
                      colSpan={historyTableColCount - 1}
                      className="px-4 py-3 text-right text-xs font-semibold text-black"
                    >
                      {historyFiltersActive ? "Total penalties (matching filters)" : "Total penalties (event history)"}
                    </td>
                    <td className="border-l border-[#07713c]/30 px-4 py-3 text-right text-sm font-bold tabular-nums text-black">
                      ₱{totalEventHistoryFinesPhp.toLocaleString("en-PH")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <PaginationBar
              totalCount={historyTotal}
              page={historyPage}
              pageSize={historyPageSize}
              onPageChange={setHistoryPage}
              emptyLabel={
                sortedEventHistory.length === 0
                  ? "No event records to show."
                  : historyFiltersActive
                    ? "No events match the current filters."
                    : "No event records to show."
              }
              itemLabel="events"
              className="!text-black"
            />
          </section>
      )}

      {student && (
      <div className="hidden grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {/* 3. Status indicator */}
          <section className="hidden rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-black">Status indicator</h3>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-lg">{tier.emoji}</span>
              <span className="font-semibold text-black">{tier.label}</span>
              <span className="text-black/85">({tier.range})</span>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-black">
              <li>🟢 Active (90–100%)</li>
              <li>🟡 Moderate (70–89%)</li>
              <li>🔴 Inactive (&lt;70%)</li>
            </ul>
            {showLowMsg && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-black">
                ⚠️ Low participation in events
              </p>
            )}
          </section>

          {/* 4. Participation insights */}
          <section className="hidden rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-black">Participation insights</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-black/85">Current attendance streak</dt>
                <dd className="text-sm font-semibold text-black">
                  {(student.streak ?? 0) > 0
                    ? `Attended ${student.streak} event${student.streak === 1 ? "" : "s"} in a row`
                    : "No active streak"}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-black/85">Participation trend</dt>
                <dd
                  className={`text-sm font-semibold ${
                    student.participationTrend === "Increasing" ? "text-black" : "text-black"
                  }`}
                >
                  {student.participationTrend === "Increasing" ? "📈 Increasing" : "📉 Decreasing"}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-black/85">Last attended event</dt>
                <dd className="text-sm font-medium text-black">
                  {student.lastAttendedEvent ? (
                    <>
                      {student.lastAttendedEvent.name}{" "}
                      <span className="text-black/85">
                        ({formatEventDateForDisplay(student.lastAttendedEvent.date)})
                      </span>
                    </>
                  ) : (
                    <span className="text-black/85">—</span>
                  )}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-black/85">Last missed event</dt>
                <dd className="text-sm font-medium text-black">
                  {student.lastMissedEvent ? (
                    <>
                      {student.lastMissedEvent.name}{" "}
                      <span className="text-black/85">
                        ({formatEventDateForDisplay(student.lastMissedEvent.date)})
                      </span>
                    </>
                  ) : (
                    <span className="text-black/85">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* 7. Alerts */}
          {(student.alerts ?? []).length > 0 && (
            <section className="hidden rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-black">7. Alerts &amp; notifications</h3>
              <ul className="space-y-2">
                {(student.alerts ?? []).map((a, i) => (
                  <li
                    key={i}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      a.tone === "success"
                        ? "border border-[#07713c]/25 bg-[#07713c]/5 text-black"
                        : a.tone === "danger"
                          ? "border border-red-200 bg-red-50 text-black"
                          : "border border-amber-200 bg-amber-50 text-black"
                    }`}
                  >
                    {a.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="hidden space-y-4">
          <section className="rounded-xl border border-[#07713c]/30 bg-white p-4 shadow-sm">
            <div className="mb-4 rounded-lg border border-[#07713c]/20 bg-gray-50/80 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-black/85">Selected student</p>
              <p className="mt-1 font-semibold text-black">{student.name}</p>
              <p className="text-xs text-black/85">
                {(() => {
                  const dept = getStudentDepartmentLabel(student);
                  return [
                    student.id,
                    dept !== "—" ? dept : null,
                    ...(selectedStudentYearLevel != null ? [`Year ${selectedStudentYearLevel}`] : []),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                })()}
              </p>
            </div>
            {(student.totalEvents ?? 0) > 0 ? (
              <div className="relative mx-auto mb-4 h-52 w-full max-w-[220px]">
                {pieData && <Pie data={pieData} options={pieOptions} />}
              </div>
            ) : (
              <p className="mb-4 text-center text-xs text-black/85">No events to show.</p>
            )}
            <div>
              <div className="mb-1 flex justify-between text-xs text-black">
                <span>Progress</span>
                <span className="tabular-nums font-medium text-black">{student.attendanceRate}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-[#07713c] transition-all"
                  style={{ width: `${Math.min(100, student.attendanceRate)}%` }}
                />
              </div>
            </div>
          </section>
        </aside>
      </div>
      )}

      {isStudentDetailModalOpen && student && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
          onClick={() => setIsStudentDetailModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Student details modal"
        >
          <div
            className="flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#07713c]/30 bg-[#07713c]/10 px-5 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-black">Student details</p>
                <h3 className="text-sm font-semibold text-black sm:text-base">{student.name}</h3>
                <p className="mt-1 text-xs text-black">
                  {student.id}
                  {selectedStudentYearLevel != null ? ` · Year ${selectedStudentYearLevel}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStudentDetailModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffb300] text-black transition-colors hover:bg-[#e6a100]"
                aria-label="Close student modal"
              >
                <span className="text-lg font-bold">×</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:rgba(7,113,60,0.28)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#07713c]/30 [&::-webkit-scrollbar-thumb]:hover:bg-[#07713c]/40 [&::-webkit-scrollbar-track]:bg-transparent sm:p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="hidden rounded-lg border-2 border-[#07713c]/30 bg-[#07713c]/10 p-3 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-black">Attendance rate ⭐</p>
                  <p className="mt-1 text-3xl font-extrabold tabular-nums text-black">{student.attendanceRate}%</p>
                </div>
                <div className="rounded-lg border border-[#07713c]/30 bg-gray-50/80 p-3">
                  <p className="text-xs font-medium text-black/85">Total events</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-black">{student.totalEvents}</p>
                </div>
                <div className="rounded-lg border border-[#07713c]/30 bg-gray-50/80 p-3">
                  <p className="text-xs font-medium text-black/85">Events attended</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-black">{student.eventsAttended}</p>
                </div>
                <div className="rounded-lg border border-[#07713c]/30 bg-gray-50/80 p-3">
                  <p className="text-xs font-medium text-black/85">Events missed</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-black">{student.eventsMissed}</p>
                </div>
              </div>
              <div className="hidden">
                <div className="mb-1 flex justify-between text-xs text-black">
                  <span>Progress</span>
                  <span className="tabular-nums font-medium">{student.attendanceRate}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-[#07713c] transition-all"
                    style={{ width: `${Math.min(100, student.attendanceRate)}%` }}
                  />
                </div>
              </div>

              <section className="min-w-0 rounded-xl border border-[#07713c]/30 bg-white shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-3 border-b border-[#07713c]/20">
                  <h3 className="text-lg font-bold text-black">Event history</h3>
                  <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                    <div className="relative min-w-0 w-full max-w-md sm:min-w-[240px] sm:flex-1">
                      <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                      <input
                        type="search"
                        value={historyEventSearch}
                        onChange={(e) => setHistoryEventSearch(e.target.value)}
                        placeholder="Search by event name or date"
                        className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-10 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] [&::-webkit-search-cancel-button]:hidden"
                        aria-label="Search events by name or date"
                      />
                      {historyEventSearch.trim() !== "" && (
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryEventSearch("");
                            setDebouncedEventSearch("");
                          }}
                          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-black/85 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                          aria-label="Clear event search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-black">
                      <span className="whitespace-nowrap">Session</span>
                      <select
                        value={historySessionFilter}
                        onChange={(e) => setHistorySessionFilter(e.target.value)}
                        className="h-9 w-[9.5rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                      >
                        <option value="all">All</option>
                        <option value="Whole day">Whole day</option>
                        <option value="AM Session">AM Session</option>
                        <option value="PM Session">PM Session</option>
                      </select>
                    </label>
                    <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-black whitespace-nowrap">
                      Events per page
                      <select
                        value={historyPageSize}
                        onChange={(e) => {
                          setHistoryPageSize(Number(e.target.value));
                          setHistoryPage(1);
                        }}
                        className="h-9 min-w-[4.75rem] rounded-lg border border-[#07713c]/40 bg-white px-2 text-sm tabular-nums focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                      >
                        {ROSTER_PAGE_SIZE_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="min-w-0 overflow-x-auto">
                  <table
                    className={`w-full text-sm ${TABLE_CELL_NOWRAP} ${narrowTimeColumns ? "min-w-[720px]" : "min-w-[960px]"}`}
                  >
                    <thead className={`border-b border-[#07713c]/20 bg-[#07713c] text-center text-xs uppercase ${STUDENTS_TH_TEXT}`}>
                      <tr>
                        <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom" rowSpan={2}>
                          Event name
                        </th>
                        <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom whitespace-nowrap" rowSpan={2}>
                          Date
                        </th>
                        <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom whitespace-nowrap" rowSpan={2}>
                          Session
                        </th>
                        <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom" rowSpan={2}>
                          Status
                        </th>
                        {narrowTimeColumns ? (
                          <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                            {historyShowPmTimePair ? "PM" : "AM"}
                          </th>
                        ) : (
                          <>
                            <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                              AM
                            </th>
                            <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                              PM
                            </th>
                          </>
                        )}
                        <th className="border-l border-[#07713c]/30 px-4 py-2 align-bottom text-right whitespace-nowrap" rowSpan={2}>
                          Fines / penalty
                        </th>
                      </tr>
                      <tr>
                        {narrowTimeColumns ? (
                          <>
                            <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                            <th className="px-3 py-1.5">Time out</th>
                          </>
                        ) : (
                          <>
                            <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                            <th className="px-3 py-1.5">Time out</th>
                            <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                            <th className="px-3 py-1.5">Time out</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEventHistory.length === 0 ? (
                        <tr>
                          <td colSpan={historyTableColCount} className="px-4 py-10 text-center text-sm text-black/85">
                            No event records in history.
                          </td>
                        </tr>
                      ) : filteredEventHistory.length === 0 ? (
                        <tr>
                          <td colSpan={historyTableColCount} className="px-4 py-10 text-center text-sm text-black/85">
                            No events match the current filters.
                          </td>
                        </tr>
                      ) : (
                      paginatedEventHistory.map((ev, i) => {
                        const row = normalizeHistoryEvent(ev);
                        const fine = getEventFinePhp(ev);
                        const timeInOnly = isHistoryTimeInOnly(ev);
                        const isHalf = row.sessionType !== "Whole day";
                        const sessionLabel = getHistorySessionLabel(ev, row);
                        const halfDayPeriod = isHalf ? getHalfDayAmPm(ev) : null;
                        const emptyTimeCell = <span className="text-black">—</span>;
                        const rowIndex = (historyPageSafe - 1) * historyPageSize + i;
                        return (
                          <tr key={`${ev.name}-${ev.date}-${rowIndex}`} className="border-t border-[#07713c]/20">
                            <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center text-black">{ev.name}</td>
                            <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center whitespace-nowrap text-black">{formatEventDateForDisplay(ev.date)}</td>
                            <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center whitespace-nowrap text-black">{sessionLabel}</td>
                            <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  ev.attended ? "bg-[#07713c]/10 text-black" : "bg-red-100 text-black"
                                }`}
                              >
                                {ev.attended ? "Attended" : "Absent"}
                              </span>
                            </td>
                            {narrowTimeColumns ? (
                              historyShowPmTimePair ? (
                                <>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                    <TimeSlot value={isHalf ? row.timeIn : row.pmTimeIn} />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <TimeOutSlot
                                      timeInOnly={timeInOnly}
                                      value={isHalf ? row.timeOut : row.pmTimeOut}
                                    />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                    <TimeSlot value={isHalf ? row.timeIn : row.amTimeIn} />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <TimeOutSlot
                                      timeInOnly={timeInOnly}
                                      value={isHalf ? row.timeOut : row.amTimeOut}
                                    />
                                  </td>
                                </>
                              )
                            ) : isHalf ? (
                              halfDayPeriod === "PM" ? (
                                <>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">{emptyTimeCell}</td>
                                  <td className="px-3 py-2.5 text-center">{emptyTimeCell}</td>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                    <TimeSlot value={row.timeIn} />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <TimeOutSlot timeInOnly={timeInOnly} value={row.timeOut} />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                    <TimeSlot value={row.timeIn} />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <TimeOutSlot timeInOnly={timeInOnly} value={row.timeOut} />
                                  </td>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">{emptyTimeCell}</td>
                                  <td className="px-3 py-2.5 text-center">{emptyTimeCell}</td>
                                </>
                              )
                            ) : (
                              <>
                                <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                  <TimeSlot value={row.amTimeIn} />
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <TimeOutSlot timeInOnly={timeInOnly} value={row.amTimeOut} />
                                </td>
                                <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                  <TimeSlot value={row.pmTimeIn} />
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <TimeOutSlot timeInOnly={timeInOnly} value={row.pmTimeOut} />
                                </td>
                              </>
                            )}
                            <td className="border-l border-[#07713c]/30 px-4 py-2.5 text-center tabular-nums">
                              {fine > 0 ? (
                                <span className="text-black">₱{fine.toLocaleString("en-PH")}</span>
                              ) : (
                                <span className="text-black">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#07713c]/30 bg-gray-50">
                        <td
                          colSpan={historyTableColCount - 1}
                          className="px-4 py-3 text-right text-xs font-semibold text-black"
                        >
                          {historyFiltersActive ? "Total penalties (matching filters)" : "Total penalties (event history)"}
                        </td>
                        <td className="border-l border-[#07713c]/30 px-4 py-3 text-right text-sm font-bold tabular-nums text-black">
                          ₱{totalEventHistoryFinesPhp.toLocaleString("en-PH")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <PaginationBar
                  totalCount={historyTotal}
                  page={historyPage}
                  pageSize={historyPageSize}
                  onPageChange={setHistoryPage}
                  emptyLabel={
                    sortedEventHistory.length === 0
                      ? "No event records to show."
                      : historyFiltersActive
                        ? "No events match the current filters."
                        : "No event records to show."
                  }
                  itemLabel="events"
                  className="!text-black"
                />
              </section>

              <section className="hidden rounded-xl border border-[#07713c]/30 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-black">Participation insights</h3>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-black/85">Current attendance streak</dt>
                    <dd className="text-sm font-semibold text-black">
                      {(student.streak ?? 0) > 0
                        ? `Attended ${student.streak} event${student.streak === 1 ? "" : "s"} in a row`
                        : "No active streak"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-black/85">Participation trend</dt>
                    <dd
                      className={`text-sm font-semibold ${
                        student.participationTrend === "Increasing" ? "text-black" : "text-black"
                      }`}
                    >
                      {student.participationTrend === "Increasing" ? "📈 Increasing" : "📉 Decreasing"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-black/85">Last attended event</dt>
                    <dd className="text-sm font-medium text-black">
                      {student.lastAttendedEvent ? (
                        <>
                          {student.lastAttendedEvent.name}{" "}
                          <span className="text-black/85">
                            ({formatEventDateForDisplay(student.lastAttendedEvent.date)})
                          </span>
                        </>
                      ) : (
                        <span className="text-black/85">—</span>
                      )}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-black/85">Last missed event</dt>
                    <dd className="text-sm font-medium text-black">
                      {student.lastMissedEvent ? (
                        <>
                          {student.lastMissedEvent.name}{" "}
                          <span className="text-black/85">
                            ({formatEventDateForDisplay(student.lastMissedEvent.date)})
                          </span>
                        </>
                      ) : (
                        <span className="text-black/85">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        </div>
      )}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-black">Export / reports</h3>
            <p className="mt-2 text-sm text-black">Apply filters below for student export.</p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-black sm:col-span-2">
                Search
                <div className="relative">
                  <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                  <input
                    type="search"
                    value={exportSearch}
                    onChange={(e) => setExportSearch(e.target.value)}
                    placeholder="Search name, ID, or year level"
                    className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-10 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] [&::-webkit-search-cancel-button]:hidden"
                  />
                  {exportSearch.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => setExportSearch("")}
                      className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-black/85 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                      aria-label="Clear export student search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </label>
              {showCollegeFilterSelect && (
                <label className="flex flex-col gap-1 text-xs text-black">
                  College
                  <select
                    value={exportCollegeFilter}
                    onChange={(e) => setExportCollegeFilter(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    {rosterCollegeSelectOptions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs text-black sm:col-span-2">
                Year level
                <select
                  value={exportYearLevelFilter}
                  onChange={(e) => setExportYearLevelFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All year levels</option>
                  {rosterYearLevelOptions.map((yl) => (
                    <option key={yl} value={String(yl)}>
                      {yl}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-black">
                Activity status
                <select
                  value={exportStatusFilter}
                  onChange={(e) => setExportStatusFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="moderate">Moderate</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs text-black/85">
              {exportFilteredRoster.length} student record(s) will be exported.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  exportRosterCsv();
                  setExportOpen(false);
                }}
                className="w-full rounded-lg border border-[#07713c] bg-[#07713c]/10 px-4 py-2.5 text-sm font-medium text-black hover:bg-[#07713c]/15"
              >
                Export CSV - filtered students
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportSearch(search);
                  setExportCollegeFilter(rosterCollegeFilter);
                  setExportCourseFilter(rosterCourseFilter);
                  setExportYearLevelFilter(rosterYearLevelFilter);
                  setExportStatusFilter("all");
                }}
                className="w-full rounded-lg border border-[#07713c]/30 px-4 py-2 text-sm font-medium text-black hover:bg-[#07713c]/8"
              >
                Reset export filters
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

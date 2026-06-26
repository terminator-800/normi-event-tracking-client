import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { useAuthSession } from "./auth";
import { getRoleFromSession, seesInstitutionWideEventData } from "../utils/roles";

/** Prefix; queries use `["attendance", "students", "all"|"scoped"]` for CSG-wide vs department scope. */
export const STUDENT_ATTENDANCE_QUERY_KEY = ["attendance", "students"];

export type StudentAttendanceRow = {
  id: string | number;
  eventName: string;
  date: string;
  present: number;
  absent: number;
  late: number;
  status: string;
  venue: string | null;
  sessionWindow: string | null;
  departmentBreakdown: Array<{
    id: string;
    name: string;
    present: number;
    late: number;
    absent: number;
  }> | null;
};

function normalizeResponseToArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.records)) return obj.records as Record<string, unknown>[];
    if (Array.isArray(obj.attendance)) return obj.attendance as Record<string, unknown>[];
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    const nested = obj.data;
    if (nested && typeof nested === "object") {
      const inner = nested as Record<string, unknown>;
      if (Array.isArray(inner.records)) return inner.records as Record<string, unknown>[];
      if (Array.isArray(inner.attendance)) return inner.attendance as Record<string, unknown>[];
    }
  }
  return [];
}

function num(raw: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    if (raw[k] != null && Number.isFinite(Number(raw[k]))) return Number(raw[k]);
  }
  return 0;
}

function normalizeDepartmentBreakdown(raw: Record<string, unknown>) {
  const list =
    raw?.department_breakdown ??
    raw?.departmentBreakdown ??
    raw?.departments ??
    raw?.by_department;
  if (!Array.isArray(list) || list.length === 0) return null;
  const rows = list
    .map((d: Record<string, unknown>, i: number) => {
      if (!d || typeof d !== "object") return null;
      const name = d.name ?? d.department ?? d.label ?? d.program;
      if (name == null || String(name).trim() === "") return null;
      return {
        id: String(d.id ?? `${String(name)}-${i}`),
        name: String(name).trim(),
        present: num(d, "present", "present_count", "presentCount"),
        late: num(d, "late", "late_count", "lateCount"),
        absent: num(d, "absent", "absent_count", "absentCount"),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
  return rows.length ? rows : null;
}

function mapAttendanceRow(raw: Record<string, unknown> | null, index: number): StudentAttendanceRow | null {
  if (!raw || typeof raw !== "object") return null;
  const eventName =
    raw.event_name ??
    raw.eventName ??
    raw.name ??
    raw.event ??
    "Untitled Event";
  const date = raw.date ?? raw.event_date ?? raw.eventDate ?? "";
  const present = num(raw, "present", "present_count", "presentCount");
  const absent = num(raw, "absent", "absent_count", "absentCount");
  const late = num(raw, "late", "late_count", "lateCount");
  const status = raw.status != null && String(raw.status).trim() !== ""
    ? String(raw.status).trim()
    : "—";

  const venueRaw = raw.venue ?? raw.location ?? raw.venue_name;
  const sessionRaw = raw.session_window ?? raw.sessionWindow ?? raw.time_window ?? raw.schedule;

  return {
    id: (raw.id ?? raw._id ?? `${eventName}-${date}-${index}`) as string | number,
    eventName: String(eventName),
    date: String(date),
    present,
    absent,
    late,
    status,
    venue: venueRaw != null && String(venueRaw).trim() !== "" ? String(venueRaw).trim() : null,
    sessionWindow: sessionRaw != null && String(sessionRaw).trim() !== "" ? String(sessionRaw).trim() : null,
    departmentBreakdown: normalizeDepartmentBreakdown(raw),
  };
}

async function fetchStudentAttendance(scope: string): Promise<StudentAttendanceRow[]> {
  try {
    const config =
      scope === "all"
        ? { params: { all_events: "1", include_all: "1" } }
        : undefined;
    const { data } = await api.get("/attendance/students", config);
    const rows = normalizeResponseToArray(data);
    return rows.map((row, i) => mapAttendanceRow(row, i)).filter((r): r is StudentAttendanceRow => r != null);
  } catch {
    return [];
  }
}

type StudentAttendanceOptions = Omit<UseQueryOptions<StudentAttendanceRow[]>, "queryKey" | "queryFn">;

export function getStudentAttendance(options: StudentAttendanceOptions = {}) {
  const { enabled: enabledOption, ...restOptions } = options;
  const { data: session, isPending: isSessionPending } = useAuthSession();
  const scope = seesInstitutionWideEventData(getRoleFromSession(session)) ? "all" : "scoped";

  return useQuery({
    ...restOptions,
    queryKey: [...STUDENT_ATTENDANCE_QUERY_KEY, scope],
    queryFn: () => fetchStudentAttendance(scope),
    staleTime: 30_000,
    enabled: (enabledOption ?? true) && !isSessionPending,
  });
}

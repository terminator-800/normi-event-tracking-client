import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { AxiosRequestConfig } from "axios";
import api from "../api/axiosInstance";
import type { DisplayEvent, ServerEventRaw } from "../types/events";
import { useAuthSession } from "./auth";
import { getRoleFromSession, seesInstitutionWideEventData } from "../utils/roles";
import { normalizeEvAudiences } from "../utils/eventAudienceLabel";
import { formatGraceDurationLabel } from "../utils/eventTimeOptions";

/** Prefix for React Query; scope suffix: all departments vs department governors only. */
export const EVENTS_QUERY_KEY = ["events", "list"];

/**
 * Query params for GET /get-events only for admins (full cross-department list).
 * Governors and CSG presidents are creator-scoped server-side regardless of params.
 */
function buildWideEventsRequestConfig() {
  return {
    params: {
      all_events: "1",
      include_all: "1",
    },
  };
}

function eventsQueryKey(scope: string) {
  return [...EVENTS_QUERY_KEY, scope];
}

type EventsListQueryOptions = Omit<UseQueryOptions<DisplayEvent[]>, "queryKey" | "queryFn">;

function useEventsListQuery(options: EventsListQueryOptions = {}) {
  const { enabled: enabledOption, ...restOptions } = options;
  const { data: session, isPending: isSessionPending } = useAuthSession();
  const role = getRoleFromSession(session);
  const scope = seesInstitutionWideEventData(role) ? "all" : "scoped";

  return useQuery({
    ...restOptions,
    queryKey: eventsQueryKey(scope),
    queryFn: () =>
      getAllEvents(scope === "all" ? buildWideEventsRequestConfig() : undefined),
    staleTime: 30_000,
    // Wait for /me so admin/CSG aren’t misclassified as "scoped" on the first fetch.
    enabled: (enabledOption ?? true) && !isSessionPending,
  });
}

/** e.g. Feb 16, 2026 — short month, local calendar day for YYYY-MM-DD (avoids UTC shift). */
export function formatEventDateForDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const s = String(dateStr).trim();
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  let d;
  if (ymd) {
    d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  } else {
    try {
      d = new Date(s);
    } catch {
      return s;
    }
  }
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function eventDateMs(d: string | null | undefined): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Active event first (by date), else soonest Upcoming; for home / select-department sidebars. */
export function selectActiveOrUpcomingEvent(apiEvents: DisplayEvent[] | null | undefined): DisplayEvent | null {
  if (!Array.isArray(apiEvents) || apiEvents.length === 0) return null;
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const isTerminal = (s: unknown) => {
    const n = norm(s);
    return n === "completed" || n === "cancelled" || n === "canceled";
  };
  const byDate = [...apiEvents]
    .filter((e) => !isTerminal(e?.status))
    .sort((a, b) => eventDateMs(a.date) - eventDateMs(b.date));
  if (byDate.length === 0) return null;
  const active = byDate.filter((e) => norm(e.status) === "active");
  if (active.length > 0) return active[0];
  const upcoming = byDate.filter((e) => norm(e.status) === "upcoming");
  if (upcoming.length > 0) return upcoming[0];
  // Back end sometimes uses other labels ("scheduled", etc.) — show soonest non-terminal row
  return byDate[0] ?? null;
}

export function formatDateTimeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function normalizeResponseToArray(data: unknown): ServerEventRaw[] {
  if (Array.isArray(data)) return data as ServerEventRaw[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.events)) return obj.events as ServerEventRaw[];
    if (Array.isArray(obj.data)) return obj.data as ServerEventRaw[];
    const nested = obj.data;
    if (nested && typeof nested === "object" && Array.isArray((nested as Record<string, unknown>).events)) {
      return (nested as Record<string, unknown>).events as ServerEventRaw[];
    }
    if (Array.isArray(obj.rows)) return obj.rows as ServerEventRaw[];
    if (Array.isArray(obj.results)) return obj.results as ServerEventRaw[];
  }
  return [];
}

/** Converts backend time strings (e.g. "07:30:00", "7:30") to locale time like "7:30 AM". */
export function formatSqlTimeForDisplay(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return s;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function scheduleSlotLabel(startRaw: unknown, endRaw: unknown): string | null {
  const start = formatSqlTimeForDisplay(startRaw);
  const end = formatSqlTimeForDisplay(endRaw);
  if (!start && !end) return null;
  return `${start ?? "—"}–${end ?? "—"}`;
}

function graceLabel(inMinutes: unknown, _outMinutes: unknown): string {
  const inVal = inMinutes != null && inMinutes !== "" ? Number(inMinutes) : null;
  if (!Number.isFinite(inVal)) return "";
  return ` (late in ${formatGraceDurationLabel(inVal)})`;
}

/**
 * Maps a row from GET /get-events ({ events: [...] }) to the UI card/list shape.
 * Supports DB snake_case (am_time_in, …) and legacy camelCase from forms.
 */
export function mapServerEventToDisplay(raw: ServerEventRaw | null | undefined): DisplayEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const amIn = raw.am_time_in ?? raw.amTimeIn ?? null;
  const amOut = raw.am_time_out ?? raw.amTimeOut ?? null;
  const pmIn = raw.pm_time_in ?? raw.pmTimeIn ?? null;
  const pmOut = raw.pm_time_out ?? raw.pmTimeOut ?? null;
  const amGraceIn =
    raw.am_grace_in ?? raw.am_grace_in_minutes ?? raw.amGraceInMinutes ?? raw.am_grace_period ?? raw.amGraceMinutes ?? null;
  const amGraceOut =
    raw.am_grace_out ?? raw.am_grace_out_minutes ?? raw.amGraceOutMinutes ?? raw.am_grace_period ?? raw.amGraceMinutes ?? null;
  const pmGraceIn =
    raw.pm_grace_in ?? raw.pm_grace_in_minutes ?? raw.pmGraceInMinutes ?? raw.pm_grace_period ?? raw.pmGraceMinutes ?? null;
  const pmGraceOut =
    raw.pm_grace_out ?? raw.pm_grace_out_minutes ?? raw.pmGraceOutMinutes ?? raw.pm_grace_period ?? raw.pmGraceMinutes ?? null;

  const slots = [];
  const amLabel = scheduleSlotLabel(amIn, amOut);
  if (amLabel) slots.push(`${amLabel}${graceLabel(amGraceIn, amGraceOut)}`);
  const pmLabel = scheduleSlotLabel(pmIn, pmOut);
  if (pmLabel) slots.push(`${pmLabel}${graceLabel(pmGraceIn, pmGraceOut)}`);

  const timeSlots =
    raw.time_slots ??
    raw.timeSlots ??
    (slots.length ? slots.join(", ") : "");

  const audiences = normalizeEvAudiences(raw.audiences);

  const eventModeRaw = String(raw.event_mode ?? "").trim().toUpperCase();
  const timeInOnlyFlag =
    eventModeRaw === "TIME_IN_ONLY" ||
    raw.time_in_only === true ||
    raw.time_in_only === 1 ||
    raw.time_in_only === "1" ||
    raw.timeInOnly === true ||
    raw.timeInOnly === 1 ||
    raw.timeInOnly === "1";
  const event_mode: "TIME_IN_OUT" | "TIME_IN_ONLY" = timeInOnlyFlag
    ? "TIME_IN_ONLY"
    : "TIME_IN_OUT";

  const fineRaw = raw.fine_amount ?? raw.fineAmount ?? raw.fine;
  let fine = null;
  if (fineRaw != null && fineRaw !== "") {
    if (typeof fineRaw === "number" && Number.isFinite(fineRaw)) {
      fine = fineRaw;
    } else {
      const s = String(fineRaw).trim();
      if (s !== "") {
        const n = Number(s.replace(/,/g, ""));
        fine = Number.isFinite(n) ? n : s;
      }
    }
  }

  return {
    id: raw.id ?? raw._id ?? null,
    name: raw.name || "Untitled Event",
    icon: raw.icon || "📅",
    date: raw.date || "",
    duration: raw.duration || "",
    event_mode,
    time_in_only: event_mode === "TIME_IN_ONLY",
    venue: raw.venue || "",
    timeSlots,
    year_level: raw.year_level != null && String(raw.year_level).trim() !== "" ? String(raw.year_level).trim() : null,
    course_code:
      raw.course_code != null && String(raw.course_code).trim() !== ""
        ? String(raw.course_code).trim()
        : null,
    major:
      raw.major != null && String(raw.major).trim() !== "" && String(raw.major).trim().toLowerCase() !== "all majors"
        ? String(raw.major).trim()
        : null,
    department_name:
      raw.department_name != null && String(raw.department_name).trim() !== ""
        ? String(raw.department_name).trim()
        : raw.department != null && String(raw.department).trim() !== ""
          ? String(raw.department).trim()
          : null,
    am_grace_in: amGraceIn != null && amGraceIn !== "" ? Number(amGraceIn) : null,
    am_grace_out: amGraceOut != null && amGraceOut !== "" ? Number(amGraceOut) : null,
    pm_grace_in: pmGraceIn != null && pmGraceIn !== "" ? Number(pmGraceIn) : null,
    pm_grace_out: pmGraceOut != null && pmGraceOut !== "" ? Number(pmGraceOut) : null,
    amGraceInMinutes: amGraceIn != null && amGraceIn !== "" ? Number(amGraceIn) : null,
    amGraceOutMinutes: amGraceOut != null && amGraceOut !== "" ? Number(amGraceOut) : null,
    pmGraceInMinutes: pmGraceIn != null && pmGraceIn !== "" ? Number(pmGraceIn) : null,
    pmGraceOutMinutes: pmGraceOut != null && pmGraceOut !== "" ? Number(pmGraceOut) : null,
    am_time_in: amIn,
    am_time_out: amOut,
    pm_time_in: pmIn,
    pm_time_out: pmOut,
    amTimeInDisplay: formatSqlTimeForDisplay(amIn),
    amTimeOutDisplay: formatSqlTimeForDisplay(amOut),
    pmTimeInDisplay: formatSqlTimeForDisplay(pmIn),
    pmTimeOutDisplay: formatSqlTimeForDisplay(pmOut),
    reg: raw.reg ?? 0,
    attRate: raw.att_rate != null ? raw.att_rate : raw.attRate != null ? raw.attRate : null,
    fine,
    status:
      raw.status != null && String(raw.status).trim() !== ""
        ? String(raw.status).trim()
        : "Upcoming",
    audience_notes: raw.audience_notes ?? null,
    is_mandatory:
      raw.is_mandatory === true || raw.is_mandatory === 1 || raw.is_mandatory === "1",
    is_all_departments:
      raw.is_all_departments === true ||
      raw.is_all_departments === 1 ||
      raw.is_all_departments === "1",
    created_by: raw.created_by ?? null,
    created_by_username: raw.created_by_username ?? null,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
    audiences,
    source: raw.source != null && raw.source !== "" ? String(raw.source) : "api",
    requiresPassword:
      raw.requires_password === true ||
      raw.requiresPassword === true ||
      raw.has_attendance_password === true ||
      raw.hasAttendancePassword === true,
  };
}

/** Fetches and normalizes every event from GET /get-events (shared by useGetEvents / useGetAllEvents). */
export async function getAllEvents(axiosConfig?: AxiosRequestConfig): Promise<DisplayEvent[]> {
  const { data } = await api.get("/get-events", axiosConfig);
  const rows = normalizeResponseToArray(data);
  return rows.map((row) => mapServerEventToDisplay(row)).filter((e): e is DisplayEvent => e != null);
}

export function useGetEvents(options: EventsListQueryOptions = {}) {
  return useEventsListQuery(options);
}

export function useGetAllEvents(options: EventsListQueryOptions = {}) {
  return useEventsListQuery(options);
}

/**
 * Maps stored `duration` + schedule fields to user-facing labels on the Events page.
 */

import type { DisplayEvent } from "../types/events";

type EventDurationInput = DisplayEvent | Record<string, unknown> | null | undefined;
export type SessionFilter = "whole" | "am_only" | "pm_only";

function slotPresent(inVal: unknown, outVal: unknown): boolean {
  const a = inVal != null && String(inVal).trim() !== "";
  const b = outVal != null && String(outVal).trim() !== "";
  return a || b;
}

function inferHalfDayFromTimeSlots(ev: EventDurationInput): SessionFilter | null {
  const ts = String(ev?.timeSlots ?? "").trim();
  if (!ts) return null;
  const hasAmTag = /(^|[,，\n]\s*)AM\s*:/i.test(ts);
  const hasPmTag = /(^|[,，\n]\s*)PM\s*:/i.test(ts);
  if (hasAmTag && !hasPmTag) return "am_only";
  if (hasPmTag && !hasAmTag) return "pm_only";
  const onlyAmTimes = /\d{1,2}:\d{2}\s*AM/i.test(ts) && !/\d{1,2}:\d{2}\s*PM/i.test(ts);
  const onlyPmTimes = /\d{1,2}:\d{2}\s*PM/i.test(ts) && !/\d{1,2}:\d{2}\s*AM/i.test(ts);
  if (onlyAmTimes && !onlyPmTimes) return "am_only";
  if (onlyPmTimes && !onlyAmTimes) return "pm_only";
  return null;
}

export function resolveEventDurationUi(ev: EventDurationInput): { label: string; sessionFilter: SessionFilter } {
  const d = String(ev?.duration ?? "").trim();
  const raw = (ev ?? {}) as Record<string, unknown>;

  const amIn = raw.am_time_in ?? raw.amTimeIn;
  const amOut = raw.am_time_out ?? raw.amTimeOut;
  const pmIn = raw.pm_time_in ?? raw.pmTimeIn;
  const pmOut = raw.pm_time_out ?? raw.pmTimeOut;
  const hasAm = slotPresent(amIn, amOut);
  const hasPm = slotPresent(pmIn, pmOut);

  if (d === "Whole Day") {
    return { label: "Whole Day", sessionFilter: "whole" };
  }
  if (d === "AM Only") {
    return { label: "AM Session", sessionFilter: "am_only" };
  }
  if (d === "PM Only") {
    return { label: "PM Session", sessionFilter: "pm_only" };
  }
  if (d === "Half Day") {
    if (hasAm && !hasPm) {
      return { label: "AM Session", sessionFilter: "am_only" };
    }
    if (!hasAm && hasPm) {
      return { label: "PM Session", sessionFilter: "pm_only" };
    }
    const fromSlots = inferHalfDayFromTimeSlots(ev);
    if (fromSlots === "am_only") {
      return { label: "AM Session", sessionFilter: "am_only" };
    }
    if (fromSlots === "pm_only") {
      return { label: "PM Session", sessionFilter: "pm_only" };
    }
    if (hasAm && hasPm) {
      return { label: "AM & PM", sessionFilter: "whole" };
    }
    return { label: "Half Day", sessionFilter: "whole" };
  }

  return { label: d || "—", sessionFilter: "whole" };
}

export function formatDurationForEventsList(ev: EventDurationInput): string {
  return resolveEventDurationUi(ev).label;
}

/**
 * Same labels as {@link formatDurationForEventsList}, but uses `sessionType` from the
 * attendance API (`"am"` | `"pm"` | `"whole_day"`) when `duration` is Half Day and the
 * client row has no `am_time_in` / `pm_time_in` (list/detail payloads often omit them).
 */
export function formatDurationForEventsListWithSessionHint(ev: EventDurationInput & { sessionType?: string }): string {
  const label = formatDurationForEventsList(ev);
  const d = String(ev?.duration ?? "").trim();
  if (d !== "Half Day" || label !== "Half Day") return label;
  const st = ev?.sessionType;
  if (st === "am") return "AM Session";
  if (st === "pm") return "PM Session";
  return label;
}

/**
 * Bucket for Events page session filter: whole day vs AM-only vs PM-only vs everything else.
 */
export function getEventSessionKindForFilter(ev: EventDurationInput): string {
  const { sessionFilter, label } = resolveEventDurationUi(ev);
  if (sessionFilter === "am_only") return "am";
  if (sessionFilter === "pm_only") return "pm";
  const d = String(ev?.duration ?? "").trim();
  if (d === "Whole Day") return "whole";
  if (label === "AM & PM") return "whole";
  return "other";
}

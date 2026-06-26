/** Shared 12-hour time dropdown options (same as Add Event). */

export function formatTime12FromTotalMinutes(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/** Minute-of-day marks for AM session dropdown (5:00 AM … 12:00 PM). */
export const AM_SESSION_MINUTE_MARKS = (() => {
  const marks = [];
  for (let m = 5 * 60; m <= 11 * 60 + 45; m += 15) {
    marks.push(m);
  }
  for (const m of [11 * 60 + 50, 11 * 60 + 55, 11 * 60 + 59, 12 * 60]) {
    marks.push(m);
  }
  return marks;
})();

export const AM_SESSION_TIME_OPTIONS = AM_SESSION_MINUTE_MARKS.map((m) =>
  formatTime12FromTotalMinutes(m),
);

/** AM session time-out only — includes 1:00 PM after the usual AM marks. */
export const AM_SESSION_TIME_OUT_OPTIONS = [...AM_SESSION_TIME_OPTIONS, "1:00 PM"];

export const PM_SESSION_TIME_OPTIONS = (() => {
  const options = [];
  for (let m = 12 * 60; m < 24 * 60; m += 15) {
    options.push(formatTime12FromTotalMinutes(m));
  }
  options.push("12:00 AM");
  return options;
})();

/**
 * Native `<select>`: symmetric padding often looks off-center; use tight left inset +
 * `text-align-last` so the chosen time reads flush left (Chrome/Safari/Firefox).
 */
export const EVENT_TIME_SELECT_CLASS =
  "block w-full min-w-0 cursor-pointer rounded-lg border border-gray-300 bg-white py-2 pl-2 pr-10 text-left text-sm text-[#07713c] [direction:ltr] [text-align-last:left] focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55";

function parseSqlToMinutes(sql: unknown): number | null {
  if (sql == null || String(sql).trim() === "") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(sql).trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Backend SQL time → dropdown value (AM: snap to nearest allowed mark up to 11:59 AM; PM: 15 min steps).
 */
export function sqlTimeToSessionSelectValue(sql: unknown, session: "am" | "pm"): string {
  const mins = parseSqlToMinutes(sql);
  if (mins == null) return "";

  if (session === "am") {
    const minM = 5 * 60;
    const maxM = 12 * 60;
    const clamped = Math.max(minM, Math.min(maxM, mins));
    let nearest = AM_SESSION_MINUTE_MARKS[0];
    let best = Infinity;
    for (const mark of AM_SESSION_MINUTE_MARKS) {
      const d = Math.abs(clamped - mark);
      if (d < best) {
        best = d;
        nearest = mark;
      }
    }
    return formatTime12FromTotalMinutes(nearest);
  }

  if (mins === 0) return "12:00 AM";

  const minM = 12 * 60;
  const maxM = 24 * 60;
  let clamped = Math.max(minM, Math.min(maxM, mins));
  clamped = Math.round(clamped / 15) * 15;
  if (clamped >= maxM) return "12:00 AM";
  return formatTime12FromTotalMinutes(clamped);
}

/** Late grace: hour part (0–12). */
export const GRACE_HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i);

/** Late grace: minute part (0–59). */
export const GRACE_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

/** Combine hour + minute dropdowns → total minutes for `am_grace_in` / `pm_grace_in`. */
export function graceTotalMinutes(hours: unknown, minutes: unknown): number {
  const h = Math.max(0, Math.min(12, Number(hours) || 0));
  const m = Math.max(0, Math.min(59, Number(minutes) || 0));
  return h * 60 + m;
}

const GRACE_MAX_TOTAL_MINUTES = 12 * 60 + 59;

/** Stored API minutes → hour/minute parts for dropdowns (capped at 12h 59m). */
export function splitGraceTotalMinutes(total: unknown): { hours: number; minutes: number } {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const capped = Math.min(t, GRACE_MAX_TOTAL_MINUTES);
  const hours = Math.floor(capped / 60);
  const minutes = capped % 60;
  return { hours, minutes };
}

/** Human-readable grace for confirm screen (e.g. "1 hr 15 mins", "45 mins"). */
export function formatGraceDurationLabel(totalMinutes: unknown): string {
  const n = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return `${m} min${m === 1 ? "" : "s"}`;
  if (m === 0) return `${h} hr${h === 1 ? "" : "s"}`;
  return `${h} hr${h === 1 ? "" : "s"} ${m} min${m === 1 ? "" : "s"}`;
}

/** "8:00 AM" → `HH:MM:SS` for API / mapper */
export function twelveHourLabelToSqlTime(label: unknown): string | null {
  if (label == null || String(label).trim() === "") return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(label).trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === "AM") {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

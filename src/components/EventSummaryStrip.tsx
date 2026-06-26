import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import type { DisplayEvent } from "../types/events";

type TimeRange = {
  start: string;
  end: string;
};

type EventSummaryStripProps = {
  event?: DisplayEvent | null;
  onClick?: () => void;
};

function parseStartEndFromTimeSlots(timeSlots: string | null | undefined): TimeRange {
  if (!timeSlots || typeof timeSlots !== "string") {
    return { start: "—", end: "—" };
  }
  const re =
    /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[\u2013\u2014\-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/gi;
  const ranges: TimeRange[] = [];
  let m = re.exec(timeSlots);
  while (m) {
    ranges.push({
      start: m[1].replace(/\s+/g, " ").trim(),
      end: m[2].replace(/\s+/g, " ").trim(),
    });
    m = re.exec(timeSlots);
  }
  if (ranges.length === 0) return { start: "—", end: "—" };
  return { start: ranges[0].start, end: ranges[ranges.length - 1].end };
}

const stripClass =
  "rounded-xl bg-[#C8E6C9] px-4 py-4 sm:px-6 sm:py-5 shadow-md w-full text-left";

/**
 * Pale green horizontal strip: Event, Date, Start/End time, Venue, Status.
 * Optional `onClick` when `event` is set (e.g. open detail modal on home).
 */
export default function EventSummaryStrip({ event: ev, onClick }: EventSummaryStripProps) {
  const { start, end } = ev ? parseStartEndFromTimeSlots(ev.timeSlots) : { start: "—", end: "—" };
  const status = ev?.status != null && String(ev.status) !== "" ? String(ev.status) : "—";
  const clickable = typeof onClick === "function" && ev != null;

  const grid = (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-6">
        {[
          { label: "Event", value: ev?.name ?? "—" },
          { label: "Date", value: ev ? formatEventDateForDisplay(ev.date) : "—" },
          { label: "Start time", value: start },
          { label: "End time", value: end },
          { label: "Venue", value: ev?.venue ?? "—" },
          { label: "Status", value: status, bold: true },
        ].map((col) => (
          <div key={col.label} className="min-w-0 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#36454F]/65">
              {col.label}
            </p>
            <p
              className={`mt-1.5 text-base text-gray-900 leading-snug break-words ${
                col.bold ? "font-bold" : "font-medium"
              }`}
            >
              {col.value}
            </p>
          </div>
        ))}
      </div>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${stripClass} cursor-pointer transition hover:brightness-[0.97] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008000] focus-visible:ring-offset-2`}
        aria-label={`View full details for ${ev?.name ?? "event"}`}
      >
        {grid}
      </button>
    );
  }

  return <div className={stripClass}>{grid}</div>;
}

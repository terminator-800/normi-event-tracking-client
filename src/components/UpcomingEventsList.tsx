import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import type { DisplayEvent } from "../types/events";

type UpcomingEventsListProps = {
  events?: DisplayEvent[];
  isLoading?: boolean;
  onEventClick?: (event: DisplayEvent) => void;
  emptyMessage?: string;
  limit?: number;
};

export default function UpcomingEventsList({
  events = [],
  isLoading = false,
  onEventClick,
  emptyMessage = "No upcoming events scheduled.",
  limit,
}: UpcomingEventsListProps) {
  const shownEvents = Number.isFinite(limit) ? events.slice(0, limit) : events;

  if (isLoading) {
    return <p className="text-sm text-[#07713c]/75">Loading events…</p>;
  }

  if (!shownEvents.length) {
    return <p className="text-sm text-[#07713c]/75">{emptyMessage}</p>;
  }

  return (
    <ul className="grid gap-3 grid-cols-1">
      {shownEvents.map((ev) => (
        <li key={ev.id ?? `${ev.name}-${ev.date}`}>
          <p className="mb-1.5 px-1 text-base font-semibold text-[#07713c]/90">
            {formatEventDateForDisplay(ev.date)}
          </p>
          <button
            type="button"
            onClick={() => onEventClick?.(ev)}
            className="w-full overflow-hidden rounded-xl border border-[#07713c]/30 bg-[#f6fff8] text-left shadow-sm transition hover:border-[#07713c]/45 hover:bg-[#eefaf2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07713c] focus-visible:ring-offset-2"
          >
            <div className="border-b border-[#07713c]/20 bg-gradient-to-r from-[#e9f8ee] to-[#f6fff8] px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-1 text-base font-semibold leading-snug text-[#07713c]">{ev.name}</span>
                <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Upcoming
                </span>
              </div>
            </div>
            <div className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                    ev.is_mandatory ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {ev.is_mandatory ? "Mandatory" : "Not mandatory"}
                </span>
                {ev.fine != null && Number(ev.fine) > 0 && (
                  <span className="rounded-full bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700">
                    Fines: ₱{Number(ev.fine)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm text-[#07713c]/85 sm:grid-cols-2">
                <p className="truncate">
                  <span className="font-semibold text-[#07713c]">Session:</span>{" "}
                  {ev.duration || "—"}
                </p>
                <p className="truncate text-[#07713c]/85">{ev.venue || "—"}</p>
                <p className="truncate sm:col-span-2">
                  <span className="font-semibold text-[#07713c]">Schedule:</span>{" "}
                  {ev.timeSlots || "—"}
                </p>
                {ev.audience_notes && String(ev.audience_notes).trim() !== "" && (
                  <p className="truncate sm:col-span-2">
                    <span className="font-semibold text-[#07713c]">Notes:</span>{" "}
                    {String(ev.audience_notes).trim()}
                  </p>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

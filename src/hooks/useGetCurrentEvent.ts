import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { CurrentEventBundle, DisplayEvent, ServerEventRaw } from "../types/events";
import {
  mapServerEventToDisplay,
  selectActiveOrUpcomingEvent,
  eventDateMs,
} from "./useGetEvents";

export const CURRENT_EVENT_QUERY_KEY = ["events", "current"];

function normalizeRawRows(data: unknown): ServerEventRaw[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as ServerEventRaw[];
  if (typeof data !== "object") return [];

  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.events)) return obj.events as ServerEventRaw[];

  if (Array.isArray(obj.data)) return obj.data as ServerEventRaw[];

  const nested = obj.data;
  if (nested && typeof nested === "object" && Array.isArray((nested as Record<string, unknown>).events)) {
    return (nested as Record<string, unknown>).events as ServerEventRaw[];
  }

  const upcomingFrom = (v: unknown) => (Array.isArray(v) ? (v as ServerEventRaw[]) : []);

  if (obj.event != null && typeof obj.event === "object") {
    const rows = [obj.event as ServerEventRaw];
    rows.push(...upcomingFrom(obj.upcoming ?? obj.upcoming_events ?? obj.upcomingEvents));
    return rows;
  }

  if (nested != null && typeof nested === "object" && !Array.isArray(nested)) {
    const inner = nested as Record<string, unknown>;
    if (inner.event != null) {
      const rows = [inner.event as ServerEventRaw];
      rows.push(...upcomingFrom(inner.upcoming ?? inner.upcoming_events));
      return rows;
    }
    if (inner.name != null || inner.date != null || inner.id != null) {
      return [inner as ServerEventRaw];
    }
  }

  if (obj.name != null || obj.date != null || obj.id != null) {
    const rows = [obj as ServerEventRaw];
    rows.push(...upcomingFrom(obj.upcoming ?? obj.upcoming_events));
    return rows;
  }

  return [];
}

async function fetchCurrentEventBundle(): Promise<CurrentEventBundle> {
  const { data } = await api.get("/get-current-event");

  console.log("[useGetCurrentEvent] raw data:", data);

  const rawRows = normalizeRawRows(data);

  console.log("[useGetCurrentEvent] rawRows:", rawRows.map(e => ({
    id: e.id,
    name: e.name,
    status: e.status,
    date: e.date,
  })));

  const mapped = rawRows
    .map((row) => mapServerEventToDisplay(row))
    .filter((e): e is DisplayEvent => e != null);

  console.log("[useGetCurrentEvent] mapped:", mapped.map(e => ({
    id: e.id,
    name: e.name,
    status: e.status,
    date: e.date,
  })));

  if (mapped.length === 0) {
    return { current: null, upcoming: [], ongoing: [] };
  }

  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

  const ongoing = mapped
    .filter((e) => {
      const s = norm(e.status);
      return s === "ongoing" || s === "active";
    })
    .sort((a, b) => eventDateMs(a.date) - eventDateMs(b.date));

  const current =
    ongoing[0] ??
    mapped
      .filter((e) => norm(e.status) === "upcoming")
      .sort((a, b) => eventDateMs(a.date) - eventDateMs(b.date))[0] ??
    null;

  const upcoming = mapped
    .filter((e) => norm(e.status) === "upcoming")
    .sort((a, b) => eventDateMs(a.date) - eventDateMs(b.date));

  console.log("[useGetCurrentEvent] current:", { id: current?.id, name: current?.name, status: current?.status });
  console.log("[useGetCurrentEvent] ongoing:", ongoing.map(e => ({ id: e.id, name: e.name, status: e.status })));
  console.log("[useGetCurrentEvent] upcoming:", upcoming.map(e => ({ id: e.id, name: e.name, status: e.status })));

  return { current, upcoming, ongoing };
}

type CurrentEventQueryOptions = Omit<UseQueryOptions<CurrentEventBundle>, "queryKey" | "queryFn">;

export function useGetCurrentEvent(options: CurrentEventQueryOptions = {}) {
  return useQuery({
    queryKey: CURRENT_EVENT_QUERY_KEY,
    queryFn: fetchCurrentEventBundle,
    staleTime: 30_000,
    ...options,
  });
}

// Re-export for consumers that only need the selector
export { selectActiveOrUpcomingEvent };

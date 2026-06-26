import { useQuery } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import {
  mapServerEventToDisplay,
  selectActiveOrUpcomingEvent,
  eventDateMs,
} from "./useGetEvents";

export const CURRENT_EVENT_QUERY_KEY = ["events", "current"];

function normalizeRawRows(data) {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data !== "object") return [];
  if (Array.isArray(data.events)) return data.events;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && typeof data.data === "object" && Array.isArray(data.data.events)) {
    return data.data.events;
  }

  const upcomingFrom = (v) => (Array.isArray(v) ? v : []);

  if (data.event != null && typeof data.event === "object") {
    const rows = [data.event];
    rows.push(...upcomingFrom(data.upcoming ?? data.upcoming_events ?? data.upcomingEvents));
    return rows;
  }

  if (data.data != null && typeof data.data === "object" && !Array.isArray(data.data)) {
    const inner = data.data;
    if (inner.event != null) {
      const rows = [inner.event];
      rows.push(...upcomingFrom(inner.upcoming ?? inner.upcoming_events));
      return rows;
    }
    if (inner.name != null || inner.date != null || inner.id != null) {
      return [inner];
    }
  }

  if (data.name != null || data.date != null || data.id != null) {
    const rows = [data];
    rows.push(...upcomingFrom(data.upcoming ?? data.upcoming_events));
    return rows;
  }

  return [];
}

async function fetchCurrentEventBundle() {
  const { data } = await api.get("/get-current-event");

  console.log("[useGetCurrentEvent] raw data:", data);

  const rawRows = normalizeRawRows(data);

  console.log("[useGetCurrentEvent] rawRows:", rawRows.map(e => ({
    id: e.id,
    name: e.name,
    status: e.status,
    date: e.date,
  })));

  const mapped = rawRows.map((row) => mapServerEventToDisplay(row)).filter(Boolean);

  console.log("[useGetCurrentEvent] mapped:", mapped.map(e => ({
    id: e.id,
    name: e.name,
    status: e.status,
    date: e.date,
  })));

  if (mapped.length === 0) {
    return { current: null, upcoming: [], ongoing: [] };
  }

  const norm = (s) => String(s ?? "").trim().toLowerCase();

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

export function useGetCurrentEvent(options = {}) {
  return useQuery({
    queryKey: CURRENT_EVENT_QUERY_KEY,
    queryFn: fetchCurrentEventBundle,
    staleTime: 30_000,
    ...options,
  });
}
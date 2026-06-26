import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import api from "../api/axiosInstance";

export const ATTENDANCE_PAGE_EVENTS_KEY = ["attendance-page", "events"];

function apiBaseUrl(): string {
  const b = api.defaults.baseURL;
  if (b && String(b).trim()) return String(b).replace(/\/$/, "");
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase && String(envBase).trim()) return String(envBase).replace(/\/$/, "");
  return "http://localhost:5000";
}

export async function fetchAttendancePageEvents(): Promise<unknown> {
  const { data } = await api.get("/attendance/page/events");
  return data;
}

type AttendancePageEventsOptions = {
  enableStream?: boolean;
};

/**
 * Loads attendance dashboard event summaries (GET) and keeps them fresh via Server-Sent Events
 * (`GET /attendance/page/stream`) — snapshots every few seconds from the server.
 */
export function useAttendancePageEvents({ enableStream = true }: AttendancePageEventsOptions = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ATTENDANCE_PAGE_EVENTS_KEY,
    queryFn: fetchAttendancePageEvents,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!enableStream) return undefined;

    const url = `${apiBaseUrl()}/attendance/page/stream`;
    let es: EventSource | undefined;
    try {
      es = new EventSource(url, { withCredentials: true });
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          queryClient.setQueryData(ATTENDANCE_PAGE_EVENTS_KEY, payload);
        } catch {
          /* ignore malformed chunk */
        }
      };
      es.onerror = () => {
        /* browser will retry; optional: could trigger refetch */
      };
    } catch {
      /* EventSource unsupported */
    }

    return () => {
      if (es) es.close();
    };
  }, [enableStream, queryClient]);

  return query;
}

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export function attendancePageEventDetailKey(eventId: string | number) {
  return ["attendance-page", "event", eventId];
}

export async function fetchAttendancePageEventDetail(eventId: string | number): Promise<unknown> {
  const { data } = await api.get(`/attendance/page/events/${encodeURIComponent(String(eventId))}`);
  const obj = data as Record<string, unknown>;
  return obj.event;
}

type EventDetailOptions = Omit<UseQueryOptions<unknown>, "queryKey" | "queryFn"> & {
  enabled?: boolean;
};

/**
 * Full event with `students` rows (times + fines) for the event detail / student list views.
 */
export function useAttendancePageEventDetail(eventId: string | number, options: EventDetailOptions = {}) {
  const { enabled = true, ...rest } = options;
  return useQuery({
    queryKey: attendancePageEventDetailKey(eventId),
    queryFn: () => fetchAttendancePageEventDetail(eventId),
    enabled: Boolean(eventId) && enabled,
    staleTime: 15_000,
    ...rest,
  });
}

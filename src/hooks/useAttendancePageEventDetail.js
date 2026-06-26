import { useQuery } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export const attendancePageEventDetailKey = (eventId) => ["attendance-page", "event", eventId];

export async function fetchAttendancePageEventDetail(eventId) {
  const { data } = await api.get(`/attendance/page/events/${encodeURIComponent(eventId)}`);
  return data.event;
}

/**
 * Full event with `students` rows (times + fines) for the event detail / student list views.
 */
export function useAttendancePageEventDetail(eventId, options = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: attendancePageEventDetailKey(eventId),
    queryFn: () => fetchAttendancePageEventDetail(eventId),
    enabled: Boolean(eventId) && enabled,
    staleTime: 15_000,
  });
}

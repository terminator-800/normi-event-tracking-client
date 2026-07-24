import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { ApiAxiosError } from "../types/api";
import { CURRENT_EVENT_QUERY_KEY } from "./useGetCurrentEvent";
import { EVENTS_QUERY_KEY } from "./useGetEvents";

export type UpdateEventTimeoutPayload = {
  am_time_out?: string | null;
  pm_time_out?: string | null;
};

type UpdateEventTimeoutVariables = {
  id: string | number;
  payload: UpdateEventTimeoutPayload;
};

export function useUpdateEventTimeout() {
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiAxiosError, UpdateEventTimeoutVariables>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/update/events/${id}/timeout`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CURRENT_EVENT_QUERY_KEY });
    },
  });
}

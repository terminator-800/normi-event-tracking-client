import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { CURRENT_EVENT_QUERY_KEY } from "./useGetCurrentEvent";
import { EVENTS_QUERY_KEY } from "./useGetEvents";

export function useEditEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/update/events/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CURRENT_EVENT_QUERY_KEY });
    },
  });
}


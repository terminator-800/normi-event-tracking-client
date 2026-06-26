import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { ApiAxiosError } from "../types/api";
import { CURRENT_EVENT_QUERY_KEY } from "./useGetCurrentEvent";
import { EVENTS_QUERY_KEY } from "./useGetEvents";

type DeleteEventVariables = { id: string | number };

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiAxiosError, DeleteEventVariables>({
    mutationFn: async ({ id }) => {
      const { data } = await api.delete(`/delete/events/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CURRENT_EVENT_QUERY_KEY });
    },
  });
}

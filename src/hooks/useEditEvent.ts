import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { ApiAxiosError } from "../types/api";
import type { AddEventPayload } from "../types/events";
import { CURRENT_EVENT_QUERY_KEY } from "./useGetCurrentEvent";
import { EVENTS_QUERY_KEY } from "./useGetEvents";

type EditEventVariables = { id: string | number; payload: AddEventPayload };

export function useEditEvent() {
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiAxiosError, EditEventVariables>({
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

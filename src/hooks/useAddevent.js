import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { CURRENT_EVENT_QUERY_KEY } from "./useGetCurrentEvent";
import { EVENTS_QUERY_KEY } from "./useGetEvents";

export function useAddevent() {
  const queryClient = useQueryClient();
  return useMutation({
    onMutate: (variables) => {
      console.warn("[useAddevent] onMutate called with:", variables);
      if (typeof window !== "undefined") {
        window.__lastAddEventPayload = variables;
      }
    },
    mutationFn: async (eventData) => {
      console.log("[useAddevent] Payload to /create/events:", eventData);
      const { data } = await api.post("/create/events", eventData);
      console.log("[useAddevent] Response from /create/events:", data);
      return data;
    },
    onSuccess: (data, variables) => {
      console.log("[useAddevent] Mutation success.", { data, variables });
      queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CURRENT_EVENT_QUERY_KEY });
    },
    onError: (error, variables) => {
      console.error("[useAddevent] Mutation error.", {
        message: error?.message,
        status: error?.response?.status,
        response: error?.response?.data,
        variables,
      });
    },
  });
}


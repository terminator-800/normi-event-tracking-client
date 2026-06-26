import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { EVENTS_QUERY_KEY } from "./useGetEvents";
import { CURRENT_EVENT_QUERY_KEY } from "./useGetCurrentEvent";
import { PAYMENTS_QUERY_KEY, PAYMENTS_SUMMARY_QUERY_KEY } from "./useGetPayments";

export const DATA_RESET_PREVIEW_QUERY_KEY = ["admin", "data-reset", "preview"];
export const DATA_RESET_CONFIRMATION_PHRASE = "RESET ALL DATA";

async function fetchDataResetPreview() {
  const { data } = await api.get("/admin/data-reset/preview");
  return data?.counts ?? null;
}

async function postDataReset(confirmation) {
  const { data } = await api.post("/admin/data-reset", { confirmation });
  return data;
}

export function useDataResetPreview(options = {}) {
  return useQuery({
    queryKey: DATA_RESET_PREVIEW_QUERY_KEY,
    queryFn: fetchDataResetPreview,
    staleTime: 15_000,
    ...options,
  });
}

export function useDataReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postDataReset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DATA_RESET_PREVIEW_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CURRENT_EVENT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_SUMMARY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

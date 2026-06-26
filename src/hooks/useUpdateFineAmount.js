import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { patchPaymentsStudentInCache, PAYMENTS_SUMMARY_QUERY_KEY } from "./useGetPayments";

export function useUpdateFineAmount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fineId, amount }) => {
      const { data } = await api.put(`/payments/fines/${fineId}`, { amount });
      return data;
    },
    onSuccess: (data) => {
      if (data?.student) {
        patchPaymentsStudentInCache(queryClient, data.student);
      }
      queryClient.invalidateQueries({ queryKey: PAYMENTS_SUMMARY_QUERY_KEY });
    },
  });
}

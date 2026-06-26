import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { ApiAxiosError } from "../types/api";
import { patchPaymentsStudentInCache, PAYMENTS_SUMMARY_QUERY_KEY } from "./useGetPayments";

type UpdateFineVariables = { fineId: string | number; amount: number };

type PaymentMutationResponse = { student?: Record<string, unknown> };

export function useUpdateFineAmount() {
  const queryClient = useQueryClient();

  return useMutation<PaymentMutationResponse, ApiAxiosError, UpdateFineVariables>({
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

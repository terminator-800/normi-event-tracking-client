import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { ApiAxiosError } from "../types/api";
import { patchPaymentsStudentInCache, PAYMENTS_SUMMARY_QUERY_KEY } from "./useGetPayments";

type SetBalanceVariables = { studentId: string; targetBalance: number };

type PaymentMutationResponse = { student?: Record<string, unknown> };

export function useSetStudentBalance() {
  const queryClient = useQueryClient();

  return useMutation<PaymentMutationResponse, ApiAxiosError, SetBalanceVariables>({
    mutationFn: async ({ studentId, targetBalance }) => {
      const { data } = await api.put(`/payments/students/${studentId}/balance`, { targetBalance });
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

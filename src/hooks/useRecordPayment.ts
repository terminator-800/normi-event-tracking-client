import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { ApiAxiosError } from "../types/api";
import { patchPaymentsStudentInCache, PAYMENTS_SUMMARY_QUERY_KEY, PAYMENTS_TRANSACTIONS_QUERY_KEY } from "./useGetPayments";

type RecordPaymentVariables = {
  studentId: string;
  amountPaid: number;
  paymentMethod?: string;
  remarks?: string;
};

type RecordPaymentResponse = {
  student?: Record<string, unknown>;
};

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation<RecordPaymentResponse, ApiAxiosError, RecordPaymentVariables>({
    mutationFn: async ({ studentId, amountPaid, paymentMethod = "Cash", remarks = "" }) => {
      const { data } = await api.post("/payments/record", {
        studentId,
        amountPaid,
        paymentMethod,
        remarks,
      });
      return data;
    },
    onSuccess: (data) => {
      if (data?.student) {
        patchPaymentsStudentInCache(queryClient, data.student);
      }
      queryClient.invalidateQueries({ queryKey: PAYMENTS_SUMMARY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_TRANSACTIONS_QUERY_KEY });
    },
  });
}

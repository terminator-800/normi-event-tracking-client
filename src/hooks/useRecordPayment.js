import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { patchPaymentsStudentInCache, PAYMENTS_SUMMARY_QUERY_KEY, PAYMENTS_TRANSACTIONS_QUERY_KEY } from "./useGetPayments";

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
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

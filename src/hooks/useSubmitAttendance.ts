import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { ApiAxiosError } from "../types/api";

type SubmitAttendancePayload = Record<string, unknown>;

async function submitAttendance(payload: SubmitAttendancePayload) {
  const { data } = await api.post("/attendance/time-in-out", payload);
  return data;
}

type SubmitAttendanceCallbacks = {
  onSuccess?: UseMutationOptions<unknown, ApiAxiosError, SubmitAttendancePayload>["onSuccess"];
  onError?: UseMutationOptions<unknown, ApiAxiosError, SubmitAttendancePayload>["onError"];
};

export function useSubmitAttendance({ onSuccess, onError }: SubmitAttendanceCallbacks = {}) {
  return useMutation<unknown, ApiAxiosError, SubmitAttendancePayload>({
    mutationFn: submitAttendance,
    onSuccess,
    onError,
  });
}

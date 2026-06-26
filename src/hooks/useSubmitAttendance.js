// hooks/useSubmitAttendance.js
import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";

async function submitAttendance(payload) {
  const { data } = await api.post("/attendance/time-in-out", payload);

  return data;
}

export function useSubmitAttendance({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: submitAttendance,
    onSuccess: (data) => {
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
  });
}
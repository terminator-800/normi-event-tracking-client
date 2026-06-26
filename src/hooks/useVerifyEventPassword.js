import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";

async function verifyEventPassword({ eventId, password }) {
  const { data } = await api.post("/attendance/verify-event-password", {
    eventId,
    password,
  });
  return data;
}

export function useVerifyEventPassword({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: verifyEventPassword,
    onSuccess: (data, variables) => {
      onSuccess?.(data, variables);
    },
    onError: (error) => {
      onError?.(error);
    },
  });
}

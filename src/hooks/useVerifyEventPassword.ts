import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { ApiAxiosError } from "../types/api";

type VerifyPasswordVariables = { eventId: string | number; password: string };

async function verifyEventPassword({ eventId, password }: VerifyPasswordVariables) {
  const { data } = await api.post("/attendance/verify-event-password", {
    eventId,
    password,
  });
  return data;
}

type VerifyPasswordCallbacks = {
  onSuccess?: UseMutationOptions<unknown, ApiAxiosError, VerifyPasswordVariables>["onSuccess"];
  onError?: UseMutationOptions<unknown, ApiAxiosError, VerifyPasswordVariables>["onError"];
};

export function useVerifyEventPassword({ onSuccess, onError }: VerifyPasswordCallbacks = {}) {
  return useMutation<unknown, ApiAxiosError, VerifyPasswordVariables>({
    mutationFn: verifyEventPassword,
    onSuccess,
    onError,
  });
}

import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export async function changeOwnPassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/change-password", payload);
  return data;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: changeOwnPassword,
  });
}

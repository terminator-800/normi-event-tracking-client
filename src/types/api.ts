import type { AxiosError } from "axios";

export type ApiErrorBody = {
  message?: string;
  error?: string;
};

export type ApiAxiosError = AxiosError<ApiErrorBody>;

export function isApiAxiosError(error: unknown): error is ApiAxiosError {
  return typeof error === "object" && error !== null && "isAxiosError" in error;
}

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (isApiAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      if (typeof data.message === "string" && data.message.trim()) return data.message;
      if (typeof data.error === "string" && data.error.trim()) return data.error;
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export type AuthUser = {
  role?: string;
  username?: string;
  full_name?: string;
  fullName?: string;
  data?: { role?: string };
};

export type AuthSession = {
  role?: string;
  username?: string;
  full_name?: string;
  fullName?: string;
  user?: AuthUser;
  data?: { role?: string; user?: AuthUser; username?: string; full_name?: string };
  profile?: { role?: string; full_name?: string };
  me?: { role?: string };
  claims?: { role?: string };
  departmentSession?: AuthSession | null;
  authenticated?: boolean;
};

export type DepartmentRecord = {
  id?: number | string;
  name?: string;
  code?: string;
};

export type UserRecord = {
  id?: number | string;
  username?: string;
  full_name?: string;
  fullName?: string;
  role?: string;
  department?: string;
  major?: string;
};

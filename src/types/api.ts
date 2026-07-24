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
  department_id?: number | null;
  department_code?: string | null;
  department_name?: string | null;
  data?: { role?: string };
};

export type AcademicPeriodRecord = {
  id: number;
  school_year: string;
  semester: "1st sem" | "2nd sem" | "summer";
  status: "draft" | "active" | "archived";
  label?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  activated_at?: string | null;
  activated_by_user_id?: number | null;
  activated_by_username?: string | null;
  created_by_user_id?: number | null;
  created_by_username?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AuthSession = {
  role?: string;
  username?: string;
  full_name?: string;
  fullName?: string;
  department_id?: number | null;
  department_code?: string | null;
  department_name?: string | null;
  user?: AuthUser;
  activeAcademicPeriod?: AcademicPeriodRecord | null;
  data?: {
    role?: string;
    user?: AuthUser;
    username?: string;
    full_name?: string;
    department_code?: string;
    department_name?: string;
  };
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
  department_id?: number | null;
  department_name?: string | null;
  major?: string;
};

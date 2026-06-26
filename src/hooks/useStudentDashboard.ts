import { keepPreviousData, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export const STUDENT_DASHBOARD_QUERY_KEY = ["dashboard", "students"];

type StudentListOptions = Omit<UseQueryOptions<Record<string, unknown>[]>, "queryKey" | "queryFn">;

export function useStudentDashboardList(options: StudentListOptions = {}) {
  return useQuery({
    queryKey: STUDENT_DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get("/dashboard/students");
      const obj = data as Record<string, unknown>;
      return Array.isArray(obj?.students) ? (obj.students as Record<string, unknown>[]) : [];
    },
    staleTime: 30_000,
    ...options,
  });
}

type StudentDetailOptions = Omit<UseQueryOptions<unknown>, "queryKey" | "queryFn">;

export function useStudentDashboardDetail(studentId: string, options: StudentDetailOptions = {}) {
  return useQuery({
    queryKey: [...STUDENT_DASHBOARD_QUERY_KEY, studentId],
    queryFn: async () => {
      const { data } = await api.get(`/dashboard/students/${encodeURIComponent(studentId)}`);
      return data;
    },
    enabled: Boolean(studentId),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    ...options,
  });
}

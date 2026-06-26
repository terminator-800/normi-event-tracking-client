import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export const STUDENT_DASHBOARD_QUERY_KEY = ["dashboard", "students"];

export function useStudentDashboardList(options = {}) {
  return useQuery({
    queryKey: STUDENT_DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get("/dashboard/students");
      return Array.isArray(data?.students) ? data.students : [];
    },
    staleTime: 30_000,
    ...options,
  });
}

export function useStudentDashboardDetail(studentId, options = {}) {
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

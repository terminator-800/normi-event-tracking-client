import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { AUTH_SESSION_QUERY_KEY } from "./auth";
import type { AcademicPeriodRecord } from "../types/api";

export const ACADEMIC_PERIODS_QUERY_KEY = ["academic-periods"];
export const ACTIVE_ACADEMIC_PERIOD_QUERY_KEY = ["academic-periods", "active"];

type CreateAcademicPeriodPayload = {
  schoolYear: string;
  semester: string;
  autoCreateSecondSemester?: boolean;
  label?: string;
  startsOn?: string;
  endsOn?: string;
};

type UpdateAcademicPeriodPayload = Partial<CreateAcademicPeriodPayload>;

async function fetchAcademicPeriods(): Promise<AcademicPeriodRecord[]> {
  const { data } = await api.get<{ periods: AcademicPeriodRecord[] }>("/academic-periods");
  return data.periods ?? [];
}

async function fetchActiveAcademicPeriod(): Promise<AcademicPeriodRecord | null> {
  try {
    const { data } = await api.get<{ period: AcademicPeriodRecord }>("/academic-periods/active");
    return data.period ?? null;
  } catch (error: unknown) {
    const status =
      typeof error === "object" && error !== null && "response" in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
    if (status === 404) return null;
    throw error;
  }
}

export function useAcademicPeriodsList(enabled = true) {
  return useQuery({
    queryKey: ACADEMIC_PERIODS_QUERY_KEY,
    queryFn: fetchAcademicPeriods,
    enabled,
  });
}

export function useActiveAcademicPeriod(enabled = true) {
  return useQuery({
    queryKey: ACTIVE_ACADEMIC_PERIOD_QUERY_KEY,
    queryFn: fetchActiveAcademicPeriod,
    enabled,
    staleTime: 30_000,
  });
}

function invalidateAcademicPeriodQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ACADEMIC_PERIODS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ACTIVE_ACADEMIC_PERIOD_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
}

export function useCreateAcademicPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAcademicPeriodPayload) => {
      const { data } = await api.post("/academic-periods", payload);
      return data;
    },
    onSuccess: () => invalidateAcademicPeriodQueries(queryClient),
  });
}

export function useUpdateAcademicPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UpdateAcademicPeriodPayload }) => {
      const { data } = await api.patch(`/academic-periods/${id}`, payload);
      return data;
    },
    onSuccess: () => invalidateAcademicPeriodQueries(queryClient),
  });
}

export function useActivateAcademicPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/academic-periods/${id}/activate`);
      return data;
    },
    onSuccess: () => invalidateAcademicPeriodQueries(queryClient),
  });
}

export function useDeleteAcademicPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/academic-periods/${id}`);
      return data;
    },
    onSuccess: () => invalidateAcademicPeriodQueries(queryClient),
  });
}

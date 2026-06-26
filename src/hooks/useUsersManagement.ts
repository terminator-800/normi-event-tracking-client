import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import axios from "../api/axiosInstance";
import type { DepartmentRecord, UserRecord } from "../types/api";

export const USERS_QUERY_KEY = ["users-management-list"];

export function useUsersList(enabled = true) {
  return useQuery<UserRecord[]>({
    queryKey: USERS_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const response = await axios.get("/users");
      return (response.data?.users ?? []) as UserRecord[];
    },
  });
}

type UpdateUserVariables = { id: string | number; payload: Record<string, unknown> };

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, UpdateUserVariables>({
    mutationFn: async ({ id, payload }) => {
      const response = await axios.put(`/users/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string | number>({
    mutationFn: async (id) => {
      const response = await axios.delete(`/users/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export const DEPARTMENTS_QUERY_KEY = ["departments-list"];

type DepartmentsQueryOptions = Omit<UseQueryOptions<DepartmentRecord[]>, "queryKey" | "queryFn">;

export function useDepartmentsList(enabled = true, options: DepartmentsQueryOptions = {}) {
  return useQuery<DepartmentRecord[]>({
    queryKey: DEPARTMENTS_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const response = await axios.get("/departments");
      return (response.data?.departments ?? []) as DepartmentRecord[];
    },
    staleTime: 60_000,
    ...options,
  });
}

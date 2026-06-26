import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "../api/axiosInstance";

export const USERS_QUERY_KEY = ["users-management-list"];

export function useUsersList(enabled = true) {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const response = await axios.get("/users");
      return response.data?.users ?? [];
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
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
  return useMutation({
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

export function useDepartmentsList(enabled = true) {
  return useQuery({
    queryKey: DEPARTMENTS_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const response = await axios.get("/departments");
      return response.data?.departments ?? [];
    },
    staleTime: 60_000,
  });
}

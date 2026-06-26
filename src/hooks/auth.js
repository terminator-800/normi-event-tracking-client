import { useMutation, useQuery } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export const AUTH_SESSION_QUERY_KEY = ["auth", "session"];

async function tryGetPaths(paths) {
  let lastNonAuthError = null;
  for (const path of paths) {
    try {
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404) continue;
      if (status === 401) continue;
      lastNonAuthError = error;
      break;
    }
  }
  if (lastNonAuthError) throw lastNonAuthError;
  return null;
}

/**
 * Loads admin/user session (GET /me) and department session (GET /department).
 * Returns a merged object, or null when neither endpoint returns a body.
 * Shape: { ...mePayload, departmentSession?: departmentPayload }
 */
async function fetchSession() {
  const meData = await tryGetPaths(["/me"]);

  let departmentData = null;
  try {
    departmentData = await tryGetPaths(["/department"]);
  } catch {
    departmentData = null;
  }

  if (meData == null && departmentData == null) {
    return null;
  }

  const base =
    meData != null && typeof meData === "object" && !Array.isArray(meData) ? { ...meData } : {};

  if (departmentData != null) {
    base.departmentSession = departmentData;
  }

  return Object.keys(base).length > 0 ? base : null;
}

export function useAuthSession(options = {}) {
  return useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: fetchSession,
    retry: false,
    staleTime: 60_000,
    ...options,
  });
}

/** Department slice of the merged session (same query as useAuthSession — no extra request). */
export function useDepartmentSession(options = {}) {
  const q = useAuthSession(options);
  const departmentSession =
    q.data && typeof q.data === "object" && q.data.departmentSession != null
      ? q.data.departmentSession
      : null;
  return {
    ...q,
    data: departmentSession,
  };
}

export function useSignIn({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: async ({ username, password }) => {
      const response = await api.post("/login", { username, password });
      return response.data;
    },
    onSuccess,
    onError,
  });
}

export function useLogout({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post("/logout");
      return response.data;
    },
    onSuccess,
    onError,
  });
}

export function useCreateDepartmentUser({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: async ({
      username,
      password,
      department,
      major,
      role = "department",
    }) => {
      const response = await api.post("/signup", {
        username,
        password,
        department,
        major,
        role,
      });
      return response.data;
    },
    onSuccess,
    onError,
  });
}
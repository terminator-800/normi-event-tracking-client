import { useMutation, useQuery, type UseMutationOptions, type UseQueryOptions } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { ApiAxiosError, AuthSession } from "../types/api";

export const AUTH_SESSION_QUERY_KEY = ["auth", "session"];

async function tryGetPaths(paths: string[]): Promise<unknown> {
  let lastNonAuthError: unknown = null;
  for (const path of paths) {
    try {
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      const status = isApiAxiosError(error) ? error.response?.status : undefined;
      if (status === 404) continue;
      if (status === 401) continue;
      lastNonAuthError = error;
      break;
    }
  }
  if (lastNonAuthError) throw lastNonAuthError;
  return null;
}

function isApiAxiosError(error: unknown): error is ApiAxiosError {
  return typeof error === "object" && error !== null && "isAxiosError" in error;
}

/**
 * Loads admin/user session (GET /me) and department session (GET /department).
 * Returns a merged object, or null when neither endpoint returns a body.
 */
async function fetchSession(): Promise<AuthSession | null> {
  const meData = await tryGetPaths(["/me"]);

  let departmentData: unknown = null;
  try {
    departmentData = await tryGetPaths(["/department"]);
  } catch {
    departmentData = null;
  }

  if (meData == null && departmentData == null) {
    return null;
  }

  const base: AuthSession =
    meData != null && typeof meData === "object" && !Array.isArray(meData)
      ? { ...(meData as AuthSession) }
      : {};

  if (departmentData != null) {
    base.departmentSession = departmentData as AuthSession;
  }

  return Object.keys(base).length > 0 ? base : null;
}

type AuthQueryOptions = Omit<UseQueryOptions<AuthSession | null>, "queryKey" | "queryFn">;

export function useAuthSession(options: AuthQueryOptions = {}) {
  return useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: fetchSession,
    retry: false,
    staleTime: 60_000,
    ...options,
  });
}

/** Department slice of the merged session (same query as useAuthSession — no extra request). */
export function useDepartmentSession(options: AuthQueryOptions = {}) {
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

type SignInVariables = { username: string; password: string };
type SignInCallbacks = {
  onSuccess?: UseMutationOptions<unknown, ApiAxiosError, SignInVariables>["onSuccess"];
  onError?: UseMutationOptions<unknown, ApiAxiosError, SignInVariables>["onError"];
};

export function useSignIn({ onSuccess, onError }: SignInCallbacks = {}) {
  return useMutation<unknown, ApiAxiosError, SignInVariables>({
    mutationFn: async ({ username, password }) => {
      const response = await api.post("/login", { username, password });
      return response.data;
    },
    onSuccess,
    onError,
  });
}

type LogoutCallbacks = {
  onSuccess?: UseMutationOptions<unknown, ApiAxiosError, void>["onSuccess"];
  onError?: UseMutationOptions<unknown, ApiAxiosError, void>["onError"];
};

export function useLogout({ onSuccess, onError }: LogoutCallbacks = {}) {
  return useMutation<unknown, ApiAxiosError, void>({
    mutationFn: async () => {
      const response = await api.post("/logout");
      return response.data;
    },
    onSuccess,
    onError,
  });
}

type CreateDepartmentUserVariables = {
  username: string;
  password: string;
  department: string;
  major?: string;
  role?: string;
};

type CreateDepartmentUserCallbacks = {
  onSuccess?: UseMutationOptions<unknown, ApiAxiosError, CreateDepartmentUserVariables>["onSuccess"];
  onError?: UseMutationOptions<unknown, ApiAxiosError, CreateDepartmentUserVariables>["onError"];
};

export function useCreateDepartmentUser({ onSuccess, onError }: CreateDepartmentUserCallbacks = {}) {
  return useMutation<unknown, ApiAxiosError, CreateDepartmentUserVariables>({
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

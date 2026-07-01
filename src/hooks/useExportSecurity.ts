import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "../api/axiosInstance";
import { getApiErrorMessage } from "../types/api";

export const EXPORT_SECURITY_QUERY_KEY = ["export-security-settings"];
export const EXPORT_KEY_QUERY_KEY = ["export-security-key"];

export type ExportSecuritySettings = {
  is_enabled: boolean;
  has_password: boolean;
  export_fingerprint: string | null;
  created_by_username: string | null;
  updated_at: string | null;
};

export type ExportKeyResult = {
  password: string | null;
};

// ── CSG President management hooks ───────────────────────────────────────────

export function useExportSecuritySettings(enabled = true) {
  return useQuery<ExportSecuritySettings>({
    queryKey: EXPORT_SECURITY_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const res = await axios.get("/export-security/settings");
      return res.data as ExportSecuritySettings;
    },
    staleTime: 10_000,
  });
}

export function useSetExportPassword() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (password: string) => {
      const res = await axios.post("/export-security/password", { password });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPORT_SECURITY_QUERY_KEY });
    },
  });
}

export function useToggleExportProtection() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, boolean>({
    mutationFn: async (enabled: boolean) => {
      const res = await axios.patch("/export-security/toggle", { enabled });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPORT_SECURITY_QUERY_KEY });
    },
  });
}

export function useVerifyExportFile() {
  return useMutation<{ valid: boolean; message: string }, Error, string>({
    mutationFn: async (fingerprint: string) => {
      const res = await axios.post("/export-security/verify", { fingerprint });
      return res.data;
    },
  });
}

// ── Export hooks for operational users (all roles) ────────────────────────────

/** Fetches the public export settings (is_enabled + fingerprint) for CSV signing. */
export function usePublicExportSettings(enabled = true) {
  return useQuery<ExportSecuritySettings>({
    queryKey: ["export-security-public"],
    enabled,
    queryFn: async () => {
      const res = await axios.get("/export-security/public-settings");
      return res.data as ExportSecuritySettings;
    },
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Fetches the decrypted password for client-side PDF encryption.
 * Returns null if protection is disabled or no password is set.
 */
export async function fetchExportKey(): Promise<string | null> {
  try {
    const res = await axios.get("/export-security/export-key");
    return (res.data as ExportKeyResult).password ?? null;
  } catch {
    return null;
  }
}

/** Extracts the NMCI export fingerprint from the first line of an exported CSV. */
export function extractFingerprintFromCsv(csvText: string): string | null {
  const firstLine = csvText.split("\n")[0]?.trim() ?? "";
  const match = firstLine.match(/^#\s*NMCI-EXPORT:v1\|([a-f0-9]{64})$/i);
  return match ? match[1] : null;
}

/**
 * Builds the signature comment line to prepend to exported CSVs.
 * Format: `# NMCI-EXPORT:v1|{fingerprint}`
 */
export function buildExportSignatureLine(fingerprint: string): string {
  return `# NMCI-EXPORT:v1|${fingerprint}`;
}

export { getApiErrorMessage };

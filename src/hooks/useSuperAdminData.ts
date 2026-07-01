import { useQuery } from "@tanstack/react-query";
import axios from "../api/axiosInstance";

export type SuperAdminStats = {
  users: {
    total_users: number;
    total_admins: number;
    total_super_admins: number;
    total_csg_presidents: number;
    total_governors: number;
  };
  events: {
    total_events: number;
    upcoming_events: number;
    active_events: number;
    completed_events: number;
  };
  students: {
    total_students: number;
  };
  payments: {
    total_payments: number;
    total_amount_collected: number;
  };
};

export type AuditLogEntry = {
  id: number;
  action: string;
  description: string;
  timestamp: string;
  performed_by: string;
};

export const SUPER_ADMIN_STATS_QUERY_KEY = ["super-admin-stats"];
export const AUDIT_LOGS_QUERY_KEY = ["super-admin-audit-logs"];

export function useSuperAdminStats(enabled = true) {
  return useQuery<SuperAdminStats>({
    queryKey: SUPER_ADMIN_STATS_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const response = await axios.get("/super-admin/stats");
      return response.data as SuperAdminStats;
    },
    staleTime: 30_000,
  });
}

export function useAuditLogs(enabled = true) {
  return useQuery<AuditLogEntry[]>({
    queryKey: AUDIT_LOGS_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const response = await axios.get("/super-admin/audit-logs");
      return (response.data?.logs ?? []) as AuditLogEntry[];
    },
    staleTime: 15_000,
  });
}

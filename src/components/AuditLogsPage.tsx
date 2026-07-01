import { useMemo, useState } from "react";
import SuperAdminShell from "./SuperAdminShell";
import { useAuditLogs, type AuditLogEntry } from "../hooks/useSuperAdminData";
import type { DeskPageProps } from "../types/desk-pages";

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function ActionBadge({ action }: { action: string }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold";
  if (action === "user_created") return <span className={`${base} bg-green-100 text-green-800`}>User Created</span>;
  if (action === "event_created") return <span className={`${base} bg-blue-100 text-blue-800`}>Event Created</span>;
  if (action === "user_updated") return <span className={`${base} bg-amber-100 text-amber-800`}>User Updated</span>;
  if (action === "user_deleted") return <span className={`${base} bg-red-100 text-red-800`}>User Deleted</span>;
  return <span className={`${base} bg-gray-100 text-gray-700`}>{action}</span>;
}

function LogRow({ log }: { log: AuditLogEntry }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-xs text-[#36454F]/60 whitespace-nowrap">{formatTimestamp(log.timestamp)}</td>
      <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
      <td className="px-4 py-3 text-sm text-[#36454F]">{log.description}</td>
      <td className="px-4 py-3 text-xs font-mono text-[#36454F]/70">{log.performed_by || "—"}</td>
    </tr>
  );
}

export default function AuditLogsPage(props: DeskPageProps) {
  const { data: logs = [], isLoading, refetch, isFetching } = useAuditLogs(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return logs.filter((log) => {
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      const matchesSearch = !q || log.description.toLowerCase().includes(q) || log.performed_by.toLowerCase().includes(q);
      return matchesAction && matchesSearch;
    });
  }, [logs, actionFilter, searchQuery]);

  const uniqueActions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return Array.from(set);
  }, [logs]);

  return (
    <SuperAdminShell
      {...props}
      activeNavId="audit_logs"
      pageTitle="Audit Logs"
      pageSubtitle="System activity log — user and event changes"
      headerRight={
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-[#36454F] hover:bg-gray-50 disabled:opacity-60"
        >
          {isFetching ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      {/* Info notice */}
      <div className="mb-4 rounded-xl border border-[#07713c]/25 bg-[#f0faf4] px-5 py-3 text-sm text-[#07713c]">
        Showing up to 100 most recent system events. Logs include user creation and event creation records.
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by description or user..."
          className="flex-1 min-w-[200px] max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-[#07713c] focus:outline-none"
        >
          <option value="all">All Actions</option>
          {uniqueActions.map((action) => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
        <span className="text-xs text-[#36454F]/60">
          {filtered.length} of {logs.length} entries
        </span>
      </div>

      {/* Log table */}
      <div className="overflow-hidden rounded-xl border border-[#07713c]/25 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-[#07713c]/20 bg-[#f8faf8]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#36454F]/60 whitespace-nowrap">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#36454F]/60">Action</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#36454F]/60">Description</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#36454F]/60">Performed By</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#36454F]/60">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin text-[#07713c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Loading audit logs...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#36454F]/60">
                    No log entries found.
                  </td>
                </tr>
              ) : (
                filtered.map((log, i) => <LogRow key={`${log.id}-${log.action}-${i}`} log={log} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminShell>
  );
}

import { useEffect, useMemo, useState } from "react";
import AppSidebarNav from "./AppSidebarNav";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import PaginationBar from "./PaginationBar";
import SearchMagnifierIcon from "./SearchMagnifierIcon";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import { fetchExportKey } from "../hooks/useExportSecurity";
import {
  useGetPaymentSummary,
  useGetPaymentTransactions,
  type PaymentTransactionRow,
} from "../hooks/useGetPayments";
import { useAppNavItems, useMyPermissions } from "../hooks/useMyPermissions";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { downloadPdfTable } from "../utils/downloadPdfTable";
import { getDashboardRoleLabel } from "../utils/roles";
import type { DeskPageProps } from "../types/desk-pages";

const PAGE_SIZE = 15;

function formatPhp(n: number | string | null | undefined): string {
  const value = Math.max(0, Number(n) || 0);
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** PDF/print-safe peso formatting (Helvetica and some print fonts render ₱ as ±). */
function formatPhpExport(n: number | string | null | undefined): string {
  const value = Math.max(0, Number(n) || 0);
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPaidAt(value: string): string {
  if (!value?.trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportsCollectionPage({ onLogout, onNavigate }: DeskPageProps) {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const navItems = useAppNavItems();
  const { has: hasPermission } = useMyPermissions();
  const canExport = hasPermission("action.collection.export");
  const canPrint = hasPermission("action.collection.print");
  const canShowExportMenu = canExport || canPrint;

  const {
    data: transactions = [],
    isLoading: isTxLoading,
    isError: isTxError,
  } = useGetPaymentTransactions();
  const { data: summary } = useGetPaymentSummary();

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of transactions) {
      const dept = String(row.department ?? "").trim();
      if (dept && dept !== "—") set.add(dept);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((row: PaymentTransactionRow) => {
      const matchesDept =
        departmentFilter === "all" ||
        String(row.department ?? "").trim() === departmentFilter;
      if (!matchesDept) return false;
      if (!q) return true;
      return (
        row.transactionCode.toLowerCase().includes(q) ||
        row.studentId.toLowerCase().includes(q) ||
        row.studentName.toLowerCase().includes(q) ||
        (row.encodedBy ?? "").toLowerCase().includes(q) ||
        (row.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [transactions, search, departmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);
  const pageSafe = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const collectedFromRows = useMemo(
    () => filtered.reduce((sum, row) => sum + (Number(row.amountPaid) || 0), 0),
    [filtered],
  );

  const buildExportTable = () => {
    const head = [
      "Transaction Code",
      "Date",
      "Student ID",
      "Student Name",
      "Department",
      "Amount",
      "Status",
      "Encoded By",
    ];
    const body = filtered.map((row) => [
      row.transactionCode || "—",
      formatPaidAt(row.paidAt),
      row.studentId || "—",
      row.studentName || "—",
      row.department || "—",
      formatPhpExport(row.amountPaid),
      row.status,
      row.encodedBy || "—",
    ]);
    return { head, body };
  };

  const downloadCsv = () => {
    const { head, body } = buildExportTable();
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [head.map(escape).join(","), ...body.map((r) => r.map(escape).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collection-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const downloadPdf = async () => {
    const { head, body } = buildExportTable();
    setExportBusy(true);
    try {
      const exportPassword = await fetchExportKey();
      await downloadPdfTable({
        filename: `collection-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        title: "Collection Report",
        subtitle: `Total collected (filtered): ${formatPhpExport(collectedFromRows)} · ${filtered.length} transaction(s)`,
        head,
        body,
        exportPassword,
        orientation: "landscape",
      });
      setExportMenuOpen(false);
    } finally {
      setExportBusy(false);
    }
  };

  const printReport = () => {
    const { head, body } = buildExportTable();
    const w = window.open("", "_blank");
    if (!w) return;
    const ths = head.map((h) => `<th>${h}</th>`).join("");
    const trs = body
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Collection Report</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #555; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #07713c; color: #fff; }
</style></head><body>
  <h1>Collection Report</h1>
  <p>Total collected (filtered): ${formatPhpExport(collectedFromRows)} · ${filtered.length} transaction(s)</p>
  <table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
</body></html>`);
    w.document.close();
    w.focus();
    window.setTimeout(() => w.print(), 250);
    setExportMenuOpen(false);
  };

  const exportReady = !isTxLoading && !isTxError && filtered.length > 0;

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="sticky top-0 flex h-screen max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto bg-[#07713C] text-white [&_p]:text-white">
        <SidebarBrand />
        <AppSidebarNav items={navItems} activeNavId="reports_collection" onNavigate={onNavigate} />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="font-[Inter,sans-serif] text-[30px] font-extrabold leading-tight text-[#07713c]">
                Collection
              </h1>
              <NavbarAcademicPeriod className="mt-1" />
              <p className="mt-1 text-xs text-black/60">{roleLabel} · Reports</p>
            </div>
            <div className="flex items-center gap-3">
              {canShowExportMenu ? (
                <div className="relative">
                  <button
                    type="button"
                    disabled={!exportReady || exportBusy}
                    onClick={() => setExportMenuOpen((open) => !open)}
                    className="rounded-lg border bg-[#07713C] px-3 py-2 text-sm font-medium text-white hover:bg-[#055a2e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exportBusy ? "Preparing…" : "Print / Download"}
                  </button>
                  {exportMenuOpen && (
                    <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-[#07713c]/30 bg-white py-1 shadow-lg">
                      {canExport ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void downloadPdf()}
                            className="block w-full px-4 py-2 text-left text-sm text-black hover:bg-[#07713c]/10"
                          >
                            Download PDF
                          </button>
                          <button
                            type="button"
                            onClick={downloadCsv}
                            className="block w-full px-4 py-2 text-left text-sm text-black hover:bg-[#07713c]/10"
                          >
                            Download CSV
                          </button>
                        </>
                      ) : null}
                      {canPrint ? (
                        <button
                          type="button"
                          onClick={printReport}
                          className="block w-full px-4 py-2 text-left text-sm text-black hover:bg-[#07713c]/10"
                        >
                          Print
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 text-black">
          <div className="mx-auto w-full max-w-7xl space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#07713c]/25 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">Collected</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[#07713c]">
                  {formatPhp(summary?.collected ?? collectedFromRows)}
                </p>
              </div>
              <div className="rounded-xl border border-[#07713c]/25 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">Outstanding</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
                  {formatPhp(summary?.outstanding ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-[#07713c]/25 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  Transactions (filtered)
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-black">{filtered.length}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search transaction, student, or encoder"
                  className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-3 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                />
              </div>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="min-w-[180px] rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                aria-label="Filter by department"
              >
                <option value="all">All departments</option>
                {departmentOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#07713c]/25 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="border-b border-[#07713c]/30 bg-[#07713c] text-xs uppercase tracking-wide text-white">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-bold">Transaction</th>
                      <th className="px-3 py-2.5 text-left font-bold">Date</th>
                      <th className="px-3 py-2.5 text-left font-bold">Student ID</th>
                      <th className="px-3 py-2.5 text-left font-bold">Student Name</th>
                      <th className="px-3 py-2.5 text-left font-bold">Department</th>
                      <th className="px-3 py-2.5 text-center font-bold">Amount</th>
                      <th className="px-3 py-2.5 text-center font-bold">Status</th>
                      <th className="px-3 py-2.5 text-left font-bold">Encoded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isTxLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-black/70">
                          Loading collections…
                        </td>
                      </tr>
                    ) : isTxError ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-red-600">
                          Unable to load collection data.
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-black/70">
                          No payment collections found.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((row) => (
                        <tr key={row.id || row.transactionCode} className="border-b border-[#07713c]/10">
                          <td className="px-3 py-2 font-mono text-xs text-black">
                            {row.transactionCode || "—"}
                          </td>
                          <td className="px-3 py-2 text-black">{formatPaidAt(row.paidAt)}</td>
                          <td className="px-3 py-2 text-black">{row.studentId || "—"}</td>
                          <td className="px-3 py-2 text-black">{row.studentName || "—"}</td>
                          <td className="px-3 py-2 text-black">{row.department || "—"}</td>
                          <td className="px-3 py-2 text-center tabular-nums font-medium text-black">
                            {formatPhp(row.amountPaid)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                row.status === "Paid"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-black">{row.encodedBy || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[#07713c]/15 px-4 py-3">
                <PaginationBar
                  totalCount={filtered.length}
                  page={pageSafe}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

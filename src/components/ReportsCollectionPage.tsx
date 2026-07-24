import { useEffect, useMemo, useState } from "react";
import AppSidebarNav from "./AppSidebarNav";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import PaginationBar from "./PaginationBar";
import SearchMagnifierIcon from "./SearchMagnifierIcon";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import { fetchExportKey } from "../hooks/useExportSecurity";
import {
  useGetPaymentTransactions,
  useGetPayments,
  type MappedPaymentRow,
  type PaymentTransactionRow,
} from "../hooks/useGetPayments";
import { useAppNavItems, useMyPermissions } from "../hooks/useMyPermissions";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { downloadPdfTable } from "../utils/downloadPdfTable";
import { getDashboardRoleLabel } from "../utils/roles";
import type { DeskPageProps } from "../types/desk-pages";
import type { AppNavId } from "../utils/appNav";

const PAGE_SIZE = 15;

export type CollectionReportMode = "all" | "paid" | "unpaid" | "partial";

type ReportsCollectionPageProps = DeskPageProps & {
  mode?: CollectionReportMode;
};

type StudentBalanceRow = {
  studentId: string;
  studentName: string;
  department: string;
  year: string;
  totalFine: number;
  paidAmount: number;
  remaining: number;
  status: string;
};

const MODE_META: Record<
  CollectionReportMode,
  { title: string; navId: AppNavId; emptyLabel: string; searchPlaceholder: string }
> = {
  all: {
    title: "Collections",
    navId: "reports_collection_all",
    emptyLabel: "No paid or partial payments found.",
    searchPlaceholder: "Search transaction, student, or encoder",
  },
  paid: {
    title: "Cash Received",
    navId: "reports_collection",
    emptyLabel: "No paid transactions found.",
    searchPlaceholder: "Search transaction, student, or encoder",
  },
  unpaid: {
    title: "Accounts Receivable",
    navId: "reports_collection_unpaid",
    emptyLabel: "No accounts receivable found (unpaid or partial with remaining balance).",
    searchPlaceholder: "Search student ID, name, or department",
  },
  partial: {
    title: "Partial Payments",
    navId: "reports_collection_partial",
    emptyLabel: "No partial payments found.",
    searchPlaceholder: "Search transaction, student, or encoder",
  },
};

function formatPhp(n: number | string | null | undefined): string {
  const value = Math.max(0, Number(n) || 0);
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function remainingBalanceForRow(row: PaymentTransactionRow): number {
  if (row.balanceAfter != null && Number.isFinite(Number(row.balanceAfter))) {
    return Math.max(0, Number(row.balanceAfter) || 0);
  }
  if (row.previousBalance != null && Number.isFinite(Number(row.previousBalance))) {
    return Math.max(0, (Number(row.previousBalance) || 0) - (Number(row.amountPaid) || 0));
  }
  return Math.max(0, (Number(row.totalFines) || 0) - (Number(row.amountPaid) || 0));
}

function studentBalanceStatus(row: MappedPaymentRow): string {
  const totalFine = Math.max(0, Number(row.totalFine) || 0);
  const paidAmount = Math.max(0, Number(row.paidAmount) || 0);
  const waivedAmount = Math.max(0, Number(row.waivedAmount) || 0);
  const remaining = Math.max(0, totalFine - paidAmount - waivedAmount);
  const payableBalance = Math.max(0, totalFine - waivedAmount);
  if (totalFine <= 0 && remaining <= 0) return "Paid";
  if (payableBalance <= 0 && totalFine > 0) return "Waived";
  if ((paidAmount > 0 || waivedAmount > 0) && remaining > 0) return "Partial";
  if (remaining <= 0 && totalFine > 0) return "Paid";
  return "Unpaid";
}

function toStudentBalanceRow(row: MappedPaymentRow): StudentBalanceRow {
  const totalFine = Math.max(0, Number(row.totalFine) || 0);
  const paidAmount = Math.max(0, Number(row.paidAmount) || 0);
  const waivedAmount = Math.max(0, Number(row.waivedAmount) || 0);
  return {
    studentId: row.studentId,
    studentName: row.studentName,
    department: row.department || "—",
    year: String(row.year ?? "—"),
    totalFine,
    paidAmount,
    remaining: Math.max(0, totalFine - paidAmount - waivedAmount),
    status: studentBalanceStatus(row),
  };
}

function collectionStatusClass(status: string): string {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "paid") return "text-blue-600 font-bold";
  if (s === "partial" || s === "initial") return "text-orange-500 font-bold";
  if (s === "unpaid") return "text-red-600 font-bold";
  return "text-black font-semibold";
}

function collectionStatusPrintClass(status: string): string {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "paid") return "status-paid";
  if (s === "partial" || s === "initial") return "status-initial";
  if (s === "unpaid") return "status-unpaid";
  return "";
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

/** Local calendar date `YYYY-MM-DD` from payment timestamp (for range filters). */
function paidAtYmd(value: string): string | null {
  if (!value?.trim()) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(String(value).trim());
  if (iso) return iso[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type CollectionFilterState = {
  search: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  encodedBy: string;
};

const EMPTY_COLLECTION_FILTERS: CollectionFilterState = {
  search: "",
  department: "all",
  dateFrom: "",
  dateTo: "",
  encodedBy: "all",
};

export default function ReportsCollectionPage({
  onLogout,
  onNavigate,
  mode = "paid",
}: ReportsCollectionPageProps) {
  const meta = MODE_META[mode];
  const isUnpaidMode = mode === "unpaid";

  const [draftFilters, setDraftFilters] = useState<CollectionFilterState>(EMPTY_COLLECTION_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<CollectionFilterState>(EMPTY_COLLECTION_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  } = useGetPaymentTransactions({ enabled: !isUnpaidMode });
  const {
    data: paymentStudents = [],
    isLoading: isStudentsLoading,
    isError: isStudentsError,
  } = useGetPayments({ enabled: isUnpaidMode });

  const scopedTransactions = useMemo(() => {
    if (mode === "all") {
      return transactions.filter((row) => row.status === "Paid" || row.status === "Partial");
    }
    if (mode === "paid") return transactions.filter((row) => row.status === "Paid");
    if (mode === "partial") return transactions.filter((row) => row.status === "Partial");
    return [];
  }, [transactions, mode]);

  const unpaidStudents = useMemo(() => {
    if (!isUnpaidMode) return [] as StudentBalanceRow[];
    return paymentStudents
      .map(toStudentBalanceRow)
      .filter(
        (row) =>
          row.remaining > 0 && (row.status === "Unpaid" || row.status === "Partial"),
      );
  }, [paymentStudents, isUnpaidMode]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    if (isUnpaidMode) {
      for (const row of unpaidStudents) {
        const dept = String(row.department ?? "").trim();
        if (dept && dept !== "—") set.add(dept);
      }
    } else {
      for (const row of scopedTransactions) {
        const dept = String(row.department ?? "").trim();
        if (dept && dept !== "—") set.add(dept);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [isUnpaidMode, unpaidStudents, scopedTransactions]);

  const encodedByOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of scopedTransactions) {
      const name = String(row.encodedBy ?? "").trim();
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [scopedTransactions]);

  const filteredTransactions = useMemo(() => {
    const q = appliedFilters.search.trim().toLowerCase();
    const from = appliedFilters.dateFrom.trim();
    const to = appliedFilters.dateTo.trim();
    return scopedTransactions.filter((row: PaymentTransactionRow) => {
      const matchesDept =
        appliedFilters.department === "all" ||
        String(row.department ?? "").trim() === appliedFilters.department;
      if (!matchesDept) return false;

      const encoder = String(row.encodedBy ?? "").trim();
      if (appliedFilters.encodedBy !== "all" && encoder !== appliedFilters.encodedBy) return false;

      const ymd = paidAtYmd(row.paidAt);
      if (from && (!ymd || ymd < from)) return false;
      if (to && (!ymd || ymd > to)) return false;

      if (!q) return true;
      return (
        row.transactionCode.toLowerCase().includes(q) ||
        row.studentId.toLowerCase().includes(q) ||
        row.studentName.toLowerCase().includes(q) ||
        (row.encodedBy ?? "").toLowerCase().includes(q) ||
        (row.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [scopedTransactions, appliedFilters]);

  const filteredStudents = useMemo(() => {
    const q = appliedFilters.search.trim().toLowerCase();
    return unpaidStudents.filter((row) => {
      const matchesDept =
        appliedFilters.department === "all" ||
        String(row.department ?? "").trim() === appliedFilters.department;
      if (!matchesDept) return false;
      if (!q) return true;
      return (
        row.studentId.toLowerCase().includes(q) ||
        row.studentName.toLowerCase().includes(q) ||
        (row.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [unpaidStudents, appliedFilters]);

  const filteredCount = isUnpaidMode ? filteredStudents.length : filteredTransactions.length;
  const isLoading = isUnpaidMode ? isStudentsLoading : isTxLoading;
  const isError = isUnpaidMode ? isStudentsError : isTxError;

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE) || 1);
  const pageSafe = Math.min(page, totalPages);
  const paginatedTransactions = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, pageSafe]);
  const paginatedStudents = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, pageSafe]);

  const hasAppliedFilters =
    Boolean(appliedFilters.search.trim()) ||
    appliedFilters.department !== "all" ||
    Boolean(appliedFilters.dateFrom) ||
    Boolean(appliedFilters.dateTo) ||
    appliedFilters.encodedBy !== "all";

  const filtersDirty =
    draftFilters.search !== appliedFilters.search ||
    draftFilters.department !== appliedFilters.department ||
    draftFilters.dateFrom !== appliedFilters.dateFrom ||
    draftFilters.dateTo !== appliedFilters.dateTo ||
    draftFilters.encodedBy !== appliedFilters.encodedBy;

  const saveFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_COLLECTION_FILTERS);
    setAppliedFilters(EMPTY_COLLECTION_FILTERS);
    setPage(1);
  };

  useEffect(() => {
    setDraftFilters(EMPTY_COLLECTION_FILTERS);
    setAppliedFilters(EMPTY_COLLECTION_FILTERS);
    setFiltersOpen(false);
    setPage(1);
    setExportMenuOpen(false);
  }, [mode]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const collectedFromRows = useMemo(() => {
    if (isUnpaidMode) {
      return filteredStudents.reduce((sum, row) => sum + (Number(row.paidAmount) || 0), 0);
    }
    return filteredTransactions.reduce((sum, row) => sum + (Number(row.amountPaid) || 0), 0);
  }, [isUnpaidMode, filteredStudents, filteredTransactions]);

  const outstandingFromRows = useMemo(() => {
    if (isUnpaidMode) {
      return filteredStudents.reduce((sum, row) => sum + (Number(row.remaining) || 0), 0);
    }
    return filteredTransactions.reduce((sum, row) => sum + remainingBalanceForRow(row), 0);
  }, [isUnpaidMode, filteredStudents, filteredTransactions]);

  const buildExportTable = () => {
    if (isUnpaidMode) {
      const head = [
        "Student ID",
        "Student Name",
        "Department",
        "Year",
        "Fines",
        "Paid Amount",
        "Remaining Balance",
        "Status",
      ];
      const body = filteredStudents.map((row) => [
        row.studentId || "—",
        row.studentName || "—",
        row.department || "—",
        row.year || "—",
        formatPhp(row.totalFine),
        formatPhp(row.paidAmount),
        formatPhp(row.remaining),
        row.status,
      ]);
      return { head, body };
    }

    const head = [
      "Transaction Code",
      "Date",
      "Student ID",
      "Student Name",
      "Department",
      "Fines",
      "Paid Amount",
      "Remaining Balance",
      "Status",
      "Encoded By",
    ];
    const body = filteredTransactions.map((row) => [
      row.transactionCode || "—",
      formatPaidAt(row.paidAt),
      row.studentId || "—",
      row.studentName || "—",
      row.department || "—",
      formatPhp(row.totalFines),
      formatPhp(row.amountPaid),
      formatPhp(remainingBalanceForRow(row)),
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
    a.download = `${mode}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const downloadPdf = async () => {
    const { head, body } = buildExportTable();
    setExportBusy(true);
    try {
      const exportPassword = await fetchExportKey();
      const paidCol = isUnpaidMode ? 5 : 6;
      const remainingCol = isUnpaidMode ? 6 : 7;
      const statusCol = isUnpaidMode ? 7 : 8;
      await downloadPdfTable({
        filename: `${mode}-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        title: meta.title,
        subtitle: `${filteredCount} record(s) · Paid ${formatPhp(collectedFromRows)} · Outstanding ${formatPhp(outstandingFromRows)}`,
        head,
        body,
        exportPassword,
        orientation: "portrait",
        columnTextColors: {
          [paidCol]: [37, 99, 235],
          [remainingCol]: [220, 38, 38],
        },
        getBodyCellStyle: ({ columnIndex, cellText }) => {
          if (columnIndex !== statusCol) return undefined;
          const s = String(cellText ?? "").trim().toLowerCase();
          if (s === "paid") return { textColor: [37, 99, 235], fontStyle: "bold" };
          if (s === "partial" || s === "initial") {
            return { textColor: [249, 115, 22], fontStyle: "bold" };
          }
          if (s === "unpaid") return { textColor: [220, 38, 38], fontStyle: "bold" };
          return undefined;
        },
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
    const paidCol = isUnpaidMode ? 5 : 6;
    const remainingCol = isUnpaidMode ? 6 : 7;
    const statusCol = isUnpaidMode ? 7 : 8;
    const ths = head.map((h) => `<th>${h}</th>`).join("");
    const trs = body
      .map(
        (row) =>
          `<tr>${row
            .map((cell, i) => {
              let cls = "";
              if (i === paidCol) cls = "paid-amount";
              else if (i === remainingCol) cls = "remaining-balance";
              else if (i === statusCol) cls = collectionStatusPrintClass(String(cell));
              return `<td class="${cls}">${cell}</td>`;
            })
            .join("")}</tr>`,
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>${meta.title}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #555; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 5px 6px; text-align: left; }
  th { background: #07713c; color: #fff; }
  td.paid-amount { color: #2563eb; font-weight: 700; }
  td.remaining-balance { color: #dc2626; font-weight: 700; }
  td.status-paid { color: #2563eb; font-weight: 700; }
  td.status-initial { color: #f97316; font-weight: 700; }
  td.status-unpaid { color: #dc2626; font-weight: 700; }
  @media print { body { padding: 0; } }
</style></head><body>
  <h1>${meta.title}</h1>
  <p>${filteredCount} record(s) · Paid ${formatPhp(collectedFromRows)} · Outstanding ${formatPhp(outstandingFromRows)}</p>
  <table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
</body></html>`);
    w.document.close();
    w.focus();
    window.setTimeout(() => w.print(), 250);
    setExportMenuOpen(false);
  };

  const exportReady = !isLoading && !isError && filteredCount > 0;

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="sticky top-0 flex h-screen max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto bg-[#07713C] text-white [&_p]:text-white">
        <SidebarBrand />
        <AppSidebarNav items={navItems} activeNavId={meta.navId} onNavigate={onNavigate} />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="font-[Inter,sans-serif] text-[30px] font-extrabold leading-tight text-[#07713c]">
                {meta.title}
              </h1>
              <NavbarAcademicPeriod className="mt-1" />
              <p className="mt-1 text-xs text-black/60">{roleLabel} · Reports · Receivables</p>
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
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">Paid Amount</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-blue-600">
                  {formatPhp(collectedFromRows)}
                </p>
              </div>
              <div className="rounded-xl border border-[#07713c]/25 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">Outstanding</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-red-600">
                  {formatPhp(outstandingFromRows)}
                </p>
              </div>
              <div className="rounded-xl border border-[#07713c]/25 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  {isUnpaidMode ? "Students (filtered)" : "Transactions (filtered)"}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-black">{filteredCount}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#07713c]/25 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#07713c]/[0.04]"
                aria-expanded={filtersOpen}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black">Filters</p>
                  <p className="mt-0.5 truncate text-xs text-black/60">
                    {hasAppliedFilters
                      ? [
                          appliedFilters.search.trim() ? `Search: “${appliedFilters.search.trim()}”` : null,
                          appliedFilters.department !== "all"
                            ? `Dept: ${appliedFilters.department}`
                            : null,
                          appliedFilters.dateFrom || appliedFilters.dateTo
                            ? `Date: ${appliedFilters.dateFrom || "…"} → ${appliedFilters.dateTo || "…"}`
                            : null,
                          appliedFilters.encodedBy !== "all"
                            ? `Created by: ${appliedFilters.encodedBy}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "No filters applied — showing all records"}
                    {filtersDirty ? " · Unsaved changes" : ""}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[#07713c]">
                  {filtersOpen ? "Collapse" : "Expand"}
                  <svg
                    className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </button>

              {filtersOpen ? (
                <div className="space-y-3 border-t border-[#07713c]/15 px-4 py-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="relative min-w-[200px] flex-1">
                      <label className="mb-1 block text-xs font-medium text-black/70">Search</label>
                      <div className="relative">
                        <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50" />
                        <input
                          type="search"
                          value={draftFilters.search}
                          onChange={(e) =>
                            setDraftFilters((prev) => ({ ...prev, search: e.target.value }))
                          }
                          placeholder={meta.searchPlaceholder}
                          className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-3 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-black/70">Department</label>
                      <select
                        value={draftFilters.department}
                        onChange={(e) =>
                          setDraftFilters((prev) => ({ ...prev, department: e.target.value }))
                        }
                        className="min-w-[160px] rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
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
                    {!isUnpaidMode ? (
                      <>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-black/70">Date from</label>
                          <input
                            type="date"
                            value={draftFilters.dateFrom}
                            onChange={(e) =>
                              setDraftFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                            }
                            className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                            aria-label="Filter date from"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-black/70">Date to</label>
                          <input
                            type="date"
                            value={draftFilters.dateTo}
                            min={draftFilters.dateFrom || undefined}
                            onChange={(e) =>
                              setDraftFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                            }
                            className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                            aria-label="Filter date to"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-black/70">Created by</label>
                          <select
                            value={draftFilters.encodedBy}
                            onChange={(e) =>
                              setDraftFilters((prev) => ({ ...prev, encodedBy: e.target.value }))
                            }
                            className="min-w-[180px] rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                            aria-label="Filter by who created the payment"
                          >
                            <option value="all">All encoders</option>
                            {encodedByOptions.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {filtersDirty ? (
                      <span className="mr-auto text-xs text-amber-700">Save to update the table below.</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={clearFilters}
                      disabled={!hasAppliedFilters && !filtersDirty}
                      className="rounded-lg border border-[#07713c]/40 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-[#07713c]/10 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={saveFilters}
                      disabled={!filtersDirty}
                      className="rounded-lg border border-[#07713c] bg-[#07713c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#055a2e] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Save filters
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-[#07713c]/25 bg-white shadow-sm">
              <div className="overflow-x-auto">
                {isUnpaidMode ? (
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="border-b border-[#07713c]/30 bg-[#07713c] text-xs uppercase tracking-wide text-white">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-bold">Student ID</th>
                        <th className="px-3 py-2.5 text-left font-bold">Student Name</th>
                        <th className="px-3 py-2.5 text-left font-bold">Department</th>
                        <th className="px-3 py-2.5 text-center font-bold">Year</th>
                        <th className="px-3 py-2.5 text-center font-bold">Fines</th>
                        <th className="px-3 py-2.5 text-center font-bold">Paid Amount</th>
                        <th className="px-3 py-2.5 text-center font-bold">Remaining Balance</th>
                        <th className="px-3 py-2.5 text-center font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-black/70">
                            Loading accounts receivable…
                          </td>
                        </tr>
                      ) : isError ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-red-600">
                            Unable to load accounts receivable.
                          </td>
                        </tr>
                      ) : filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-black/70">
                            {meta.emptyLabel}
                          </td>
                        </tr>
                      ) : (
                        paginatedStudents.map((row) => (
                          <tr key={row.studentId} className="border-b border-[#07713c]/10">
                            <td className="px-3 py-2 text-black">{row.studentId || "—"}</td>
                            <td className="px-3 py-2 text-black">{row.studentName || "—"}</td>
                            <td className="px-3 py-2 text-black">{row.department || "—"}</td>
                            <td className="px-3 py-2 text-center text-black">{row.year || "—"}</td>
                            <td className="px-3 py-2 text-center tabular-nums font-medium text-black">
                              {formatPhp(row.totalFine)}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-semibold text-blue-600">
                              {formatPhp(row.paidAmount)}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-semibold text-red-600">
                              {formatPhp(row.remaining)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-[11px] ${collectionStatusClass(row.status)}`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full min-w-[1100px] text-sm">
                    <thead className="border-b border-[#07713c]/30 bg-[#07713c] text-xs uppercase tracking-wide text-white">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-bold">Transaction</th>
                        <th className="px-3 py-2.5 text-left font-bold">Date</th>
                        <th className="px-3 py-2.5 text-left font-bold">Student ID</th>
                        <th className="px-3 py-2.5 text-left font-bold">Student Name</th>
                        <th className="px-3 py-2.5 text-left font-bold">Department</th>
                        <th className="px-3 py-2.5 text-center font-bold">Fines</th>
                        <th className="px-3 py-2.5 text-center font-bold">Paid Amount</th>
                        <th className="px-3 py-2.5 text-center font-bold">Remaining Balance</th>
                        <th className="px-3 py-2.5 text-center font-bold">Status</th>
                        <th className="px-3 py-2.5 text-left font-bold">Encoded By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-10 text-center text-black/70">
                            Loading collections…
                          </td>
                        </tr>
                      ) : isError ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-10 text-center text-red-600">
                            Unable to load collection data.
                          </td>
                        </tr>
                      ) : filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-10 text-center text-black/70">
                            {meta.emptyLabel}
                          </td>
                        </tr>
                      ) : (
                        paginatedTransactions.map((row) => (
                          <tr key={row.id || row.transactionCode} className="border-b border-[#07713c]/10">
                            <td className="px-3 py-2 font-mono text-xs text-black">
                              {row.transactionCode || "—"}
                            </td>
                            <td className="px-3 py-2 text-black">{formatPaidAt(row.paidAt)}</td>
                            <td className="px-3 py-2 text-black">{row.studentId || "—"}</td>
                            <td className="px-3 py-2 text-black">{row.studentName || "—"}</td>
                            <td className="px-3 py-2 text-black">{row.department || "—"}</td>
                            <td className="px-3 py-2 text-center tabular-nums font-medium text-black">
                              {formatPhp(row.totalFines)}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-semibold text-blue-600">
                              {formatPhp(row.amountPaid)}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums font-semibold text-red-600">
                              {formatPhp(remainingBalanceForRow(row))}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-[11px] ${collectionStatusClass(row.status)}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-black">{row.encodedBy || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="border-t border-[#07713c]/15 px-4 py-3">
                <PaginationBar
                  totalCount={filteredCount}
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

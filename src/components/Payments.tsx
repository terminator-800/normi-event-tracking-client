import { useEffect, useMemo, useState } from "react";
import { NavbarAcademicPeriod } from "./Navbar";
import UserCircleIcon from "./UserCircleIcon";
import PaginationBar from "./PaginationBar";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { getDashboardRoleLabel, isCsgPresident } from "../utils/roles";
import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import { useGetPaymentSummary, useGetPayments, useGetPaymentTransactions } from "../hooks/useGetPayments";
import { getAppNavItems } from "../utils/appNav";
import { formatCourseWithMajor } from "../utils/courseMajorDisplay";
import { downloadPdfTable } from "../utils/downloadPdfTable";
import csgLogo from "../assets/CSG LOGO.jpg";
import type {
  DeskPageProps,
  EnrichedPaymentStudent,
  PaymentExportRow,
  PaymentReceipt,
  PaymentStudentRecord,
  PaymentTransaction,
  StudentExportFilters,
} from "../types/desk-pages";
import Sidebar from "./Sidebar";
import NewPayment from "./NewPayment";


/** Payments page main content text (sidebar nav excluded). */
const PAYMENTS_PAGE_TEXT = "text-black";
const PAYMENTS_TH_TEXT = "font-bold text-black";
const TABLE_CELL_NOWRAP = "[&_th]:whitespace-nowrap [&_tbody_td]:whitespace-nowrap";
const TRANSACTIONS_PAGE_SIZE = 15;
/** Wait for RFID wedge / typing to finish before auto-submit (same as Home attendance). */
const AUTO_SUBMIT_DEBOUNCE_MS = 500;
const MIN_AUTO_SUBMIT_LENGTH = 6;

function formatPhp(n: number | string | null | undefined): string {
  const v = Math.max(0, Number(n) || 0);
  return `₱${v.toLocaleString("en-PH")}`;
}

function formatPhpMaybeHidden(visible: boolean, n: number | string | null | undefined): string {
  return visible ? formatPhp(n) : "₱••••••";
}

type IconProps = { className?: string };

function EyeOpenIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58a2 2 0 0 0 2.84 2.84" />
      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a17.52 17.52 0 0 1-4.06 5.94" />
      <path d="M6.12 6.12A17.52 17.52 0 0 0 2 12s3 7 10 7a10.94 10.94 0 0 0 2.12-.21" />
    </svg>
  );
}

function transactionStatusClass(status: string): string {
  if (status === "Paid") return "bg-[#07713c]/10 text-black";
  return "bg-orange-100 text-black";
}

function sessionLabel(kindRaw: string | null | undefined): string {
  const kind = String(kindRaw ?? "whole").toLowerCase();
  if (kind === "am") return "AM Session";
  if (kind === "pm") return "PM Session";
  return "Whole day";
}

function parseMoneyInput(raw: string | null | undefined): number {
  const cleaned = String(raw ?? "").replace(/,/g, "").trim();
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
}

function inferCollegeFromCourse(courseRaw: string | null | undefined): string {
  const course = String(courseRaw ?? "").toUpperCase();
  if (course.startsWith("BEED") || course.startsWith("BSED")) return "College of Education, Arts and Sciences";
  if (course.startsWith("BSIT")) return "College of Information Technology";
  if (course.startsWith("BSCRIM")) return "College of Criminal Justice Education";
  if (course.startsWith("BSHM")) return "College of Hospitality Management";
  if (course.startsWith("BSBA")) return "College of Business Administration";
  return "Unassigned";
}

function enrichPaymentStudent(student: PaymentStudentRecord | null | undefined): EnrichedPaymentStudent | null {
  if (!student) return null;
  const totalFine = Math.max(0, Number(student.totalFine) || 0);
  const paidAmount = Math.max(0, Number(student.paidAmount) || 0);
  const waivedAmount = Math.max(0, Number(student.waivedAmount) || 0);
  const remaining = Math.max(0, totalFine - paidAmount - waivedAmount);
  const payableBalance = Math.max(0, totalFine - waivedAmount);
  let status = "Unpaid";
  const hasProgress = paidAmount > 0 || waivedAmount > 0;
  if (totalFine <= 0 && remaining <= 0) {
    status = "Paid";
  } else if (payableBalance <= 0 && totalFine > 0) {
    status = "Waived";
  } else if (hasProgress && remaining > 0) {
    status = "Partial";
  } else if (remaining <= 0 && totalFine > 0) {
    status = "Paid";
  }
  const courseDisplay = formatCourseWithMajor(student.course, student.major ?? null);
  const inferredDepartment = inferCollegeFromCourse(student.course);
  const departmentDisplay =
    student.department && student.department !== "—"
      ? student.department
      : inferredDepartment !== "Unassigned"
        ? inferredDepartment
        : "—";
  return {
    ...student,
    totalFine,
    paidAmount,
    waivedAmount,
    remaining,
    status,
    courseDisplay,
    departmentDisplay,
    college: inferredDepartment !== "Unassigned" ? inferredDepartment : student.department,
  };
}

function downloadTextFile(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildReceiptHtml(receipt: PaymentReceipt, logoUrl: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${receipt.transactionCode || receipt.receiptNo}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; color: #16331f; }
      .page { max-width: 760px; margin: 24px auto; border: 1px solid #d1d5db; border-radius: 12px; overflow: hidden; }
      .header { background: #07713C; color: #fff; padding: 16px 20px; display: flex; gap: 12px; align-items: center; }
      .logo { width: 52px; height: 52px; border-radius: 9999px; background: rgba(255,255,255,0.15); object-fit: contain; }
      .title { font-weight: 700; font-size: 18px; margin: 0; }
      .subtitle { margin: 2px 0 0 0; font-size: 12px; opacity: 0.95; }
      .content { padding: 18px 20px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; font-size: 14px; }
      .label { color: #4b5563; }
      .value { font-weight: 600; }
      .summary { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
      .row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px; }
      .row-divider { border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 8px; }
      .new-balance { font-size: 18px; font-weight: 700; color: #07713C; }
      .total { font-size: 18px; font-weight: 700; color: #07713C; }
      .foot { margin-top: 20px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <img class="logo" src="${logoUrl}" alt="Central Student Government" />
        <div>
          <p class="title">Payment Receipt</p>
          <p class="subtitle">CENTRAL STUDENT GOVERNMENT</p>
        </div>
      </div>
      <div class="content">
        <div class="grid">
          <div><span class="label">Transaction Code:</span> <span class="value">${receipt.transactionCode || receipt.receiptNo}</span></div>
          <div><span class="label">Date:</span> <span class="value">${formatEventDateForDisplay(receipt.createdAt ?? "")}</span></div>
          <div><span class="label">Student ID:</span> <span class="value">${receipt.studentId}</span></div>
          <div><span class="label">Student Name:</span> <span class="value">${receipt.studentName}</span></div>
          <div><span class="label">Department / Year:</span> <span class="value">${receipt.department} · ${receipt.year}</span></div>
          <div><span class="label">Encoded By:</span> <span class="value">${receipt.encodedBy}</span></div>
        </div>
        <div class="summary">
          <div class="row"><span>Previous Balance</span><strong>${formatPhp(receipt.previousBalance)}</strong></div>
          <div class="row row-divider"><span>Amount Paid</span><strong>${formatPhp(receipt.amountPaid)}</strong></div>
          <div class="row new-balance"><span>New Balance</span><strong>${formatPhp(receipt.newBalance)}</strong></div>
        </div>
        ${receipt.note ? `<div class="foot"><strong>Note:</strong> ${receipt.note}</div>` : ""}
      </div>
    </div>
  </body>
</html>`;
}

function transactionToReceipt(tx: PaymentTransaction): PaymentReceipt {
  const amountPaid = Number(tx.amountPaid) || 0;
  const previousBalance =
    tx.previousBalance != null
      ? tx.previousBalance
      : tx.balanceAfter != null
        ? amountPaid + tx.balanceAfter
        : amountPaid;
  const newBalance =
    tx.balanceAfter != null ? tx.balanceAfter : tx.status === "Paid" ? 0 : Math.max(0, previousBalance - amountPaid);

  return {
    transactionCode: tx.transactionCode,
    receiptNo: tx.transactionCode,
    createdAt: tx.paidAt,
    encodedBy: tx.encodedBy || "—",
    studentId: tx.studentId,
    studentName: tx.studentName,
    department: tx.department || "—",
    year: tx.year || "—",
    previousBalance,
    amountPaid,
    newBalance,
    note: tx.remarks || "",
  };
}

type PaymentsPageProps = DeskPageProps;

export default function Payments({ onNavigate, onLogout }: PaymentsPageProps) {
  const { role, isGovernor, governorScope } = useGovernorScope();
  void getDashboardRoleLabel(isGovernor, governorScope, role);
  const normalizedRole = String(role || "").toLowerCase().trim();
  const isAdmin = normalizedRole === "admin";
  const isSuperAdmin = normalizedRole === "super_admin";
  const isCsg = isCsgPresident(normalizedRole);
  const navItems = getAppNavItems({ isAdmin: isAdmin || isSuperAdmin, isSuperAdmin, isCsgPresident: isCsg });
  const { data: paymentSummary } = useGetPaymentSummary();
  const { data: paymentTransactions = [], isLoading: isTransactionsLoading, isError: isTransactionsError } =
    useGetPaymentTransactions() as {
      data: PaymentTransaction[];
      isLoading: boolean;
      isError: boolean;
    };
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [summaryAmountsVisible, setSummaryAmountsVisible] = useState(true);
  const [lastReceipt, setLastReceipt] = useState<PaymentReceipt | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransaction | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSearch, setExportSearch] = useState("");
  const [exportStatusFilter, setExportStatusFilter] = useState("All");
  const [exportCollegeFilter, setExportCollegeFilter] = useState("all");
  const [exportCourseFilter, setExportCourseFilter] = useState("all");
  const [exportYearFilter, setExportYearFilter] = useState("all");
  const [exportBalanceFilter, setExportBalanceFilter] = useState("all");
  const [showLogout, setShowLogout] = useState(false);

  const { data: paymentRowsFromApi = [], isLoading: isExportListLoading } = useGetPayments({
    enabled: exportOpen,
  });

  const filteredTransactions = useMemo(() => {
    const q = transactionSearch.trim().toLowerCase();
    if (!q) return paymentTransactions;
    return paymentTransactions.filter((row: PaymentTransaction) => {
      return (
        row.transactionCode.toLowerCase().includes(q) ||
        row.studentId.toLowerCase().includes(q) ||
        row.studentName.toLowerCase().includes(q) ||
        (row.encodedBy ?? "").toLowerCase().includes(q)
      );
    });
  }, [paymentTransactions, transactionSearch]);

  const transactionsTotal = filteredTransactions.length;
  const transactionsTotalPages = Math.max(1, Math.ceil(transactionsTotal / TRANSACTIONS_PAGE_SIZE) || 1);
  const transactionsPageSafe = Math.min(transactionsPage, transactionsTotalPages);

  const paginatedTransactions = useMemo(() => {
    const start = (transactionsPageSafe - 1) * TRANSACTIONS_PAGE_SIZE;
    return filteredTransactions.slice(start, start + TRANSACTIONS_PAGE_SIZE);
  }, [filteredTransactions, transactionsPageSafe]);

  useEffect(() => {
    setTransactionsPage(1);
  }, [transactionSearch]);

  useEffect(() => {
    setTransactionsPage((p) => Math.min(p, transactionsTotalPages));
  }, [transactionsTotalPages]);

  const totals = useMemo(
    () => ({
      total: paymentSummary?.ledgerTotal ?? 0,
      paid: paymentSummary?.collected ?? 0,
      unpaid: paymentSummary?.outstanding ?? 0,
      waived: paymentSummary?.waived ?? 0,
    }),
    [paymentSummary],
  );
  const studentsWithBalance = paymentSummary?.studentsWithBalance ?? 0;

  const exportStudentRows = useMemo((): PaymentExportRow[] => {
    return paymentRowsFromApi
      .map((student: PaymentStudentRecord) => enrichPaymentStudent(student))
      .filter((row: EnrichedPaymentStudent | null): row is EnrichedPaymentStudent => row != null) as PaymentExportRow[];
  }, [paymentRowsFromApi]);

  const applyStudentFilters = (rows: PaymentExportRow[], filters: StudentExportFilters): PaymentExportRow[] => {
    const q = String(filters.search ?? "").trim().toLowerCase();
    return rows.filter((row: PaymentExportRow) => {
      const matchesStatus = filters.status === "All" || row.status === filters.status;
      const rowCollege = row.college || inferCollegeFromCourse(row.course);
      const matchesCollege = filters.college === "all" || rowCollege === filters.college;
      const matchesCourse = filters.course === "all" || row.course === filters.course;
      const matchesYear = filters.year === "all" || String(row.year ?? "") === String(filters.year);
      const matchesBalance =
        filters.balance === "all" ||
        (filters.balance === "with_balance" && row.remaining > 0) ||
        (filters.balance === "zero_balance" && row.remaining <= 0);
      const majorQ = (row.major ?? "").toLowerCase();
      const matchesSearch =
        !q ||
        row.studentName.toLowerCase().includes(q) ||
        row.studentId.toLowerCase().includes(q) ||
        row.course.toLowerCase().includes(q) ||
        majorQ.includes(q) ||
        (row.courseDisplay ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesCollege && matchesCourse && matchesYear && matchesBalance && matchesSearch;
    });
  };

  const exportCollegeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          exportStudentRows
            .map((row: PaymentExportRow) => row.college || inferCollegeFromCourse(row.course))
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [exportStudentRows],
  );


  const exportYearOptions = useMemo(
    () =>
      Array.from(
        new Set(exportStudentRows.map((row: PaymentExportRow) => String(row.year ?? "")).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [exportStudentRows],
  );

  const exportFilteredRows = useMemo(
    () =>
      applyStudentFilters(exportStudentRows, {
        search: exportSearch,
        status: exportStatusFilter,
        college: exportCollegeFilter,
        course: exportCourseFilter,
        year: exportYearFilter,
        balance: exportBalanceFilter,
      }),
    [exportStudentRows, exportSearch, exportStatusFilter, exportCollegeFilter, exportCourseFilter, exportYearFilter, exportBalanceFilter],
  );

  const handlePaymentSaved = (receipt: PaymentReceipt) => {
    setLastReceipt(receipt);
  };

  const printReceipt = (receipt: PaymentReceipt) => {
    if (!receipt) return;
    const logoUrl = String(csgLogo).startsWith("http")
      ? csgLogo
      : new URL(csgLogo, window.location.origin).href;
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(buildReceiptHtml(receipt, logoUrl));
    w.document.close();
    w.focus();
    window.setTimeout(() => w.print(), 250);
  };

  const exportPaymentsCsv = () => {
    const header = ["Student ID", "Student Name", "Course", "Year", "Total Events", "Total Fine", "Paid Amount", "Remaining", "Status"];
    const body = exportFilteredRows.map((row: PaymentExportRow) => [
      `"${row.studentId}"`,
      `"${String(row.studentName || "").replace(/"/g, '""')}"`,
      `"${String(row.courseDisplay || row.course || "").replace(/"/g, '""')}"`,
      `"${String(row.year ?? "")}"`,
      String(row.totalEvents ?? 0),
      String(Number(row.totalFine) || 0),
      String(Number(row.paidAmount) || 0),
      String(Number(row.remaining) || 0),
      `"${row.status}"`,
    ]);
    downloadTextFile(
      `payments-${new Date().toISOString().slice(0, 10)}.csv`,
      [header.join(","), ...body.map((r) => r.join(","))].join("\n"),
    );
  };

  const buildPaymentsExportSubtitle = () => {
    const parts = [
      `Generated ${new Date().toLocaleString("en-PH")}`,
      `${exportFilteredRows.length} student record(s)`,
    ];
    if (exportStatusFilter !== "All") parts.push(`Status: ${exportStatusFilter}`);
    if (exportCollegeFilter !== "all") parts.push(`College: ${exportCollegeFilter}`);
    if (exportYearFilter !== "all") parts.push(`Year: ${exportYearFilter}`);
    if (exportBalanceFilter === "with_balance") parts.push("With balance");
    if (exportBalanceFilter === "zero_balance") parts.push("Zero balance");
    if (exportSearch.trim()) parts.push(`Search: ${exportSearch.trim()}`);
    return parts.join(" · ");
  };

  const exportPaymentsPdf = async () => {
    const header = ["Student ID", "Student Name", "Year", "Total Events", "Total Fine", "Paid Amount", "Remaining", "Status"];
    const body = exportFilteredRows.map((row: PaymentExportRow) => [
      String(row.studentId || ""),
      String(row.studentName || ""),
      String(row.year ?? ""),
      String(row.totalEvents ?? 0),
      Number(row.totalFine) || 0,
      Number(row.paidAmount) || 0,
      Number(row.remaining) || 0,
      String(row.status || ""),
    ]);
    await downloadPdfTable({
      filename: `payments-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Payments Report",
      subtitle: buildPaymentsExportSubtitle(),
      head: header,
      body,
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <Sidebar navItems={navItems} onNavigate={onNavigate} activeNavId="payment" />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-[#07713c]/30 px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-4">
            <div>
              <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">Payments</h1>
              <NavbarAcademicPeriod className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="rounded-lg border border-[#e6a100] bg-[#ffb300] px-3 py-2 text-sm font-medium text-black hover:bg-[#e6a100]"
              >
                Export / Reports
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLogout((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#07713c] hover:bg-[#07713c]/10"
                  aria-label="Account menu"
                  aria-expanded={showLogout}
                  aria-haspopup="true"
                  title="Profile"
                >
                  <UserCircleIcon />
                </button>
                {showLogout && (
                  <div className="absolute right-0 top-full mt-1 min-w-[100px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLogout(false);
                        onLogout?.();
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className={`flex-1 p-6 overflow-auto ${PAYMENTS_PAGE_TEXT} [&_th]:font-bold [&_th]:!text-black`}>
          <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative bg-white rounded-lg border border-[#07713c]/30 p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setSummaryAmountsVisible((v) => !v)}
                className="absolute top-3 right-3 rounded-md p-1 text-black/50 hover:bg-[#07713c]/10 hover:text-[#07713c]"
                aria-label={summaryAmountsVisible ? "Hide ledger total" : "Show ledger total"}
                title={summaryAmountsVisible ? "Hide amount" : "Show amount"}
              >
                {summaryAmountsVisible ? <EyeOffIcon /> : <EyeOpenIcon />}
              </button>
              <p className="text-2xl font-bold text-black pr-8">{formatPhpMaybeHidden(summaryAmountsVisible, totals.total)}</p>
              <p className="text-sm font-medium text-black">Ledger Total</p>
            </div>
            <div className="relative bg-white rounded-lg border border-[#07713c]/30 p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setSummaryAmountsVisible((v) => !v)}
                className="absolute top-3 right-3 rounded-md p-1 text-black/50 hover:bg-[#07713c]/10 hover:text-[#07713c]"
                aria-label={summaryAmountsVisible ? "Hide collected amount" : "Show collected amount"}
                title={summaryAmountsVisible ? "Hide amount" : "Show amount"}
              >
                {summaryAmountsVisible ? <EyeOffIcon /> : <EyeOpenIcon />}
              </button>
              <p className="text-2xl font-bold text-black pr-8">{formatPhpMaybeHidden(summaryAmountsVisible, totals.paid)}</p>
              <p className="text-sm font-medium text-black">Collected</p>
            </div>
            <div className="relative bg-white rounded-lg border border-[#07713c]/30 p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setSummaryAmountsVisible((v) => !v)}
                className="absolute top-3 right-3 rounded-md p-1 text-black/50 hover:bg-[#07713c]/10 hover:text-[#07713c]"
                aria-label={summaryAmountsVisible ? "Hide outstanding amount" : "Show outstanding amount"}
                title={summaryAmountsVisible ? "Hide amount" : "Show amount"}
              >
                {summaryAmountsVisible ? <EyeOffIcon /> : <EyeOpenIcon />}
              </button>
              <p className="text-2xl font-bold text-black pr-8">{formatPhpMaybeHidden(summaryAmountsVisible, totals.unpaid)}</p>
              <p className="text-sm font-medium text-black">Outstanding</p>
            </div>
            <div className="bg-white rounded-lg border border-[#07713c]/30 p-4 shadow-sm">
              <p className="text-2xl font-bold text-black">{studentsWithBalance}</p>
              <p className="text-sm font-medium text-black">Students with Balance</p>
            </div>
          </div>

          {lastReceipt ? (
            <div className="mb-4 rounded-xl border border-[#07713c]/25 bg-[#07713c]/[0.04] p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-black">
                <p className="font-semibold">Payment saved successfully</p>
                <p>Transaction Code: <span className="font-mono font-bold">{lastReceipt.transactionCode || lastReceipt.receiptNo}</span></p>
                <p>{lastReceipt.studentName} · {formatPhp(lastReceipt.amountPaid)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => printReceipt(lastReceipt)}
                  className="rounded-lg border border-[#07713c] bg-white px-4 py-2 text-sm font-medium text-black hover:bg-[#07713c]/10"
                >
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setLastReceipt(null)}
                  className="rounded-lg border border-[#07713c]/30 px-3 py-2 text-sm text-black hover:bg-gray-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <section className="min-w-0 bg-white rounded-lg border border-[#07713c]/30 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-[#07713c]/20 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-black">Payment Transactions</h2>
                <p className="text-sm text-black/75">Recorded payments only. Click a row to view details or print a receipt. Use + New Payment to post a new transaction.</p>
              </div>
              <NewPayment onSaved={handlePaymentSaved} />
            </div>

            <div className="p-4 border-b border-[#07713c]/20">
              <input
                type="search"
                value={transactionSearch}
                onChange={(e) => setTransactionSearch(e.target.value)}
                placeholder="Search transaction code, student ID, or name"
                className="w-full max-w-md rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
              />
            </div>

            <div className="min-w-0 overflow-x-auto">
              <table className={`w-full min-w-0 table-fixed text-sm ${TABLE_CELL_NOWRAP}`}>
                <thead className={`border-b border-[#07713c]/30 bg-[#ffb300] text-xs uppercase tracking-wide ${PAYMENTS_TH_TEXT}`}>
                  <tr>
                    <th className="w-[18%] px-3 py-2.5 text-left align-middle">Transaction Code</th>
                    <th className="w-[12%] px-3 py-2.5 text-left align-middle">Date</th>
                    <th className="w-[12%] px-3 py-2.5 text-left align-middle">Student ID</th>
                    <th className="w-[22%] px-3 py-2.5 text-left align-middle">Student Name</th>
                    <th className="px-3 py-2.5 text-center align-middle">Amount</th>
                    <th className="px-3 py-2.5 text-center align-middle">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isTransactionsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center text-black/85">Loading transactions...</td>
                    </tr>
                  ) : isTransactionsError ? (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center text-black">Unable to load transactions right now.</td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center text-black/85">
                        No payment transactions yet. Click <span className="font-semibold">+ New Payment</span> to record a payment.
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((row: PaymentTransaction) => (
                      <tr
                        key={row.id ?? row.transactionCode}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedTransaction(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedTransaction(row);
                          }
                        }}
                        className="border-b border-[#07713c]/15 hover:bg-[#07713c]/[0.08] cursor-pointer"
                      >
                        <td className="px-3 py-1.5 font-mono text-xs leading-snug text-black">{row.transactionCode}</td>
                        <td className="px-3 py-1.5 leading-snug text-black whitespace-nowrap">{formatEventDateForDisplay(row.paidAt ?? "")}</td>
                        <td className="px-3 py-1.5 leading-snug text-black">{row.studentId}</td>
                        <td className="px-3 py-1.5 leading-snug text-black truncate" title={row.studentName}>{row.studentName}</td>
                        <td className="px-3 py-1.5 text-center tabular-nums leading-snug text-black">{formatPhp(row.amountPaid)}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${transactionStatusClass(row.status ?? "")}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              totalCount={transactionsTotal}
              page={transactionsPage}
              pageSize={TRANSACTIONS_PAGE_SIZE}
              onPageChange={setTransactionsPage}
              emptyLabel="No payment transactions to show."
              itemLabel="transactions"
              className="!text-black border-[#07713c]/20"
            />
          </section>
          </div>
        </main>
      </div>

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-black">Export / reports</h3>
            <p className="mt-2 text-sm text-black">
              Apply filters below for export. {isExportListLoading ? "Loading student list..." : ""}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-black sm:col-span-2">
                Search
                <input
                  type="search"
                  value={exportSearch}
                  onChange={(e) => setExportSearch(e.target.value)}
                  placeholder="Search student, ID, or course"
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-black">
                Status
                <select
                  value={exportStatusFilter}
                  onChange={(e) => setExportStatusFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option>All</option>
                  <option>Unpaid</option>
                  <option>Partial</option>
                  <option>Paid</option>
                  <option>Waived</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-black">
                College
                <select
                  value={exportCollegeFilter}
                  onChange={(e) => setExportCollegeFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All colleges</option>
                  {exportCollegeOptions.map((college) => (
                    <option key={college} value={college}>
                      {college}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-black">
                Year
                <select
                  value={exportYearFilter}
                  onChange={(e) => setExportYearFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All years</option>
                  {exportYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-black">
                Balance
                <select
                  value={exportBalanceFilter}
                  onChange={(e) => setExportBalanceFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All balances</option>
                  <option value="with_balance">With balance</option>
                  <option value="zero_balance">Zero balance</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs text-black/85">
              {exportFilteredRows.length} student record(s) will be exported.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  exportPaymentsCsv();
                  setExportOpen(false);
                }}
                className="w-full rounded-lg border border-[#07713c] bg-[#07713c]/10 px-4 py-2.5 text-sm font-medium text-black hover:bg-[#07713c]/15"
              >
                Export CSV — filtered payments
              </button>
              <button
                type="button"
                onClick={() => {
                  exportPaymentsPdf();
                  setExportOpen(false);
                }}
                className="w-full rounded-lg border border-[#07713c]/40 px-4 py-2.5 text-sm font-medium text-black hover:bg-[#07713c]/10"
              >
                Export PDF — filtered payments
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportSearch("");
                  setExportStatusFilter("All");
                  setExportCollegeFilter("all");
                  setExportCourseFilter("all");
                  setExportYearFilter("all");
                  setExportBalanceFilter("all");
                }}
                className="w-full rounded-lg border border-[#07713c]/30 px-4 py-2 text-sm font-medium text-black hover:bg-[#07713c]/8"
              >
                Reset export filters
              </button>
            </div>
            <button
              type="button"
              onClick={() => setExportOpen(false)}
              className="mt-4 w-full rounded-lg border border-[#07713c]/30 py-2 text-sm text-black hover:bg-[#07713c]/10"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {selectedTransaction && (
        <div className="fixed inset-0 z-[63] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#07713c]/30 bg-[#07713c]/10 px-5 py-3">
              <h3 className="text-lg font-semibold text-black">Payment Transaction</h3>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ffb300] text-black hover:bg-[#e6a100]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 text-sm text-black">
              <div className="rounded-lg border border-[#07713c]/20 bg-[#07713c]/5 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-black/60">Transaction Code</p>
                <p className="mt-1 font-mono text-base font-bold">{selectedTransaction.transactionCode}</p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-xs text-black/60">Date</dt>
                  <dd className="font-medium">{formatEventDateForDisplay(selectedTransaction.paidAt ?? "")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-black/60">Status</dt>
                  <dd>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${transactionStatusClass(selectedTransaction.status ?? "")}`}>
                      {selectedTransaction.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-black/60">Student ID</dt>
                  <dd className="font-medium">{selectedTransaction.studentId}</dd>
                </div>
                <div>
                  <dt className="text-xs text-black/60">Student Name</dt>
                  <dd className="font-medium truncate" title={selectedTransaction.studentName}>
                    {selectedTransaction.studentName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-black/60">Department / Year</dt>
                  <dd className="font-medium">
                    {selectedTransaction.department || "—"}
                    {selectedTransaction.year ? ` · ${selectedTransaction.year}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-black/60">Amount Paid</dt>
                  <dd className="font-semibold tabular-nums text-[#07713c]">{formatPhp(selectedTransaction.amountPaid)}</dd>
                </div>
                {selectedTransaction.previousBalance != null ? (
                  <div>
                    <dt className="text-xs text-black/60">Previous Balance</dt>
                    <dd className="font-medium tabular-nums">{formatPhp(selectedTransaction.previousBalance)}</dd>
                  </div>
                ) : null}
                {selectedTransaction.balanceAfter != null ? (
                  <div>
                    <dt className="text-xs text-black/60">Balance After</dt>
                    <dd className="font-medium tabular-nums">{formatPhp(selectedTransaction.balanceAfter)}</dd>
                  </div>
                ) : null}
                <div className="hidden">
                  <dt className="text-xs text-black/60">Payment Method</dt>
                  <dd className="font-medium">{selectedTransaction.paymentMethod || "Cash"}</dd>
                </div>
                <div className="hidden">
                  <dt className="text-xs text-black/60">Encoded By</dt>
                  <dd className="font-medium">{selectedTransaction.encodedBy || "—"}</dd>
                </div>
              </dl>

              {selectedTransaction.remarks ? (
                <div className="rounded-lg border border-[#07713c]/15 bg-gray-50 px-3 py-2">
                  <p className="text-xs text-black/60">Remarks</p>
                  <p className="mt-1 text-sm">{selectedTransaction.remarks}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => printReceipt(transactionToReceipt(selectedTransaction))}
                  className="rounded-lg border border-[#07713c] bg-[#07713c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#055a2e]"
                >
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTransaction(null)}
                  className="rounded-lg border border-[#07713c]/30 px-4 py-2 text-sm text-black hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

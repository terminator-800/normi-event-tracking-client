import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppSidebarNav from "./AppSidebarNav";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import { getFullNameFromSession, getNavDisplayNameFromSession } from "../utils/roles";
import { useAuthSession } from "../hooks/auth";
import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import { lookupPaymentStudent, useGetPaymentStudent } from "../hooks/useGetPayments";
import { useRecordPayment } from "../hooks/useRecordPayment";
import { useAppNavItems, useMyPermissions } from "../hooks/useMyPermissions";
import { formatCourseWithMajor } from "../utils/courseMajorDisplay";
import csgLogo from "../assets/CSG LOGO.jpg";
import type {
  DeskPageProps,
  EnrichedPaymentStudent,
  PaymentReceipt,
  PaymentStudentRecord,
} from "../types/desk-pages";

const TH_TEXT = "font-bold text-white";
const TABLE_CELL_NOWRAP = "[&_th]:whitespace-nowrap [&_tbody_td]:whitespace-nowrap";
const AUTO_SUBMIT_DEBOUNCE_MS = 500;
const MIN_AUTO_SUBMIT_LENGTH = 6;

function formatPhp(n: number | string | null | undefined): string {
  const v = Math.max(0, Number(n) || 0);
  return `₱${v.toLocaleString("en-PH")}`;
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

function makeReceiptNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `RCP-${y}${m}${d}-${h}${min}${s}${ms}`;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveReceiptLogoUrl(): string {
  const imported = String(csgLogo);
  if (imported.startsWith("http")) return imported;
  if (imported.startsWith("/")) return `${window.location.origin}${imported}`;
  try {
    return new URL(imported, window.location.origin).href;
  } catch {
    return `${window.location.origin}/csg.jpg`;
  }
}

function buildReceiptHtml(receipt: PaymentReceipt, logoUrl: string): string {
  const txCode = escapeHtml(receipt.transactionCode || receipt.receiptNo);
  const date = escapeHtml(formatEventDateForDisplay(receipt.createdAt ?? ""));
  const studentId = escapeHtml(receipt.studentId);
  const studentName = escapeHtml(receipt.studentName);
  const department = escapeHtml(receipt.department);
  const year = escapeHtml(receipt.year);
  const encodedBy = escapeHtml(receipt.encodedBy);
  const note = receipt.note ? escapeHtml(receipt.note) : "";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${txCode}</title>
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
      .foot { margin-top: 20px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <img class="logo" src="${escapeHtml(logoUrl)}" alt="Central Student Government" />
        <div>
          <p class="title">Payment Receipt</p>
          <p class="subtitle">CENTRAL STUDENT GOVERNMENT</p>
        </div>
      </div>
      <div class="content">
        <div class="grid">
          <div><span class="label">Transaction Code:</span> <span class="value">${txCode}</span></div>
          <div><span class="label">Date:</span> <span class="value">${date}</span></div>
          <div><span class="label">Student ID:</span> <span class="value">${studentId}</span></div>
          <div><span class="label">Student Name:</span> <span class="value">${studentName}</span></div>
          <div><span class="label">Department / Year:</span> <span class="value">${department} · ${year}</span></div>
          <div><span class="label">Encoded By:</span> <span class="value">${encodedBy}</span></div>
        </div>
        <div class="summary">
          <div class="row"><span>Previous Balance</span><strong>${formatPhp(receipt.previousBalance)}</strong></div>
          <div class="row row-divider"><span>Amount Paid</span><strong>${formatPhp(receipt.amountPaid)}</strong></div>
          <div class="row new-balance"><span>New Balance</span><strong>${formatPhp(receipt.newBalance)}</strong></div>
        </div>
        ${note ? `<div class="foot"><strong>Note:</strong> ${note}</div>` : ""}
      </div>
    </div>
  </body>
</html>`;
}

function IconStorefront({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l1.5-4.5A2 2 0 0 1 6.4 3h11.2a2 2 0 0 1 1.9 1.5L21 9" />
      <path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" />
      <path d="M3 9h18" />
      <path d="M10 21V13h4v8" />
    </svg>
  );
}

function IconSearch({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

export default function PaymentStation({ onNavigate, onLogout }: DeskPageProps) {
  const { data: session } = useAuthSession();
  const encoderDisplayName =
    getFullNameFromSession(session) || getNavDisplayNameFromSession(session) || "—";
  const navItems = useAppNavItems();
  const { has: hasPermission } = useMyPermissions();
  const canRecordPayment = hasPermission("action.payment.record");
  const recordPaymentMutation = useRecordPayment();

  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInAmount, setWalkInAmount] = useState("");
  const [walkInNote, setWalkInNote] = useState("");
  const [walkInError, setWalkInError] = useState("");
  const [payFlowStep, setPayFlowStep] = useState<"search" | "review">("search");
  const [payFlowStudentId, setPayFlowStudentId] = useState("");
  const [rfidBuffer, setRfidBuffer] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const rfidInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAutoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [lastReceipt, setLastReceipt] = useState<PaymentReceipt | null>(null);

  const {
    data: payFlowStudentRaw,
    isLoading: isPayFlowStudentLoading,
    isError: isPayFlowStudentError,
  } = useGetPaymentStudent(payFlowStudentId, {
    enabled: Boolean(payFlowStudentId) && payFlowStep === "review",
  });

  const payFlowStudent = useMemo(() => enrichPaymentStudent(payFlowStudentRaw), [payFlowStudentRaw]);
  const deskEvents = payFlowStudent?.events ?? [];
  const deskFilteredTotalFine = useMemo(
    () => deskEvents.reduce((sum, event) => sum + (Number(event.fine) || 0), 0),
    [deskEvents],
  );
  const selectedRow = payFlowStudent;
  const payFlowPreviewNewBalance = useMemo(() => {
    if (!payFlowStudent) return 0;
    const amount = parseMoneyInput(paymentAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) return payFlowStudent.remaining;
    return Math.max(0, payFlowStudent.remaining - amount);
  }, [payFlowStudent, paymentAmountInput]);

  const armCardReader = useCallback(() => {
    if (payFlowStep !== "search" || showWalkIn) return;
    window.setTimeout(() => rfidInputRef.current?.focus(), 0);
  }, [payFlowStep, showWalkIn]);

  const resetToSearch = useCallback(() => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    if (searchAutoSubmitTimerRef.current) {
      clearTimeout(searchAutoSubmitTimerRef.current);
      searchAutoSubmitTimerRef.current = null;
    }
    setPayFlowStep("search");
    setPayFlowStudentId("");
    setRfidBuffer("");
    setSearchQuery("");
    setLookupError("");
    setPaymentAmountInput("");
    setPaymentError("");
  }, []);

  const lookupStudent = useCallback(async (rawIdentifier: string) => {
    const identifier = String(rawIdentifier ?? "").replace(/\D/g, "").trim();
    if (!identifier) {
      setLookupError("Enter a Student ID or tap an ID card.");
      return;
    }
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    if (searchAutoSubmitTimerRef.current) {
      clearTimeout(searchAutoSubmitTimerRef.current);
      searchAutoSubmitTimerRef.current = null;
    }
    setIsLookingUp(true);
    setLookupError("");
    try {
      const student = await lookupPaymentStudent(identifier);
      if (!student?.studentId) {
        setLookupError("Student not found or access denied.");
        return;
      }
      setPayFlowStudentId(student.studentId);
      setPayFlowStep("review");
      setPaymentAmountInput("");
      setPaymentError("");
      setRfidBuffer("");
      setSearchQuery("");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error != null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data.message
          : "Student not found or access denied.";
      setLookupError(message);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  useEffect(() => {
    if (payFlowStep !== "search" || showWalkIn) return;
    const identifier = rfidBuffer.trim();
    if (!identifier || isLookingUp) return;
    if (!/^\d+$/.test(identifier) || identifier.length < MIN_AUTO_SUBMIT_LENGTH) return;

    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    autoSubmitTimerRef.current = setTimeout(() => {
      void lookupStudent(identifier);
    }, AUTO_SUBMIT_DEBOUNCE_MS);

    return () => {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    };
  }, [rfidBuffer, isLookingUp, lookupStudent, payFlowStep, showWalkIn]);

  // Search field: auto-lookup Student ID / RFID after typing pauses (no Enter needed).
  useEffect(() => {
    if (payFlowStep !== "search" || showWalkIn) return;
    const identifier = searchQuery.replace(/\D/g, "").trim();
    if (!identifier || isLookingUp) return;
    if (identifier.length < MIN_AUTO_SUBMIT_LENGTH) return;

    if (searchAutoSubmitTimerRef.current) clearTimeout(searchAutoSubmitTimerRef.current);
    searchAutoSubmitTimerRef.current = setTimeout(() => {
      void lookupStudent(identifier);
    }, AUTO_SUBMIT_DEBOUNCE_MS);

    return () => {
      if (searchAutoSubmitTimerRef.current) {
        clearTimeout(searchAutoSubmitTimerRef.current);
        searchAutoSubmitTimerRef.current = null;
      }
    };
  }, [searchQuery, isLookingUp, lookupStudent, payFlowStep, showWalkIn]);

  useEffect(() => {
    armCardReader();
  }, [armCardReader, payFlowStep, lastReceipt]);

  useEffect(() => {
    if (payFlowStep !== "search" || showWalkIn) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("input, textarea, button, a, [role='dialog']")) return;
      armCardReader();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [armCardReader, payFlowStep, showWalkIn]);

  const writeReceiptToWindow = (win: Window, receipt: PaymentReceipt) => {
    const html = buildReceiptHtml(receipt, resolveReceiptLogoUrl());
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    const triggerPrint = () => {
      try {
        win.print();
      } catch {
        /* ignore */
      }
    };
    const img = win.document.querySelector("img");
    if (img && !img.complete) {
      img.onload = () => window.setTimeout(triggerPrint, 100);
      img.onerror = () => window.setTimeout(triggerPrint, 100);
    } else {
      window.setTimeout(triggerPrint, 250);
    }
  };

  const printReceipt = (receipt: PaymentReceipt, existingWindow?: Window | null) => {
    const win = existingWindow ?? window.open("", "_blank", "width=800,height=900");
    if (!win) {
      alert("Pop-up blocked. Allow pop-ups to print the receipt.");
      return;
    }
    writeReceiptToWindow(win, receipt);
  };

  const handleSubmitPayment = async () => {
    if (!selectedRow) return;
    const maxPayable = Math.max(0, selectedRow.totalFine - selectedRow.waivedAmount);
    const previousBalance = selectedRow.remaining;
    const amount = parseMoneyInput(paymentAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a valid amount greater than zero.");
      return;
    }
    if (amount > selectedRow.remaining) {
      setPaymentError("Amount cannot be greater than remaining balance.");
      return;
    }
    const roundedAmount = Math.round(amount * 100) / 100;
    const newBalance = Math.max(0, previousBalance - roundedAmount);

    if (roundedAmount > maxPayable) {
      setPaymentError("Amount cannot be greater than total payable balance.");
      return;
    }

    const printWin = window.open("", "_blank", "width=800,height=900");

    try {
      const response = (await recordPaymentMutation.mutateAsync({
        studentId: selectedRow.studentId ?? "",
        amountPaid: roundedAmount,
        paymentMethod: "Cash",
        remarks: "",
      } as never)) as {
        transactionCode?: string;
        receiptNo?: string;
        encodedBy?: string;
        previousBalance?: number;
        amountPaid?: number;
        newBalance?: number;
      };
      const receipt: PaymentReceipt = {
        transactionCode: response?.transactionCode || response?.receiptNo || makeReceiptNumber(),
        receiptNo: response?.transactionCode || response?.receiptNo || makeReceiptNumber(),
        createdAt: new Date().toISOString(),
        encodedBy: response?.encodedBy || encoderDisplayName,
        studentId: selectedRow.studentId,
        studentName: selectedRow.studentName,
        department: payFlowStudent?.departmentDisplay || payFlowStudent?.department || "—",
        year: selectedRow.year ?? "—",
        previousBalance: response?.previousBalance ?? previousBalance,
        amountPaid: response?.amountPaid ?? roundedAmount,
        newBalance: response?.newBalance ?? newBalance,
        note: "",
      };
      setLastReceipt(receipt);
      resetToSearch();
      printReceipt(receipt, printWin);
    } catch (error: unknown) {
      printWin?.close();
      const message =
        typeof error === "object" &&
        error != null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data.message
          : "Unable to save payment right now.";
      setPaymentError(message);
    }
  };

  const handleWalkInSubmit = () => {
    const name = walkInName.trim();
    const amount = parseMoneyInput(walkInAmount);
    if (!name) {
      setWalkInError("Enter the payer’s name.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setWalkInError("Enter a valid amount greater than zero.");
      return;
    }
    const roundedAmount = Math.round(amount * 100) / 100;
    const receipt: PaymentReceipt = {
      transactionCode: makeReceiptNumber(),
      receiptNo: makeReceiptNumber(),
      createdAt: new Date().toISOString(),
      encodedBy: encoderDisplayName,
      studentId: "WALK-IN",
      studentName: name,
      department: "Walk-in",
      year: "—",
      previousBalance: roundedAmount,
      amountPaid: roundedAmount,
      newBalance: 0,
      note: walkInNote.trim() || "Walk-in payment (not linked to a student account)",
    };
    setLastReceipt(receipt);
    setShowWalkIn(false);
    setWalkInName("");
    setWalkInAmount("");
    setWalkInNote("");
    setWalkInError("");
    printReceipt(receipt);
  };

  return (
    <div className="flex min-h-screen bg-[#f4f6f5] [&_button]:cursor-pointer">
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col [&_p]:text-white">
        <SidebarBrand />
        <AppSidebarNav items={navItems} activeNavId="payment_station" onNavigate={onNavigate} />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200/80 px-6 py-4">
          <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 text-[#0f172a]">
                <img
                  src="/csg.jpg"
                  alt="Central Student Government"
                  className="h-9 w-9 rounded-full object-contain bg-white border border-gray-200"
                />
                <h1 className="text-[28px] font-bold tracking-tight leading-none">Payment Station</h1>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#07713c]">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#22c55e] shadow-[0_0_0_3px_rgba(34,197,94,0.25)]" />
                  CARD READER ARMED
                </p>
                <NavbarAcademicPeriod className="!mt-0 text-xs text-gray-500" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setWalkInError("");
                  setShowWalkIn(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0f172a] shadow-sm hover:bg-gray-50"
              >
                <IconStorefront className="h-4 w-4 text-gray-600" />
                Walk-in Payment
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
            {lastReceipt ? (
              <div className="rounded-2xl border border-[#07713c]/25 bg-[#07713c]/[0.08] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#0f172a]">Payment saved successfully</p>
                  <p className="text-sm text-gray-600">
                    {lastReceipt.studentName} · {formatPhp(lastReceipt.amountPaid)} · New balance{" "}
                    {formatPhp(lastReceipt.newBalance)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => printReceipt(lastReceipt)}
                    className="rounded-lg border border-[#07713c] bg-white px-3 py-1.5 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/5"
                  >
                    Print Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setLastReceipt(null)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-[#0f172a] hover:bg-gray-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}

            {payFlowStep === "search" ? (
              <section className="mx-auto w-full max-w-xl rounded-3xl border border-gray-200 bg-white px-8 py-12 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
                {/* Hidden RFID capture — keeps wedge keyboard focus when armed */}
                <input
                  ref={rfidInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="RFID card reader input"
                  value={rfidBuffer}
                  onChange={(e) => {
                    setRfidBuffer(e.target.value.replace(/\D/g, ""));
                    if (lookupError) setLookupError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (autoSubmitTimerRef.current) {
                      clearTimeout(autoSubmitTimerRef.current);
                      autoSubmitTimerRef.current = null;
                    }
                    void lookupStudent(rfidBuffer);
                  }}
                  className="sr-only"
                />

                <button
                  type="button"
                  onClick={armCardReader}
                  className="mx-auto flex w-full max-w-sm flex-col items-center text-center"
                >
                  <div className="relative mb-7 flex h-36 w-36 items-center justify-center">
                    <span className="absolute inset-0 rounded-full border border-[#07713c]/15 animate-ping opacity-40 [animation-duration:2.4s]" />
                    <span className="absolute inset-3 rounded-full border border-[#07713c]/20" />
                    <span className="absolute inset-7 rounded-full border border-[#07713c]/25" />
                    <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg shadow-[#07713c]/20 ring-2 ring-[#07713c]/25">
                      <img
                        src="/csg.jpg"
                        alt="Central Student Government"
                        className="h-full w-full object-cover"
                      />
                    </span>
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-[#0f172a]">Tap ID card</h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
                    Student photo, balances, and payment history load instantly.
                  </p>
                </button>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center" aria-hidden>
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-[11px] font-semibold tracking-[0.14em] text-gray-400">
                      NO CARD?
                    </span>
                  </div>
                </div>

                <label className="block">
                  <span className="sr-only">Search student</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <IconSearch />
                    </span>
                    <input
                      ref={searchInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value.replace(/\D/g, ""));
                        if (lookupError) setLookupError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (searchAutoSubmitTimerRef.current) {
                          clearTimeout(searchAutoSubmitTimerRef.current);
                          searchAutoSubmitTimerRef.current = null;
                        }
                        void lookupStudent(searchQuery);
                      }}
                      placeholder="Student ID or RFID — loads automatically"
                      className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm text-[#0f172a] placeholder:text-gray-400 shadow-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/20"
                    />
                  </div>
                </label>

                {lookupError ? (
                  <p className="mt-3 text-center text-sm font-medium text-red-600">{lookupError}</p>
                ) : null}
                {isLookingUp ? (
                  <p className="mt-3 text-center text-sm text-gray-500">Looking up student...</p>
                ) : null}

                <p className="mt-5 text-center text-xs text-gray-500">
                  Paying customer is not a student? Use{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setWalkInError("");
                      setShowWalkIn(true);
                    }}
                    className="font-semibold text-[#0f172a] underline-offset-2 hover:underline"
                  >
                    Walk-in Payment
                  </button>{" "}
                  above.
                </p>
              </section>
            ) : (
              <section className="mx-auto w-full max-w-3xl rounded-3xl border border-gray-200 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)] overflow-hidden">
                <div className="border-b border-gray-100 bg-[#f8faf9] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#0f172a]">Review Fines & Pay</h2>
                    <p className="text-sm text-gray-500">Confirm the amount, then save the payment.</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetToSearch}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-[#0f172a] hover:bg-gray-50"
                  >
                    Search Another
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {isPayFlowStudentLoading ? (
                    <p className="text-sm text-gray-500 text-center py-8">Calculating fines...</p>
                  ) : isPayFlowStudentError || !payFlowStudent ? (
                    <p className="text-sm text-[#0f172a] text-center py-8">Unable to load student fines.</p>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-[#07713c]/20 bg-[#07713c]/[0.04] p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-lg font-bold text-[#0f172a]">{payFlowStudent.studentName}</p>
                          <p className="text-sm text-gray-600">ID: {payFlowStudent.studentId}</p>
                          <p className="text-sm text-gray-600">
                            {payFlowStudent.departmentDisplay || payFlowStudent.department || "—"} · Year{" "}
                            {payFlowStudent.year}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                            <p className="text-xs text-gray-500">Total Fine</p>
                            <p className="font-bold tabular-nums text-[#0f172a]">{formatPhp(payFlowStudent.totalFine)}</p>
                          </div>
                          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                            <p className="text-xs text-gray-500">Remaining</p>
                            <p className="font-bold tabular-nums text-[#0f172a]">{formatPhp(payFlowStudent.remaining)}</p>
                          </div>
                          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                            <p className="text-xs text-gray-500">Paid</p>
                            <p className="font-bold tabular-nums text-[#0f172a]">{formatPhp(payFlowStudent.paidAmount)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 overflow-x-auto rounded-xl border border-gray-200">
                        <table className={`w-full text-sm ${TABLE_CELL_NOWRAP}`}>
                          <thead className={`border-b border-[#07713c]/30 bg-[#07713c] text-xs uppercase ${TH_TEXT}`}>
                            <tr>
                              <th className="px-4 py-2 text-left">Event</th>
                              <th className="px-4 py-2 text-center">Date</th>
                              <th className="px-4 py-2 text-center">Session</th>
                              <th className="px-4 py-2 text-right">Remaining Fine</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deskEvents.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                                  No completed events with fines.
                                </td>
                              </tr>
                            ) : (
                              deskEvents.map((event, index) => (
                                <tr key={event.id ?? index} className="border-t border-gray-100">
                                  <td className="px-4 py-2.5 text-[#0f172a]">{event.name}</td>
                                  <td className="px-4 py-2.5 text-center text-[#0f172a]">
                                    {formatEventDateForDisplay(event.date ?? "")}
                                  </td>
                                  <td className="px-4 py-2.5 text-center text-[#0f172a]">
                                    {sessionLabel(event.sessionKind)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-[#0f172a]">
                                    {formatPhp(event.fine)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="bg-[#f8faf9] border-t border-gray-200">
                              <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-[#0f172a]">
                                Total remaining fines
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-[#0f172a]">
                                {formatPhp(deskFilteredTotalFine)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-[#f8faf9] p-4 space-y-3">
                        <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">Record Payment</p>
                        {!canRecordPayment ? (
                          <p className="text-sm text-gray-600">Your role cannot record payments.</p>
                        ) : (
                          <>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#0f172a]">
                          <span>Current balance</span>
                          <span className="font-semibold tabular-nums">{formatPhp(payFlowStudent.remaining)}</span>
                        </div>
                        <label className="block text-sm text-[#0f172a]">
                          <span className="mb-1 block font-semibold">Amount to pay</span>
                          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                            <span>₱</span>
                            <input
                              value={paymentAmountInput}
                              onChange={(e) => {
                                const normalized = e.target.value
                                  .replace(/[^\d.]/g, "")
                                  .replace(/(\..*)\./g, "$1");
                                setPaymentAmountInput(normalized);
                                if (paymentError) setPaymentError("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void handleSubmitPayment();
                              }}
                              placeholder="0.00"
                              inputMode="decimal"
                              className="w-full bg-transparent text-right tabular-nums outline-none focus:ring-0"
                            />
                          </div>
                        </label>
                        {payFlowStudent.remaining > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentAmountInput(String(payFlowStudent.remaining));
                              if (paymentError) setPaymentError("");
                            }}
                            className="text-xs font-medium text-[#07713c] hover:underline underline-offset-2"
                          >
                            Pay full balance ({formatPhp(payFlowStudent.remaining)})
                          </button>
                        ) : null}
                        <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-sm text-[#0f172a]">
                          <span className="font-medium">New balance after payment</span>
                          <span className="font-bold tabular-nums text-[#07713c]">
                            {formatPhp(payFlowPreviewNewBalance)}
                          </span>
                        </div>
                        {paymentError ? <p className="text-sm font-medium text-red-600">{paymentError}</p> : null}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSubmitPayment()}
                    disabled={!canRecordPayment || !payFlowStudent || payFlowStudent.remaining <= 0 || recordPaymentMutation.isPending}
                    className="rounded-xl bg-[#07713c] px-5 py-2.5 font-semibold text-white hover:bg-[#055a2e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {recordPaymentMutation.isPending ? "Saving..." : "Save Payment"}
                  </button>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {showWalkIn ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-bold text-[#0f172a]">Walk-in Payment</h3>
              <p className="mt-1 text-sm text-gray-500">
                For payers who are not in the student roster. Prints a walk-in receipt (not linked to a student account).
              </p>
            </div>
            <div className="space-y-3 p-5">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#0f172a]">Payer name</span>
                <input
                  value={walkInName}
                  onChange={(e) => {
                    setWalkInName(e.target.value);
                    if (walkInError) setWalkInError("");
                  }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/20"
                  placeholder="Full name"
                  autoFocus
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#0f172a]">Amount</span>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5">
                  <span className="text-[#0f172a]">₱</span>
                  <input
                    value={walkInAmount}
                    onChange={(e) => {
                      setWalkInAmount(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"));
                      if (walkInError) setWalkInError("");
                    }}
                    className="w-full bg-transparent text-right tabular-nums outline-none"
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#0f172a]">Note (optional)</span>
                <input
                  value={walkInNote}
                  onChange={(e) => setWalkInNote(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/20"
                  placeholder="Purpose or reference"
                />
              </label>
              {walkInError ? <p className="text-sm font-medium text-red-600">{walkInError}</p> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowWalkIn(false);
                  setWalkInError("");
                  armCardReader();
                }}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-[#0f172a] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWalkInSubmit}
                className="rounded-xl bg-[#07713c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#055a2e]"
              >
                Print Walk-in Receipt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

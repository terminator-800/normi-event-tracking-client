import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useAuthSession } from "../hooks/auth";
import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import { lookupPaymentStudent, useGetPaymentStudent } from "../hooks/useGetPayments";
import { useRecordPayment } from "../hooks/useRecordPayment";
import { formatCourseWithMajor } from "../utils/courseMajorDisplay";
import { getFullNameFromSession, getNavDisplayNameFromSession } from "../utils/roles";
import type { PaymentReceipt, PaymentStudentRecord } from "../types/desk-pages";

const AUTO_SUBMIT_DEBOUNCE_MS = 500;
const MIN_AUTO_SUBMIT_LENGTH = 6;

type NewPaymentProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  children?: ReactNode;
  onSaved?: (receipt: PaymentReceipt) => void;
};

type EnrichedPaymentStudent = PaymentStudentRecord & {
  totalFine: number;
  paidAmount: number;
  waivedAmount: number;
  remaining: number;
  status: string;
  courseDisplay: string;
  departmentDisplay: string;
  college: string;
};

function formatPhp(n: number | string | null | undefined): string {
  const v = Math.max(0, Number(n) || 0);
  return `₱${v.toLocaleString("en-PH")}`;
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
    college: inferredDepartment !== "Unassigned" ? inferredDepartment : student.department ?? "—",
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

function sessionLabel(kindRaw: string | null | undefined): string {
  const kind = String(kindRaw ?? "whole").toLowerCase();
  if (kind === "am") return "AM Session";
  if (kind === "pm") return "PM Session";
  return "Whole day";
}

export default function NewPayment({
  children = "+ New Payment",
  className = "",
  onSaved,
  ...props
}: NewPaymentProps) {
  const { data: session } = useAuthSession();
  const encoderDisplayName = getFullNameFromSession(session) || getNavDisplayNameFromSession(session) || "—";
  const recordPaymentMutation = useRecordPayment();

  const [showModal, setShowModal] = useState(false);
  const [payFlowStep, setPayFlowStep] = useState("search");
  const [payFlowStudentId, setPayFlowStudentId] = useState("");
  const [addStudentIdentifier, setAddStudentIdentifier] = useState("");
  const [addStudentError, setAddStudentError] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const addStudentInputRef = useRef<HTMLInputElement | null>(null);
  const addStudentAutoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: payFlowStudentRaw,
    isLoading: isPayFlowStudentLoading,
    isError: isPayFlowStudentError,
  } = useGetPaymentStudent(payFlowStudentId, {
    enabled: showModal && payFlowStep === "review" && Boolean(payFlowStudentId),
  });

  const payFlowStudent = useMemo(() => enrichPaymentStudent(payFlowStudentRaw), [payFlowStudentRaw]);
  const deskEvents = useMemo(() => payFlowStudent?.events ?? [], [payFlowStudent]);
  const deskFilteredTotalFine = useMemo(
    () => deskEvents.reduce((sum, event) => sum + (Number(event.fine) || 0), 0),
    [deskEvents],
  );
  const payFlowPreviewNewBalance = useMemo(() => {
    if (!payFlowStudent) return 0;
    const amount = parseMoneyInput(paymentAmountInput);
    const applied = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    return Math.max(0, payFlowStudent.remaining - applied);
  }, [payFlowStudent, paymentAmountInput]);

  const openPayStudentModal = () => {
    setPayFlowStep("search");
    setPayFlowStudentId("");
    setAddStudentIdentifier("");
    setAddStudentError("");
    setPaymentAmountInput("");
    setPaymentError("");
    setShowModal(true);
  };

  const closePayStudentModal = () => {
    if (addStudentAutoSubmitTimerRef.current) {
      clearTimeout(addStudentAutoSubmitTimerRef.current);
      addStudentAutoSubmitTimerRef.current = null;
    }
    setShowModal(false);
    setPayFlowStep("search");
    setPayFlowStudentId("");
    setAddStudentIdentifier("");
    setAddStudentError("");
    setPaymentAmountInput("");
    setPaymentError("");
  };

  const handleAddStudent = useCallback(async (rawIdentifier?: string) => {
    const identifier = String(rawIdentifier ?? addStudentIdentifier ?? "").trim();
    if (!identifier) {
      setAddStudentError("Enter a Student ID or RFID.");
      return;
    }
    setIsAddingStudent(true);
    setAddStudentError("");
    try {
      const student = await lookupPaymentStudent(identifier);
      if (!student?.studentId) {
        setAddStudentError("Student not found or access denied.");
        return;
      }
      setPayFlowStudentId(student.studentId);
      setPayFlowStep("review");
      setPaymentAmountInput("");
      setPaymentError("");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error != null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data.message
          : "Student not found or access denied.";
      setAddStudentError(message);
    } finally {
      setIsAddingStudent(false);
    }
  }, [addStudentIdentifier]);

  useEffect(() => {
    if (!showModal || payFlowStep !== "search") return;
    const identifier = addStudentIdentifier.trim();
    if (!identifier || isAddingStudent) return;
    if (!/^\d+$/.test(identifier) || identifier.length < MIN_AUTO_SUBMIT_LENGTH) return;

    if (addStudentAutoSubmitTimerRef.current) clearTimeout(addStudentAutoSubmitTimerRef.current);
    addStudentAutoSubmitTimerRef.current = setTimeout(() => {
      void handleAddStudent(identifier);
    }, AUTO_SUBMIT_DEBOUNCE_MS);

    return () => {
      if (addStudentAutoSubmitTimerRef.current) {
        clearTimeout(addStudentAutoSubmitTimerRef.current);
        addStudentAutoSubmitTimerRef.current = null;
      }
    };
  }, [addStudentIdentifier, handleAddStudent, isAddingStudent, payFlowStep, showModal]);

  useEffect(() => {
    if (!showModal || payFlowStep !== "search") return;
    window.setTimeout(() => addStudentInputRef.current?.focus(), 0);
  }, [payFlowStep, showModal]);

  const handleSubmitPayment = async () => {
    if (!payFlowStudent) return;
    const maxPayable = Math.max(0, payFlowStudent.totalFine - payFlowStudent.waivedAmount);
    const previousBalance = payFlowStudent.remaining;
    const amount = parseMoneyInput(paymentAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a valid amount greater than zero.");
      return;
    }
    if (amount > payFlowStudent.remaining) {
      setPaymentError("Amount cannot be greater than remaining balance.");
      return;
    }
    const roundedAmount = Math.round(amount * 100) / 100;
    const newBalance = Math.max(0, previousBalance - roundedAmount);

    if (roundedAmount > maxPayable) {
      setPaymentError("Amount cannot be greater than total payable balance.");
      return;
    }

    try {
      const response = (await recordPaymentMutation.mutateAsync({
        studentId: payFlowStudent.studentId ?? "",
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
        studentId: payFlowStudent.studentId,
        studentName: payFlowStudent.studentName,
        department: payFlowStudent.departmentDisplay || payFlowStudent.department || "—",
        year: payFlowStudent.year ?? "—",
        previousBalance: response?.previousBalance ?? previousBalance,
        amountPaid: response?.amountPaid ?? roundedAmount,
        newBalance: response?.newBalance ?? newBalance,
        note: "",
      };
      onSaved?.(receipt);
      closePayStudentModal();
      setPaymentAmountInput("");
      setPaymentError("");
    } catch (error: unknown) {
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

  return (
    <>
      <button
        type="button"
        className={`rounded-lg border border-[#e6a100] bg-[#ffb300] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e6a100] ${className}`.trim()}
        onClick={openPayStudentModal}
        {...props}
      >
        {children}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[62] flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[#07713c]/30 bg-[#07713c]/10 px-5 py-3">
              <h3 className="text-lg font-semibold text-black">
                {payFlowStep === "search" ? "New Payment" : "Review Fines & Pay"}
              </h3>
              <button
                type="button"
                onClick={closePayStudentModal}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ffb300] text-black hover:bg-[#e6a100]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {payFlowStep === "search" ? (
              <>
                <div className="space-y-4 p-5">
                  <p className="text-sm text-black/75">Search by Student ID or RFID. The student is not saved on this page — only the payment transaction is recorded.</p>
                  <label className="block text-sm text-black">
                    <span className="mb-1 block font-semibold">Student ID or RFID</span>
                    <input
                      ref={addStudentInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={addStudentIdentifier}
                      onChange={(e) => {
                        setAddStudentIdentifier(e.target.value.replace(/\D/g, ""));
                        if (addStudentError) setAddStudentError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (addStudentAutoSubmitTimerRef.current) {
                          clearTimeout(addStudentAutoSubmitTimerRef.current);
                          addStudentAutoSubmitTimerRef.current = null;
                        }
                        void handleAddStudent(addStudentIdentifier);
                      }}
                      placeholder="Tap or enter Student ID / RFID"
                      className="w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                      autoFocus
                    />
                  </label>
                  {addStudentError ? <p className="text-sm font-medium text-black">{addStudentError}</p> : null}
                  {isAddingStudent ? <p className="text-sm text-black/75">Searching student...</p> : null}
                </div>
                <div className="flex shrink-0 justify-end gap-2 border-t border-[#07713c]/20 px-5 py-3">
                  <button type="button" onClick={closePayStudentModal} className="rounded-lg border border-[#07713c]/30 px-4 py-2 text-black hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAddStudent()}
                    disabled={isAddingStudent}
                    className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-4 py-2 font-medium text-black hover:bg-[#07713c]/15 disabled:opacity-60"
                  >
                    {isAddingStudent ? "Searching..." : "Search Student"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  {isPayFlowStudentLoading ? (
                    <p className="py-8 text-center text-sm text-black/85">Calculating fines...</p>
                  ) : isPayFlowStudentError || !payFlowStudent ? (
                    <p className="py-8 text-center text-sm text-black">Unable to load student fines.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#07713c]/25 bg-[#07713c]/[0.04] p-4 text-black sm:grid-cols-2">
                        <div>
                          <p className="text-lg font-bold">{payFlowStudent.studentName}</p>
                          <p className="text-sm">ID: {payFlowStudent.studentId}</p>
                          <p className="text-sm">{payFlowStudent.departmentDisplay || payFlowStudent.department || "—"} · Year {payFlowStudent.year}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-lg border border-[#07713c]/20 bg-white px-3 py-2">
                            <p className="text-xs text-black/70">Total Fine</p>
                            <p className="font-bold tabular-nums">{formatPhp(payFlowStudent.totalFine)}</p>
                          </div>
                          <div className="rounded-lg border border-[#07713c]/20 bg-white px-3 py-2">
                            <p className="text-xs text-black/70">Remaining</p>
                            <p className="font-bold tabular-nums">{formatPhp(payFlowStudent.remaining)}</p>
                          </div>
                          <div className="rounded-lg border border-[#07713c]/20 bg-white px-3 py-2">
                            <p className="text-xs text-black/70">Paid</p>
                            <p className="font-bold tabular-nums">{formatPhp(payFlowStudent.paidAmount)}</p>
                          </div>
                          <div className="hidden rounded-lg border border-[#07713c]/20 bg-white px-3 py-2">
                            <p className="text-xs text-black/70">Waived</p>
                            <p className="font-bold tabular-nums">{formatPhp(payFlowStudent.waivedAmount)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 overflow-x-auto rounded-lg border border-[#07713c]/30">
                        <table className="w-full text-sm">
                          <thead className="border-b border-[#07713c]/30 bg-[#ffb300] text-xs uppercase">
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
                                <td colSpan={4} className="px-4 py-6 text-center text-black/85">No completed events with fines.</td>
                              </tr>
                            ) : (
                              deskEvents.map((event, index) => (
                                <tr key={event.id ?? index} className="border-t border-[#07713c]/20">
                                  <td className="px-4 py-2.5 text-black">{event.name}</td>
                                  <td className="px-4 py-2.5 text-center text-black">{formatEventDateForDisplay(event.date ?? "")}</td>
                                  <td className="px-4 py-2.5 text-center text-black">{sessionLabel(event.sessionKind)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-black">{formatPhp(event.fine)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-[#07713c]/30 bg-[#07713c]/[0.07]">
                              <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-black">Total remaining fines</td>
                              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-black">{formatPhp(deskFilteredTotalFine)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="space-y-3 rounded-xl border border-[#07713c]/25 bg-gray-50 p-4">
                        <p className="text-sm font-semibold uppercase tracking-wide text-black/80">Record Payment</p>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-black">
                          <span>Current balance</span>
                          <span className="font-semibold tabular-nums">{formatPhp(payFlowStudent.remaining)}</span>
                        </div>
                        <label className="block text-sm text-black">
                          <span className="mb-1 block font-semibold">Amount to pay</span>
                          <div className="flex items-center gap-2 rounded-lg border border-[#07713c]/40 bg-white px-3 py-2">
                            <span className="text-black">₱</span>
                            <input
                              value={paymentAmountInput}
                              onChange={(e) => {
                                const normalized = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                                setPaymentAmountInput(normalized);
                                if (paymentError) setPaymentError("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void handleSubmitPayment();
                              }}
                              placeholder="0.00"
                              inputMode="decimal"
                              className="w-full bg-transparent text-right tabular-nums text-black outline-none focus:ring-0"
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
                            className="text-xs font-medium text-[#07713c] underline-offset-2 hover:underline"
                          >
                            Pay full balance ({formatPhp(payFlowStudent.remaining)})
                          </button>
                        ) : null}
                        <div className="flex items-center justify-between border-t border-[#07713c]/20 pt-2 text-sm text-black">
                          <span className="font-medium">New balance after payment</span>
                          <span className="font-bold tabular-nums text-[#07713c]">{formatPhp(payFlowPreviewNewBalance)}</span>
                        </div>
                        {paymentError ? <p className="text-sm font-medium text-black">{paymentError}</p> : null}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-[#07713c]/20 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPayFlowStep("search");
                      setPayFlowStudentId("");
                      setAddStudentIdentifier("");
                      setPaymentAmountInput("");
                      setPaymentError("");
                    }}
                    className="rounded-lg border border-[#07713c]/30 px-4 py-2 text-black hover:bg-gray-50"
                  >
                    Search Another
                  </button>
                  <div className="flex gap-2">
                    <button type="button" onClick={closePayStudentModal} className="rounded-lg border border-[#07713c]/30 px-4 py-2 text-black hover:bg-gray-50">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmitPayment()}
                      disabled={!payFlowStudent || payFlowStudent.remaining <= 0 || recordPaymentMutation.isPending}
                      className="rounded-lg border border-[#07713c] bg-[#07713c] px-4 py-2 font-semibold text-white hover:bg-[#055a2e] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {recordPaymentMutation.isPending ? "Saving..." : "Save Payment"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

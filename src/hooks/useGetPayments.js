import { useQuery } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export const PAYMENTS_QUERY_KEY = ["payments", "students"];
export const PAYMENTS_SUMMARY_QUERY_KEY = ["payments", "summary"];
export const PAYMENTS_TRANSACTIONS_QUERY_KEY = ["payments", "transactions"];

export function paymentStudentQueryKey(studentId) {
  return ["payments", "student", String(studentId ?? "")];
}

function normalizeResponseToArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.students)) return data.students;
  if (Array.isArray(data?.data?.students)) return data.data.students;
  return [];
}

function normalizeSessionKind(kindRaw) {
  const kind = String(kindRaw ?? "whole").trim().toLowerCase();
  if (kind === "am" || kind === "pm" || kind === "whole") return kind;
  if (kind === "am only") return "am";
  if (kind === "pm only") return "pm";
  return "whole";
}

export function mapPaymentRow(raw) {
  const events = Array.isArray(raw?.events) ? raw.events : [];
  const majorRaw = raw?.major;
  const major =
    majorRaw != null && String(majorRaw).trim() !== "" ? String(majorRaw).trim() : null;

  return {
    studentId: String(raw?.studentId ?? ""),
    studentName: String(raw?.studentName ?? "Unknown Student"),
    course: String(raw?.course ?? "—"),
    major,
    department: String(raw?.department ?? "—"),
    year: String(raw?.year ?? "—"),
    totalEvents: Math.max(0, Number(raw?.totalEvents) || 0),
    totalFine: Math.max(0, Number(raw?.totalFine) || 0),
    paidAmount: Math.max(0, Number(raw?.paidAmount) || 0),
    waivedAmount: Math.max(0, Number(raw?.waivedAmount) || 0),
    events: events.map((event) => ({
      id: String(event?.id ?? ""),
      fineId: Number(event?.fineId) || null,
      name: String(event?.name ?? "Untitled Event"),
      date: String(event?.date ?? ""),
      sessionKind: normalizeSessionKind(event?.sessionKind),
      amIn: event?.amIn ?? null,
      amOut: event?.amOut ?? null,
      pmIn: event?.pmIn ?? null,
      pmOut: event?.pmOut ?? null,
      fine: Math.max(0, Number(event?.fine) || 0),
    })),
  };
}

/** List row totals + optional lazy-loaded events. */
export function mergePaymentStudentRow(listRow, detailRow) {
  if (!listRow) return detailRow ?? null;
  if (!detailRow || detailRow.studentId !== listRow.studentId) {
    return { ...listRow, events: listRow.events ?? [] };
  }
  return {
    ...listRow,
    course: detailRow.course ?? listRow.course,
    major: detailRow.major ?? listRow.major,
    department: detailRow.department ?? listRow.department,
    year: detailRow.year ?? listRow.year,
    totalEvents: detailRow.totalEvents ?? listRow.totalEvents,
    totalFine: detailRow.totalFine ?? listRow.totalFine,
    paidAmount: detailRow.paidAmount ?? listRow.paidAmount,
    waivedAmount: detailRow.waivedAmount ?? listRow.waivedAmount,
    events: detailRow.events ?? [],
  };
}

export async function getPayments() {
  const { data } = await api.get("/payments/students");
  const rows = normalizeResponseToArray(data);
  return rows.map((row) => mapPaymentRow(row));
}

export async function getPaymentStudent(studentId) {
  const { data } = await api.get(`/payments/students/${encodeURIComponent(studentId)}`);
  return mapPaymentRow(data?.student ?? data);
}

export async function lookupPaymentStudent(identifier) {
  const { data } = await api.get("/payments/students/lookup", {
    params: { identifier: String(identifier ?? "").trim() },
  });
  return mapPaymentRow(data?.student ?? data);
}

export async function getPaymentSummary() {
  const { data } = await api.get("/payments/summary");
  const summary = data?.summary ?? data ?? {};
  return {
    ledgerTotal: Math.max(0, Number(summary.ledgerTotal) || 0),
    collected: Math.max(0, Number(summary.collected) || 0),
    outstanding: Math.max(0, Number(summary.outstanding) || 0),
    waived: Math.max(0, Number(summary.waived) || 0),
    studentsWithBalance: Math.max(0, Number(summary.studentsWithBalance) || 0),
  };
}

export async function getPaymentTransactions() {
  const { data } = await api.get("/payments/transactions");
  const rows = Array.isArray(data?.transactions) ? data.transactions : [];
  return rows.map((row) => ({
    id: Number(row?.id) || 0,
    transactionCode: String(row?.transactionCode ?? ""),
    studentId: String(row?.studentId ?? ""),
    studentName: String(row?.studentName ?? "Unknown Student"),
    amountPaid: Math.max(0, Number(row?.amountPaid) || 0),
    paymentMethod: String(row?.paymentMethod ?? "Cash"),
    remarks: row?.remarks != null ? String(row.remarks) : null,
    paidAt: String(row?.paidAt ?? ""),
    encodedBy: String(row?.encodedBy ?? ""),
    status: String(row?.status ?? "Partial") === "Paid" ? "Paid" : "Partial",
    department: String(row?.department ?? "—"),
    year: String(row?.year ?? ""),
    previousBalance: row?.previousBalance != null ? Number(row.previousBalance) : null,
    balanceAfter: row?.balanceAfter != null ? Number(row.balanceAfter) : null,
  }));
}

export function useGetPaymentTransactions(options = {}) {
  return useQuery({
    queryKey: PAYMENTS_TRANSACTIONS_QUERY_KEY,
    queryFn: getPaymentTransactions,
    staleTime: 15_000,
    ...options,
  });
}

export function useGetPaymentSummary(options = {}) {
  return useQuery({
    queryKey: PAYMENTS_SUMMARY_QUERY_KEY,
    queryFn: getPaymentSummary,
    staleTime: 30_000,
    ...options,
  });
}

export function useGetPayments(options = {}) {
  return useQuery({
    queryKey: PAYMENTS_QUERY_KEY,
    queryFn: getPayments,
    staleTime: 30_000,
    ...options,
  });
}

export function useGetPaymentStudent(studentId, options = {}) {
  const id = String(studentId ?? "").trim();
  return useQuery({
    queryKey: paymentStudentQueryKey(id),
    queryFn: () => getPaymentStudent(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 30_000,
    ...options,
  });
}

/** Merge one student from mutation responses into list + detail caches. */
export function patchPaymentsStudentInCache(queryClient, rawStudent) {
  if (!rawStudent?.studentId) return;
  const updated = mapPaymentRow(rawStudent);
  const listRow = { ...updated, events: [] };

  queryClient.setQueryData(paymentStudentQueryKey(updated.studentId), updated);

  queryClient.setQueryData(PAYMENTS_QUERY_KEY, (old) => {
    if (!Array.isArray(old)) return old;
    const index = old.findIndex((row) => row.studentId === updated.studentId);
    if (index < 0) return old;
    const next = [...old];
    next[index] = listRow;
    return next;
  });
}

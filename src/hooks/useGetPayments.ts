import { useQuery, type QueryClient, type UseQueryOptions } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import type { PaymentStudentRecord } from "../types/desk-pages";

export const PAYMENTS_QUERY_KEY = ["payments", "students"];
export const PAYMENTS_SUMMARY_QUERY_KEY = ["payments", "summary"];
export const PAYMENTS_TRANSACTIONS_QUERY_KEY = ["payments", "transactions"];

export function paymentStudentQueryKey(studentId: string | number) {
  return ["payments", "student", String(studentId ?? "")];
}

function normalizeResponseToArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.students)) return obj.students as Record<string, unknown>[];
    const nested = obj.data;
    if (nested && typeof nested === "object" && Array.isArray((nested as Record<string, unknown>).students)) {
      return (nested as Record<string, unknown>).students as Record<string, unknown>[];
    }
  }
  return [];
}

function normalizeSessionKind(kindRaw: unknown): "am" | "pm" | "whole" {
  const kind = String(kindRaw ?? "whole").trim().toLowerCase();
  if (kind === "am" || kind === "pm" || kind === "whole") return kind;
  if (kind === "am only") return "am";
  if (kind === "pm only") return "pm";
  return "whole";
}

export type MappedPaymentRow = PaymentStudentRecord & {
  studentId: string;
  studentName: string;
  course: string;
  major: string | null;
  department: string;
  year: string;
  totalEvents: number;
  totalFine: number;
  paidAmount: number;
  waivedAmount: number;
  events: Array<{
    id: string;
    fineId: number | null;
    name: string;
    date: string;
    sessionKind: "am" | "pm" | "whole";
    amIn: unknown;
    amOut: unknown;
    pmIn: unknown;
    pmOut: unknown;
    fine: number;
  }>;
};

export function mapPaymentRow(raw: Record<string, unknown> | null | undefined): MappedPaymentRow {
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
    events: events.map((event: Record<string, unknown>) => ({
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

export function mergePaymentStudentRow(
  listRow: MappedPaymentRow | null | undefined,
  detailRow: MappedPaymentRow | null | undefined,
): MappedPaymentRow | null {
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

export async function getPayments(): Promise<MappedPaymentRow[]> {
  const { data } = await api.get("/payments/students");
  const rows = normalizeResponseToArray(data);
  return rows.map((row) => mapPaymentRow(row));
}

export async function getPaymentStudent(studentId: string): Promise<MappedPaymentRow> {
  const { data } = await api.get(`/payments/students/${encodeURIComponent(studentId)}`);
  const obj = data as Record<string, unknown>;
  return mapPaymentRow((obj?.student ?? obj) as Record<string, unknown>);
}

export async function lookupPaymentStudent(identifier: string): Promise<MappedPaymentRow> {
  const { data } = await api.get("/payments/students/lookup", {
    params: { identifier: String(identifier ?? "").trim() },
  });
  const obj = data as Record<string, unknown>;
  return mapPaymentRow((obj?.student ?? obj) as Record<string, unknown>);
}

export type PaymentSummary = {
  ledgerTotal: number;
  collected: number;
  outstanding: number;
  waived: number;
  studentsWithBalance: number;
};

export async function getPaymentSummary(): Promise<PaymentSummary> {
  const { data } = await api.get("/payments/summary");
  const obj = data as Record<string, unknown>;
  const summary = (obj?.summary ?? obj ?? {}) as Record<string, unknown>;
  return {
    ledgerTotal: Math.max(0, Number(summary.ledgerTotal) || 0),
    collected: Math.max(0, Number(summary.collected) || 0),
    outstanding: Math.max(0, Number(summary.outstanding) || 0),
    waived: Math.max(0, Number(summary.waived) || 0),
    studentsWithBalance: Math.max(0, Number(summary.studentsWithBalance) || 0),
  };
}

export type PaymentTransactionRow = {
  id: number;
  transactionCode: string;
  studentId: string;
  studentName: string;
  amountPaid: number;
  paymentMethod: string;
  remarks: string | null;
  paidAt: string;
  encodedBy: string;
  status: "Paid" | "Partial";
  department: string;
  year: string;
  previousBalance: number | null;
  balanceAfter: number | null;
};

export async function getPaymentTransactions(): Promise<PaymentTransactionRow[]> {
  const { data } = await api.get("/payments/transactions");
  const obj = data as Record<string, unknown>;
  const rows = Array.isArray(obj?.transactions) ? obj.transactions : [];
  return (rows as Record<string, unknown>[]).map((row) => ({
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

type PaymentsQueryOptions = Omit<UseQueryOptions<PaymentTransactionRow[]>, "queryKey" | "queryFn">;
type SummaryQueryOptions = Omit<UseQueryOptions<PaymentSummary>, "queryKey" | "queryFn">;
type PaymentListQueryOptions = Omit<UseQueryOptions<MappedPaymentRow[]>, "queryKey" | "queryFn">;
type PaymentStudentQueryOptions = Omit<UseQueryOptions<MappedPaymentRow>, "queryKey" | "queryFn">;

export function useGetPaymentTransactions(options: PaymentsQueryOptions = {}) {
  return useQuery({
    queryKey: PAYMENTS_TRANSACTIONS_QUERY_KEY,
    queryFn: getPaymentTransactions,
    staleTime: 15_000,
    ...options,
  });
}

export function useGetPaymentSummary(options: SummaryQueryOptions = {}) {
  return useQuery({
    queryKey: PAYMENTS_SUMMARY_QUERY_KEY,
    queryFn: getPaymentSummary,
    staleTime: 30_000,
    ...options,
  });
}

export function useGetPayments(options: PaymentListQueryOptions = {}) {
  return useQuery({
    queryKey: PAYMENTS_QUERY_KEY,
    queryFn: getPayments,
    staleTime: 30_000,
    ...options,
  });
}

export function useGetPaymentStudent(studentId: string, options: PaymentStudentQueryOptions = {}) {
  const id = String(studentId ?? "").trim();
  return useQuery({
    queryKey: paymentStudentQueryKey(id),
    queryFn: () => getPaymentStudent(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 30_000,
    ...options,
  });
}

export function patchPaymentsStudentInCache(
  queryClient: QueryClient,
  rawStudent: Record<string, unknown>,
) {
  if (!rawStudent?.studentId) return;
  const updated = mapPaymentRow(rawStudent);
  const listRow = { ...updated, events: [] };

  queryClient.setQueryData(paymentStudentQueryKey(updated.studentId), updated);

  queryClient.setQueryData(PAYMENTS_QUERY_KEY, (old: MappedPaymentRow[] | undefined) => {
    if (!Array.isArray(old)) return old;
    const index = old.findIndex((row) => row.studentId === updated.studentId);
    if (index < 0) return old;
    const next = [...old];
    next[index] = listRow;
    return next;
  });
}

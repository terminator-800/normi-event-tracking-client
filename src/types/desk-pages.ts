export type DeskPageProps = {
  onLogout?: () => void;
  onNavigate?: (page: string) => void;
  onOpenCreateUser?: () => void;
  isCreateUserOpen?: boolean;
};

export type AttendanceStudent = {
  id?: string | number;
  name?: string;
  course?: string;
  major?: string | null;
  yearLevel?: number | string | null;
  year_level?: number | string | null;
  department?: string;
  status?: string;
  fromServer?: boolean;
  amIn?: string | null;
  amOut?: string | null;
  pmIn?: string | null;
  pmOut?: string | null;
  penalty?: number;
  finePhp?: number;
};

export type AttendanceEvent = {
  id?: string | number;
  name?: string;
  date?: string;
  status?: string;
  venue?: string;
  sessionType?: string;
  students?: AttendanceStudent[];
  finePerAbsence?: number;
  absent?: number;
  totalStudents?: number;
  attended?: number;
  audiences?: unknown;
  audience_notes?: string;
  audienceNotes?: string;
  isAllDepartments?: boolean;
  is_all_departments?: boolean | number;
  event_mode?: "TIME_IN_OUT" | "TIME_IN_ONLY" | string;
  time_in_only?: boolean;
  am_time_in?: string | null;
  am_time_out?: string | null;
  pm_time_in?: string | null;
  pm_time_out?: string | null;
  amTimeIn?: string | null;
  amTimeOut?: string | null;
  pmTimeIn?: string | null;
  pmTimeOut?: string | null;
  am_grace_in?: string | number | null;
  pm_grace_in?: string | number | null;
  amGraceInMinutes?: string | number | null;
  pmGraceInMinutes?: string | number | null;
};

export type DetailEventMeta = {
  sessionType: string;
  hasAmSession: boolean;
  hasPmSession: boolean;
  type: string;
  requiresRegistration: string;
  audience: string;
  duration: string;
  scheduleAmRange: string | null;
  schedulePmRange: string | null;
  scheduleAm: string | null;
  schedulePm: string | null;
  lateAmIn: number | null;
  latePmIn: number | null;
  notes: string;
};

export type PaymentStudentRecord = {
  studentId?: string;
  studentName?: string;
  course?: string;
  major?: string | null;
  department?: string;
  year?: string | number | null;
  totalFine?: number;
  paidAmount?: number;
  waivedAmount?: number;
  totalEvents?: number;
  remaining?: number;
  status?: string;
  courseDisplay?: string;
  departmentDisplay?: string;
  events?: PaymentDeskEvent[];
};

export type PaymentDeskEvent = {
  id?: string | number;
  name?: string;
  date?: string;
  session?: string;
  sessionKind?: string;
  fineAmount?: number;
  fine?: number;
  status?: string;
};

export type PaymentTransaction = {
  id?: string | number;
  transactionCode: string;
  paidAt?: string;
  encodedBy?: string;
  studentId: string;
  studentName: string;
  department?: string;
  year?: string | number;
  amountPaid?: number;
  previousBalance?: number | null;
  balanceAfter?: number | null;
  status?: string;
  remarks?: string;
  paymentMethod?: string;
};

export type PaymentExportRow = EnrichedPaymentStudent & {
  studentId: string;
  studentName: string;
  course: string;
  college?: string;
  major?: string | null;
  year?: string | number | null;
};

export type StudentExportFilters = {
  search?: string;
  status?: string;
  college?: string;
  course?: string;
  year?: string;
  balance?: string;
};

export type PaymentReceipt = {
  transactionCode?: string;
  receiptNo?: string;
  createdAt?: string;
  encodedBy?: string;
  studentId?: string;
  studentName?: string;
  department?: string;
  year?: string | number;
  previousBalance?: number;
  amountPaid?: number;
  newBalance?: number;
  note?: string;
};

export type EnrichedPaymentStudent = PaymentStudentRecord & {
  totalFine: number;
  paidAmount: number;
  waivedAmount: number;
  remaining: number;
  status: string;
  courseDisplay: string;
  departmentDisplay: string;
  college?: string;
};

import api from "../api/axiosInstance";

export type PublicAttendanceEventRow = {
  eventId: number;
  name: string;
  date: string;
  status: string;
  sessionType: "Whole day" | "AM Only" | "PM Only";
  attended: boolean;
  timeIn?: string | null;
  timeOut?: string | null;
  amTimeIn?: string | null;
  amTimeOut?: string | null;
  pmTimeIn?: string | null;
  pmTimeOut?: string | null;
  finePhp: number;
  /** Payment status for this event's fines; null when there is no fine. */
  paymentStatus: "Paid" | "Partial" | "Unpaid" | "Waived" | null;
};

export type PublicStudentAttendanceResult = {
  student: {
    studentId: string;
    name: string;
    yearLevel: number | null;
    department: string | null;
    course: string | null;
  };
  summary: {
    totalEvents: number;
    attended: number;
    missed: number;
    attendanceRate: number;
  };
  events: PublicAttendanceEventRow[];
};

export async function lookupPublicStudentAttendance(
  identifier: string,
): Promise<PublicStudentAttendanceResult> {
  const { data } = await api.get<PublicStudentAttendanceResult>("/public/student-attendance", {
    params: { identifier: String(identifier ?? "").trim() },
  });
  return data;
}

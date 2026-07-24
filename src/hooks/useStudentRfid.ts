import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export type StudentRfidProfile = {
  id: number;
  studentId: string;
  fullName: string;
  rfid: string | null;
  yearLevel: number | null;
  departmentName: string | null;
  courseCode: string | null;
  major: string | null;
};

type LookupResponse = {
  students: StudentRfidProfile[];
  student: StudentRfidProfile | null;
};
type UpdateResponse = { message: string; student: StudentRfidProfile };

export type StudentRfidLookupResult = {
  students: StudentRfidProfile[];
  student: StudentRfidProfile | null;
};

export async function lookupStudentRfid(identifier: string): Promise<StudentRfidLookupResult> {
  const { data } = await api.get<LookupResponse>("/students/rfid/lookup", {
    params: { identifier: identifier.trim() },
  });
  const students = Array.isArray(data.students) ? data.students : [];
  return {
    students,
    student: data.student ?? (students.length === 1 ? students[0] : null),
  };
}

export async function updateStudentRfid(
  studentId: string,
  rfid: string | null,
): Promise<UpdateResponse> {
  const { data } = await api.patch<UpdateResponse>(
    `/students/${encodeURIComponent(studentId)}/rfid`,
    { rfid },
  );
  return data;
}

export function useLookupStudentRfid() {
  return useMutation({
    mutationFn: (identifier: string) => lookupStudentRfid(identifier),
  });
}

export function useUpdateStudentRfid() {
  return useMutation({
    mutationFn: ({ studentId, rfid }: { studentId: string; rfid: string | null }) =>
      updateStudentRfid(studentId, rfid),
  });
}

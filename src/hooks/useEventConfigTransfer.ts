import api from "../api/axiosInstance";

export type EventConfigAudience = {
  department_code: string | null;
  department_name: string | null;
  course_code: string | null;
  course_name: string | null;
  major: string | null;
  year_level: number | null;
};

export type EventConfigPackage = {
  format: string;
  version: number;
  exported_at: string;
  exported_by: { username: string };
  academic_period: { school_year: string; semester: string } | null;
  export_scope: { department_code: string | null; department_name: string | null } | null;
  event: {
    event_uuid?: string;
    master_event_uuid?: string;
    event_version?: number;
    name: string;
    date: string;
    venue: string;
    duration: string;
    event_mode: "TIME_IN_OUT" | "TIME_IN_ONLY" | string;
    am_time_in: string | null;
    am_grace_in: number;
    am_time_out: string | null;
    am_grace_out: number;
    pm_time_in: string | null;
    pm_grace_in: number;
    pm_time_out: string | null;
    pm_grace_out: number;
    is_mandatory: boolean;
    is_all_departments: boolean;
    status: string;
    audience_notes: string | null;
    fine_amount: number;
    has_attendance_password: boolean;
  };
  audiences: EventConfigAudience[];
};

export type EventConfigPreview = {
  valid: boolean;
  warnings: string[];
  errors: string[];
  package: EventConfigPackage;
  duplicate: { id: number; name: string; date: string; status: string } | null;
  unresolved_audiences: EventConfigAudience[];
  academic_period_match: "exact" | "active_fallback" | "missing_active";
};

export type EventConfigImportResult = {
  success: boolean;
  message: string;
  eventId?: number;
  action?: "check" | "create" | "merge" | "update" | "cancel";
  audiences_added?: number;
  preview?: EventConfigPreview;
};

export type EventConfigRosterDepartment = {
  id: number;
  code: string;
  name: string;
};

export type EventConfigRoster = {
  event_id: number;
  is_all_departments: boolean;
  departments: EventConfigRosterDepartment[];
  selected_department_code: string | null;
};

export type AttendanceJsonPreview = {
  valid: boolean;
  warnings: string[];
  errors: string[];
  package: {
    format: string;
    version: number;
    event_uuid: string;
    department: { code: string; name: string | null };
    summary: { total: number; present: number; absent: number };
  };
  master_event: {
    id: number;
    name: string;
    date: string;
    status: string;
    event_uuid: string;
  } | null;
};

export type AttendanceJsonImportResult = {
  success: boolean;
  message: string;
  eventId?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  unmatched?: number;
  preview?: AttendanceJsonPreview;
};

function filenameFromDisposition(disposition: string | undefined, fallback: string): string {
  const match = String(disposition ?? "").match(/filename="?([^";\n]+)"?/);
  return match?.[1]?.trim() || fallback;
}

function triggerBlobDownload(data: BlobPart, filename: string, mime = "application/json") {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchEventConfigRoster(
  eventId: string | number,
  departmentCode?: string | null,
): Promise<EventConfigRoster> {
  const params: Record<string, string> = {};
  const code = String(departmentCode ?? "").trim();
  if (code) params.departmentCode = code;
  const { data } = await api.get<EventConfigRoster>(`/export/event/${eventId}/config/roster`, {
    params,
  });
  return data;
}

export async function downloadEventConfig(
  eventId: string | number,
  opts?: { departmentCode?: string | null },
): Promise<void> {
  const params: Record<string, string> = {};
  const code = String(opts?.departmentCode ?? "").trim();
  if (code) params.departmentCode = code;

  const response = await api.get(`/export/event/${eventId}/config`, {
    responseType: "blob",
    params,
  });

  const disposition = String(response.headers?.["content-disposition"] ?? "");
  const filename = filenameFromDisposition(disposition, `event-${eventId}_config.json`);
  triggerBlobDownload(response.data as BlobPart, filename);
}

/** Download one config JSON per selected department (CSG multi-dept export). */
export async function downloadEventConfigForDepartments(
  eventId: string | number,
  departmentCodes: string[],
): Promise<void> {
  const codes = [...new Set(departmentCodes.map((c) => c.trim()).filter(Boolean))];
  if (codes.length === 0) {
    await downloadEventConfig(eventId);
    return;
  }
  for (const code of codes) {
    await downloadEventConfig(eventId, { departmentCode: code });
  }
}

export async function previewEventConfigFile(file: File): Promise<EventConfigPreview> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<EventConfigPreview>("/export/event/config/preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    validateStatus: (s) => s === 200 || s === 422,
  });
  return data;
}

export async function importEventConfigFile(opts: {
  file: File;
  attendancePassword: string;
  action?: "check" | "create" | "merge" | "update" | "cancel";
}): Promise<EventConfigImportResult> {
  const formData = new FormData();
  formData.append("file", opts.file);
  formData.append("attendancePassword", opts.attendancePassword);
  formData.append("action", opts.action ?? "check");
  const { data } = await api.post<EventConfigImportResult>("/export/event/config/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    validateStatus: (s) => s === 200 || s === 422,
  });
  return data;
}

export async function downloadAttendanceJson(
  eventId: string | number,
  opts?: { departmentCode?: string | null },
): Promise<void> {
  const params: Record<string, string> = {};
  const code = String(opts?.departmentCode ?? "").trim();
  if (code) params.departmentCode = code;

  const response = await api.get(`/export/event/${eventId}/attendance/json`, {
    responseType: "blob",
    params,
  });

  const disposition = String(response.headers?.["content-disposition"] ?? "");
  const filename = filenameFromDisposition(disposition, `event-${eventId}_attendance.json`);
  triggerBlobDownload(response.data as BlobPart, filename);
}

export async function previewAttendanceJsonFile(file: File): Promise<AttendanceJsonPreview> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<AttendanceJsonPreview>("/export/event/attendance/preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    validateStatus: (s) => s === 200 || s === 422,
  });
  return data;
}

export async function importAttendanceJsonFile(opts: {
  file: File;
  action?: "skip" | "update";
}): Promise<AttendanceJsonImportResult> {
  const formData = new FormData();
  formData.append("file", opts.file);
  formData.append("action", opts.action ?? "skip");
  const { data } = await api.post<AttendanceJsonImportResult>(
    "/export/event/attendance/import",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      validateStatus: (s) => s === 200 || s === 422,
    },
  );
  return data;
}

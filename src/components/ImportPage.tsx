import { type ChangeEvent, useMemo, useRef, useState } from "react";
import axiosApi from "../api/axiosInstance";
import Sidebar from "./Sidebar";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import UserCircleIcon from "./UserCircleIcon";
import PaginationBar from "./PaginationBar";
import { getAppNavItems } from "../utils/appNav";
import { getDashboardRoleLabel, isCsgPresident } from "../utils/roles";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { useImportStudentsCsv } from "../hooks/useImportStudentsCsv";
import { useActiveAcademicPeriod } from "../hooks/useAcademicPeriods";
import {
  DATA_RESET_CONFIRMATION_PHRASE,
  useDataReset,
  useDataResetPreview,
} from "../hooks/useDataReset";
import { detectStudentCsvFormat, validateStudentCsvHeaders } from "../utils/studentCsvImport";
import { getApiErrorMessage } from "../types/api";
import type { DeskPageProps } from "../types/desk-pages";

type CsvPreview = {
  headers: string[];
  rows: string[][];
};

type ImportExistingStudent = {
  row: number;
  studentId: string;
  fullName: string;
  rfid?: string;
  yearLevelLabel?: string;
  yearLevel?: string;
  departments?: string;
  majors?: string;
};

type StudentCsvImportResult = {
  processedRows?: number;
  importedRows?: number;
  skippedRows?: number;
  inserted?: {
    departments?: number;
    programs?: number;
    students?: number;
    enrollments?: number;
  };
  errors?: Array<{ row: number; message: string }>;
  skipped?: Array<{ row: number; reason: string }>;
  existingStudents?: ImportExistingStudent[];
};

type DataResetPreviewCounts = {
  students?: number;
  enrollments?: number;
  departments?: number;
  programs?: number;
  events?: number;
  attendance?: number;
  fines?: number;
  payments?: number;
  nonAdminUsers?: number;
  adminUsers?: number;
};

function parseCsvPreview(text: string): CsvPreview {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (line: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    values.push(current.trim());
    return values;
  };
  const rawHeaders = split(lines[0]);
  let lastNonEmptyHeaderIndex = rawHeaders.length - 1;
  while (lastNonEmptyHeaderIndex >= 0 && !String(rawHeaders[lastNonEmptyHeaderIndex] || "").trim()) {
    lastNonEmptyHeaderIndex -= 1;
  }
  const maxColumns = Math.max(lastNonEmptyHeaderIndex + 1, 0);
  const headers = rawHeaders.slice(0, maxColumns);
  const rows = lines.slice(1).map((line) => split(line).slice(0, maxColumns));

  return { headers, rows };
}

/** Import page main content text (sidebar + top header excluded). */
const IMPORT_PAGE_TEXT = "text-black";
const IMPORT_TH_TEXT = "font-bold text-black";
const TABLE_CELL_NOWRAP = "[&_th]:whitespace-nowrap [&_tbody_td]:whitespace-nowrap";
const EXISTING_STUDENTS_PAGE_SIZE = 10;

export default function ImportPage({ onNavigate, onLogout }: DeskPageProps) {
  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const normalizedRole = String(role || "").toLowerCase().trim();
  const isAdmin = normalizedRole === "admin";
  const isSuperAdmin = normalizedRole === "super_admin";
  const isCsg = isCsgPresident(normalizedRole);
  const canManage = isAdmin || isSuperAdmin;

  // ── Excel import state (CSG President only) ──────────────────────────────
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [xlsxPreview, setXlsxPreview] = useState<null | {
    valid: boolean; message: string;
    eventId?: number | null; eventName?: string; eventDate?: string;
    studentCount?: number; paymentCount?: number;
    exportedBy?: string; exportDate?: string;
  }>(null);
  const [xlsxImporting, setXlsxImporting] = useState(false);
  const [xlsxResult, setXlsxResult] = useState<null | { success: boolean; message: string; attendanceCreated: number; attendanceSkipped: number }>(null);
  const [xlsxDragging, setXlsxDragging] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode] = useState("export");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewText, setPreviewText] = useState("");
  const [result, setResult] = useState<StudentCsvImportResult | null>(null);
  const [error, setError] = useState("");
  const [existingStudentsPage, setExistingStudentsPage] = useState(1);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetAcknowledged, setResetAcknowledged] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [showNoActivePeriodModal, setShowNoActivePeriodModal] = useState(false);
  const importMutation = useImportStudentsCsv();
  const { data: activeAcademicPeriod, isLoading: isActivePeriodLoading } = useActiveAcademicPeriod(canManage);
  const hasActiveAcademicPeriod = Boolean(activeAcademicPeriod?.id);
  const {
    data: resetPreview,
    refetch: refetchResetPreview,
    isFetching: isResetPreviewLoading,
  } = useDataResetPreview({ enabled: canManage });
  const resetMutation = useDataReset();
  const resetCounts = resetPreview as DataResetPreviewCounts | undefined;

  const navItems = getAppNavItems({ isAdmin: canManage, isSuperAdmin, isCsgPresident: isCsg });

  const handleXlsxFile = async (file: File) => {
    setXlsxFile(file);
    setXlsxPreview(null);
    setXlsxResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await axiosApi.post("/export/event/import-preview", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setXlsxPreview(res.data as typeof xlsxPreview);
    } catch (err: unknown) {
      const msg = err instanceof Error && "response" in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Validation failed.")
        : "Validation failed.";
      setXlsxPreview({ valid: false, message: msg });
    }
  };

  const handleXlsxImport = async () => {
    if (!xlsxFile) return;
    setXlsxImporting(true);
    const fd = new FormData();
    fd.append("file", xlsxFile);
    try {
      const res = await axiosApi.post("/export/event/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setXlsxResult(res.data as typeof xlsxResult);
    } catch (err: unknown) {
      const msg = err instanceof Error && "response" in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Import failed.")
        : "Import failed.";
      setXlsxResult({ success: false, message: msg, attendanceCreated: 0, attendanceSkipped: 0 });
    } finally {
      setXlsxImporting(false);
    }
  };

  const preview = useMemo(() => parseCsvPreview(previewText), [previewText]);
  const headerValidation = useMemo(
    () => validateStudentCsvHeaders(preview.headers, preview.rows.length),
    [preview.headers, preview.rows.length],
  );
  const detectedFormat = useMemo(
    () => detectStudentCsvFormat(preview.headers),
    [preview.headers],
  );
  const existingStudents = result?.existingStudents ?? [];
  const existingStudentsTotalPages = Math.max(
    1,
    Math.ceil(existingStudents.length / EXISTING_STUDENTS_PAGE_SIZE) || 1,
  );
  const safeExistingStudentsPage = Math.min(existingStudentsPage, existingStudentsTotalPages);
  const paginatedExistingStudents = useMemo(() => {
    const start = (safeExistingStudentsPage - 1) * EXISTING_STUDENTS_PAGE_SIZE;
    return existingStudents.slice(start, start + EXISTING_STUDENTS_PAGE_SIZE);
  }, [existingStudents, safeExistingStudentsPage]);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    setError("");
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (!file) {
      setPreviewText("");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a .csv file.");
      setPreviewText("");
      return;
    }
    const text = await file.text();
    setPreviewText(text);
  };

  const onResetAllData = () => {
    setResetMessage("");
    setResetError("");
    if (!resetAcknowledged) {
      setResetError("Check the box to confirm you understand this cannot be undone.");
      return;
    }
    if (resetConfirmation.trim() !== DATA_RESET_CONFIRMATION_PHRASE) {
      setResetError(`Type ${DATA_RESET_CONFIRMATION_PHRASE} to confirm.`);
      return;
    }
    resetMutation.mutate(DATA_RESET_CONFIRMATION_PHRASE, {
      onSuccess: (data) => {
        const resetData = data as { message?: string } | null | undefined;
        setResetMessage(resetData?.message?.trim() || "All data has been reset.");
        setResetConfirmation("");
        setResetAcknowledged(false);
        setResult(null);
        setPreviewText("");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        refetchResetPreview();
      },
      onError: (err) => {
        setResetError(getApiErrorMessage(err, "Reset failed."));
      },
    });
  };

  const onImport = () => {
    const fallbackFile = fileInputRef.current?.files?.[0] ?? null;
    const fileToImport = selectedFile ?? fallbackFile;
    if (!fileToImport) {
      setError("");
      fileInputRef.current?.click();
      return;
    }
    if (!isActivePeriodLoading && !hasActiveAcademicPeriod) {
      setShowNoActivePeriodModal(true);
      return;
    }
    if (!headerValidation.valid) {
      setError(headerValidation.message || "CSV is empty.");
      return;
    }
    setError("");
    setResult(null);
    setExistingStudentsPage(1);
    importMutation.mutate(fileToImport, {
      onSuccess: (data) => setResult(data as StudentCsvImportResult),
      onError: (err) => {
        const message = getApiErrorMessage(err, "Import failed.");
        const isMissingActivePeriod =
          err.response?.status === 403 &&
          /active school year|academic period/i.test(message);
        if (isMissingActivePeriod) {
          setShowNoActivePeriodModal(true);
          setError("");
          return;
        }
        setError(message);
      },
      onSettled: () => {
        setSelectedFile(null);
        setPreviewText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <Sidebar navItems={navItems} onNavigate={onNavigate} activeNavId="import" />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">
                Import Students CSV
              </h1>
              <NavbarAcademicPeriod className="mt-1" />
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLogout((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center text-[#07713c] rounded-lg hover:bg-green-50"
                  aria-label="Account menu"
                >
                  <UserCircleIcon />
                </button>
                {showLogout && (
                  <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[100px] z-10">
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

        <main className={`flex-1 overflow-auto p-6 ${IMPORT_PAGE_TEXT} [&_th]:font-bold [&_th]:!text-black`}>
          <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <p className="text-sm text-black">
                Upload a student CSV (export from Excel as CSV UTF-8). Use the 5-column format below to link each
                student to a college department.
              </p>
              <div className="rounded-lg border border-green-100 bg-green-50/60 px-3 py-2 text-sm text-black space-y-1">
                <p>
                  <span className="text-black">Imports all rows</span> — duplicates are updated, and
                  missing fields are left empty when not provided.
                </p>
                <p>
                  <span className="text-black">Typical columns:</span>{" "}
                  <code className="text-sm">id_number</code>, <code className="text-sm">rfid</code>,{" "}
                  <code className="text-sm">full_name</code>, <code className="text-sm">level</code>,{" "}
                  <code className="text-sm">department</code>
                </p>
              </div>
              {preview.headers.length > 0 && headerValidation.valid && (
                <p className="text-sm text-black">
                  Ready to import {preview.rows.length} row(s) ({detectedFormat} mapping).
                </p>
              )}
              {preview.headers.length > 0 && !headerValidation.valid && (
                <p className="text-sm text-black">{headerValidation.message}</p>
              )}
              {!isActivePeriodLoading && !hasActiveAcademicPeriod ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Student import is disabled until a super admin activates a school year and semester.
                </p>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                className="block w-full text-sm"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onImport}
                  disabled={importMutation.isPending}
                  className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-4 py-2 text-sm font-medium text-black disabled:opacity-60 hover:bg-[#07713c]/15"
                >
                  {importMutation.isPending ? "Importing..." : "Start Import"}
                </button>
                {selectedFile && (
                  <p className="text-sm text-black/75">
                    Selected: <span className="text-black">{selectedFile.name}</span>
                  </p>
                )}
              </div>
              {error && <p className="text-sm text-black">{error}</p>}
              <p className="text-sm text-black/75">Role: {roleLabel}</p>
            </div>

            {preview.headers.length > 0 && (
              <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm text-black mb-3">CSV Preview</h3>
                <p className="mb-3 text-sm text-black">Total students in CSV: {preview.rows.length}</p>
                <div className="min-w-0 overflow-auto">
                  <table className={`min-w-full text-sm border-collapse ${TABLE_CELL_NOWRAP}`}>
                    <thead className={`bg-[#07713c]/10 ${IMPORT_TH_TEXT}`}>
                      <tr>
                        {preview.headers.map((header, idx) => (
                          <th key={`${header}-${idx}`} className="border border-[#07713c]/20 px-2 py-1 text-left">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, rowIdx) => (
                        <tr key={`preview-row-${rowIdx}`}>
                          {preview.headers.map((_, colIdx) => (
                            <td key={`cell-${rowIdx}-${colIdx}`} className="border px-2 py-1">
                              {row[colIdx] || ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {canManage && (
              <div className="min-w-0 rounded-xl border border-red-300 bg-red-50/40 p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-black">Reset all data</h3>
                  <p className="mt-1 text-sm text-black">
                    Deletes all students, colleges, courses, events, attendance, fines, payments, and
                    non-admin users. <span className="font-bold text-black">Admin account(s) are kept.</span> This
                    cannot be undone.
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-white p-3 text-sm text-black">
                  <p className="mb-2 font-bold text-black">Records that will be removed</p>
                  {isResetPreviewLoading && !resetPreview ? (
                    <p className="text-black/75">Loading counts…</p>
                  ) : resetCounts ? (
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                      <li>Students: {resetCounts.students ?? 0}</li>
                      <li>Enrollments: {resetCounts.enrollments ?? 0}</li>
                      <li>Departments: {resetCounts.departments ?? 0}</li>
                      <li>Programs: {resetCounts.programs ?? 0}</li>
                      <li>Events: {resetCounts.events ?? 0}</li>
                      <li>Attendance: {resetCounts.attendance ?? 0}</li>
                      <li>Fines: {resetCounts.fines ?? 0}</li>
                      <li>Payments: {resetCounts.payments ?? 0}</li>
                      <li>Non-admin users: {resetCounts.nonAdminUsers ?? 0}</li>
                    </ul>
                  ) : (
                    <p className="text-black/75">Could not load preview.</p>
                  )}
                  {resetCounts && (
                    <p className="mt-2 text-sm text-black">
                      Admin accounts kept: {resetCounts.adminUsers ?? 0}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => refetchResetPreview()}
                    disabled={isResetPreviewLoading}
                    className="mt-2 text-sm text-black underline disabled:opacity-60"
                  >
                    Refresh counts
                  </button>
                </div>
                <label className="flex items-start gap-2 text-sm text-black">
                  <input
                    type="checkbox"
                    checked={resetAcknowledged}
                    onChange={(e) => setResetAcknowledged(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>I understand all data above will be permanently deleted (admin kept).</span>
                </label>
                <div>
                  <label htmlFor="reset-confirmation" className="block text-sm text-black mb-1">
                    Type <code className="text-sm font-bold">{DATA_RESET_CONFIRMATION_PHRASE}</code> to confirm
                  </label>
                  <input
                    id="reset-confirmation"
                    type="text"
                    value={resetConfirmation}
                    onChange={(e) => setResetConfirmation(e.target.value)}
                    placeholder={DATA_RESET_CONFIRMATION_PHRASE}
                    className="block w-full max-w-md appearance-none rounded-lg border-[1.5px] border-red-600 bg-white px-3 py-2 text-sm text-black shadow-none outline-none [box-shadow:none] hover:border-red-700 focus:border-red-700 focus:outline-none focus:ring-0 focus-visible:border-red-700 focus-visible:outline-none focus-visible:ring-0 focus-visible:[box-shadow:none]"
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  onClick={onResetAllData}
                  disabled={resetMutation.isPending}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  {resetMutation.isPending ? "Resetting…" : "Reset all data"}
                </button>
                {resetError && <p className="text-sm text-black">{resetError}</p>}
                {resetMessage && <p className="text-sm text-black">{resetMessage}</p>}
              </div>
            )}

            {result && (
              <div className="min-w-0 rounded-xl border border-green-200 bg-green-50 p-5 text-black">
                <h3 className="text-sm text-black mb-2">Import Summary</h3>
                <p className="text-sm text-black">Processed: {result.processedRows}</p>
                <p className="text-sm text-black">Imported: {result.importedRows}</p>
                <p className="text-sm text-black">Skipped: {result.skippedRows}</p>
                <p className="text-sm text-black">
                  Inserted - Departments: {result.inserted?.departments ?? 0}, Programs: {result.inserted?.programs ?? 0}, Students:{" "}
                  {result.inserted?.students ?? 0}, Enrollments: {result.inserted?.enrollments ?? 0}
                </p>
                {(result.errors?.length ?? 0) > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-black">Row Errors</p>
                    <ul className="text-sm text-black list-disc pl-5">
                      {(result.errors ?? []).slice(0, 15).map((item, idx) => (
                        <li key={`${item.row}-${idx}`}>Row {item.row}: {item.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(result.skipped?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-black">Skipped Rows and Reasons</p>
                    <ul className="text-sm text-black list-disc pl-5">
                      {(result.skipped ?? []).slice(0, 50).map((item, idx) => (
                        <li key={`skip-${item.row}-${idx}`}>Row {item.row}: {item.reason}</li>
                      ))}
                    </ul>
                    {(result.skipped?.length ?? 0) > 50 && (
                      <p className="mt-1 text-sm text-black">Showing first 50 skipped rows.</p>
                    )}
                  </div>
                )}
                {(result.existingStudents?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-black">Updated Existing Students (still imported)</p>
                    <div className="mt-2 min-w-0 overflow-auto rounded-lg border border-[#07713c]/20 bg-white">
                      <table className={`min-w-full border-collapse text-sm text-black ${TABLE_CELL_NOWRAP}`}>
                        <thead className={`bg-[#07713c]/10 ${IMPORT_TH_TEXT}`}>
                          <tr>
                            <th className="border border-[#07713c]/20 px-2 py-1 text-left">Row</th>
                            <th className="border border-[#07713c]/20 px-2 py-1 text-left">Student ID</th>
                            <th className="border border-[#07713c]/20 px-2 py-1 text-left">Full Name</th>
                            <th className="border border-[#07713c]/20 px-2 py-1 text-left">RFID</th>
                            <th className="border border-[#07713c]/20 px-2 py-1 text-left">Level</th>
                            <th className="border border-[#07713c]/20 px-2 py-1 text-left">Department(s)</th>
                            <th className="border border-[#07713c]/20 px-2 py-1 text-left">Major(s)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedExistingStudents.map((item, idx) => (
                            <tr key={`existing-${item.row}-${item.studentId}-${idx}`} className="odd:bg-white even:bg-[#07713c]/[0.04]">
                              <td className="border border-[#07713c]/15 px-2 py-1 align-top">{item.row}</td>
                              <td className="border border-[#07713c]/15 px-2 py-1 align-top">{item.studentId}</td>
                              <td className="border border-[#07713c]/15 px-2 py-1 align-top">{item.fullName}</td>
                              <td className="border border-[#07713c]/15 px-2 py-1 align-top">{item.rfid || "—"}</td>
                              <td className="border border-[#07713c]/15 px-2 py-1 align-top">{item.yearLevelLabel || item.yearLevel || "—"}</td>
                              <td className="border border-[#07713c]/15 px-2 py-1 align-top">{item.departments || "N/A"}</td>
                              <td className="border border-[#07713c]/15 px-2 py-1 align-top">{item.majors || "No major"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <PaginationBar
                      totalCount={existingStudents.length}
                      page={safeExistingStudentsPage}
                      pageSize={EXISTING_STUDENTS_PAGE_SIZE}
                      onPageChange={setExistingStudentsPage}
                      itemLabel="existing students"
                      className="!text-black border-[#07713c]/20"
                    />
                  </div>
                )}
              </div>
            )}
          {/* ── Excel Import (CSG President only) ───────────────────── */}
          {isCsg && (
            <div className="min-w-0 rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-[#07713c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.5C16.5 22.15 20 17.25 20 12V6l-8-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <h2 className="text-base font-bold text-black">Import Protected Event Excel</h2>
              </div>
              <p className="text-xs text-black/60">
                Upload an event Excel file exported by the system. The file will be automatically validated
                against the current System Export Password before importing.
              </p>

              {/* File drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setXlsxDragging(true); }}
                onDragLeave={() => setXlsxDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setXlsxDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleXlsxFile(f);
                }}
                onClick={() => xlsxInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center cursor-pointer transition-colors ${
                  xlsxDragging ? "border-[#07713c] bg-green-50" : "border-gray-300 bg-gray-50 hover:border-[#07713c]/60 hover:bg-green-50/40"
                }`}
              >
                <svg className="h-9 w-9 text-[#07713c]/50 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                </svg>
                <p className="text-sm font-medium text-black">
                  {xlsxFile ? xlsxFile.name : "Drop an Excel (.xlsx) file here or click to browse"}
                </p>
                <p className="text-xs text-black/50 mt-1">Accepts NMCI-exported event Excel files only</p>
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleXlsxFile(f);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Preview result */}
              {xlsxPreview && (
                <div className={`rounded-xl border p-4 ${xlsxPreview.valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-start gap-2 mb-2">
                    {xlsxPreview.valid ? (
                      <svg className="h-5 w-5 text-green-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 6L9 17l-5-5" /></svg>
                    ) : (
                      <svg className="h-5 w-5 text-red-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    )}
                    <p className={`text-sm font-semibold ${xlsxPreview.valid ? "text-green-800" : "text-red-700"}`}>{xlsxPreview.message}</p>
                  </div>
                  {xlsxPreview.valid && (
                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-green-900">
                      {xlsxPreview.eventName && <><span className="font-medium">Event:</span><span>{xlsxPreview.eventName}</span></>}
                      {xlsxPreview.eventDate && <><span className="font-medium">Date:</span><span>{xlsxPreview.eventDate}</span></>}
                      {xlsxPreview.studentCount != null && <><span className="font-medium">Students:</span><span>{xlsxPreview.studentCount}</span></>}
                      {xlsxPreview.paymentCount != null && <><span className="font-medium">Payment records:</span><span>{xlsxPreview.paymentCount}</span></>}
                      {xlsxPreview.exportedBy && <><span className="font-medium">Exported by:</span><span>{xlsxPreview.exportedBy}</span></>}
                    </div>
                  )}
                </div>
              )}

              {/* Import button */}
              {xlsxPreview?.valid && !xlsxResult && (
                <button
                  type="button"
                  onClick={() => void handleXlsxImport()}
                  disabled={xlsxImporting}
                  className="w-full rounded-lg bg-[#07713c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#055a2e] disabled:opacity-60"
                >
                  {xlsxImporting ? "Importing..." : "Import Event Data"}
                </button>
              )}

              {/* Import result */}
              {xlsxResult && (
                <div className={`rounded-xl border p-4 ${xlsxResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <p className={`text-sm font-semibold ${xlsxResult.success ? "text-green-800" : "text-red-700"}`}>{xlsxResult.message}</p>
                  {xlsxResult.success && (
                    <p className="mt-1 text-xs text-green-700">
                      Attendance records created: {xlsxResult.attendanceCreated} · Skipped: {xlsxResult.attendanceSkipped}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => { setXlsxFile(null); setXlsxPreview(null); setXlsxResult(null); }}
                    className="mt-3 text-xs text-[#07713c] underline hover:text-[#055a2e]"
                  >
                    Import another file
                  </button>
                </div>
              )}
            </div>
          )}

          </div>{/* end mx-auto max-w-7xl */}
        </main>
      </div>

      {showNoActivePeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
              <h3 className="text-lg font-semibold text-amber-950">Cannot import students yet</h3>
            </div>
            <div className="space-y-4 p-5 text-sm text-black">
              <p>
                There is no <span className="font-semibold">active school year and semester</span> configured for the
                system right now.
              </p>
              <p>
                Student CSV imports are linked to the active academic period. Before you can import, a super admin must
                create and activate a school year and semester under <span className="font-semibold">Academic Settings</span>.
              </p>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-black/80">
                After activation, return here and upload your CSV again. Imported enrollments will be tied to that
                active period.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowNoActivePeriodModal(false)}
                  className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-medium text-white hover:bg-[#055a2e]"
                >
                  OK, got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-[#07713c]/30 bg-[#07713c]/10 px-5 py-3">
              <h3 className="font-semibold text-black">
                {reportMode === "settings"
                  ? `${roleLabel} Settings`
                  : reportMode === "import"
                    ? "Import Data"
                    : "Export Data"}
              </h3>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-black">
                {reportMode === "settings"
                  ? "Settings are not implemented yet (this is a placeholder)."
                  : reportMode === "import"
                    ? "Use the Import page main section to upload and import CSV."
                    : "Export is not implemented in Import page yet."}
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="rounded-lg border border-[#07713c]/30 px-4 py-2 text-sm text-black hover:bg-[#07713c]/10"
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

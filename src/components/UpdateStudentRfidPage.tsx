import { useEffect, useRef, useState } from "react";
import AppSidebarNav from "./AppSidebarNav";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import { useAppNavItems, useMyPermissions } from "../hooks/useMyPermissions";
import {
  useLookupStudentRfid,
  useUpdateStudentRfid,
  type StudentRfidProfile,
} from "../hooks/useStudentRfid";
import { getApiErrorMessage } from "../types/api";
import { formatCourseWithMajor } from "../utils/courseMajorDisplay";
import type { DeskPageProps } from "../types/desk-pages";

function yearLabel(year: number | null | undefined): string {
  if (year == null || !Number.isFinite(Number(year))) return "—";
  const n = Number(year);
  if (n === 1) return "1st Year";
  if (n === 2) return "2nd Year";
  if (n === 3) return "3rd Year";
  if (n === 4) return "4th Year";
  return `Year ${n}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-[#36454F]/60">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-[#36454F]">{value || "—"}</p>
    </div>
  );
}

export default function UpdateStudentRfidPage({ onNavigate, onLogout }: DeskPageProps) {
  const navItems = useAppNavItems();
  const { has: hasPermission, isSuperAdmin } = useMyPermissions();
  const canUpdate =
    isSuperAdmin ||
    hasPermission("nav.settings.update_rfid") ||
    hasPermission("action.students.update_rfid");

  const lookupMutation = useLookupStudentRfid();
  const updateMutation = useUpdateStudentRfid();

  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<StudentRfidProfile[]>([]);
  const [student, setStudent] = useState<StudentRfidProfile | null>(null);
  const [rfid, setRfid] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const rfidInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const selectStudent = (found: StudentRfidProfile) => {
    setStudent(found);
    setMatches([]);
    setRfid(found.rfid ?? "");
    setQuery(found.studentId || found.fullName || query);
    setError("");
    setSuccess("");
    setTimeout(() => rfidInputRef.current?.focus(), 50);
  };

  const runLookup = (raw: string) => {
    const value = raw.trim();
    setError("");
    setSuccess("");
    setStudent(null);
    setMatches([]);
    setRfid("");
    if (!value) {
      setError("Enter a name or Student ID.");
      return;
    }
    lookupMutation.mutate(value, {
      onSuccess: (result) => {
        if (result.student) {
          selectStudent(result.student);
          return;
        }
        if (result.students.length > 1) {
          setMatches(result.students);
          return;
        }
        setError("Student not found.");
      },
      onError: (err) => {
        setError(getApiErrorMessage(err, "Student not found."));
      },
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runLookup(query);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setError("");
    setSuccess("");
    const next = rfid.trim();
    updateMutation.mutate(
      { studentId: student.studentId, rfid: next || null },
      {
        onSuccess: (data) => {
          setStudent(data.student);
          setRfid(data.student.rfid ?? "");
          setSuccess(data.message || "Student RFID updated.");
        },
        onError: (err) => setError(getApiErrorMessage(err, "Failed to update RFID.")),
      },
    );
  };

  const handleClearStudent = () => {
    setStudent(null);
    setMatches([]);
    setRfid("");
    setQuery("");
    setError("");
    setSuccess("");
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  if (!canUpdate) {
    return (
      <div className="flex min-h-screen bg-[#07713c]/[0.04] [&_button]:cursor-pointer">
        <aside className="sticky top-0 flex h-screen max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto bg-[#07713c] text-white">
          <SidebarBrand />
          <AppSidebarNav items={navItems} activeNavId="update_student_rfid" onNavigate={onNavigate} />
          <SidebarUserFullName onLogout={onLogout} />
        </aside>
        <main className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-red-700">You do not have permission to update students.</p>
        </main>
      </div>
    );
  }

  const courseDisplay = student
    ? formatCourseWithMajor(student.courseCode, student.major) || "—"
    : "—";

  return (
    <div className="flex min-h-screen bg-[#07713c]/[0.04] [&_button]:cursor-pointer">
      <aside className="sticky top-0 flex h-screen max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto bg-[#07713c] text-white [&_p]:text-white">
        <SidebarBrand />
        <AppSidebarNav items={navItems} activeNavId="update_student_rfid" onNavigate={onNavigate} />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto w-full max-w-4xl">
            <h1 className="font-[Inter,sans-serif] text-[30px] font-extrabold leading-tight text-[#07713c]">
              Update Student
            </h1>
            <p className="mt-0.5 text-sm text-[#36454F]/60">
              Search by name or Student ID, then edit the RFID
            </p>
            <NavbarAcademicPeriod className="mt-1" />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 text-black">
          <div className="mx-auto w-full max-w-4xl space-y-4">
            <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-black">Find student</h2>
              <p className="mt-1 text-sm text-black/75">
                Enter a <strong>name</strong> or <strong>Student ID</strong>, then press Enter or
                Search.
              </p>

              <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1 text-sm font-semibold text-black">
                  Name / Student ID
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setError("");
                      setSuccess("");
                      setMatches([]);
                      if (student) {
                        setStudent(null);
                        setRfid("");
                      }
                    }}
                    placeholder="e.g. Juan Dela Cruz or 2024-0001"
                    autoComplete="off"
                    disabled={lookupMutation.isPending}
                    className="mt-1.5 w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  />
                </label>
                <button
                  type="submit"
                  disabled={lookupMutation.isPending || !query.trim()}
                  className="rounded-lg bg-[#07713c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#055c30] disabled:opacity-60"
                >
                  {lookupMutation.isPending ? "Searching…" : "Search"}
                </button>
              </form>

              {matches.length > 1 ? (
                <div className="mt-4 overflow-hidden rounded-lg border border-[#07713c]/20">
                  <p className="bg-[#07713c]/[0.06] px-3 py-2 text-xs font-semibold text-[#36454F]">
                    {matches.length} students found — select one
                  </p>
                  <ul className="max-h-64 divide-y divide-[#07713c]/10 overflow-auto">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => selectStudent(m)}
                          className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-[#07713c]/[0.06] sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-sm font-semibold text-[#36454F]">
                            {m.fullName || "—"}
                          </span>
                          <span className="text-xs text-[#36454F]/70">
                            {m.studentId || "—"}
                            {m.courseCode ? ` · ${m.courseCode}` : ""}
                            {m.rfid ? ` · RFID ${m.rfid}` : " · No RFID"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!student && !matches.length && error ? (
                <p className="mt-3 text-sm text-red-700">{error}</p>
              ) : null}
            </section>

            {student ? (
              <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-black">Student info</h2>
                    <p className="mt-1 text-sm text-black/75">
                      Review the student details, then edit RFID below.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearStudent}
                    className="rounded-lg border border-[#07713c]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#07713c] hover:bg-[#07713c]/5"
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-[#07713c]/15 bg-[#07713c]/[0.04] p-4 sm:grid-cols-2">
                  <InfoRow label="Full name" value={student.fullName || "—"} />
                  <InfoRow label="Student ID" value={student.studentId || "—"} />
                  <InfoRow label="Department" value={student.departmentName || "—"} />
                  <InfoRow label="Course" value={courseDisplay} />
                  <InfoRow label="Year level" value={yearLabel(student.yearLevel)} />
                </div>

                <form onSubmit={handleUpdate} className="mt-5 space-y-3">
                  <label className="block max-w-md text-sm font-semibold text-black">
                    RFID
                    <input
                      ref={rfidInputRef}
                      type="text"
                      value={rfid}
                      onChange={(e) => {
                        setRfid(e.target.value);
                        setError("");
                        setSuccess("");
                      }}
                      placeholder="Tap card or type RFID"
                      autoComplete="off"
                      maxLength={32}
                      disabled={updateMutation.isPending}
                      className="mt-1.5 w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2.5 font-mono text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                    />
                  </label>
                  <p className="text-xs text-black/60">
                    Edit this field, then save. Leave blank to clear the RFID.
                  </p>

                  {error ? <p className="text-sm text-red-700">{error}</p> : null}
                  {success ? <p className="text-sm text-[#07713c]">{success}</p> : null}

                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="rounded-lg bg-[#07713c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#055c30] disabled:opacity-60"
                  >
                    {updateMutation.isPending ? "Saving…" : "Save RFID"}
                  </button>
                </form>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

import { useState } from "react";
import SuperAdminShell from "./SuperAdminShell";
import {
  useAcademicPeriodsList,
  useActivateAcademicPeriod,
  useCreateAcademicPeriod,
  useDeleteAcademicPeriod,
} from "../hooks/useAcademicPeriods";
import { useMyPermissions } from "../hooks/useMyPermissions";
import { getApiErrorMessage, type AcademicPeriodRecord } from "../types/api";
import type { DeskPageProps } from "../types/desk-pages";

function periodStatusKey(status: AcademicPeriodRecord["status"] | string | null | undefined): string {
  return String(status ?? "").trim().toLowerCase();
}

function isActivePeriod(period: AcademicPeriodRecord): boolean {
  return periodStatusKey(period.status) === "active";
}

function statusBadge(status: AcademicPeriodRecord["status"]) {
  if (periodStatusKey(status) === "active") {
    return (
      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 ring-1 ring-green-200">
        Active
      </span>
    );
  }
  if (periodStatusKey(status) === "archived") {
    return (
      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
        Inactive
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
      Inactive
    </span>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const d = new Date(value.trim().match(/^\d{4}-\d{2}-\d{2}$/) ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SystemSettingsPage(props: DeskPageProps) {
  const [schoolYear, setSchoolYear] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const { has: hasPermission, isSuperAdmin } = useMyPermissions();
  const canManagePeriods = hasPermission("action.academic_period.manage") || isSuperAdmin;

  const { data: periods = [], isLoading } = useAcademicPeriodsList();
  const createPeriod = useCreateAcademicPeriod();
  const activatePeriod = useActivateAcademicPeriod();
  const deletePeriod = useDeleteAcademicPeriod();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    if (!schoolYear.trim()) { setFormError("School year is required."); return; }
    createPeriod.mutate(
      {
        schoolYear: schoolYear.trim(),
        semester: "1st sem",
        autoCreateSecondSemester: true,
      },
      {
        onSuccess: () => {
          setFormSuccess("First and second semester periods created.");
          setSchoolYear("");
        },
        onError: (err) => setFormError(getApiErrorMessage(err, "Failed to create school year.")),
      },
    );
  };

  const handleActivate = (id: number) => {
    if (!window.confirm("Activate this academic period? The current active period will be archived.")) return;
    activatePeriod.mutate(id, {
      onError: (err) => alert(getApiErrorMessage(err, "Failed to activate.")),
    });
  };

  const handleDelete = (id: number) => {
    if (
      !window.confirm(
        "Delete this draft/archived period? Enrollments, events, attendance, fines, and payments for this period will also be permanently deleted.",
      )
    ) {
      return;
    }
    deletePeriod.mutate(id, {
      onError: (err) => alert(getApiErrorMessage(err, "Failed to delete.")),
    });
  };

  const sorted = [...periods].sort((a, b) => {
    const statusOrder: Record<string, number> = { active: 0, draft: 1, archived: 2 };
    const byStatus =
      (statusOrder[periodStatusKey(a.status)] ?? 9) - (statusOrder[periodStatusKey(b.status)] ?? 9);
    if (byStatus !== 0) return byStatus;
    const yearCmp = String(b.school_year).localeCompare(String(a.school_year));
    if (yearCmp !== 0) return yearCmp;
    const semOrder: Record<string, number> = { "1st sem": 0, "2nd sem": 1, summer: 2 };
    const bySem =
      (semOrder[String(a.semester).toLowerCase()] ?? 9) -
      (semOrder[String(b.semester).toLowerCase()] ?? 9);
    if (bySem !== 0) return bySem;
    return Number(b.id) - Number(a.id);
  });
  const activePeriods = sorted.filter((p) => isActivePeriod(p));
  const inactivePeriods = sorted.filter((p) => !isActivePeriod(p));

  return (
    <SuperAdminShell
      {...props}
      activeNavId="system_settings"
      pageTitle="School Year"
      pageSubtitle="Manage school year and semester periods"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Create period form */}
        <div className="lg:col-span-1">
          {canManagePeriods ? (
          <div className="rounded-xl border border-[#07713c]/25 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-[#36454F] mb-4">Create School Year</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#36454F]/70 mb-1">School Year</label>
                <input
                  type="text"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  placeholder="e.g. 2024-2025"
                  className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                />
              </div>
              <p className="rounded-lg bg-green-50 px-3 py-2 text-xs leading-relaxed text-[#055a2e]">
                This automatically creates draft records for the 1st and 2nd Semester.
                Activate the 1st Semester when the school year begins.
              </p>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              {formSuccess && <p className="text-xs text-green-700">{formSuccess}</p>}
              <button
                type="submit"
                disabled={createPeriod.isPending}
                className="w-full rounded-lg bg-[#07713c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#055a2e] disabled:opacity-60"
              >
                {createPeriod.isPending ? "Creating..." : "Create School Year"}
              </button>
            </form>
          </div>
          ) : null}

          {/* System info panel */}
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-[#36454F] mb-3">System Information</h2>
            <dl className="space-y-2 text-sm">
              {[
                { label: "Application", value: "NMCI Event Tracking" },
                { label: "Organization", value: "Northern Mindanao Colleges, Inc." },
                { label: "System", value: "CSG Event Attendance Monitoring" },
                { label: "Version", value: "1.0.0" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between gap-4">
                  <dt className="text-[#36454F]/60 shrink-0">{item.label}</dt>
                  <dd className="font-medium text-[#36454F] text-right">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Academic periods list */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-[#07713c]/25 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#07713c]/20 px-5 py-4">
              <h2 className="text-base font-bold text-[#36454F]">Academic Periods</h2>
              <p className="text-xs text-[#36454F]/60 mt-0.5">Manage school year and semester records</p>
            </div>
            {isLoading ? (
              <div className="px-5 py-8 text-center text-sm text-[#36454F]/60">Loading periods...</div>
            ) : sorted.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[#36454F]/60">No academic periods found.</div>
            ) : (
              <div className="divide-y divide-[#07713c]/10">
                {activePeriods.length > 0 ? (
                  <div className="bg-[#07713c]/5 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#07713c]">
                    Active
                  </div>
                ) : null}
                {activePeriods.map((period) => (
                  <div key={period.id} className="flex items-center justify-between gap-4 bg-green-50/50 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#36454F]">
                          {period.school_year} · {period.semester}
                        </span>
                        {statusBadge(period.status)}
                      </div>
                      <p className="mt-0.5 text-xs text-[#36454F]/55">
                        {period.starts_on ? `${formatDate(period.starts_on)} – ${formatDate(period.ends_on)}` : "Dates not set"}
                        {period.activated_by_username && ` · Activated by ${period.activated_by_username}`}
                      </p>
                    </div>
                  </div>
                ))}

                {inactivePeriods.length > 0 ? (
                  <div className="bg-gray-50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#36454F]/70">
                    Inactive ({inactivePeriods.length})
                  </div>
                ) : (
                  <div className="bg-gray-50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#36454F]/70">
                    Inactive
                  </div>
                )}
                {inactivePeriods.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-[#36454F]/60">
                    No inactive semesters yet. Creating a school year adds a draft 2nd semester here.
                  </div>
                ) : null}
                {inactivePeriods.map((period) => (
                  <div key={period.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#36454F]">
                          {period.school_year} · {period.semester}
                        </span>
                        {statusBadge(period.status)}
                        <span className="text-[11px] text-[#36454F]/50">
                          {periodStatusKey(period.status) === "draft" ? "Draft" : "Archived"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#36454F]/55">
                        {period.starts_on ? `${formatDate(period.starts_on)} – ${formatDate(period.ends_on)}` : "Dates not set"}
                        {period.activated_by_username && ` · Activated by ${period.activated_by_username}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {canManagePeriods && (
                        <button
                          type="button"
                          onClick={() => handleActivate(period.id)}
                          disabled={activatePeriod.isPending}
                          className="rounded-lg border border-[#07713c] px-3 py-1.5 text-xs font-semibold text-[#07713c] hover:bg-green-50 disabled:opacity-60"
                        >
                          Activate
                        </button>
                      )}
                      {canManagePeriods &&
                        (periodStatusKey(period.status) === "draft" ||
                          periodStatusKey(period.status) === "archived") && (
                        <button
                          type="button"
                          onClick={() => handleDelete(period.id)}
                          disabled={deletePeriod.isPending}
                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}

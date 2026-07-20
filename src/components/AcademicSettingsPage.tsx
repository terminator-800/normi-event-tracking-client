import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import AppSidebarNav from "./AppSidebarNav";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import { useAppNavItems, useMyPermissions } from "../hooks/useMyPermissions";
import { getRoleFromSession, isSuperAdminRole } from "../utils/roles";
import { useAuthSession } from "../hooks/auth";
import {
  useAcademicPeriodsList,
  useActivateAcademicPeriod,
  useCreateAcademicPeriod,
  useDeleteAcademicPeriod,
  useUpdateAcademicPeriod,
} from "../hooks/useAcademicPeriods";
import { getApiErrorMessage, type AcademicPeriodRecord } from "../types/api";
import type { DeskPageProps } from "../types/desk-pages";
import PaginationBar from "./PaginationBar";

const PAGE_TEXT = "text-black";
const PERIODS_PAGE_SIZE = 6;
const FIELD_INPUT =
  "w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2.5 text-base text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30";
const SEMESTER_OPTIONS = [
  { value: "1st sem", label: "1st Semester" },
  { value: "2nd sem", label: "2nd Semester" },
  { value: "summer", label: "Summer" },
] as const;

type PeriodForm = {
  schoolYear: string;
  semester: string;
};

const emptyForm = (): PeriodForm => ({
  schoolYear: "",
  semester: "1st sem",
});

function statusBadgeClass(status: AcademicPeriodRecord["status"]): string {
  if (status === "active") return "bg-[#07713c] text-white";
  if (status === "archived") return "bg-gray-200 text-gray-700";
  return "bg-amber-100 text-amber-900";
}

function periodCardBorderClass(status: AcademicPeriodRecord["status"]): string {
  if (status === "active") return "border-[#07713c] ring-2 ring-[#07713c]/20";
  if (status === "draft") return "border-amber-200";
  return "border-gray-200";
}

function periodDisplayLabel(period: AcademicPeriodRecord): string {
  return period.label?.trim() || `${period.school_year} · ${period.semester}`;
}

function formatReadableDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const trimmed = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const d = dateOnly ? new Date(`${trimmed}T12:00:00`) : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function canDeletePeriod(period: AcademicPeriodRecord): boolean {
  return period.status === "draft" || period.status === "archived";
}

type PeriodFormFieldsProps = {
  form: PeriodForm;
  setForm: Dispatch<SetStateAction<PeriodForm>>;
};

function PeriodFormFields({ form, setForm }: PeriodFormFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block sm:col-span-1">
        <span className={`mb-1.5 block text-base font-medium ${PAGE_TEXT}`}>School year</span>
        <input
          type="text"
          value={form.schoolYear}
          onChange={(e) => setForm((prev) => ({ ...prev, schoolYear: e.target.value }))}
          placeholder="SY2025-2026"
          className={FIELD_INPUT}
        />
      </label>
      <label className="block sm:col-span-1">
        <span className={`mb-1.5 block text-base font-medium ${PAGE_TEXT}`}>Semester</span>
        <select
          value={form.semester}
          onChange={(e) => setForm((prev) => ({ ...prev, semester: e.target.value }))}
          className={FIELD_INPUT}
        >
          {SEMESTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default function AcademicSettingsPage({ onNavigate, onLogout }: DeskPageProps) {
  const { data: session } = useAuthSession();
  const role = getRoleFromSession(session);
  const isSuperAdmin = isSuperAdminRole(role);
  const { has: hasPermission } = useMyPermissions();
  const canManagePeriods = hasPermission("action.academic_period.manage") || isSuperAdmin;

  const [form, setForm] = useState<PeriodForm>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showPeriodFormModal, setShowPeriodFormModal] = useState(false);
  const [formModalError, setFormModalError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [periodToDelete, setPeriodToDelete] = useState<AcademicPeriodRecord | null>(null);
  const [periodsPage, setPeriodsPage] = useState(1);

  const { data: periods = [], isLoading, refetch } = useAcademicPeriodsList(
    isSuperAdmin || hasPermission("nav.settings.school_year") || canManagePeriods,
  );
  const createMutation = useCreateAcademicPeriod();
  const updateMutation = useUpdateAcademicPeriod();
  const activateMutation = useActivateAcademicPeriod();
  const deleteMutation = useDeleteAcademicPeriod();

  const navItems = useAppNavItems();

  const sortedPeriods = useMemo(
    () =>
      [...periods].sort((a, b) => {
        const statusOrder = { active: 0, draft: 1, archived: 2 };
        const diff = statusOrder[a.status] - statusOrder[b.status];
        if (diff !== 0) return diff;
        return Number(b.id) - Number(a.id);
      }),
    [periods],
  );

  const periodsTotal = sortedPeriods.length;
  const periodsTotalPages = Math.max(1, Math.ceil(periodsTotal / PERIODS_PAGE_SIZE) || 1);
  const periodsPageSafe = Math.min(periodsPage, periodsTotalPages);

  const paginatedPeriods = useMemo(() => {
    const start = (periodsPageSafe - 1) * PERIODS_PAGE_SIZE;
    return sortedPeriods.slice(start, start + PERIODS_PAGE_SIZE);
  }, [sortedPeriods, periodsPageSafe]);

  useEffect(() => {
    setPeriodsPage((p) => Math.min(p, periodsTotalPages));
  }, [periodsTotalPages]);

  useEffect(() => {
    if (isSuperAdmin) return;
    onNavigate?.("events");
  }, [isSuperAdmin, onNavigate]);

  if (!isSuperAdmin) return null;

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormModalError("");
  };

  const openCreateModal = () => {
    setActionError("");
    setActionSuccess("");
    resetForm();
    setShowPeriodFormModal(true);
  };

  const openEditModal = (period: AcademicPeriodRecord) => {
    setActionError("");
    setActionSuccess("");
    setFormModalError("");
    setEditingId(period.id);
    setForm({
      schoolYear: period.school_year,
      semester: period.semester,
    });
    setShowPeriodFormModal(true);
  };

  const closeFormModal = () => {
    setShowPeriodFormModal(false);
    resetForm();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormModalError("");

    const payload = {
      schoolYear: form.schoolYear.trim(),
      semester: form.semester,
    };

    if (!payload.schoolYear) {
      setFormModalError("School year is required.");
      return;
    }

    if (editingId != null) {
      updateMutation.mutate(
        { id: editingId, payload },
        {
          onSuccess: () => {
            setActionSuccess("Academic period updated.");
            closeFormModal();
            void refetch();
          },
          onError: (err) => setFormModalError(getApiErrorMessage(err, "Failed to update academic period.")),
        },
      );
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        setActionSuccess("Academic period created as draft.");
        closeFormModal();
        void refetch();
      },
      onError: (err) => setFormModalError(getApiErrorMessage(err, "Failed to create academic period.")),
    });
  };

  const handleActivate = (period: AcademicPeriodRecord) => {
    setActionError("");
    setActionSuccess("");
    const label = periodDisplayLabel(period);
    if (
      !window.confirm(
        `Activate "${label}"?\n\nThis will archive the current active period. Admin, CSG, and governors will operate within this school year and semester.`,
      )
    ) {
      return;
    }
    activateMutation.mutate(period.id, {
      onSuccess: () => {
        setActionSuccess(`Activated ${label}.`);
        void refetch();
      },
      onError: (err) => setActionError(getApiErrorMessage(err, "Failed to activate academic period.")),
    });
  };

  const handleDelete = (period: AcademicPeriodRecord) => {
    setActionError("");
    setActionSuccess("");
    setPeriodToDelete(period);
  };

  const confirmDelete = () => {
    if (!periodToDelete) return;
    deleteMutation.mutate(periodToDelete.id, {
      onSuccess: () => {
        setActionSuccess(`Deleted ${periodDisplayLabel(periodToDelete)}.`);
        if (editingId === periodToDelete.id) closeFormModal();
        setPeriodToDelete(null);
        void refetch();
      },
      onError: (err) => {
        setActionError(getApiErrorMessage(err, "Failed to delete academic period."));
        setPeriodToDelete(null);
      },
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isEditMode = editingId != null;

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col [&_p]:text-white">
        <SidebarBrand />
        <AppSidebarNav items={navItems} activeNavId="academic_settings" onNavigate={onNavigate} />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="mx-auto w-full max-w-6xl">
            <div>
              <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">
                Academic Settings
              </h1>
              <p className={`text-base ${PAGE_TEXT}/70`}>
                Configure school year and semester, then activate one period for the whole system.
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {actionError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">
                {actionError}
              </div>
            ) : null}
            {actionSuccess ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-base text-green-800">
                {actionSuccess}
              </div>
            ) : null}

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className={`text-xl font-bold ${PAGE_TEXT}`}>Academic periods</h2>
                  <p className={`text-base ${PAGE_TEXT}/70`}>
                    Only one period can be active at a time for the entire system.
                  </p>
                </div>
                {canManagePeriods ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="rounded-lg bg-[#07713c] px-5 py-2.5 text-base font-medium text-white hover:bg-[#055a2e]"
                >
                  + Create academic period
                </button>
                ) : null}
              </div>

              {isLoading ? (
                <p className={`text-base ${PAGE_TEXT}`}>Loading...</p>
              ) : sortedPeriods.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#07713c]/30 bg-white px-6 py-12 text-center">
                  <p className={`text-base ${PAGE_TEXT}`}>No academic periods yet.</p>
                  <p className={`mt-1 text-base ${PAGE_TEXT}/70`}>
                    Create a draft, then activate it for admin and governors to use the system.
                  </p>
                  {canManagePeriods ? (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-4 rounded-lg border border-[#07713c] bg-[#07713c]/10 px-5 py-2.5 text-base font-medium text-black hover:bg-[#07713c]/15"
                  >
                    Create your first period
                  </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {paginatedPeriods.map((period) => {
                      const displayLabel = periodDisplayLabel(period);
                      return (
                        <article
                          key={period.id}
                          className={`flex flex-col rounded-xl border bg-white p-6 shadow-sm ${periodCardBorderClass(period.status)}`}
                        >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ${statusBadgeClass(period.status)}`}
                          >
                            {period.status}
                          </span>
                          {period.status === "active" ? (
                            <span className="text-sm font-medium text-[#07713c]">Currently in use</span>
                          ) : null}
                        </div>

                        <h3 className="mt-3 text-2xl font-bold text-[#07713c]">{period.school_year}</h3>
                        <p className="text-base font-medium text-black">{period.semester}</p>
                        {period.label?.trim() ? (
                          <p className="mt-1 text-base text-black/70">{period.label}</p>
                        ) : null}

                        <dl className="mt-4 space-y-2 text-base text-black/80">
                          {period.starts_on ? (
                            <div className="flex justify-between gap-2">
                              <dt>Starts</dt>
                              <dd>{formatReadableDate(period.starts_on)}</dd>
                            </div>
                          ) : null}
                          {period.ends_on ? (
                            <div className="flex justify-between gap-2">
                              <dt>Ends</dt>
                              <dd>{formatReadableDate(period.ends_on)}</dd>
                            </div>
                          ) : null}
                          {period.activated_at ? (
                            <div className="flex justify-end">
                              <dd className="text-sm text-black/60">
                                {formatReadableDate(period.activated_at)}
                              </dd>
                            </div>
                          ) : null}
                        </dl>

                        <div className="mt-auto flex flex-wrap gap-2 pt-5">
                          {canManagePeriods && period.status !== "active" ? (
                            <button
                              type="button"
                              onClick={() => handleActivate(period)}
                              disabled={activateMutation.isPending}
                              className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-medium text-white hover:bg-[#055a2e] disabled:opacity-60"
                            >
                              Activate
                            </button>
                          ) : null}
                          {canManagePeriods && period.status === "draft" ? (
                            <button
                              type="button"
                              onClick={() => openEditModal(period)}
                              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          ) : null}
                          {canManagePeriods && canDeletePeriod(period) ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(period)}
                              disabled={isDeleting}
                              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          ) : null}
                          <span className="sr-only">{displayLabel}</span>
                        </div>
                      </article>
                    );
                  })}
                  </div>
                  <PaginationBar
                    totalCount={periodsTotal}
                    page={periodsPage}
                    pageSize={PERIODS_PAGE_SIZE}
                    onPageChange={setPeriodsPage}
                    emptyLabel="No academic periods to show."
                    itemLabel="periods"
                    className="!text-black border-t-0 px-0"
                  />
                </>
              )}
            </section>
          </div>
        </main>
      </div>

      {showPeriodFormModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-[#07713c]/20 bg-[#07713c]/10 px-6 py-5">
              <h3 className="text-xl font-semibold text-[#07713c]">
                {isEditMode ? "Edit academic period" : "Create academic period"}
              </h3>
              <p className="mt-1 text-base text-black/70">
                {isEditMode
                  ? "Update this draft before activating it."
                  : "New periods are saved as drafts until you activate them."}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              {formModalError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-base text-red-800">
                  {formModalError}
                </div>
              ) : null}
              <PeriodFormFields form={form} setForm={setForm} />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={isSaving}
                  className="rounded-lg border border-[#07713c]/40 px-5 py-2.5 text-base font-medium text-black hover:bg-[#07713c]/10 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-[#07713c] px-5 py-2.5 text-base font-medium text-white hover:bg-[#055a2e] disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : isEditMode ? "Save changes" : "Create draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {periodToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-red-200 bg-red-50 px-6 py-5">
              <h3 className="text-xl font-semibold text-red-900">Delete academic period?</h3>
            </div>
            <div className="space-y-4 p-6 text-base text-black">
              <p>
                You are about to permanently delete{" "}
                <span className="font-semibold">{periodDisplayLabel(periodToDelete)}</span>
                {periodToDelete.status === "archived" ? " (archived)" : " (draft)"}.
              </p>
              <p className="text-black/80">
                This cannot be undone. All enrollments, events, attendance, fines, and payments linked to
                this period will also be permanently deleted.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPeriodToDelete(null)}
                  disabled={isDeleting}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-base font-medium hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-red-600 px-5 py-2.5 text-base font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isDeleting ? "Deleting..." : "Delete period"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

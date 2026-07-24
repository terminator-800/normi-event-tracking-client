import { useMemo, useState } from "react";
import AppSidebarNav from "./AppSidebarNav";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import { useAppNavItems, useMyPermissions } from "../hooks/useMyPermissions";
import { useAcademicPeriodsList } from "../hooks/useAcademicPeriods";
import { useAuthSession } from "../hooks/auth";
import api from "../api/axiosInstance";
import { getApiErrorMessage, type AcademicPeriodRecord, type AuthSession } from "../types/api";
import type { DeskPageProps } from "../types/desk-pages";
import {
  getCashierAccountLabel,
  getGovernorScopeFromSession,
  getRoleFromSession,
  isCashierRole,
  isCsgPresident,
  isDepartmentGovernorRole,
  isSuperAdminRole,
  isAdminRole,
} from "../utils/roles";

function periodLabel(p: AcademicPeriodRecord): string {
  const sy = String(p.school_year ?? "").trim() || "—";
  const sem = String(p.semester ?? "").trim() || "—";
  const status = String(p.status ?? "").trim();
  return `${sy} · ${sem}${status ? ` (${status})` : ""}`;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sessionDepartmentLabel(session: AuthSession | null | undefined): string | null {
  const code = String(
    session?.department_code ??
      session?.user?.department_code ??
      session?.departmentSession?.department_code ??
      session?.data?.department_code ??
      "",
  )
    .trim()
    .toUpperCase();
  const name = String(
    session?.department_name ??
      session?.user?.department_name ??
      session?.departmentSession?.department_name ??
      session?.data?.department_name ??
      "",
  ).trim();
  if (code && name) return `${code} — ${name}`;
  return code || name || null;
}

export default function BackupPage({ onNavigate, onLogout }: DeskPageProps) {
  const navItems = useAppNavItems();
  const { data: session } = useAuthSession();
  const { has: hasPermission, isSuperAdmin } = useMyPermissions();
  const canBackup = isSuperAdmin || hasPermission("nav.settings.backup") || hasPermission("action.backup.download");
  const { data: periods = [], isLoading, isError } = useAcademicPeriodsList(canBackup);

  const [periodId, setPeriodId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const backupScopeLabel = useMemo(() => {
    const role = getRoleFromSession(session);
    if (isAdminRole(role) || isSuperAdminRole(role)) {
      return "All events (all creators)";
    }
    if (isCsgPresident(role)) {
      return "Events you created";
    }
    if (isDepartmentGovernorRole(role)) {
      const scope = getGovernorScopeFromSession(session, role);
      const dept = scope?.departmentCode || scope?.departmentName || sessionDepartmentLabel(session);
      return dept ? `Events you created (${dept})` : "Events you created";
    }
    if (isCashierRole(role)) {
      const label = getCashierAccountLabel({
        role,
        department_id: session?.department_id ?? session?.user?.department_id,
        department_name: session?.department_name ?? session?.user?.department_name,
      });
      if (label === "Dept Cashier") {
        const dept = sessionDepartmentLabel(session);
        return dept
          ? `Events created by ${dept} accounts`
          : "Events created by your college accounts";
      }
      return "Events created by CSG President";
    }
    return "Events in your scope";
  }, [session]);

  const selectablePeriods = useMemo(
    () =>
      [...periods].sort((a, b) => {
        const sy = String(b.school_year).localeCompare(String(a.school_year));
        if (sy !== 0) return sy;
        return Number(b.id) - Number(a.id);
      }),
    [periods],
  );

  const selectedPeriod = useMemo(
    () => selectablePeriods.find((p) => String(p.id) === String(periodId)) ?? null,
    [selectablePeriods, periodId],
  );

  const downloadBackup = async () => {
    setError("");
    setSuccess("");
    if (!periodId) {
      setError("Select a school year / semester first.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.get(`/backup/semester/${encodeURIComponent(periodId)}`, {
        responseType: "blob",
      });
      const disposition = String(res.headers?.["content-disposition"] ?? "");
      const match = disposition.match(/filename="?([^";\n]+)"?/i);
      const filename =
        match?.[1]?.trim() ||
        `backup_${selectedPeriod?.school_year ?? "period"}_${selectedPeriod?.semester ?? "sem"}.xlsx`;
      triggerBlobDownload(res.data as Blob, filename);
      const events = res.headers?.["x-backup-events"];
      const attendance = res.headers?.["x-backup-attendance"];
      const collection = res.headers?.["x-backup-collection"];
      const scope = String(res.headers?.["x-backup-scope"] ?? "").trim() || backupScopeLabel;
      const parts = [
        events != null ? `${events} events` : null,
        attendance != null ? `${attendance} attendance rows` : null,
        collection != null ? `${collection} collection rows` : null,
        scope ? `scope: ${scope}` : null,
      ].filter(Boolean);
      setSuccess(
        parts.length
          ? `Backup downloaded (${parts.join(", ")}).`
          : "Backup downloaded successfully.",
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to download semester backup."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#07713c]/[0.04] [&_button]:cursor-pointer">
      <aside className="sticky top-0 flex h-screen max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto bg-[#07713c] text-white [&_p]:text-white">
        <SidebarBrand />
        <AppSidebarNav items={navItems} activeNavId="backup" onNavigate={onNavigate} />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto w-full max-w-4xl">
            <h1 className="font-[Inter,sans-serif] text-[30px] font-extrabold leading-tight text-[#07713c]">
              Backup
            </h1>
            <NavbarAcademicPeriod className="mt-1" />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 text-black">
          <div className="mx-auto w-full max-w-4xl space-y-4">
            <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-black">Semester backup</h2>
              <p className="mt-1 text-sm text-black/75">
                Download one Excel file with <strong>Events</strong>, <strong>Attendance</strong>, and{" "}
                <strong>Collection</strong> for the selected school year and semester. Event range follows{" "}
                <strong>who created the events</strong>
                {backupScopeLabel ? (
                  <>
                    {" "}
                    — <strong>{backupScopeLabel}</strong>
                  </>
                ) : null}
                .
              </p>

              <div className="mt-5 max-w-md space-y-3">
                <label className="block text-sm font-semibold text-black">
                  School year / semester
                  <select
                    value={periodId}
                    onChange={(e) => {
                      setPeriodId(e.target.value);
                      setError("");
                      setSuccess("");
                    }}
                    disabled={isLoading || busy}
                    className="mt-1.5 w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="">
                      {isLoading ? "Loading periods…" : "Select a semester"}
                    </option>
                    {selectablePeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {periodLabel(p)}
                      </option>
                    ))}
                  </select>
                </label>

                {isError ? (
                  <p className="text-sm text-red-700">Could not load academic periods.</p>
                ) : null}
                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                {success ? <p className="text-sm text-[#07713c]">{success}</p> : null}

                <button
                  type="button"
                  disabled={!periodId || busy || isLoading}
                  onClick={() => void downloadBackup()}
                  className="rounded-lg bg-[#07713c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#055c30] disabled:opacity-60"
                >
                  {busy ? "Preparing backup…" : "Download backup"}
                </button>
              </div>

              <ul className="mt-6 space-y-1.5 text-sm text-black/80">
                <li>
                  <span className="font-semibold text-black">Events</span> — events in this semester that
                  match your creator scope (same idea as Manage Events)
                </li>
                <li>
                  <span className="font-semibold text-black">Attendance</span> — every event with its full
                  student roster (Attended / Absent / No record), not only tap records
                </li>
                <li>
                  <span className="font-semibold text-black">Collection</span> — payment transactions
                </li>
              </ul>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

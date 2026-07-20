import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebarNav from "./AppSidebarNav";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { useAppNavItems, useMyPermissions } from "../hooks/useMyPermissions";
import { resolveNavRoute } from "../utils/appNav";
import { getDashboardRoleLabel } from "../utils/roles";
import type { DeskPageProps } from "../types/desk-pages";
import StudentAttendanceDashboard from "./StudentAttendanceDashboard";

/** Students page main content text (sidebar nav excluded). */
const STUDENTS_PAGE_TEXT = "text-black";

/** Shell for the Students (per-student attendance) view at `/students`. */
export default function StudentAttendancePage({ onLogout, onNavigate }: DeskPageProps) {
  const navigate = useNavigate();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode] = useState("export");
  const [openStudentsExport, setOpenStudentsExport] = useState<(() => void) | null>(null);

  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const { has: hasPermission } = useMyPermissions();
  const canExportStudents =
    hasPermission("action.students.export") || hasPermission("action.students.print");

  const navItems = useAppNavItems();


  const handleNav = (itemId: string) => {
    const route = resolveNavRoute(itemId);
    if (route) {
      navigate(route);
      return;
    }
    onNavigate?.(itemId);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col [&_p]:text-white">
        <SidebarBrand />
        <AppSidebarNav items={navItems} activeNavId="students" onNavigate={handleNav} />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-[#07713c]/30 px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">Students</h1>
              <NavbarAcademicPeriod className="mt-1" />
            </div>
            {canExportStudents ? (
              <button
                type="button"
                onClick={() => openStudentsExport?.()}
                className="rounded-lg border bg-[#07713C] px-3 py-2 text-sm font-medium text-white"
              >
                Export / Reports
              </button>
            ) : null}
          </div>
        </header>

        <main className={`flex-1 p-6 overflow-auto ${STUDENTS_PAGE_TEXT} [&_th]:font-bold [&_th]:text-white`}>
          <div className="mx-auto w-full min-w-0 max-w-7xl">
            <StudentAttendanceDashboard onRegisterExportOpen={setOpenStudentsExport} />
          </div>
        </main>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#07713c] px-5 py-3">
              <h3 className="text-white font-semibold">
                {reportMode === "settings"
                  ? `${roleLabel} Settings`
                  : reportMode === "import"
                    ? "Import Data"
                    : "Export Data"}
              </h3>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-gray-600">
                {reportMode === "settings"
                  ? "Settings are not implemented yet (this is a placeholder)."
                  : reportMode === "import"
                    ? "Choose what you want to import."
                    : "Choose what you want to export."}
              </p>
              {reportMode !== "settings" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-gray-300 p-4 text-left hover:border-[#07713c] hover:bg-green-50 transition-colors"
                    onClick={() => setShowReportModal(false)}
                  >
                    <p className="font-semibold text-gray-900">
                      {reportMode === "import" ? "Import Attendance" : "Export Attendance"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {reportMode === "import"
                        ? "Import attendance records into the system."
                        : "Download attendance records for reports."}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-gray-300 p-4 text-left hover:border-[#07713c] hover:bg-green-50 transition-colors"
                    onClick={() => setShowReportModal(false)}
                  >
                    <p className="font-semibold text-gray-900">
                      {reportMode === "import" ? "Import Students" : "Export Students"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {reportMode === "import"
                        ? "Import student records into the system."
                        : "Download student or department records."}
                    </p>
                  </button>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 rounded-lg bg-[#07713c] text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

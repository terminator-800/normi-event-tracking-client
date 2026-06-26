import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SidebarNavIcon from "./SidebarNavIcon";
import SidebarBrand from "./SidebarBrand";
import UserCircleIcon from "./UserCircleIcon";
import SidebarUserFullName from "./SidebarUserFullName";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { getAppNavItems } from "../utils/appNav";
import { getDashboardRoleLabel } from "../utils/roles";
import StudentAttendanceDashboard from "./StudentAttendanceDashboard";

/** Students page main content text (sidebar nav excluded). */
const STUDENTS_PAGE_TEXT = "text-black";

/** Shell for the Students (per-student attendance) view at `/students`. */
export default function StudentAttendancePage({ onLogout, onNavigate }) {
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode, setReportMode] = useState("export");
  const [openStudentsExport, setOpenStudentsExport] = useState(null);

  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const isAdmin = String(role || "").toLowerCase().trim() === "admin";

  const navItems = getAppNavItems({ isAdmin });


  const handleNav = (itemId) => {
    if (itemId === "attendance_students") {
      navigate("/students");
      return;
    }
    if (itemId === "attendance") {
      navigate("/attendance");
      return;
    }
    onNavigate?.(itemId);
  };

  const navActive = (itemId) => {
    if (itemId === "attendance_students") return true;
    return false;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col [&_p]:text-white">
        <SidebarBrand />
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                navActive(item.id) ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
              }`}
            >
              <SidebarNavIcon navId={item.id} />
              {item.label}
            </button>
          ))}
        </nav>
        <SidebarUserFullName />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">Students</h1>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => openStudentsExport?.()}
                className="rounded-lg border border-[#e6a100] bg-[#ffb300] px-3 py-2 text-sm font-medium text-black hover:bg-[#e6a100]"
              >
                Export / Reports
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLogout((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center text-[#07713c] rounded-lg hover:bg-green-50"
                  aria-label="Account menu"
                  aria-expanded={showLogout}
                  aria-haspopup="true"
                >
                  <UserCircleIcon />
                </button>
                {showLogout && (
                  <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[100px] z-10">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLogout(false);
                        onLogout();
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

        <main className={`flex-1 p-6 overflow-auto ${STUDENTS_PAGE_TEXT} [&_th]:font-bold [&_th]:text-black`}>
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

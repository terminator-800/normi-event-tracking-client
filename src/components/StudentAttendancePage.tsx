import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavbarAcademicPeriod } from "./Navbar";
import UserCircleIcon from "./UserCircleIcon";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { getAppNavItems, resolveNavRoute } from "../utils/appNav";
import { getDashboardRoleLabel } from "../utils/roles";
import type { DeskPageProps } from "../types/desk-pages";
import StudentAttendanceDashboard from "./StudentAttendanceDashboard";
import Sidebar from "./Sidebar";
import ExportReportsButton from "./ExportReports";

/** Students page main content text (sidebar nav excluded). */
const STUDENTS_PAGE_TEXT = "text-black";

/** Shell for the Students (per-student attendance) view at `/students`. */
export default function StudentAttendancePage({ onLogout, onNavigate }: DeskPageProps) {
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [openStudentsExport, setOpenStudentsExport] = useState<(() => void) | null>(null);

  const { role, isGovernor, governorScope } = useGovernorScope();
  void getDashboardRoleLabel(isGovernor, governorScope, role);
  const normalizedRole = String(role || "").toLowerCase().trim();
  const isAdmin = normalizedRole === "admin";
  const isSuperAdmin = normalizedRole === "super_admin";
  const isCsg = normalizedRole === "csg_president";

  const navItems = getAppNavItems({ isAdmin: isAdmin || isSuperAdmin, isSuperAdmin, isCsgPresident: isCsg });


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
      <Sidebar navItems={navItems} onNavigate={handleNav} activeNavId="students" />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">Students</h1>
              <NavbarAcademicPeriod className="mt-1" />
            </div>
            <div className="flex items-center gap-4">
              <ExportReportsButton
                title="Export / reports"
                description="Open the student export workflow from here."
                actions={[
                  {
                    label: "Open export workflow",
                    description: "Launch the report export flow for the current view.",
                    onClick: () => {
                      openStudentsExport?.();
                    },
                  },
                ]}
              />
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

        <main className={`flex-1 p-6 overflow-auto ${STUDENTS_PAGE_TEXT} [&_th]:font-bold [&_th]:text-black`}>
          <div className="mx-auto w-full min-w-0 max-w-7xl">
            <StudentAttendanceDashboard onRegisterExportOpen={setOpenStudentsExport} />
          </div>
        </main>
      </div>
    </div>
  );
}

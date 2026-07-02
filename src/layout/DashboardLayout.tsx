import { useState, type ReactNode } from "react";
import SidebarBrand from "../components/SidebarBrand";
import SidebarNavIcon from "../components/SidebarNavIcon";
import SidebarUserFullName from "../components/SidebarUserFullName";
import UserCircleIcon from "../components/UserCircleIcon";
import NavbarAcademicPeriod from "../components/NavbarAcademicPeriod";
import type { AppNavId } from "../utils/appNav";

export type DashboardNavItem = {
  id: AppNavId;
  label: string;
};

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  navItems: DashboardNavItem[];
  onNavigate?: (id: string) => void;
  onLogout?: () => void;
  headerRight?: ReactNode;
  headerSubtitle?: ReactNode;
  activeNavId?: string;
}

export default function DashboardLayout({
  children,
  title,
  navItems,
  onNavigate,
  onLogout,
  headerRight,
  headerSubtitle,
  activeNavId = "dashboard",
}: DashboardLayoutProps) {
  const [showLogout, setShowLogout] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col">
        <SidebarBrand />
        <nav className="flex-1 px-4 space-y-1 pb-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                item.id === activeNavId ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
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
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-extrabold font-[Inter,sans-serif] text-[#008000] leading-tight">
              {title}
            </h1>
            {headerSubtitle ?? <NavbarAcademicPeriod className="mt-1" />}
          </div>
          <div className="flex items-center gap-3">
            {headerRight}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogout((prev) => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center text-[#008000] rounded-lg hover:bg-green-50"
                aria-label="Account menu"
                aria-expanded={showLogout}
              >
                <UserCircleIcon />
              </button>
              {showLogout && (
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[120px] z-10">
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
        </header>

        <main className="flex-1 p-6 overflow-auto bg-[#f6f8f9]">{children}</main>
      </div>
    </div>
  );
}

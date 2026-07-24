/**
 * Reusable shell layout for Super Admin pages.
 * Provides the green sidebar (with all nav items) and header.
 */
import AppSidebarNav from "./AppSidebarNav";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import type { AppNavId } from "../utils/appNav";
import { useAppNavItems } from "../hooks/useMyPermissions";
import type { DeskPageProps } from "../types/desk-pages";

type Props = DeskPageProps & {
  activeNavId: AppNavId;
  pageTitle: string;
  pageSubtitle?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
};

export default function SuperAdminShell({
  onLogout,
  onNavigate,
  activeNavId,
  pageTitle,
  pageSubtitle,
  children,
  headerRight,
}: Props) {
  const navItems = useAppNavItems();

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      {/* Sidebar */}
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col">
        <SidebarBrand />
        <AppSidebarNav items={navItems} activeNavId={activeNavId} onNavigate={onNavigate} />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[28px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">
                  {pageTitle}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Super Admin
                </span>
              </div>
              {pageSubtitle && (
                <p className="text-sm text-[#36454F]/60 mt-0.5">{pageSubtitle}</p>
              )}
              <NavbarAcademicPeriod className="mt-1" />
            </div>
            {headerRight ? <div className="flex items-center gap-3">{headerRight}</div> : null}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-[#f6f8f9]">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

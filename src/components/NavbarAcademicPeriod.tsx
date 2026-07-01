import { useActiveAcademicPeriod } from "../hooks/useAcademicPeriods";
import { useAuthSession } from "../hooks/auth";
import { getActiveAcademicPeriodFromSession } from "../utils/academicPeriod";
import { getRoleFromSession, isOperationalDeskRole, isSuperAdminRole } from "../utils/roles";

type NavbarAcademicPeriodProps = {
  className?: string;
};

/** Compact active school year / semester for desk page headers. */
export default function NavbarAcademicPeriod({ className = "" }: NavbarAcademicPeriodProps) {
  const { data: session } = useAuthSession();
  const role = getRoleFromSession(session);
  const { data: activePeriodQuery, isLoading } = useActiveAcademicPeriod(isOperationalDeskRole(role));

  if (isSuperAdminRole(role)) return null;

  const activePeriod = activePeriodQuery ?? getActiveAcademicPeriodFromSession(session);

  if (isLoading) {
    return (
      <p className={`text-sm text-gray-500 ${className}`}>Loading academic period...</p>
    );
  }

  if (activePeriod) {
    const label =
      activePeriod.label?.trim() ||
      `${activePeriod.school_year} · ${activePeriod.semester}`;
    return (
      <p className={`text-sm font-medium text-[#055a2e] ${className}`} title="Active academic period">
        {label}
      </p>
    );
  }

  return (
    <p className={`text-sm font-medium text-amber-800 ${className}`} title="No active academic period">
      No active school year / semester
    </p>
  );
}

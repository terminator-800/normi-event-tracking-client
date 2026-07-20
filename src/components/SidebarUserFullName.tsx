import { useAuthSession } from "../hooks/auth";
import { getNavDisplayNameFromSession } from "../utils/roles";

type SidebarUserFullNameProps = {
  onLogout?: () => void;
};

export default function SidebarUserFullName({ onLogout }: SidebarUserFullNameProps) {
  const { data: session } = useAuthSession();
  const displayName = getNavDisplayNameFromSession(session);

  if (!displayName && !onLogout) return null;

  return (
    <div className="mt-auto shrink-0 border-t border-white/20 px-4 py-4 text-center">
      {displayName ? (
        <p className="truncate text-sm font-medium text-white" title={displayName}>
          {displayName}
        </p>
      ) : null}
      {onLogout ? (
        <button
          type="button"
          onClick={onLogout}
          className="mt-3 w-full rounded-lg border border-white/35 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          Logout
        </button>
      ) : null}
    </div>
  );
}

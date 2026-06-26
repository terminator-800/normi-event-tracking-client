import { useAuthSession } from "../hooks/auth";
import { getNavDisplayNameFromSession } from "../utils/roles";

export default function SidebarUserFullName() {
  const { data: session } = useAuthSession();
  const displayName = getNavDisplayNameFromSession(session);

  if (!displayName) return null;

  return (
    <div className="shrink-0 border-t border-white/20 px-4 py-4 text-center">
      <p className="truncate text-sm font-medium text-white" title={displayName}>
        {displayName}
      </p>
    </div>
  );
}

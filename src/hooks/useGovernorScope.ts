import { useMemo } from "react";
import { useAuthSession } from "./auth";
import { getGovernorScopeFromSession, getRoleFromSession, isDepartmentGovernorRole } from "../utils/roles";

export function useGovernorScope() {
  const { data: session, isLoading } = useAuthSession();

  const role = useMemo(() => getRoleFromSession(session), [session]);
  const governorScope = useMemo(
    () => getGovernorScopeFromSession(session, role),
    [session, role],
  );

  return {
    role,
    isGovernor: isDepartmentGovernorRole(role),
    governorScope,
    isSessionLoading: isLoading,
  };
}

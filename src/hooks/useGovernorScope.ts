import { useMemo } from "react";
import { useAuthSession } from "./auth";
import { getGovernorScopeFromRole, getRoleFromSession } from "../utils/roles";

export function useGovernorScope() {
  const { data: session, isLoading } = useAuthSession();

  const role = useMemo(() => getRoleFromSession(session), [session]);
  const governorScope = useMemo(
    () => getGovernorScopeFromRole(role),
    [role],
  );

  return {
    role,
    isGovernor: !!governorScope,
    governorScope,
    isSessionLoading: isLoading,
  };
}


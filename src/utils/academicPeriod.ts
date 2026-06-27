import type { AuthSession } from "../types/api";

export function getActiveAcademicPeriodFromSession(session: AuthSession | null | undefined) {
  if (!session || typeof session !== "object") return null;
  return session.activeAcademicPeriod ?? null;
}

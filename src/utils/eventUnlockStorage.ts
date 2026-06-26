const STORAGE_PREFIX = "event_unlock_token_";

type EventId = string | number | null | undefined;

export function getEventUnlockToken(eventId: EventId): string | null {
  if (typeof window === "undefined" || eventId == null || eventId === "") return null;
  return sessionStorage.getItem(`${STORAGE_PREFIX}${eventId}`);
}

export function setEventUnlockToken(eventId: EventId, token: string | number | null | undefined): void {
  if (typeof window === "undefined" || eventId == null || eventId === "" || !token) return;
  sessionStorage.setItem(`${STORAGE_PREFIX}${eventId}`, String(token));
}

export function clearEventUnlockToken(eventId: EventId): void {
  if (typeof window === "undefined" || eventId == null || eventId === "") return;
  sessionStorage.removeItem(`${STORAGE_PREFIX}${eventId}`);
}

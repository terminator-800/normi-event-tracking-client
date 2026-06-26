const STORAGE_PREFIX = "event_unlock_token_";

export function getEventUnlockToken(eventId) {
  if (typeof window === "undefined" || eventId == null || eventId === "") return null;
  return sessionStorage.getItem(`${STORAGE_PREFIX}${eventId}`);
}

export function setEventUnlockToken(eventId, token) {
  if (typeof window === "undefined" || eventId == null || eventId === "" || !token) return;
  sessionStorage.setItem(`${STORAGE_PREFIX}${eventId}`, String(token));
}

export function clearEventUnlockToken(eventId) {
  if (typeof window === "undefined" || eventId == null || eventId === "") return;
  sessionStorage.removeItem(`${STORAGE_PREFIX}${eventId}`);
}

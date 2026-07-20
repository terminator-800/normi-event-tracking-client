import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "./Navbar";
import EventCard from "./EventCard";
import UpcomingEventsList from "./UpcomingEventsList";
import PaginationBar from "./PaginationBar";
import csgLogo from "../assets/CSG LOGO.jpg";
import { useGetCurrentEvent } from "../hooks/useGetCurrentEvent";
import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import { useSubmitAttendance } from "../hooks/useSubmitAttendance";
import { useVerifyEventPassword } from "../hooks/useVerifyEventPassword";
import {
  clearEventUnlockToken,
  getEventUnlockToken,
  setEventUnlockToken,
} from "../utils/eventUnlockStorage";
import { getApiErrorMessage } from "../types/api";
import type { DisplayEvent } from "../types/events";
import {
  lookupPublicStudentAttendance,
  type PublicStudentAttendanceResult,
} from "../hooks/usePublicStudentAttendance";
import toast from "react-hot-toast";

const UPCOMING_EVENTS_PAGE_SIZE = 3;
const ONGOING_EVENTS_PAGE_SIZE = 1;

type VerifyPasswordResponse = {
  unlockToken?: string;
  token?: string;
};

type AttendanceResponse = {
  status?: string;
  message?: string;
};

type SubmitAttendanceVariables = {
  identifier: string;
  attendanceKind: "in" | "out";
  eventId?: string | number;
  eventUnlockToken?: string;
  simulatedTapTime?: string;
  simulatedDate?: string;
};

function sqlTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value).trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Wait for RFID wedge / typing to finish before auto-submit. */
const AUTO_SUBMIT_DEBOUNCE_MS = 500;
const MIN_AUTO_SUBMIT_LENGTH = 6;

export default function Home() {
  const { eventId: focusEventId } = useParams();
  const [userId, setUserId] = useState("");
  const [eventPasswordInput, setEventPasswordInput] = useState("");
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
  const identifierInputRef = useRef<HTMLInputElement>(null);
  const eventPasswordInputRef = useRef<HTMLInputElement>(null);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmittedIdentifierRef = useRef("");
  const [detailEvent, setDetailEvent] = useState<DisplayEvent | null>(null);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [ongoingPage, setOngoingPage] = useState(1);
  const [historyIdentifier, setHistoryIdentifier] = useState("");
  const [historyResult, setHistoryResult] = useState<PublicStudentAttendanceResult | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [isLookingUpHistory, setIsLookingUpHistory] = useState(false);
  const historyInputRef = useRef<HTMLInputElement>(null);
  const historyAutoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(() => new Date());
  const { data: eventBundle, isPending: isCurrentEventLoading } = useGetCurrentEvent();
  const currentEvent = eventBundle?.current ?? null;
  const ongoingEvents = useMemo(() => {
    const list = Array.isArray(eventBundle?.ongoing) ? eventBundle.ongoing : [];
    if (list.length > 0) return list;
    const normalized = String(currentEvent?.status ?? "").trim().toLowerCase();
    return normalized === "ongoing" || normalized === "active" ? [currentEvent] : [];
  }, [eventBundle, currentEvent]);
  const upcomingEvents = useMemo(() => {
    if (!Array.isArray(eventBundle?.upcoming)) return [];
    return eventBundle.upcoming;
  }, [eventBundle]);
  const upcomingEvent = useMemo(() => {
    if (!Array.isArray(eventBundle?.upcoming)) return null;
    return eventBundle.upcoming[0] ?? null;
  }, [eventBundle]);

  /** From dashboard deep-link: focus ongoing event, or open upcoming details. */
  useEffect(() => {
    if (!focusEventId) return;
    const ongoingIdx = ongoingEvents.findIndex(
      (e) => e != null && String(e.id) === String(focusEventId),
    );
    if (ongoingIdx >= 0) {
      setOngoingPage(Math.floor(ongoingIdx / ONGOING_EVENTS_PAGE_SIZE) + 1);
      setDetailEvent(null);
      return;
    }
    const upcomingMatch = upcomingEvents.find((e) => String(e.id) === String(focusEventId));
    if (upcomingMatch) {
      setDetailEvent(upcomingMatch);
    }
  }, [focusEventId, ongoingEvents, upcomingEvents]);

  useEffect(() => {
    if (!detailEvent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailEvent(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailEvent]);

  const totalOngoingPages = Math.max(
    1,
    Math.ceil(ongoingEvents.length / ONGOING_EVENTS_PAGE_SIZE) || 1,
  );
  const safeOngoingPage = Math.min(ongoingPage, totalOngoingPages);
  const selectedOngoingEvent = useMemo(() => {
    const start = (safeOngoingPage - 1) * ONGOING_EVENTS_PAGE_SIZE;
    return ongoingEvents[start] ?? null;
  }, [ongoingEvents, safeOngoingPage]);
  const hasOngoingEvent = ongoingEvents.length > 0;
  const requiresEventPassword = Boolean(selectedOngoingEvent?.requiresPassword);
  const isAttendanceUnlocked = !requiresEventPassword || Boolean(unlockToken);

  useEffect(() => {
    const eventId = selectedOngoingEvent?.id;
    setUnlockToken(eventId != null ? getEventUnlockToken(eventId) : null);
    setEventPasswordInput("");
    setShowUnlockPassword(false);
  }, [selectedOngoingEvent?.id]);

  const displayNow = now;
  const attendancePhase = useMemo(() => {
    if (!selectedOngoingEvent) return null;

    const amIn = sqlTimeToMinutes(selectedOngoingEvent.am_time_in);
    const amOut = sqlTimeToMinutes(selectedOngoingEvent.am_time_out);
    const pmIn = sqlTimeToMinutes(selectedOngoingEvent.pm_time_in);
    const pmOut = sqlTimeToMinutes(selectedOngoingEvent.pm_time_out);
    const nowMinutes = displayNow.getHours() * 60 + displayNow.getMinutes();

    const duration = String(selectedOngoingEvent.duration ?? "").trim();
    /** Same rules as server `determineSlot` so "Time Out" + submit record `am_time_out` for AM-only. */
    let usePmSlot;
    if (duration === "AM Only") {
      usePmSlot = false;
    } else if (duration === "PM Only") {
      usePmSlot = true;
    } else if (duration === "Half Day") {
      const hasAm =
        selectedOngoingEvent.am_time_in != null &&
        String(selectedOngoingEvent.am_time_in).trim() !== "";
      const hasPm =
        selectedOngoingEvent.pm_time_in != null &&
        String(selectedOngoingEvent.pm_time_in).trim() !== "";
      if (hasAm && !hasPm) usePmSlot = false;
      else if (!hasAm && hasPm) usePmSlot = true;
      else usePmSlot = pmIn != null && nowMinutes >= pmIn;
    } else {
      usePmSlot = pmIn != null && nowMinutes >= pmIn;
    }
    const slotIn = usePmSlot ? pmIn : amIn;
    const slotOut = usePmSlot ? pmOut : amOut;

    if (slotIn != null && nowMinutes < slotIn) {
      return {
        label: "Time In Not Yet Active",
        className: "text-amber-700",
        dotClassName: "bg-amber-500/80",
      };
    }

    const timeInOnly =
      String(selectedOngoingEvent.event_mode ?? "").trim().toUpperCase() === "TIME_IN_ONLY" ||
      selectedOngoingEvent.time_in_only === true;

    // Time-In Only: never switch the kiosk to Time Out.
    if (timeInOnly) {
      return {
        label: "Time In",
        className: "text-[#07713c]",
        dotClassName: "bg-[#07713c]/80",
      };
    }

    if (slotOut != null && nowMinutes >= slotOut) {
      return {
        label: "Time Out",
        className: "text-red-600",
        dotClassName: "bg-red-500/80",
      };
    }

    return {
      label: "Time In",
      className: "text-[#07713c]",
      dotClassName: "bg-[#07713c]/80",
    };
  }, [selectedOngoingEvent, displayNow]);
  const attendanceKind = useMemo(
    () => (attendancePhase?.label === "Time Out" ? "out" : "in"),
    [attendancePhase],
  );
  const ongoingEventTimeDisplay = useMemo(() => {
    const raw = String(selectedOngoingEvent?.timeSlots ?? "").trim();
    if (!raw) return "—";
    return raw
      .replace(/\s*,\s*(?=\d{1,2}:\d{2}\s*(?:AM|PM))/gi, "\n")
      .trim();
  }, [selectedOngoingEvent]);
  const totalUpcomingPages = Math.max(
    1,
    Math.ceil(upcomingEvents.length / UPCOMING_EVENTS_PAGE_SIZE) || 1,
  );
  const safeUpcomingPage = Math.min(upcomingPage, totalUpcomingPages);
  const pagedUpcomingEvents = useMemo(() => {
    const start = (safeUpcomingPage - 1) * UPCOMING_EVENTS_PAGE_SIZE;
    return upcomingEvents.slice(start, start + UPCOMING_EVENTS_PAGE_SIZE);
  }, [safeUpcomingPage, upcomingEvents]);

  useEffect(() => {
    setUpcomingPage(1);
  }, [showUpcomingModal]);

  useEffect(() => {
    if (upcomingPage > totalUpcomingPages) {
      setUpcomingPage(totalUpcomingPages);
    }
  }, [upcomingPage, totalUpcomingPages]);

  useEffect(() => {
    if (ongoingPage > totalOngoingPages) {
      setOngoingPage(totalOngoingPages);
    }
  }, [ongoingPage, totalOngoingPages]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const clearIdentifierInput = useCallback(() => {
    setUserId("");
    lastSubmittedIdentifierRef.current = "";
    if (isAttendanceUnlocked) {
      identifierInputRef.current?.focus();
    }
  }, [isAttendanceUnlocked]);

  const { mutate: verifyEventPassword, isPending: isVerifyingEventPassword } = useVerifyEventPassword({
    onSuccess: (data) => {
      const body: VerifyPasswordResponse =
        data != null && typeof data === "object" ? (data as VerifyPasswordResponse) : {};
      const token = body.unlockToken ?? body.token ?? null;
      const eventId = selectedOngoingEvent?.id;
      if (!token || eventId == null) {
        toast.error("Unlock failed. Please try again.");
        return;
      }
      setEventUnlockToken(eventId, token);
      setUnlockToken(String(token));
      setEventPasswordInput("");
      toast.success("Event unlocked. Students can now tap in or out.");
      window.setTimeout(() => identifierInputRef.current?.focus(), 0);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Incorrect event password."));
      setEventPasswordInput("");
      eventPasswordInputRef.current?.focus();
    },
  });

  const handleUnlockEvent = useCallback(() => {
    const password = eventPasswordInput.trim();
    const eventId = selectedOngoingEvent?.id;
    if (!password || eventId == null || isVerifyingEventPassword) return;
    verifyEventPassword({ eventId, password });
  }, [eventPasswordInput, isVerifyingEventPassword, selectedOngoingEvent?.id, verifyEventPassword]);

  const { mutate: submitAttendance, isPending: isSubmittingAttendance } = useSubmitAttendance({
    onSuccess: (data) => {
      const body: AttendanceResponse =
        data != null && typeof data === "object" ? (data as AttendanceResponse) : {};
      const status = String(body.status ?? "").toLowerCase();
      const message = body.message ? String(body.message) : "";

      if (status === "time_out_not_active") {
        toast.error(
          message ||
            "Time out is not active yet. Please tap again during the time out schedule.",
        );
        clearIdentifierInput();
        return;
      }

      toast.success(message || "Attendance submitted successfully.");
      clearIdentifierInput();
    },
    onError: (error) => {
      const status = error.response?.status;
      if (status === 403 && selectedOngoingEvent?.id != null) {
        clearEventUnlockToken(selectedOngoingEvent.id);
        setUnlockToken(null);
        toast.error(getApiErrorMessage(error, "Event session expired. Enter the password again."));
        return;
      }
      toast.error(getApiErrorMessage(error, "Failed to submit attendance."));
      clearIdentifierInput();
    },
  });

  const submitIdentifier = useCallback(
    (rawIdentifier?: string) => {
      const identifier = String(rawIdentifier ?? userId).trim();
      if (!identifier || isSubmittingAttendance || !hasOngoingEvent || !isAttendanceUnlocked) return;
      if (identifier === lastSubmittedIdentifierRef.current) return;

      lastSubmittedIdentifierRef.current = identifier;
      const payload: SubmitAttendanceVariables = {
        identifier,
        attendanceKind,
        ...(selectedOngoingEvent?.id != null ? { eventId: selectedOngoingEvent.id } : {}),
        ...(unlockToken ? { eventUnlockToken: unlockToken } : {}),
      };
      submitAttendance(payload);
    },
    [
      attendanceKind,
      hasOngoingEvent,
      isAttendanceUnlocked,
      isSubmittingAttendance,
      selectedOngoingEvent?.id,
      submitAttendance,
      unlockToken,
      userId,
    ],
  );

  const clearHistoryView = useCallback(() => {
    if (historyClearTimerRef.current) {
      clearTimeout(historyClearTimerRef.current);
      historyClearTimerRef.current = null;
    }
    if (historyAutoSubmitTimerRef.current) {
      clearTimeout(historyAutoSubmitTimerRef.current);
      historyAutoSubmitTimerRef.current = null;
    }
    setHistoryResult(null);
    setHistoryIdentifier("");
    setHistoryError("");
    window.setTimeout(() => historyInputRef.current?.focus(), 0);
  }, []);

  const lookupHistory = useCallback(async (rawIdentifier?: string) => {
    const identifier = String(rawIdentifier ?? historyIdentifier).replace(/\D/g, "").trim();
    if (!identifier) {
      setHistoryError("Enter a Student ID or tap an RFID card.");
      return;
    }
    if (historyAutoSubmitTimerRef.current) {
      clearTimeout(historyAutoSubmitTimerRef.current);
      historyAutoSubmitTimerRef.current = null;
    }
    if (historyClearTimerRef.current) {
      clearTimeout(historyClearTimerRef.current);
      historyClearTimerRef.current = null;
    }
    setIsLookingUpHistory(true);
    setHistoryError("");
    try {
      const result = await lookupPublicStudentAttendance(identifier);
      setHistoryResult(result);
    } catch (error) {
      setHistoryResult(null);
      setHistoryError(getApiErrorMessage(error, "Student not found."));
    } finally {
      setIsLookingUpHistory(false);
    }
  }, [historyIdentifier]);

  useEffect(() => {
    if (!historyResult) return;
    if (historyClearTimerRef.current) clearTimeout(historyClearTimerRef.current);
    historyClearTimerRef.current = setTimeout(() => {
      clearHistoryView();
    }, 6000);
    return () => {
      if (historyClearTimerRef.current) {
        clearTimeout(historyClearTimerRef.current);
        historyClearTimerRef.current = null;
      }
    };
  }, [historyResult, clearHistoryView]);

  useEffect(() => {
    const identifier = historyIdentifier.replace(/\D/g, "").trim();
    if (!identifier || isLookingUpHistory || historyResult) return;
    if (identifier.length < MIN_AUTO_SUBMIT_LENGTH) return;

    if (historyAutoSubmitTimerRef.current) clearTimeout(historyAutoSubmitTimerRef.current);
    historyAutoSubmitTimerRef.current = setTimeout(() => {
      void lookupHistory(identifier);
    }, AUTO_SUBMIT_DEBOUNCE_MS);

    return () => {
      if (historyAutoSubmitTimerRef.current) {
        clearTimeout(historyAutoSubmitTimerRef.current);
        historyAutoSubmitTimerRef.current = null;
      }
    };
  }, [historyIdentifier, isLookingUpHistory, historyResult, lookupHistory]);

  useEffect(() => {
    if (!hasOngoingEvent || detailEvent || showUpcomingModal) return;
    if (requiresEventPassword && !isAttendanceUnlocked) {
      eventPasswordInputRef.current?.focus();
      return;
    }
    identifierInputRef.current?.focus();
  }, [detailEvent, hasOngoingEvent, isAttendanceUnlocked, requiresEventPassword, showUpcomingModal]);

  useEffect(() => {
    const identifier = userId.trim();
    if (!identifier || !hasOngoingEvent || !isAttendanceUnlocked || isSubmittingAttendance) return;
    if (!/^\d+$/.test(identifier) || identifier.length < MIN_AUTO_SUBMIT_LENGTH) return;

    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    autoSubmitTimerRef.current = setTimeout(() => {
      submitIdentifier(identifier);
    }, AUTO_SUBMIT_DEBOUNCE_MS);

    return () => {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    };
  }, [hasOngoingEvent, isAttendanceUnlocked, isSubmittingAttendance, submitIdentifier, userId]);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#07713c]/[0.04] px-4 py-24 sm:px-8 lg:px-12 [&_button]:cursor-pointer">
      <Navbar showSettings />
      <section className="relative w-full max-w-6xl rounded-2xl border border-white/50 bg-white/92 px-5 py-6 sm:px-8 shadow-xl backdrop-blur-[2px] text-center">
        <div className="mt-2 px-1 sm:px-3 flex justify-center">
          {isCurrentEventLoading ? (
            <div className="w-full max-w-md rounded-lg p-6 text-center">
              <p className="text-xl font-semibold text-gray-900">Loading current event...</p>
            </div>
          ) : hasOngoingEvent && selectedOngoingEvent ? (
            <button
              type="button"
              onClick={() => setDetailEvent(selectedOngoingEvent)}
              className="flex w-full max-w-md flex-col items-center justify-center rounded-lg p-6 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07713c]"
            >
              <div className="mb-4 flex justify-center">
                <img
                  src={csgLogo}
                  alt="CSG Logo"
                  className="h-24 w-24 sm:h-28 sm:w-28 object-contain"
                />
              </div>
              <p className="mt-1 inline-flex items-center justify-center gap-1 text-xs font-semibold text-red-600 sm:text-sm">
                <span>Live</span>
                <span className="relative inline-flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                </span>
              </p>
              <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{selectedOngoingEvent?.name || "—"}</p>
              <p className="mt-2 text-lg font-medium text-gray-700">{selectedOngoingEvent?.venue || "—"}</p>
              <p className="mt-1 whitespace-pre-line text-lg font-medium text-gray-700">{ongoingEventTimeDisplay}</p>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-[#07713c]">Status: {selectedOngoingEvent?.status || "Ongoing"}</p>
            </button>
          ) : (
            <div className="w-full max-w-md rounded-lg p-6 text-center">
              <div className="mb-4 flex justify-center">
                <img
                  src={csgLogo}
                  alt="CSG Logo"
                  className="h-20 w-20 object-contain"
                />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {upcomingEvents.length > 0
                  ? "There is an upcoming event(s)."
                  : "No upcoming event"}
              </p>
              <p className="mt-2 text-base text-gray-700">There is no live event right now. Please check back later.</p>
              {upcomingEvent && (
                <p className="mt-3 text-sm font-medium text-[#07713c]">
                  Next event: {upcomingEvent.name} on {upcomingEvent.date ? formatEventDateForDisplay(upcomingEvent.date) : "TBA"}
                </p>
              )}
            </div>
          )}
        </div>
        {hasOngoingEvent && requiresEventPassword && !isAttendanceUnlocked && (
          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-md text-left">
              <p className="mb-2 text-sm font-medium text-[#07713c]">Event password required</p>
              <p className="mb-3 text-xs text-[#07713c]/80">
                Enter the password set for this event before students can tap in or out.
              </p>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <input
                    ref={eventPasswordInputRef}
                    id="event-unlock-password"
                    type={showUnlockPassword ? "text" : "password"}
                    value={eventPasswordInput}
                    onChange={(e) => setEventPasswordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      handleUnlockEvent();
                    }}
                    placeholder="Enter event password"
                    autoComplete="off"
                    className="block w-full appearance-none rounded-lg border-[1.5px] border-[#07713c] bg-white px-3 py-2 pr-14 text-sm text-[#07713c] outline-none focus:border-[#07713c] focus:ring-1 focus:ring-[#07713c]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-3 text-[11px] text-[#07713c] hover:text-[#055a2e]"
                  >
                    {showUnlockPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleUnlockEvent}
                  disabled={!eventPasswordInput.trim() || isVerifyingEventPassword}
                  className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#055c30] disabled:opacity-60"
                >
                  {isVerifyingEventPassword ? "Unlocking..." : "Unlock attendance"}
                </button>
              </div>
            </div>
          </div>
        )}

        {hasOngoingEvent && isAttendanceUnlocked && (
          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-md text-left">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="attendance-identifier" className="block text-sm font-medium text-[#07713c]">
                  Student ID or RFID
                </label>
                {attendancePhase && (
                  <p className={`inline-flex items-center justify-end gap-1 text-xs font-semibold sm:text-sm ${attendancePhase.className}`}>
                    <span>{attendancePhase.label}</span>
                    <span className="relative inline-flex h-2 w-2" aria-hidden="true">
                      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${attendancePhase.dotClassName}`} />
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${attendancePhase.dotClassName}`} />
                    </span>
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={identifierInputRef}
                  id="attendance-identifier"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (autoSubmitTimerRef.current) {
                      clearTimeout(autoSubmitTimerRef.current);
                      autoSubmitTimerRef.current = null;
                    }
                    submitIdentifier(userId);
                  }}
                  placeholder="Tap or enter student ID / RFID"
                  className="block w-full appearance-none rounded-lg border-[1.5px] border-[#07713c] bg-white px-3 py-2 text-sm text-[#07713c] shadow-none outline-none [box-shadow:none] hover:border-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-0 focus:ring-transparent focus-visible:border-[#07713c] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:[box-shadow:none]"
                />
                {isSubmittingAttendance && (
                  <p className="text-center text-xs font-medium text-[#07713c]/80">Submitting…</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShowUpcomingModal(true)}
            className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#055c30] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07713c]"
          >
            View Upcoming Events
          </button>
        </div>

        <div className="mt-8 w-full rounded-2xl border border-[#07713c]/25 bg-white p-5 sm:p-6 shadow-sm">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-lg font-bold text-[#0f172a]">Check my attendance</h2>
            <p className="mt-1 text-sm text-gray-600">
              Tap your ID card or enter your Student ID / RFID to view attendance for all events.
            </p>
            <div className="mt-4">
              <input
                ref={historyInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={historyIdentifier}
                onChange={(e) => {
                  setHistoryIdentifier(e.target.value.replace(/\D/g, ""));
                  if (historyError) setHistoryError("");
                  if (historyResult) setHistoryResult(null);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  void lookupHistory(historyIdentifier);
                }}
                placeholder="Student ID or RFID — loads automatically"
                className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2.5 text-center text-sm text-[#0f172a] placeholder:text-gray-400 focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/20"
              />
              {isLookingUpHistory ? (
                <p className="mt-2 text-sm text-gray-500">Looking up attendance...</p>
              ) : null}
            </div>
            {historyError ? (
              <p className="mt-3 text-sm font-medium text-red-600">{historyError}</p>
            ) : null}
          </div>

          {historyResult ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#07713c]/20 bg-[#07713c]/[0.04] p-4">
                <div>
                  <p className="text-sm text-gray-600">
                    ID: {historyResult.student.studentId}
                    {historyResult.student.yearLevel != null
                      ? ` · Year ${historyResult.student.yearLevel}`
                      : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-white px-3 py-2 border border-gray-200">
                    <p className="text-xs text-gray-500">Events</p>
                    <p className="font-bold tabular-nums">{historyResult.summary.totalEvents}</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 border border-gray-200">
                    <p className="text-xs text-gray-500">Present</p>
                    <p className="font-bold tabular-nums text-[#07713c]">{historyResult.summary.attended}</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 border border-gray-200">
                    <p className="text-xs text-gray-500">Absent</p>
                    <p className="font-bold tabular-nums text-red-600">{historyResult.summary.missed}</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 border border-gray-200">
                    <p className="text-xs text-gray-500">Total fines</p>
                    <p className="font-bold tabular-nums text-[#0f172a]">
                      ₱
                      {historyResult.events
                        .reduce((sum, ev) => sum + (Number(ev.finePhp) || 0), 0)
                        .toLocaleString("en-PH")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#07713c]/25">
                <table className="w-full min-w-[880px] text-sm">
                  <thead className="bg-[#07713c] text-white">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Event</th>
                      <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Date</th>
                      <th className="px-4 py-2.5 text-center font-semibold whitespace-nowrap">Session</th>
                      <th className="px-4 py-2.5 text-center font-semibold whitespace-nowrap">Status</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Time records</th>
                      <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap min-w-[7rem]">
                        Fine
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyResult.events.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No event attendance records found for this student.
                        </td>
                      </tr>
                    ) : (
                      historyResult.events.map((ev) => {
                        const timeLabel =
                          ev.sessionType === "Whole day"
                            ? `AM ${ev.amTimeIn ?? "—"} / ${ev.amTimeOut ?? "—"} · PM ${ev.pmTimeIn ?? "—"} / ${ev.pmTimeOut ?? "—"}`
                            : `In ${ev.timeIn ?? "—"} · Out ${ev.timeOut ?? "—"}`;
                        const fine = Number(ev.finePhp) || 0;
                        return (
                          <tr key={ev.eventId} className="border-t border-[#07713c]/15">
                            <td className="px-4 py-2.5 font-medium text-[#0f172a]">{ev.name}</td>
                            <td className="px-4 py-2.5 text-[#0f172a] whitespace-nowrap">
                              {formatEventDateForDisplay(ev.date)}
                            </td>
                            <td className="px-4 py-2.5 text-center text-[#0f172a] whitespace-nowrap">
                              {ev.sessionType}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  ev.attended
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {ev.attended ? "Present" : "Absent"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                              {timeLabel}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap text-[#0f172a]">
                              ₱{fine.toLocaleString("en-PH")}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-center text-xs text-gray-500">
                Returning to landing page in a few seconds…
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={clearHistoryView}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-[#0f172a] hover:bg-gray-50"
                >
                  Clear now
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {ongoingEvents.length > 1 && (
          <PaginationBar
            totalCount={ongoingEvents.length}
            page={safeOngoingPage}
            pageSize={ONGOING_EVENTS_PAGE_SIZE}
            onPageChange={setOngoingPage}
            itemLabel="ongoing events"
            className="mt-4 border-t-0 px-0 pb-0"
          />
        )}
      </section>

      {detailEvent && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-label="Event details"
          onClick={() => setDetailEvent(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[min(92dvh,880px)] flex flex-col rounded-2xl bg-white shadow-2xl border border-[#066336] ring-1 ring-[#07713c]/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 bg-[#07713C] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                  Event Introduction
                </p>
                <p className="mt-1 text-sm text-white/90">
                  Review the full event information below, including schedule, notes, and audience coverage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailEvent(null)}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-[#07713c] hover:bg-yellow-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <span className="text-lg font-bold leading-none">×</span>
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-7 [scrollbar-width:thin] [scrollbar-color:rgba(7,113,60,0.28)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#07713c]/30 [&::-webkit-scrollbar-thumb]:hover:bg-[#07713c]/40 [&::-webkit-scrollbar-track]:bg-transparent">
              <EventCard event={detailEvent} variant="modalHorizontal" />
            </div>
          </div>
        </div>
      )}

      {showUpcomingModal && (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center p-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-label="Upcoming events"
          onClick={() => setShowUpcomingModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#066336]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-[#07713c] px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Upcoming Events</h2>
              <button
                type="button"
                onClick={() => setShowUpcomingModal(false)}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-[#07713c] hover:bg-yellow-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <span className="text-lg font-bold leading-none">×</span>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:rgba(7,113,60,0.28)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#07713c]/30 [&::-webkit-scrollbar-thumb]:hover:bg-[#07713c]/40 [&::-webkit-scrollbar-track]:bg-transparent">
              <UpcomingEventsList
                events={pagedUpcomingEvents}
                isLoading={isCurrentEventLoading}
                emptyMessage="No upcoming events available."
                onEventClick={(event) => {
                  setShowUpcomingModal(false);
                  setDetailEvent(event);
                }}
              />
            </div>
            <PaginationBar
              totalCount={upcomingEvents.length}
              page={safeUpcomingPage}
              pageSize={UPCOMING_EVENTS_PAGE_SIZE}
              onPageChange={setUpcomingPage}
              itemLabel="upcoming events"
            />
          </div>
        </div>
      )}
    </main>
  );
}

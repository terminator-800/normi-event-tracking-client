import { useEffect, useMemo, useState, type MouseEvent } from "react";
import AddEvent from "./AddEvent";
import AttendanceExportModal from "./AttendanceExportModal";
import AttendanceImportModal from "./AttendanceImportModal";
import EventConfigExportModal from "./EventConfigExportModal";
import EventConfigImportModal from "./EventConfigImportModal";
import PaginationBar from "./PaginationBar";
import SearchMagnifierIcon from "./SearchMagnifierIcon";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import AppSidebarNav from "./AppSidebarNav";
import { useGetAllEvents } from "../hooks/useGetAllEvents";
import { useEditEvent } from "../hooks/useEditEvent";
import { useDeleteEvent } from "../hooks/useDeleteEvent";
import { useUpdateEventTimeout } from "../hooks/useUpdateEventTimeout";
import { useAppNavItems, useMyPermissions } from "../hooks/useMyPermissions";
import { formatEventDateForDisplay, formatSqlTimeForDisplay } from "../hooks/useGetEvents";
import api from "../api/axiosInstance";
import {
  formatDurationForEventsList,
  getEventSessionKindForFilter,
  resolveEventDurationUi,
} from "../utils/eventDurationDisplay";
import {
  AM_SESSION_TIME_OPTIONS,
  AM_SESSION_TIME_OUT_OPTIONS,
  EVENT_TIME_SELECT_CLASS,
  GRACE_HOUR_OPTIONS,
  GRACE_MINUTE_OPTIONS,
  PM_SESSION_TIME_OPTIONS,
  formatGraceDurationLabel,
  graceTotalMinutes,
  splitGraceTotalMinutes,
  sqlTimeToSessionSelectValue,
  twelveHourLabelToSqlTime,
} from "../utils/eventTimeOptions";
import { getAudienceScopeLabel } from "../utils/eventAudienceLabel";
import { getApiErrorMessage } from "../types/api";
import type { DeskPageProps } from "../types/desk-pages";
import type { DisplayEvent } from "../types/events";

type ManageEventsPageProps = DeskPageProps;
type EventModalMode = "view" | "edit";
type ViewMode = "list" | "grid";
type SessionKindFilter = "all" | "whole" | "am" | "pm";

type EditableEvent = DisplayEvent & {
  fineAmount?: number | string | null;
  _id?: string | number | null;
  amTimeIn?: string | null;
  amTimeOut?: string | null;
  pmTimeIn?: string | null;
  pmTimeOut?: string | null;
};

type EventSchedulePatch = Partial<
  Pick<
    EditableEvent,
    | "am_time_in"
    | "am_time_out"
    | "pm_time_in"
    | "pm_time_out"
    | "amGraceInMinutes"
    | "pmGraceInMinutes"
    | "am_grace_in"
    | "pm_grace_in"
    | "amTimeInDisplay"
    | "amTimeOutDisplay"
    | "pmTimeInDisplay"
    | "pmTimeOutDisplay"
  >
>;

type EventScheduleFields = {
  amIn: string | null;
  amOut: string | null;
  pmIn: string | null;
  pmOut: string | null;
  amGraceIn: number | null;
  pmGraceIn: number | null;
};

type EventModalScheduleProps = {
  ev: EditableEvent;
  readOnly: boolean;
  /** Ongoing events: only time-out can be changed (early end). */
  timeoutOnly?: boolean;
  onPatch?: (partial: EventSchedulePatch) => void;
};

/** Legacy "Half Day" rows → concrete value for session `<select>` (no Half Day option). */
function durationNormalizedForSessionEdit(ev: DisplayEvent): string {
  const d = String(ev?.duration ?? "").trim();
  if (d === "Half Day") {
    const { sessionFilter } = resolveEventDurationUi(ev);
    if (sessionFilter === "am_only") return "AM Only";
    if (sessionFilter === "pm_only") return "PM Only";
    return "Whole Day";
  }
  if (d === "Whole Day" || d === "AM Only" || d === "PM Only") return d;
  return d || "Whole Day";
}

const FINE_PER_ABSENT = 50; // Pesos per absent student
const EVENTS_LIST_PAGE_SIZE = 10;
/** Grid uses 12 so a 4-column row fills evenly (e.g. 3 full rows). */
const EVENTS_GRID_PAGE_SIZE = 12;

/** Manage Event main content text (sidebar + top header excluded). */
const EVENTS_PAGE_TEXT = "text-black";
const EVENTS_TH_TEXT = "font-bold text-white";
const TABLE_CELL_NOWRAP = "[&_th]:whitespace-nowrap [&_tbody_td]:whitespace-nowrap";

function normStatusKey(status: string | null | undefined): string {
  const n = String(status ?? "").trim().toLowerCase();
  if (n === "active" || n === "ongoing") return "ongoing";
  if (n === "completed") return "completed";
  if (n === "upcoming") return "upcoming";
  return n;
}

/** Completed events cannot be fully edited; Ongoing can only adjust time-out. */
function isEventLockedFromEditing(status: string | null | undefined): boolean {
  const k = normStatusKey(status);
  return k === "completed" || k === "ongoing";
}

function isEventOngoing(status: string | null | undefined): boolean {
  return normStatusKey(status) === "ongoing";
}

/** Completed events hide export / edit (delete stays for Super Admin). */
function isEventCompleted(status: string | null | undefined): boolean {
  return normStatusKey(status) === "completed";
}

/** Label shown in badges (API may still send "Active"). */
function displayEventStatus(status: string | null | undefined): string {
  const k = normStatusKey(status);
  if (k === "ongoing") return "Ongoing";
  if (k === "completed") return "Completed";
  if (k === "upcoming") return "Upcoming";
  return status ? String(status) : "—";
}

function getEventStatusClass(status: string | null | undefined): string {
  const k = normStatusKey(status);
  if (k === "completed") return "bg-green-100 text-black";
  if (k === "ongoing") return "bg-orange-100 text-black";
  if (k === "upcoming") return "bg-blue-100 text-black";
  return "bg-gray-100 text-black";
}

/** Event modal “Status:” value — bg + border pill (esp. upcoming: blue fill + blue border). */
function getEventModalStatusBadgeClass(status: string | null | undefined): string {
  const k = normStatusKey(status);
  if (k === "completed") return "bg-green-100 text-black border border-green-300";
  if (k === "ongoing") return "bg-orange-100 text-black border border-orange-300";
  if (k === "upcoming") return "bg-blue-100 text-black border border-blue-300";
  return "bg-gray-100 text-black border border-gray-300";
}

function getDefaultFinesForEvent(ev: DisplayEvent): number | null {
  if (ev.attRate == null) return null;
  const reg = Number(ev.reg) || 0;
  const rate = Number(ev.attRate);
  if (!Number.isFinite(rate)) return null;
  const absentCount = Math.round((reg * (100 - rate)) / 100);
  return Math.max(0, absentCount * FINE_PER_ABSENT);
}

function finiteGraceMinutes(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** `YYYY-MM-DD` for `<input type="date" />` from API date string. */
function eventYmdForDateInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(dateStr).trim());
  if (!m) return "";
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

function applySchedulePatch(prev: EditableEvent, partial: EventSchedulePatch): EditableEvent {
  const next = { ...prev, ...partial };
  if ("am_time_in" in partial) next.amTimeInDisplay = formatSqlTimeForDisplay(partial.am_time_in ?? null);
  if ("am_time_out" in partial) next.amTimeOutDisplay = formatSqlTimeForDisplay(partial.am_time_out ?? null);
  if ("pm_time_in" in partial) next.pmTimeInDisplay = formatSqlTimeForDisplay(partial.pm_time_in ?? null);
  if ("pm_time_out" in partial) next.pmTimeOutDisplay = formatSqlTimeForDisplay(partial.pm_time_out ?? null);
  return next;
}

/** Times + grace for modal (fields from API mapper or raw snake_case keys). */
function getEventScheduleFields(ev: EditableEvent): EventScheduleFields {
  const amIn = ev.amTimeInDisplay ?? formatSqlTimeForDisplay(ev.am_time_in ?? ev.amTimeIn);
  const amOut = ev.amTimeOutDisplay ?? formatSqlTimeForDisplay(ev.am_time_out ?? ev.amTimeOut);
  const pmIn = ev.pmTimeInDisplay ?? formatSqlTimeForDisplay(ev.pm_time_in ?? ev.pmTimeIn);
  const pmOut = ev.pmTimeOutDisplay ?? formatSqlTimeForDisplay(ev.pm_time_out ?? ev.pmTimeOut);
  return {
    amIn,
    amOut,
    pmIn,
    pmOut,
    amGraceIn: finiteGraceMinutes(ev.amGraceInMinutes ?? ev.am_grace_in),
    pmGraceIn: finiteGraceMinutes(ev.pmGraceInMinutes ?? ev.pm_grace_in),
  };
}

function EventModalSchedule({ ev, readOnly, timeoutOnly = false, onPatch }: EventModalScheduleProps) {
  const { sessionFilter } = resolveEventDurationUi(ev);
  const s = getEventScheduleFields(ev);
  const hasAmData = s.amIn || s.amOut || s.amGraceIn != null;
  const hasPmData = s.pmIn || s.pmOut || s.pmGraceIn != null;
  const showAmBlock = readOnly || timeoutOnly
    ? sessionFilter === "whole"
      ? hasAmData
      : sessionFilter === "am_only"
    : sessionFilter === "whole" || sessionFilter === "am_only";
  const showPmBlock = readOnly || timeoutOnly
    ? sessionFilter === "whole"
      ? hasPmData
      : sessionFilter === "pm_only"
    : sessionFilter === "whole" || sessionFilter === "pm_only";
  const summary =
    ev.timeSlots != null && String(ev.timeSlots).trim() !== "" ? String(ev.timeSlots).trim() : "";

  const row = (label: string, value: string | null | undefined) => (
    <div className="border-b border-[#07713c]/10 py-1.5 text-left last:border-0">
      <span className="block text-black/80">{label}</span>
      <span className="mt-0.5 block font-medium tabular-nums text-black">{value ?? "—"}</span>
    </div>
  );

  const gAmIn = finiteGraceMinutes(ev.amGraceInMinutes ?? ev.am_grace_in);
  const gPmIn = finiteGraceMinutes(ev.pmGraceInMinutes ?? ev.pm_grace_in);

  if (timeoutOnly && onPatch) {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold text-black">Time in / out &amp; late threshold</p>
        <p className="mb-3 rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.06] px-3 py-2 text-xs leading-relaxed text-black">
          Event ended early? Move <strong>Time out</strong> earlier so students can time out now instead of
          waiting for the original end time.
        </p>
        <div className="space-y-3">
          {showAmBlock && (
            <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] px-3 py-2">
              <p className="mb-2 text-xs font-medium text-black">AM Session</p>
              <div className="space-y-2 text-sm">
                {row("Time in", s.amIn)}
                {row(
                  "Late — time in",
                  s.amGraceIn != null ? formatGraceDurationLabel(s.amGraceIn) : null,
                )}
                <div className="flex w-full min-w-0 flex-col gap-1.5 pt-1 text-left">
                  <span className="text-xs font-medium text-black/85">Time out</span>
                  <select
                    className={EVENT_TIME_SELECT_CLASS}
                    value={sqlTimeToSessionSelectValue(ev.am_time_out ?? ev.amTimeOut, "am")}
                    onChange={(e) => {
                      const v = e.target.value;
                      onPatch({ am_time_out: v ? twelveHourLabelToSqlTime(v) : null });
                    }}
                  >
                    <option value="">Select time</option>
                    {AM_SESSION_TIME_OUT_OPTIONS.map((timeOption) => (
                      <option key={`am-out-early-${timeOption}`} value={timeOption}>
                        {timeOption}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          {showPmBlock && (
            <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] px-3 py-2">
              <p className="mb-2 text-xs font-medium text-black">PM Session</p>
              <div className="space-y-2 text-sm">
                {row("Time in", s.pmIn)}
                {row(
                  "Late — time in",
                  s.pmGraceIn != null ? formatGraceDurationLabel(s.pmGraceIn) : null,
                )}
                <div className="flex w-full min-w-0 flex-col gap-1.5 pt-1 text-left">
                  <span className="text-xs font-medium text-black/85">Time out</span>
                  <select
                    className={EVENT_TIME_SELECT_CLASS}
                    value={sqlTimeToSessionSelectValue(ev.pm_time_out ?? ev.pmTimeOut, "pm")}
                    onChange={(e) => {
                      const v = e.target.value;
                      onPatch({ pm_time_out: v ? twelveHourLabelToSqlTime(v) : null });
                    }}
                  >
                    <option value="">Select time</option>
                    {PM_SESSION_TIME_OPTIONS.map((timeOption) => (
                      <option key={`pm-out-early-${timeOption}`} value={timeOption}>
                        {timeOption}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!readOnly && onPatch) {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold text-black">Time in / out &amp; late threshold</p>
        <div className="space-y-3">
          {showAmBlock && (
            <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] px-3 py-2">
              <p className="mb-2 text-xs font-medium text-black">AM Session</p>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2 sm:gap-4">
                  <div className="flex min-w-0 flex-col gap-3 text-left">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-xs font-medium text-black/85">Time in</span>
                      <select
                        className={EVENT_TIME_SELECT_CLASS}
                        value={sqlTimeToSessionSelectValue(ev.am_time_in ?? ev.amTimeIn, "am")}
                        onChange={(e) => {
                          const v = e.target.value;
                          onPatch({ am_time_in: v ? twelveHourLabelToSqlTime(v) : null });
                        }}
                      >
                        <option value="">Select time</option>
                        {AM_SESSION_TIME_OPTIONS.map((timeOption) => (
                          <option key={`am-in-${timeOption}`} value={timeOption}>
                            {timeOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-xs font-medium text-black/85">Late — time in</span>
                      <div className="grid w-full min-w-0 grid-cols-2 gap-2">
                        <div className="min-w-0">
                          <span className="mb-1 block text-[11px] font-medium text-black/75">Hour(s)</span>
                          <select
                            className="w-full min-w-0 cursor-pointer rounded-lg border border-[#07713c]/40 bg-white px-2 py-1.5 text-left text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15"
                            value={splitGraceTotalMinutes(gAmIn ?? 0).hours}
                            onChange={(e) => {
                              const h = Number(e.target.value);
                              const { minutes } = splitGraceTotalMinutes(gAmIn ?? 0);
                              const v = graceTotalMinutes(h, minutes);
                              onPatch({ amGraceInMinutes: v, am_grace_in: v });
                            }}
                          >
                            {GRACE_HOUR_OPTIONS.map((h) => (
                              <option key={`edit-am-grace-h-${h}`} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="min-w-0">
                          <span className="mb-1 block text-[11px] font-medium text-black/75">Minutes</span>
                          <select
                            className="w-full min-w-0 cursor-pointer rounded-lg border border-[#07713c]/40 bg-white px-2 py-1.5 text-left text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15"
                            value={splitGraceTotalMinutes(gAmIn ?? 0).minutes}
                            onChange={(e) => {
                              const m = Number(e.target.value);
                              const { hours } = splitGraceTotalMinutes(gAmIn ?? 0);
                              const v = graceTotalMinutes(hours, m);
                              onPatch({ amGraceInMinutes: v, am_grace_in: v });
                            }}
                          >
                            {GRACE_MINUTE_OPTIONS.map((m) => (
                              <option key={`edit-am-grace-m-${m}`} value={m}>
                                {String(m).padStart(2, "0")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full min-w-0 flex-col gap-1.5 text-left">
                    <span className="text-xs font-medium text-black/85">Time out</span>
                    <select
                      className={EVENT_TIME_SELECT_CLASS}
                      value={sqlTimeToSessionSelectValue(ev.am_time_out ?? ev.amTimeOut, "am")}
                      onChange={(e) => {
                        const v = e.target.value;
                        onPatch({ am_time_out: v ? twelveHourLabelToSqlTime(v) : null });
                      }}
                    >
                      <option value="">Select time</option>
                      {AM_SESSION_TIME_OPTIONS.map((timeOption) => (
                        <option key={`am-out-${timeOption}`} value={timeOption}>
                          {timeOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showPmBlock && (
            <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] px-3 py-2">
              <p className="mb-2 text-xs font-medium text-black">PM Session</p>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2 sm:gap-4">
                  <div className="flex min-w-0 flex-col gap-3 text-left">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-xs font-medium text-black/85">Time in</span>
                      <select
                        className={EVENT_TIME_SELECT_CLASS}
                        value={sqlTimeToSessionSelectValue(ev.pm_time_in ?? ev.pmTimeIn, "pm")}
                        onChange={(e) => {
                          const v = e.target.value;
                          onPatch({ pm_time_in: v ? twelveHourLabelToSqlTime(v) : null });
                        }}
                      >
                        <option value="">Select time</option>
                        {PM_SESSION_TIME_OPTIONS.map((timeOption) => (
                          <option key={`pm-in-${timeOption}`} value={timeOption}>
                            {timeOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-xs font-medium text-black/85">Late — time in</span>
                      <div className="grid w-full min-w-0 grid-cols-2 gap-2">
                        <div className="min-w-0">
                          <span className="mb-1 block text-[11px] font-medium text-black/75">Hour(s)</span>
                          <select
                            className="w-full min-w-0 cursor-pointer rounded-lg border border-[#07713c]/40 bg-white px-2 py-1.5 text-left text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15"
                            value={splitGraceTotalMinutes(gPmIn ?? 0).hours}
                            onChange={(e) => {
                              const h = Number(e.target.value);
                              const { minutes } = splitGraceTotalMinutes(gPmIn ?? 0);
                              const v = graceTotalMinutes(h, minutes);
                              onPatch({ pmGraceInMinutes: v, pm_grace_in: v });
                            }}
                          >
                            {GRACE_HOUR_OPTIONS.map((h) => (
                              <option key={`edit-pm-grace-h-${h}`} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="min-w-0">
                          <span className="mb-1 block text-[11px] font-medium text-black/75">Minutes</span>
                          <select
                            className="w-full min-w-0 cursor-pointer rounded-lg border border-[#07713c]/40 bg-white px-2 py-1.5 text-left text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15"
                            value={splitGraceTotalMinutes(gPmIn ?? 0).minutes}
                            onChange={(e) => {
                              const m = Number(e.target.value);
                              const { hours } = splitGraceTotalMinutes(gPmIn ?? 0);
                              const v = graceTotalMinutes(hours, m);
                              onPatch({ pmGraceInMinutes: v, pm_grace_in: v });
                            }}
                          >
                            {GRACE_MINUTE_OPTIONS.map((m) => (
                              <option key={`edit-pm-grace-m-${m}`} value={m}>
                                {String(m).padStart(2, "0")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-[11px] text-black/65">
                        After this grace ends: Time In Cutoff — taps not recorded, student marked Absent.
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full min-w-0 flex-col gap-1.5 text-left">
                    <span className="text-xs font-medium text-black/85">Time out</span>
                    <select
                      className={EVENT_TIME_SELECT_CLASS}
                      value={sqlTimeToSessionSelectValue(ev.pm_time_out ?? ev.pmTimeOut, "pm")}
                      onChange={(e) => {
                        const v = e.target.value;
                        onPatch({ pm_time_out: v ? twelveHourLabelToSqlTime(v) : null });
                      }}
                    >
                      <option value="">Select time</option>
                      {PM_SESSION_TIME_OPTIONS.map((timeOption) => (
                        <option key={`pm-out-${timeOption}`} value={timeOption}>
                          {timeOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!showAmBlock && !showPmBlock) {
    return (
      <div>
        <label className="mb-1 block text-xs font-semibold text-black">Time in / out & late threshold</label>
        <p className="min-h-[2.5rem] rounded-lg border border-[#07713c]/30 bg-[#07713c]/5 px-3 py-2 text-sm text-black">
          {summary || "—"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-black">Time in / out & late threshold</p>
      <div className="space-y-3">
        {showAmBlock && (
          <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] px-3 py-2">
            <p className="mb-2 text-xs font-medium text-black">AM Session</p>
            <div className="text-sm">
              {row("Time in", s.amIn)}
              {row("Time out", s.amOut)}
              {row(
                "Late — time in",
                s.amGraceIn != null ? formatGraceDurationLabel(s.amGraceIn) : null,
              )}
            </div>
          </div>
        )}
        {showPmBlock && (
          <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] px-3 py-2">
            <p className="mb-2 text-xs font-medium text-black">PM Session</p>
            <div className="text-sm">
              {row("Time in", s.pmIn)}
              {row("Time out", s.pmOut)}
              {row(
                "Late — time in",
                s.pmGraceIn != null ? formatGraceDurationLabel(s.pmGraceIn) : null,
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ManageEvents({ onLogout, onNavigate }: ManageEventsPageProps) {
  const { data: apiEvents = [], isPending: isEventsLoading, isError: isEventsError } =
    useGetAllEvents();
  const editEventMutation = useEditEvent();
  const updateTimeoutMutation = useUpdateEventTimeout();
  const deleteEventMutation = useDeleteEvent();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sessionKindFilter, setSessionKindFilter] = useState<SessionKindFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DisplayEvent | null>(null);
  const [editableEvent, setEditableEvent] = useState<EditableEvent | null>(null);
  /** 'view' = read-only modal; 'edit' = editable (frontend only until API exists) */
  const [eventModalMode, setEventModalMode] = useState<EventModalMode>("edit");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const [editSaveSuccess, setEditSaveSuccess] = useState<string | null>(null);
  const [showEditNotAllowedModal, setShowEditNotAllowedModal] = useState(false);
  const [editNotAllowedEventLabel, setEditNotAllowedEventLabel] = useState("");
  const [eventsPage, setEventsPage] = useState(1);
  const [showImportConfig, setShowImportConfig] = useState(false);
  const [showImportAttendance, setShowImportAttendance] = useState(false);
  const [exportConfigEvent, setExportConfigEvent] = useState<DisplayEvent | null>(null);
  const [exportAttendanceEvent, setExportAttendanceEvent] = useState<DisplayEvent | null>(null);
  const [eventPasswordReveal, setEventPasswordReveal] = useState<{
    loading: boolean;
    password: string | null;
    recoverable: boolean;
    hasPassword: boolean;
  } | null>(null);
  const [showRevealedEventPassword, setShowRevealedEventPassword] = useState(false);
  const activeNav = "manage_events";
  const { has: hasPermission, isSuperAdmin } = useMyPermissions();
  /** Event actions are controlled only by Role Permission checkboxes. */
  const canCreateEvent = hasPermission("action.event.create");
  const canEditEvent = hasPermission("action.event.edit");
  const canDeleteEvent = hasPermission("action.event.delete");
  const canManageEvents = canCreateEvent || canEditEvent || canDeleteEvent;
  /** Super Admin may delete completed/ongoing events; others only non-completed. */
  const canDeleteEventByStatus = (status: string | null | undefined) =>
    canDeleteEvent && (isSuperAdmin || !isEventCompleted(status));
  const canExportConfig =
    isSuperAdmin ||
    hasPermission("action.event.export_config") ||
    hasPermission("action.event.export");
  const canExportAttendance =
    isSuperAdmin ||
    hasPermission("action.event.export_attendance") ||
    hasPermission("action.event.export");
  const canImportConfig =
    hasPermission("action.event.import_config") || hasPermission("action.event.export");
  const canImportAttendance =
    hasPermission("action.event.import_attendance") || hasPermission("action.event.export");
  /** Super Admin can export any event (including completed); others only non-completed while managing. */
  const canShowEventExports = (status: string | null | undefined) =>
    (canExportConfig || canExportAttendance) && (isSuperAdmin || !isEventCompleted(status));
  /**
   * Display amount for the Fines column — never 0 (uses {@link FINE_PER_ABSENT} as minimum).
   */
  const getFinesForEvent = (ev: DisplayEvent): number => {
    if (ev.attRate != null) {
      const computed = getDefaultFinesForEvent(ev);
      if (computed != null) {
        return computed <= 0 ? FINE_PER_ABSENT : computed;
      }
    }
    if (ev.fine != null && ev.fine !== "") {
      const n = Number(ev.fine);
      if (Number.isFinite(n)) {
        const v = Math.max(0, n);
        return v <= 0 ? FINE_PER_ABSENT : v;
      }
    }
    return FINE_PER_ABSENT;
  };

  const navItems = useAppNavItems();


  /** Live events from API only. */
  const allEvents = useMemo(() => [...apiEvents], [apiEvents]);

  const openEventModal = (ev: DisplayEvent, mode: EventModalMode = "edit") => {
    setEditSaveError(null);
    setEditSaveSuccess(null);
    setEventPasswordReveal(null);
    setShowRevealedEventPassword(false);
    setSelectedEvent(ev);
    const wantEdit = mode === "edit" && !isEventLockedFromEditing(ev.status);
    const openEdit = canEditEvent && wantEdit;
    setEditableEvent(() => {
      if (!openEdit) return { ...ev };
      const duration = durationNormalizedForSessionEdit(ev);
      let fine = ev.fine;
      if (fine == null || fine === "") {
        fine = getFinesForEvent(ev);
      } else {
        const n = Number(fine);
        fine = Number.isFinite(n) ? n : getFinesForEvent(ev);
      }
      return { ...ev, duration, fine, fineAmount: fine };
    });
    setEventModalMode(!canEditEvent || !wantEdit ? "view" : "edit");
  };

  const closeEventModal = () => {
    setSelectedEvent(null);
    setEditableEvent(null);
    setEditSaveError(null);
    setEditSaveSuccess(null);
    setEventModalMode("edit");
    setEventPasswordReveal(null);
    setShowRevealedEventPassword(false);
  };

  useEffect(() => {
    if (!isSuperAdmin || !selectedEvent?.id) {
      return;
    }
    let cancelled = false;
    setEventPasswordReveal({ loading: true, password: null, recoverable: false, hasPassword: false });
    void api
      .get(`/events/${selectedEvent.id}/attendance-password`)
      .then((res) => {
        if (cancelled) return;
        setEventPasswordReveal({
          loading: false,
          password: res.data?.password != null ? String(res.data.password) : null,
          recoverable: Boolean(res.data?.recoverable),
          hasPassword: Boolean(res.data?.hasPassword),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setEventPasswordReveal({
          loading: false,
          password: null,
          recoverable: false,
          hasPassword: false,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, selectedEvent?.id]);

  const handleDeleteSelectedEvent = () => {
    if (!selectedEvent || !canDeleteEventByStatus(selectedEvent.status)) return;
    setDeleteError(null);
    const eventId = selectedEvent.id ?? (selectedEvent as EditableEvent)._id;
    if (eventId == null || String(eventId).trim() === "") {
      setDeleteError("Missing event id.");
      return;
    }

    deleteEventMutation.mutate(
      { id: eventId },
      {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          closeEventModal();
          setDeleteError(null);
        },
        onError: (error) => {
          setDeleteError(getApiErrorMessage(error, "Could not delete event."));
        },
      },
    );
  };

  const saveEditableEvent = () => {
    if (!canEditEvent) return;
    if (!editableEvent) return;
    const eventId = editableEvent.id ?? editableEvent._id;
    if (eventId == null || String(eventId).trim() === "") {
      setEditSaveError("Missing event id.");
      return;
    }

    const payload = {
      name: String(editableEvent.name ?? "").trim(),
      date: eventYmdForDateInput(editableEvent.date),
      venue: String(editableEvent.venue ?? "").trim(),
      duration: String(editableEvent.duration ?? "Whole Day").trim(),
      event_mode:
        editableEvent.event_mode === "TIME_IN_ONLY" || editableEvent.time_in_only
          ? "TIME_IN_ONLY"
          : "TIME_IN_OUT",
      time_in_only:
        editableEvent.event_mode === "TIME_IN_ONLY" || editableEvent.time_in_only === true,
      am_time_in: editableEvent.am_time_in ?? null,
      am_time_out: editableEvent.am_time_out ?? null,
      pm_time_in: editableEvent.pm_time_in ?? null,
      pm_time_out: editableEvent.pm_time_out ?? null,
      am_grace_in: Math.max(0, Number(editableEvent.am_grace_in ?? editableEvent.amGraceInMinutes ?? 0) || 0),
      pm_grace_in: Math.max(0, Number(editableEvent.pm_grace_in ?? editableEvent.pmGraceInMinutes ?? 0) || 0),
      audience_notes: editableEvent.audience_notes ?? "",
      fine_amount: Math.max(0, Number(editableEvent.fine ?? editableEvent.fineAmount ?? 0) || 0),
    };

    if (!payload.name || !payload.date || !payload.venue) {
      setEditSaveError("Event name, date, and venue are required.");
      return;
    }

    setEditSaveError(null);
    editEventMutation.mutate(
      { id: eventId, payload },
      {
        onSuccess: () => {
          closeEventModal();
        },
        onError: (error) => {
          setEditSaveError(getApiErrorMessage(error, "Could not save event changes."));
        },
      },
    );
  };

  const saveEventTimeout = () => {
    if (!canEditEvent) return;
    if (!editableEvent || !isEventOngoing(editableEvent.status)) return;
    const eventId = editableEvent.id ?? editableEvent._id;
    if (eventId == null || String(eventId).trim() === "") {
      setEditSaveError("Missing event id.");
      return;
    }

    const { sessionFilter } = resolveEventDurationUi(editableEvent);
    const payload: { am_time_out?: string | null; pm_time_out?: string | null } = {};
    if (sessionFilter === "whole" || sessionFilter === "am_only") {
      payload.am_time_out = editableEvent.am_time_out ?? null;
    }
    if (sessionFilter === "whole" || sessionFilter === "pm_only") {
      payload.pm_time_out = editableEvent.pm_time_out ?? null;
    }

    if (payload.am_time_out === undefined && payload.pm_time_out === undefined) {
      setEditSaveError("No session time-out to update.");
      return;
    }

    setEditSaveError(null);
    setEditSaveSuccess(null);
    updateTimeoutMutation.mutate(
      { id: eventId, payload },
      {
        onSuccess: () => {
          setEditSaveError(null);
          setEditSaveSuccess(null);
          closeEventModal();
        },
        onError: (error) => {
          setEditSaveSuccess(null);
          setEditSaveError(getApiErrorMessage(error, "Could not update time-out."));
        },
      },
    );
  };

  const patchEditableEventSchedule = (partial: EventSchedulePatch) => {
    setEditSaveSuccess(null);
    setEditableEvent((prev) => (prev ? applySchedulePatch(prev, partial) : prev));
  };

  const openDeleteFromRow = (ev: DisplayEvent) => {
    if (!canDeleteEventByStatus(ev.status)) return;
    setEditableEvent(null);
    setSelectedEvent(ev);
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const handleEditClick = (ev: DisplayEvent, e?: MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation?.();
    if (!canEditEvent) return;
    if (isEventOngoing(ev.status)) {
      openEventModal(ev, "view");
      return;
    }
    if (isEventLockedFromEditing(ev.status)) {
      const label = ev.name != null && String(ev.name).trim() !== "" ? String(ev.name).trim() : "This event";
      setEditNotAllowedEventLabel(label);
      setShowEditNotAllowedModal(true);
      return;
    }
    openEventModal(ev, "edit");
  };

  // Filter events by status, session kind, and search
  const filteredEvents = allEvents.filter((ev) => {
    const matchesStatus =
      statusFilter === "All Status" || normStatusKey(ev.status) === normStatusKey(statusFilter);
    const kind = getEventSessionKindForFilter(ev);
    const matchesSession =
      sessionKindFilter === "all" ||
      (sessionKindFilter === "whole" && kind === "whole") ||
      (sessionKindFilter === "am" && kind === "am") ||
      (sessionKindFilter === "pm" && kind === "pm");
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      ev.name.toLowerCase().includes(q) ||
      ev.venue?.toLowerCase().includes(q) ||
      getAudienceScopeLabel(ev).toLowerCase().includes(q) ||
      (ev.audience_notes && String(ev.audience_notes).toLowerCase().includes(q));
    return matchesStatus && matchesSession && matchesSearch;
  });

  const eventsTotal = filteredEvents.length;
  const eventsPageSize = viewMode === "grid" ? EVENTS_GRID_PAGE_SIZE : EVENTS_LIST_PAGE_SIZE;
  const eventsTotalPages = Math.max(1, Math.ceil(eventsTotal / eventsPageSize) || 1);
  const eventsPageSafe = Math.min(eventsPage, eventsTotalPages);

  const paginatedEvents = useMemo(() => {
    const start = (eventsPageSafe - 1) * eventsPageSize;
    return filteredEvents.slice(start, start + eventsPageSize);
  }, [filteredEvents, eventsPageSafe, eventsPageSize]);

  useEffect(() => {
    setEventsPage(1);
  }, [search, statusFilter, sessionKindFilter, viewMode]);

  useEffect(() => {
    setEventsPage((p) => Math.min(p, eventsTotalPages));
  }, [eventsTotalPages]);

  function eventRowKey(ev: DisplayEvent, index: number): string {
    const id = ev.id ?? (ev as EditableEvent)._id;
    if (id != null && String(id).trim() !== "") return String(id);
    return `event-${index}`;
  }

  return (
    <div className="flex min-h-screen bg-[#07713c]/[0.04] [&_button]:cursor-pointer">
      {/* Sidebar — same green as Attendance */}
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713c] text-white flex flex-col [&_p]:text-white">
        <SidebarBrand />
        <AppSidebarNav
          items={navItems}
          activeNavId={activeNav}
          onNavigate={onNavigate}
        />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto w-full max-w-7xl">
            <div>
              <h1 className="font-[Inter,sans-serif] text-[30px] font-extrabold leading-tight text-[#07713c]">Create Event</h1>
              <NavbarAcademicPeriod className="mt-1" />
            </div>
          </div>
        </header>

        <main className={`flex-1 overflow-auto p-6 ${EVENTS_PAGE_TEXT} [&_th]:font-bold [&_th]:!text-white`}>
          <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4">
          {isEventsLoading && (
            <p className="mb-3 rounded-lg border border-[#07713c]/30 bg-[#07713c]/10 px-3 py-2 text-sm font-medium text-black">Loading events…</p>
          )}
          {isEventsError && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-black">Could not load events.</p>
          )}
          {/* Search, Filter, View, Add */}
          <div className="flex flex-wrap gap-4 mb-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
              <input
                type="search"
                placeholder="Search Event"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-10 text-sm text-black placeholder:text-black/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] [&::-webkit-search-cancel-button]:hidden"
              />
              {search.trim() !== "" && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-black/85 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                  aria-label="Clear events search"
                >
                  ×
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[#07713c]/40 bg-white px-4 py-2 text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15"
            >
              <option value="All Status">All Status</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Upcoming">Upcoming</option>
            </select>
            <select
              value={sessionKindFilter}
              onChange={(e) => setSessionKindFilter(e.target.value as SessionKindFilter)}
              className="rounded-lg border border-[#07713c]/40 bg-white px-4 py-2 text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15"
              aria-label="Filter by session"
            >
              <option value="all">All sessions</option>
              <option value="whole">Whole day</option>
              <option value="am">AM session</option>
              <option value="pm">PM session</option>
            </select>
            <div className="hidden flex overflow-hidden rounded-lg border border-[#07713c]/40">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-[#07713c]/10 font-medium text-black" : "bg-white text-black/80 hover:bg-[#07713c]/10"}`}
              >
                ☰
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-2 text-sm ${viewMode === "grid" ? "bg-[#07713c]/10 font-medium text-black" : "bg-white text-black/80 hover:bg-[#07713c]/10"}`}
              >
                ⊞
              </button>
            </div>
            {canManageEvents && (
              <>
                {canImportAttendance && (
                  <button
                    type="button"
                    onClick={() => setShowImportAttendance(true)}
                    className="rounded-lg border border-[#07713c]/40 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#07713c]/10"
                  >
                    Import Attendance
                  </button>
                )}
                {canImportConfig && (
                  <button
                    type="button"
                    onClick={() => setShowImportConfig(true)}
                    className="rounded-lg border border-[#07713c]/40 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#07713c]/10"
                  >
                    Import Event
                  </button>
                )}
                {canCreateEvent && (
                  <button
                    type="button"
                    onClick={() => setShowAddEvent(true)}
                    className="rounded-lg border bg-[#07713C] px-4 py-2 text-sm font-medium text-white transition-colors"
                  >
                    + Add Event
                  </button>
                )}
              </>
            )}
          </div>

          {/* Events Content - List or Grid */}
          <div className="overflow-hidden rounded-xl border border-[#07713c]/30 bg-white shadow-sm">
            {viewMode === "list" ? (
              <div className="min-w-0 overflow-x-auto">
                <table className={`w-full text-sm ${TABLE_CELL_NOWRAP}`}>
                  <thead className={`border-b border-[#07713c]/30 bg-[#07713c] text-center text-xs uppercase tracking-wide ${EVENTS_TH_TEXT}`}>
                    <tr>
                      <th className="px-4 py-2.5 align-middle text-center">Event Name</th>
                      <th className="px-4 py-2.5 align-middle text-center">Date</th>
                      <th className="px-4 py-2.5 align-middle text-center">Session</th>
                      <th className="px-4 py-2.5 align-middle text-center">Venue</th>
                      <th className="px-4 py-2.5 align-middle text-center">Fines</th>
                      <th className="px-4 py-2.5 align-middle text-center">Status</th>
                      <th className="px-4 py-2.5 align-middle text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-black/70">
                          No event records.
                        </td>
                      </tr>
                    ) : (
                      paginatedEvents.map((ev, i) => {
                        const fineVal = getFinesForEvent(ev);
                        return (
                          <tr
                            key={eventRowKey(ev, i)}
                            className="cursor-pointer border-t border-[#07713c]/20 hover:bg-[#07713c]/10"
                            onClick={() => openEventModal(ev, "view")}
                          >
                            <td className="px-4 py-2.5 text-center text-black">
                              <span className="block truncate">{ev.name}</span>
                            </td>
                            <td className="px-4 py-2.5 text-center text-black">
                              {formatEventDateForDisplay(ev.date)}
                            </td>
                            <td className="px-4 py-2.5 text-center text-black">
                              {formatDurationForEventsList(ev)}
                            </td>
                            <td className="px-4 py-2.5 text-center text-black">
                              <span className="line-clamp-2 break-words" title={ev.venue}>
                                {ev.venue}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center tabular-nums text-black">
                              ₱{Number(fineVal).toLocaleString("en-PH")}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getEventStatusClass(ev.status)}`}>
                                {displayEventStatus(ev.status)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <div
                                className="flex flex-wrap items-center justify-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="rounded-md px-2 py-1 text-xs font-medium text-black hover:bg-[#07713c]/10"
                                  onClick={() => openEventModal(ev, "view")}
                                >
                                  View
                                </button>
                                {canShowEventExports(ev.status) && (
                                  <>
                                    {canExportConfig && (
                                      <button
                                        type="button"
                                        title="Export event configuration"
                                        className="rounded-md px-2 py-1 text-xs font-medium text-black hover:bg-[#07713c]/10"
                                        onClick={() => setExportConfigEvent(ev)}
                                      >
                                        Export Event
                                      </button>
                                    )}
                                    {canExportAttendance && (
                                      <button
                                        type="button"
                                        title="Export attendance JSON"
                                        className="rounded-md px-2 py-1 text-xs font-medium text-black hover:bg-[#07713c]/10"
                                        onClick={() => setExportAttendanceEvent(ev)}
                                      >
                                        Export Attendance
                                      </button>
                                    )}
                                  </>
                                )}
                                {canManageEvents && !isEventCompleted(ev.status) && (
                                  <>
                                    {canEditEvent && (
                                      <button
                                        type="button"
                                        title="Edit event"
                                        className="rounded-md px-2 py-1 text-xs font-medium text-black hover:bg-blue-50"
                                        onClick={(e) => handleEditClick(ev, e)}
                                      >
                                        Edit
                                      </button>
                                    )}
                                    {canDeleteEventByStatus(ev.status) && (
                                      <button
                                        type="button"
                                        className="px-2 py-1 rounded-md text-xs font-medium text-black hover:bg-red-50"
                                        onClick={() => openDeleteFromRow(ev)}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </>
                                )}
                                {isEventCompleted(ev.status) && canDeleteEventByStatus(ev.status) && (
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded-md text-xs font-medium text-black hover:bg-red-50"
                                    onClick={() => openDeleteFromRow(ev)}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                {filteredEvents.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-sm text-black/70">No event records.</div>
                ) : (
                  paginatedEvents.map((ev, i) => (
                    <div
                      key={eventRowKey(ev, i)}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer rounded-xl border border-[#07713c]/30 bg-white p-4 transition-all hover:border-[#07713c]/50 hover:bg-[#07713c]/[0.06] hover:shadow-md"
                      onClick={() => openEventModal(ev, "view")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openEventModal(ev, "view");
                        }
                      }}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="min-w-0 flex-1 line-clamp-2 text-base font-semibold leading-snug text-black sm:text-[1.0625rem]">
                          {ev.name}
                        </h3>
                        <span
                          className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${getEventStatusClass(ev.status)}`}
                        >
                          {displayEventStatus(ev.status)}
                        </span>
                      </div>
                      <p className="mb-1 text-sm font-medium text-black">{formatEventDateForDisplay(ev.date)}</p>
                      <p className="mb-1 text-sm font-medium text-black">{ev.venue}</p>
                      <p className="mb-2 text-sm font-medium text-black">{formatDurationForEventsList(ev)}</p>
                      <div className="border-t border-[#07713c]/15 pt-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="shrink-0 text-xs font-medium text-black">Fines</span>
                          <span className="min-w-[4.5rem] text-right text-sm font-semibold tabular-nums text-black">
                            ₱{Number(getFinesForEvent(ev)).toLocaleString("en-PH")}
                          </span>
                        </div>
                      </div>
                      <div
                        className="mt-3 flex flex-wrap justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="rounded-md bg-[#07713c]/10 px-2.5 py-1 text-xs font-medium text-black hover:bg-[#07713c]/20"
                          onClick={() => openEventModal(ev, "view")}
                        >
                          View
                        </button>
                        {canShowEventExports(ev.status) && (
                          <>
                            {canExportConfig && (
                              <button
                                type="button"
                                title="Export event configuration"
                                className="rounded-md bg-[#07713c]/10 px-2.5 py-1 text-xs font-medium text-black hover:bg-[#07713c]/20"
                                onClick={() => setExportConfigEvent(ev)}
                              >
                                Export Event
                              </button>
                            )}
                            {canExportAttendance && (
                              <button
                                type="button"
                                title="Export attendance JSON"
                                className="rounded-md bg-[#07713c]/10 px-2.5 py-1 text-xs font-medium text-black hover:bg-[#07713c]/20"
                                onClick={() => setExportAttendanceEvent(ev)}
                              >
                                Export Attendance
                              </button>
                            )}
                          </>
                        )}
                        {canManageEvents && !isEventCompleted(ev.status) && (
                          <>
                            {canEditEvent && (
                              <button
                                type="button"
                                title="Edit event"
                                className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-black hover:bg-blue-100"
                                onClick={(e) => handleEditClick(ev, e)}
                              >
                                Edit
                              </button>
                            )}
                            {canDeleteEventByStatus(ev.status) && (
                              <button
                                type="button"
                                className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-black hover:bg-red-100"
                                onClick={() => openDeleteFromRow(ev)}
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                        {isEventCompleted(ev.status) && canDeleteEventByStatus(ev.status) && (
                          <button
                            type="button"
                            className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-black hover:bg-red-100"
                            onClick={() => openDeleteFromRow(ev)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            <PaginationBar
              totalCount={eventsTotal}
              page={eventsPage}
              pageSize={eventsPageSize}
              onPageChange={setEventsPage}
              emptyLabel="No records to show."
              itemLabel="events"
              className="!text-black"
            />
          </div>
          </div>
        </main>
      </div>
      {showAddEvent && (
        <AddEvent onBack={() => setShowAddEvent(false)} onNext={() => {}} />
      )}

      {/* Edit blocked: Completed / Ongoing */}
      {showEditNotAllowedModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-not-allowed-title"
          onClick={() => setShowEditNotAllowedModal(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#07713c]/30 bg-[#07713c]/10 px-5 py-3">
              <h3 id="edit-not-allowed-title" className="text-sm font-semibold text-black sm:text-base">
                Editing not permitted
              </h3>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-black/90">
              <p>
                <span className="font-semibold text-black">{editNotAllowedEventLabel}</span>
                <span className="text-black/80"> cannot be fully edited at this time.</span>
              </p>
              <p>
                <strong className="text-black">Completed</strong> events are locked from modification.
                For <strong className="text-black">Ongoing</strong> events, open{" "}
                <strong className="text-black">Event details</strong> to adjust{" "}
                <strong className="text-black">Time out</strong> if the session ended early.
              </p>
            </div>
            <div className="flex justify-end border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#07713c]/15"
                onClick={() => setShowEditNotAllowedModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event details / edit modal */}
      {selectedEvent && editableEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[3px]">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#07713c]/30 bg-[#07713c]/10 px-6 py-3">
              <h2 className="text-sm font-semibold text-black sm:text-base">
                {eventModalMode === "view" ? "Event details" : "Edit event"}
              </h2>
              <button
                type="button"
                onClick={closeEventModal}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffb300] text-black transition-colors hover:bg-[#e6a100]"
                aria-label="Close event modal"
              >
                <span className="text-lg font-bold">×</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm [scrollbar-width:thin] [scrollbar-color:rgba(7,113,60,0.28)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#07713c]/30 [&::-webkit-scrollbar-thumb]:hover:bg-[#07713c]/40 [&::-webkit-scrollbar-track]:bg-transparent sm:p-5">
              {eventModalMode === "edit" && (
                <p className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.06] px-3 py-2 text-xs text-black">
                  Save and delete are connected to the API.
                </p>
              )}
              {editSaveError && (
                <p className="text-xs text-black bg-amber-50 border border-amber-200 p-2 rounded-lg">{editSaveError}</p>
              )}
              {editSaveSuccess && (
                <p className="rounded-lg border border-[#07713c]/30 bg-[#07713c]/10 p-2 text-xs text-black">
                  {editSaveSuccess}
                </p>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-black">Event Name</label>
                <input
                  type="text"
                  readOnly={eventModalMode === "view"}
                  className={`w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15 ${eventModalMode === "view" ? "bg-[#07713c]/5" : "bg-white"}`}
                  value={editableEvent.name || ""}
                  onChange={(e) => setEditableEvent({ ...editableEvent, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-black">Date</label>
                  {eventModalMode === "view" ? (
                    <p className="rounded-lg border border-[#07713c]/30 bg-[#07713c]/5 px-3 py-2 text-sm text-black">
                      {formatEventDateForDisplay(editableEvent.date)}
                    </p>
                  ) : (
                    <input
                      type="date"
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15"
                      value={eventYmdForDateInput(editableEvent.date)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditableEvent((prev) =>
                          prev && v ? { ...prev, date: v } : prev,
                        );
                      }}
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-black">Session</label>
                  {eventModalMode === "view" ? (
                    <p className="rounded-lg border border-[#07713c]/30 bg-[#07713c]/5 px-3 py-2 text-sm text-black">
                      {formatDurationForEventsList(selectedEvent)}
                    </p>
                  ) : (
                    <select
                      className="w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15 bg-white"
                      value={
                        ["Whole Day", "AM Only", "PM Only"].includes(String(editableEvent.duration ?? "").trim())
                          ? String(editableEvent.duration).trim()
                          : "Whole Day"
                      }
                      onChange={(e) =>
                        setEditableEvent((prev) => (prev ? { ...prev, duration: e.target.value } : prev))
                      }
                    >
                      <option value="Whole Day">Whole Day</option>
                      <option value="AM Only">AM Only</option>
                      <option value="PM Only">PM Only</option>
                    </select>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-black">Venue</label>
                <input
                  type="text"
                  readOnly={eventModalMode === "view"}
                  className={`w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15 ${eventModalMode === "view" ? "bg-[#07713c]/5" : "bg-white"}`}
                  value={editableEvent.venue || ""}
                  onChange={(e) => setEditableEvent({ ...editableEvent, venue: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-black">Fines</label>
                {eventModalMode === "view" ? (
                  <p className="rounded-lg border border-[#07713c]/30 bg-[#07713c]/5 px-3 py-2 text-sm font-semibold tabular-nums text-black">
                    ₱{Number(getFinesForEvent(selectedEvent)).toLocaleString("en-PH")}
                  </p>
                ) : (
                  <div className="flex items-center gap-1 rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 focus-within:border-[#07713c]/55 focus-within:ring-1 focus-within:ring-[#07713c]/15">
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-black">₱</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold tabular-nums text-black placeholder:text-black/40 focus:outline-none focus:ring-0"
                      placeholder="0"
                      value={
                        editableEvent.fine == null || editableEvent.fine === ""
                          ? ""
                          : Number(editableEvent.fine)
                      }
                      onChange={(e) => {
                        const raw = e.target.value;
                        setEditableEvent((prev) => {
                          if (!prev) return prev;
                          if (raw === "") return { ...prev, fine: null, fineAmount: null };
                          const n = Number(raw);
                          if (!Number.isFinite(n)) return prev;
                          const v = Math.max(0, n);
                          return { ...prev, fine: v, fineAmount: v };
                        });
                      }}
                    />
                  </div>
                )}
              </div>
              <EventModalSchedule
                ev={editableEvent}
                readOnly={eventModalMode === "view" && !isEventOngoing(editableEvent.status)}
                timeoutOnly={
                  eventModalMode === "view" &&
                  isEventOngoing(editableEvent.status) &&
                  canEditEvent
                }
                onPatch={
                  eventModalMode === "edit" ||
                  (eventModalMode === "view" &&
                    isEventOngoing(editableEvent.status) &&
                    canEditEvent)
                    ? patchEditableEventSchedule
                    : undefined
                }
              />
              <div>
                <label className="mb-1 block text-xs font-semibold text-black">Attendance mode</label>
                {eventModalMode === "view" ? (
                  <p className="rounded-lg border border-[#07713c]/30 bg-[#07713c]/5 px-3 py-2 text-sm text-black">
                    {editableEvent.event_mode === "TIME_IN_ONLY" || editableEvent.time_in_only
                      ? "Time-In Only"
                      : "Time In / Time Out"}
                  </p>
                ) : (
                  <label className="inline-flex items-start gap-2 text-sm text-black">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={
                        editableEvent.event_mode === "TIME_IN_ONLY" ||
                        editableEvent.time_in_only === true
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditableEvent((prev) =>
                          prev
                            ? {
                                ...prev,
                                event_mode: checked ? "TIME_IN_ONLY" : "TIME_IN_OUT",
                                time_in_only: checked,
                              }
                            : prev,
                        );
                      }}
                    />
                    <span>
                      <span className="font-medium">Time-In Only</span>
                      <span className="mt-0.5 block text-xs text-black/70">
                        Participants Time In once and are marked Present. Time Out is disabled.
                      </span>
                    </span>
                  </label>
                )}
              </div>
              {eventModalMode !== "view" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-black">Audience scope</label>
                  <p className="min-h-[2.5rem] rounded-lg border border-[#07713c]/30 bg-[#07713c]/5 px-3 py-2 text-sm text-black">
                    {getAudienceScopeLabel(editableEvent)}
                  </p>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-black">Audience notes</label>
                {eventModalMode === "view" ? (
                  <p className="min-h-[2.5rem] whitespace-pre-wrap rounded-lg border border-[#07713c]/30 bg-[#07713c]/5 px-3 py-2 text-sm text-black">
                    {editableEvent.audience_notes != null && String(editableEvent.audience_notes).trim() !== ""
                      ? editableEvent.audience_notes
                      : "—"}
                  </p>
                ) : (
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15"
                    placeholder="Optional notes for this audience…"
                    value={editableEvent.audience_notes ?? ""}
                    onChange={(e) =>
                      setEditableEvent((prev) => (prev ? { ...prev, audience_notes: e.target.value } : prev))
                    }
                  />
                )}
              </div>
              <div className="space-y-1.5 text-sm text-black">
                {isSuperAdmin && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                      Event password (Super Admin)
                    </p>
                    {eventPasswordReveal?.loading ? (
                      <p className="mt-1 text-sm text-black/70">Loading…</p>
                    ) : !eventPasswordReveal?.hasPassword ? (
                      <p className="mt-1 text-sm text-black/70">No attendance password set.</p>
                    ) : !eventPasswordReveal?.recoverable || !eventPasswordReveal.password ? (
                      <p className="mt-1 text-sm text-black/70">
                        Password exists but is not recoverable (set before recovery was enabled). Reset by recreating the event or updating the password on create/import.
                      </p>
                    ) : (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <code className="rounded bg-white px-2 py-1 text-sm font-semibold text-black">
                          {showRevealedEventPassword ? eventPasswordReveal.password : "••••••••"}
                        </code>
                        <button
                          type="button"
                          className="rounded-md border border-[#07713c]/40 bg-white px-2 py-1 text-xs font-medium text-black hover:bg-[#07713c]/10"
                          onClick={() => setShowRevealedEventPassword((v) => !v)}
                        >
                          {showRevealedEventPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <p>
                  <span className="font-semibold">Created by:</span>{" "}
                  {editableEvent.created_by_username != null && String(editableEvent.created_by_username).trim() !== ""
                    ? editableEvent.created_by_username
                    : "—"}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">Status:</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getEventModalStatusBadgeClass(editableEvent.status)}`}
                  >
                    {displayEventStatus(editableEvent.status).toLowerCase()}
                  </span>
                </p>
                {eventModalMode === "edit" && (
                  <p className="text-xs text-black/70">Status is updated automatically by the system.</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end border-t border-gray-200 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap justify-end gap-2">
                {editableEvent && canShowEventExports(editableEvent.status) && (
                  <>
                    {canExportConfig && (
                      <button
                        type="button"
                        onClick={() => {
                          if (editableEvent) setExportConfigEvent(editableEvent);
                        }}
                        className="rounded-lg border border-[#07713c]/40 px-4 py-2 text-sm text-black hover:bg-[#07713c]/10"
                      >
                        Export Event
                      </button>
                    )}
                    {canExportAttendance && (
                      <button
                        type="button"
                        onClick={() => {
                          if (editableEvent) setExportAttendanceEvent(editableEvent);
                        }}
                        className="rounded-lg border border-[#07713c]/40 px-4 py-2 text-sm text-black hover:bg-[#07713c]/10"
                      >
                        Export Attendance
                      </button>
                    )}
                  </>
                )}
                {editableEvent && canDeleteEventByStatus(editableEvent.status) && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 text-sm rounded-lg border border-red-300 text-black hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
                {canEditEvent &&
                  eventModalMode === "view" &&
                  editableEvent &&
                  isEventOngoing(editableEvent.status) && (
                  <button
                    type="button"
                    onClick={saveEventTimeout}
                    disabled={updateTimeoutMutation.isPending}
                    className="rounded-lg border border-[#07713c] bg-[#07713c] px-4 py-2 text-sm font-medium text-white hover:bg-[#055a2e] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updateTimeoutMutation.isPending ? "Saving…" : "Save time out"}
                  </button>
                )}
                {canEditEvent &&
                  eventModalMode === "edit" &&
                  editableEvent &&
                  !isEventCompleted(editableEvent.status) && (
                  <button
                    type="button"
                    onClick={saveEditableEvent}
                    disabled={editEventMutation.isPending}
                    className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-4 py-2 text-sm font-medium text-black hover:bg-[#07713c]/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {editEventMutation.isPending ? "Saving..." : "Save Changes"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm (admin or governor) */}
      {canDeleteEvent && showDeleteConfirm && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-red-600 px-6 py-3">
              <h3 className="text-sm sm:text-base font-semibold text-white">Delete Event</h3>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <p className="text-black">
                Delete <span className="font-semibold">{selectedEvent.name}</span>?
              </p>
              <p className="text-xs text-black/75">
                This will permanently delete the event and its audience targets.
              </p>
              {deleteError && <p className="text-xs text-black bg-red-50 border border-red-200 p-2 rounded-lg">{deleteError}</p>}
            </div>
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteEventMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-black hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedEvent}
                disabled={deleteEventMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteEventMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <EventConfigImportModal
        open={showImportConfig}
        onClose={() => setShowImportConfig(false)}
      />
      <AttendanceImportModal
        open={showImportAttendance}
        onClose={() => setShowImportAttendance(false)}
      />
      {exportConfigEvent && (
        <EventConfigExportModal
          open={Boolean(exportConfigEvent)}
          event={exportConfigEvent}
          onClose={() => setExportConfigEvent(null)}
        />
      )}
      {exportAttendanceEvent && (
        <AttendanceExportModal
          open={Boolean(exportAttendanceEvent)}
          event={exportAttendanceEvent}
          requireDepartmentSelect={canImportAttendance}
          onClose={() => setExportAttendanceEvent(null)}
        />
      )}
    </div>
  );
}

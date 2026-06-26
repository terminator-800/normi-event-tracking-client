import { formatEventDateForDisplay, formatSqlTimeForDisplay } from "../hooks/useGetEvents";
import { formatAudienceYearLevel, getAudienceScopeLabel } from "../utils/eventAudienceLabel";
import { formatGraceDurationLabel } from "../utils/eventTimeOptions";

const ALL_DEPARTMENT_COURSES = [
  { code: "BEED", name: "Bachelor of Elementary Education", major: "" },
  { code: "BSED", name: "Bachelor of Secondary Education Major in English", major: "English" },
  { code: "BSED", name: "Bachelor of Secondary Education Major in Math", major: "Math" },
  { code: "BSED", name: "Bachelor of Secondary Education Major in Filipino", major: "Filipino" },
  { code: "BSIT", name: "Bachelor of Science in Information Technology", major: "" },
  { code: "BSCRIM", name: "Bachelor of Science in Criminology", major: "" },
  { code: "BSHM", name: "Bachelor of Science in Hospitality Management", major: "" },
  { code: "BSBA", name: "BSBA Marketing Management", major: "Marketing Management" },
  { code: "BSBA", name: "BSBA Human Resource Development Management", major: "Human Resource Development Management" },
  { code: "BSBA", name: "BSBA Financial Management", major: "Financial Management" },
];

/** Home event detail — all-departments audience shown as colleges, not per-program. */
const ALL_DEPARTMENT_COLLEGES = [
  "College of Criminal Justice Education",
  "College of Business Administration",
  "College of Education, Arts and Sciences",
  "College of Information Technology",
  "College of Hospitality Management",
];

function allDepartmentCourseLabel(course) {
  return course.name;
}

function statusPillClass(status) {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "upcoming" || s === "ongoing" || s === "active") {
    return "bg-blue-100 text-blue-700";
  }
  if (s === "completed") {
    return "bg-gray-200 text-gray-700";
  }
  return "bg-[#07713c]/15 text-[#07713c]";
}

function AllDepartmentCourseNamesList({ className = "" }) {
  return (
    <ul className={className}>
      {ALL_DEPARTMENT_COURSES.map((c, idx) => (
        <li
          key={`${c.code}-${idx}`}
          className="rounded-lg border border-gray-100 bg-gray-50/90 px-3 py-2 text-sm text-gray-700"
        >
          {c.name}
        </li>
      ))}
    </ul>
  );
}

function Row({ label, value, small }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 text-xs w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-gray-800 ${small ? "text-xs" : "text-sm"}`}>{value || "—"}</span>
    </div>
  );
}

function graceMins(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? formatGraceDurationLabel(n) : "—";
}

/**
 * Splits `timeSlots` into AM/PM rows: newline, legacy `AM:/PM:` comma, or comma before next clock time.
 */
function parseScheduleSlots(timeSlots) {
  if (!timeSlots || typeof timeSlots !== "string") return [];
  const t = timeSlots.trim();
  if (!t) return [];
  if (/\n/.test(t)) {
    return t.split(/\n/).map((p) => p.trim()).filter(Boolean);
  }
  const legacy = t.split(/\s*,\s*(?=(?:AM|PM):)/i).map((p) => p.trim()).filter(Boolean);
  if (legacy.length > 1 || (legacy.length === 1 && /^(AM|PM):/i.test(legacy[0]))) {
    return legacy;
  }
  return t.split(/\s*,\s*(?=\d{1,2}:\d{2}\s*(?:AM|PM))/i).map((p) => p.trim()).filter(Boolean);
}

function parsePeriodRangeFromTimeSlots(timeSlots, period) {
  const lines = parseScheduleSlots(timeSlots);
  const p = period.toUpperCase();
  let line =
    p === "PM"
      ? lines.find((s) => /\d{1,2}:\d{2}\s*PM/i.test(s))
      : lines.find((s) => /\d{1,2}:\d{2}\s*AM/i.test(s));
  if (!line && lines.length >= 2) {
    line = p === "AM" ? lines[0] : lines[1];
  }
  if (!line) {
    line = lines.find((s) => s.toUpperCase().startsWith(`${p}:`));
  }
  if (!line) return { start: "—", end: "—" };
  const withoutPrefix = line.replace(/^(AM|PM):\s*/i, "").trim();
  const clean = withoutPrefix.split(/\s*\(.*$/)[0].trim();
  const parts = clean.split(/\s*[–−-]\s*/);
  const startRaw = parts[0]?.trim() || "—";
  const endRaw = parts[1]?.trim() || "—";
  return {
    start: startRaw,
    end: endRaw,
  };
}

function resolveTimePair(ev, period) {
  const isAm = period === "AM";
  const inDisplay = isAm ? ev?.amTimeInDisplay : ev?.pmTimeInDisplay;
  const outDisplay = isAm ? ev?.amTimeOutDisplay : ev?.pmTimeOutDisplay;
  const inRaw = isAm ? ev?.am_time_in ?? ev?.amTimeIn : ev?.pm_time_in ?? ev?.pmTimeIn;
  const outRaw = isAm ? ev?.am_time_out ?? ev?.amTimeOut : ev?.pm_time_out ?? ev?.pmTimeOut;

  const start = inDisplay ?? formatSqlTimeForDisplay(inRaw);
  const end = outDisplay ?? formatSqlTimeForDisplay(outRaw);
  if (start !== "—" || end !== "—") return { start, end };

  return parsePeriodRangeFromTimeSlots(ev?.timeSlots, period);
}

function shouldShowPeriodFromDuration(duration, period) {
  const d = String(duration ?? "").trim().toLowerCase();
  if (!d) return true;

  const isAmOnly =
    d === "am" ||
    d.includes("am only") ||
    d.includes("am session") ||
    d === "morning";
  const isPmOnly =
    d === "pm" ||
    d.includes("pm only") ||
    d.includes("pm session") ||
    d === "afternoon";

  if (period === "AM") return !isPmOnly;
  return !isAmOnly;
}

function hasVisibleRange(range) {
  if (!range) return false;
  return range.start !== "—" || range.end !== "—";
}

function ScheduleLine({ line }) {
  const m = /^(AM|PM):\s*(.+)$/i.exec(line.trim());
  if (!m) {
    return <span className="text-xs leading-relaxed text-gray-800">{line}</span>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="inline-flex shrink-0 rounded-md bg-[#008000]/12 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#008000]">
        {m[1]}
      </span>
      <span className="min-w-0 text-xs leading-relaxed text-gray-800">{m[2]}</span>
    </div>
  );
}

/** Readable AM/PM blocks for schedule strings from the API. */
function ScheduleBlocks({ timeSlots, compact }) {
  const slots = parseScheduleSlots(timeSlots);
  if (slots.length === 0) {
    return (
      <span className={compact ? "text-xs text-gray-500" : "text-sm text-gray-500"}>
        {timeSlots && String(timeSlots).trim() ? String(timeSlots).trim() : "—"}
      </span>
    );
  }
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {slots.map((line, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-100 bg-slate-50/95 pl-3 pr-3 py-2.5 shadow-sm"
        >
          <ScheduleLine line={line} />
        </div>
      ))}
    </div>
  );
}

function MiniCell({ label, children, className = "", dense }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <div
        className={
          dense
            ? "mt-0.5 text-xs leading-relaxed text-gray-800 whitespace-pre-wrap break-words"
            : "mt-0.5 text-sm text-gray-900 truncate"
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Label "Mandatory" with Yes / No (replaces single mandatory pill). */
function MandatoryYesNo({ ev, compact }) {
  const labelCls = compact ? "text-[11px]" : "text-xs";
  const pillCls = compact ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      <span className={`${labelCls} font-medium text-gray-500`}>Mandatory</span>
      <span
        className={`${pillCls} rounded-md font-semibold tabular-nums ${
          ev.is_mandatory ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"
        }`}
      >
        {ev.is_mandatory ? "Yes" : "No"}
      </span>
    </div>
  );
}

function EventCardMinimal({ ev }) {
  const audience = ev.is_all_departments ? "All departments" : getAudienceScopeLabel(ev);

  return (
    <div className="rounded-lg bg-white/80 px-4 py-4 sm:px-5 border border-[#36454F]/8 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-2xl leading-none shrink-0">{ev.icon || "📅"}</span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#36454F] tracking-tight truncate">{ev.name}</h2>
            <p className="mt-0.5 text-xs text-[#36454F]/65">
              {formatEventDateForDisplay(ev.date)}
              <span className="mx-1.5 text-[#36454F]/35">·</span>
              {ev.venue || "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#008000]/10 text-[#008000] font-medium">
            {ev.status}
          </span>
          <MandatoryYesNo ev={ev} compact />
          {ev.is_all_departments && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">All departments</span>
          )}
          {ev.fine != null && (
            <span className="text-sm font-medium text-red-600 tabular-nums">
              Fines: ₱{ev.fine}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[#36454F]/10 pt-4">
        <MiniCell label="Duration">{ev.duration || "—"}</MiniCell>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 border-t border-[#36454F]/10 pt-3">
        <div className="md:col-span-2 min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-2">Schedule</p>
          <ScheduleBlocks timeSlots={ev.timeSlots} compact />
        </div>
        <MiniCell label="Late AM (time in)">{graceMins(ev.amGraceInMinutes)}</MiniCell>
        <MiniCell label="Late PM (time in)">{graceMins(ev.pmGraceInMinutes)}</MiniCell>
        <MiniCell label="Audience" className="md:col-span-2" dense>
          {audience}
        </MiniCell>
        <MiniCell label="Notes" className="md:col-span-2" dense>
          {ev.audience_notes || "—"}
        </MiniCell>
      </div>

      {((ev.is_all_departments && ALL_DEPARTMENT_COURSES.length > 0) ||
        (!ev.is_all_departments && Array.isArray(ev.audiences) && ev.audiences.length > 0)) && (
        <div className="mt-3 border-t border-[#36454F]/10 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-2">Target audience</p>
          <div className="flex flex-wrap gap-2">
            {ev.is_all_departments
              ? ALL_DEPARTMENT_COURSES.map((c, idx) => (
                  <div
                    key={`${c.code}-${idx}`}
                    className="flex-1 min-w-[220px] max-w-full rounded-md border border-gray-100 bg-gray-50/90 px-3 py-2 text-[11px] text-gray-700"
                  >
                    {allDepartmentCourseLabel(c)}
                  </div>
                ))
              : ev.audiences.map((a, idx) => (
                  <div
                    key={idx}
                    className="flex-1 min-w-[140px] max-w-full rounded-md border border-gray-100 bg-gray-50/90 px-3 py-2 text-[11px] text-gray-700"
                  >
                    {a?.department_name ?? "—"}
                    {a?.course_code ? ` · ${a.course_code}` : ""}
                    {a?.course_name ? ` · ${a.course_name}` : ""}
                    {a?.year_level != null ? ` · ${formatAudienceYearLevel(a.year_level)}` : ""}
                  </div>
                ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HRow({ label, value, small }) {
  return (
    <div className="flex gap-3 min-w-0">
      <span className="text-gray-400 text-xs w-24 shrink-0 pt-0.5">{label}</span>
      <span className={`text-gray-800 min-w-0 flex-1 ${small ? "text-xs" : "text-sm"} break-words`}>
        {value || "—"}
      </span>
    </div>
  );
}

/** Wide two-column layout for dashboard modal. */
function EventCardModalHorizontal({ ev }) {
  const audience = ev.is_all_departments ? "All departments" : getAudienceScopeLabel(ev);

  const amRange = resolveTimePair(ev, "AM");
  const pmRange = resolveTimePair(ev, "PM");
  const sessionDescriptor = [ev.duration, ev.session, ev.sessionType].filter(Boolean).join(" ");
  const baseShowAmSlot = shouldShowPeriodFromDuration(sessionDescriptor, "AM");
  const baseShowPmSlot = shouldShowPeriodFromDuration(sessionDescriptor, "PM");
  const hasAmData = hasVisibleRange(amRange);
  const hasPmData = hasVisibleRange(pmRange);
  // If session label is ambiguous but only one period has actual data, show only that period.
  const showAmSlot = baseShowAmSlot && (hasAmData || !hasPmData);
  const showPmSlot = baseShowPmSlot && (hasPmData || !hasAmData);

  return (
    <div className="overflow-hidden rounded-xl border border-[#07713c]/30 bg-[#f6fff8] p-2 shadow-sm sm:p-3">
      <div className="border-b border-[#07713c]/20 bg-gradient-to-r from-[#e9f8ee] to-[#f6fff8] px-4 py-3 pb-5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="overflow-hidden text-ellipsis whitespace-nowrap text-lg font-semibold leading-tight text-[#07713c]">
              {ev.name}
            </h2>
            <p className="mt-1 text-sm font-medium text-[#07713c]/85">
              {formatEventDateForDisplay(ev.date)}
              {ev.duration ? ` · ${ev.duration}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusPillClass(ev.status)}`}>
              {ev.status}
            </span>
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                ev.is_mandatory ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-700"
              }`}
            >
              {ev.is_mandatory ? "Mandatory" : "Not mandatory"}
            </span>
            {ev.fine != null && (
              <span className="rounded-full bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700">
                Fines: ₱{ev.fine}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 pt-3 gap-2 sm:grid-cols-2 ${showAmSlot && showPmSlot ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {showAmSlot && (
          <div className="rounded-lg border border-[#07713c]/20 bg-white px-3 pb-3 pt-5">
            <p className="text-[11px] uppercase tracking-wide text-[#07713c]/70">AM slot</p>
            <p className="mt-2 text-sm font-semibold text-[#07713c]">{amRange.start} - {amRange.end}</p>
            <p className="mt-1 text-xs text-[#07713c]/75">Late in {graceMins(ev.amGraceInMinutes)}</p>
          </div>
        )}
        {showPmSlot && (
          <div className="rounded-lg border border-[#07713c]/20 bg-white px-3 pb-3 pt-5">
            <p className="text-[11px] uppercase tracking-wide text-[#07713c]/70">PM slot</p>
            <p className="mt-2 text-sm font-semibold text-[#07713c]">{pmRange.start} - {pmRange.end}</p>
            <p className="mt-1 text-xs text-[#07713c]/75">Late in {graceMins(ev.pmGraceInMinutes)}</p>
          </div>
        )}
        <div className="rounded-lg border border-[#07713c]/20 bg-white px-3 pb-3 pt-5">
          <p className="text-[11px] uppercase tracking-wide text-[#07713c]/70">Venue</p>
          <p className="mt-2 text-sm font-semibold text-[#07713c]">{ev.venue || "—"}</p>
        </div>
        <div className="rounded-lg border border-[#07713c]/20 bg-white px-3 pb-3 pt-5">
          <p className="text-[11px] uppercase tracking-wide text-[#07713c]/70">Audience</p>
          <p className="mt-2 text-sm font-semibold text-[#07713c]">{audience}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[#07713c]/20 bg-white px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#07713c]/70">
          Description & notes
        </p>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#07713c]/85">
          {ev.audience_notes || "—"}
        </p>
      </div>

      {((ev.is_all_departments && ALL_DEPARTMENT_COURSES.length > 0) ||
        (!ev.is_all_departments && Array.isArray(ev.audiences) && ev.audiences.length > 0)) && (
        <div className="mt-3 rounded-lg border border-[#07713c]/20 bg-white px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#07713c]/70">
            Event Audience
          </p>
          {ev.is_all_departments ? (
            <div className="mt-2.5 grid gap-2 grid-cols-1 sm:grid-cols-2">
              {ALL_DEPARTMENT_COLLEGES.map((college) => (
                <div
                  key={college}
                  className="rounded-lg border border-[#07713c]/20 bg-[#f6fff8] px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-[#07713c]">{college}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ev.audiences.map((a, idx) => (
                  <div key={idx} className="rounded-lg border border-[#07713c]/20 bg-[#f6fff8] p-3 text-xs space-y-1.5">
                    <Row label="Department" small value={a?.department_name ?? "—"} />
                    <Row label="Course code" small value={a?.course_code ?? "—"} />
                    <Row label="Course name" small value={a?.course_name ?? "—"} />
                    <Row label="Year level" small value={a?.year_level != null ? formatAudienceYearLevel(a.year_level) : "—"} />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EventCard({ event: ev, variant = "default" }) {
  if (variant === "minimal") {
    return <EventCardMinimal ev={ev} />;
  }
  if (variant === "modalHorizontal") {
    return <EventCardModalHorizontal ev={ev} />;
  }

  const audience = ev.is_all_departments ? "All departments" : getAudienceScopeLabel(ev);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{ev.icon}</span>
          <h2 className="text-base font-medium text-gray-900">{ev.name}</h2>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 shrink-0">
          {ev.status}
        </span>
      </div>

      <hr className="border-gray-100" />

      {/* Core details */}
      <div className="flex flex-col gap-2.5">
        <Row label="Date"      value={formatEventDateForDisplay(ev.date)} />
        <Row label="Duration"  value={ev.duration} />
        <Row label="Venue"     value={ev.venue} />
        <div className="flex gap-2">
          <span className="text-gray-400 text-xs w-28 shrink-0 pt-0.5">Schedule</span>
          <div className="flex-1 min-w-0">
            <ScheduleBlocks timeSlots={ev.timeSlots} />
          </div>
        </div>
        <Row label="Audience"  value={audience} />
        <Row label="Notes"     value={ev.audience_notes} />
      </div>

      <hr className="border-gray-100" />

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-medium text-gray-500">Late (minutes)</p>
        <Row label="AM late in" value={graceMins(ev.amGraceInMinutes)} />
        <Row label="PM late in" value={graceMins(ev.pmGraceInMinutes)} />
      </div>

      {((ev.is_all_departments && ALL_DEPARTMENT_COURSES.length > 0) ||
        (!ev.is_all_departments && Array.isArray(ev.audiences) && ev.audiences.length > 0)) && (
        <>
          <hr className="border-gray-100" />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-500">Target audience</p>
            {ev.is_all_departments
              ? <AllDepartmentCourseNamesList className="grid grid-cols-1 gap-2" />
              : ev.audiences.map((a, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-xs space-y-1.5"
                  >
                    <Row label="Department" small value={a?.department_name ?? "—"} />
                    <Row label="Course code" small value={a?.course_code ?? "—"} />
                    <Row label="Course name" small value={a?.course_name ?? "—"} />
                    <Row label="Year level" small value={a?.year_level != null ? formatAudienceYearLevel(a.year_level) : "—"} />
                  </div>
                ))}
          </div>
        </>
      )}

      <hr className="border-gray-100" />

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap">
        <MandatoryYesNo ev={ev} />
        {ev.is_all_departments && (
          <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-600">
            All departments
          </span>
        )}
        {ev.fine != null && (
          <span className="text-sm font-medium text-red-500 ml-auto">
            Fines: ₱{ev.fine}
          </span>
        )}
      </div>
    </div>
  );
}

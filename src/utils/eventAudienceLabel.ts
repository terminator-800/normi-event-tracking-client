import type { DisplayEvent } from "../types/events";

type AudienceRow = Record<string, unknown>;

/** Course code from one `audiences[]` row (snake_case / camelCase / program_* aliases). */
function audienceRowCourseCode(audience: AudienceRow | null | undefined): string | null {
  if (!audience || typeof audience !== "object") return null;
  const code =
    audience.course_code ??
    audience.courseCode ??
    audience.program_code ??
    audience.programCode;
  if (code == null || String(code).trim() === "") return null;
  return String(code).trim();
}

function audienceRowDepartmentCode(audience: AudienceRow | null | undefined): string | null {
  if (!audience || typeof audience !== "object") return null;
  const c = audience.department_code ?? audience.departmentCode;
  if (c == null || String(c).trim() === "") return null;
  return String(c).trim().toUpperCase();
}

function audienceRowMajor(audience: AudienceRow | null | undefined): string {
  if (!audience || typeof audience !== "object") return "";
  const m = audience.major ?? audience.program_major ?? "";
  const s = String(m).trim();
  if (!s || s.toLowerCase() === "null") return "";
  return s;
}

function audienceRowYearLevelRaw(audience: AudienceRow | null | undefined): unknown {
  if (!audience || typeof audience !== "object") return null;
  const yl = audience.year_level ?? audience.yearLevel;
  if (yl == null || yl === "") return null;
  return yl;
}

/** Audience year level integer/string → compact label (e.g. “1st Year”). */
export function formatAudienceYearLevel(yl: unknown): string {
  if (yl == null || yl === "") return "—";
  const n = Number(yl);
  if (!Number.isFinite(n)) return String(yl).trim();
  const ord = ["", "1st", "2nd", "3rd", "4th"];
  if (n >= 1 && n <= 4) return `${ord[n]} Year`;
  return `${n}th Year`;
}

/** BSED-all (no major) vs Eng / Filipino / Math */
export function abbrevBsedMajorLabel(rawMajor: unknown): string {
  const major = String(rawMajor ?? "").trim().toLowerCase();
  if (!major) return "BSED";
  if (major === "english") return "English";
  if (major === "filipino") return "Filipino";
  if (major === "math" || major === "mathematics") return "Math";
  return String(rawMajor).trim();
}

/** BSBA cohort: MM, FM, HRDM (Manage Event / Attendance audience). */
export function abbrevBsbaMajorLabel(rawMajor: unknown): string {
  const major = String(rawMajor ?? "").trim().toLowerCase();
  if (!major) return "BSBA";
  if (major === "financial management") return "BSBA — FM";
  if (major === "human resource development management" || major === "human resource management")
    return "BSBA — HRDM";
  if (major === "marketing management") return "BSBA — MM";
  if (major === "hrdm") return "BSBA — HRDM";
  if (major === "mm") return "BSBA — MM";
  if (major === "fm") return "BSBA — FM";
  return String(rawMajor).trim();
}

function audienceRowCourseName(a: AudienceRow): string {
  return String(a?.course_name ?? a?.courseName ?? "").trim();
}

/** When DB omits `major` but fills `course_name`, infer canonical major for labeling. */
function inferBsbaMajorFromCourseName(a: AudienceRow): string {
  const raw = audienceRowCourseName(a);
  const cn = raw.toLowerCase();
  if (!cn) return "";
  if (/\bhrdm\b|\bhuman resource\b|\bhuman resource management\b|\bhuman resource development\b/i.test(raw)) {
    return "Human Resource Development Management";
  }
  if (cn.includes("financial management")) return "Financial Management";
  if (cn.includes("marketing management")) return "Marketing Management";
  return "";
}

function bsbaMajorForAudienceLabel(a: AudienceRow): string {
  const explicit = audienceRowMajor(a);
  if (explicit) return explicit;
  return inferBsbaMajorFromCourseName(a);
}

/** Handles JSON string from SQL drivers (Manage Event uses `ev.audiences` verbatim). */
export function normalizeEvAudiences(raw: unknown): AudienceRow[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((x): x is AudienceRow => x != null && typeof x === "object");
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const p = JSON.parse(s);
      return Array.isArray(p) ? p.filter((x): x is AudienceRow => x != null && typeof x === "object") : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Single audience JSON row → display label for Manage Event / Attendance column.
 */
function labelOneAudienceRow(a: AudienceRow): string | null {
  const codeUpper = audienceRowCourseCode(a)?.toUpperCase() ?? "";

  if (!codeUpper) {
    const dc = audienceRowDepartmentCode(a);
    if (dc === "CEAS") return "CEAS";
    if (dc === "CBA") return "CBA";
    if (dc) return `${dc} (all majors)`;
    const name = String(a?.department_name ?? a?.departmentName ?? "").trim();
    if (/education[, ].*arts.*sciences/i.test(name) || /\bceas\b/i.test(name)) {
      return "CEAS";
    }
    if (/\bbusiness\s+administration\b/i.test(name) || /\bcba\b/i.test(name)) {
      return "CBA";
    }
    return null;
  }

  if (codeUpper === "BEED") return "BEED";

  if (codeUpper === "BSED") {
    return abbrevBsedMajorLabel(audienceRowMajor(a));
  }

  if (codeUpper === "BSBA") {
    return abbrevBsbaMajorLabel(bsbaMajorForAudienceLabel(a));
  }

  return codeUpper;
}

function appendYearLevelSuffix(baseLabel: string | null, audience: AudienceRow): string | null {
  if (!baseLabel) return baseLabel;
  const rawYl = audienceRowYearLevelRaw(audience);
  if (rawYl == null) return baseLabel;
  return `${baseLabel} · ${formatAudienceYearLevel(rawYl)}`;
}

/**
 * Manage Event / Attendance audience column.
 * BEED → BEED. BSED majors abbreviated. BSBA majors → BSBA — MM / FM / HRDM. Dept-only CBA → CBA.
 */
export function getAudienceScopeLabel(ev: DisplayEvent | Record<string, unknown> | null | undefined): string {
  if (!ev) return "—";
  const instituteWide =
    (ev as Record<string, unknown>).isAllDepartments === true ||
    ev.is_all_departments === true ||
    Number(ev.is_all_departments) === 1;
  if (instituteWide) return "All departments";

  const rows = normalizeEvAudiences(ev.audiences);

  if (rows.length > 0) {
    const allBsed =
      rows.length > 1 &&
      rows.every((r) => audienceRowCourseCode(r)?.toUpperCase() === "BSED");
    if (allBsed) {
      return appendYearLevelSuffix("BSED", rows[0]) ?? "BSED";
    }

    const parts = [
      ...new Set(
        rows
          .map((row) => appendYearLevelSuffix(labelOneAudienceRow(row), row))
          .filter(Boolean)
      ),
    ];
    if (parts.length > 0) return parts.join(", ");
  }

  if (ev.course_code != null && String(ev.course_code).trim() !== "") {
    return String(ev.course_code).trim().toUpperCase();
  }

  return "—";
}

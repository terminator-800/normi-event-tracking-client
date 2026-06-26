/** Lookup key (lowercase) → department code. Mirrors API `departments.model.ts`. */
export const DEPARTMENT_CODE_BY_LOOKUP_KEY: Record<string, string> = {
  "college of information technology": "CIT",
  "college of business administration": "CBA",
  "college of education, arts and sciences": "CEAS",
  "college of teacher education": "CEAS",
  "college of criminology": "CCJE",
  "college of criminal justice education": "CCJE",
  "college of hospitality management": "CHM",
};

export function normalizeDepartmentLookupKey(departmentName: unknown): string {
  return String(departmentName ?? "")
    .trim()
    .toLowerCase()
    .replace(/,\s+and\b/g, " and")
    .replace(/\s+/g, " ");
}

export function deriveDepartmentCode(departmentName: unknown): string {
  const normalized = normalizeDepartmentLookupKey(departmentName);
  if (DEPARTMENT_CODE_BY_LOOKUP_KEY[normalized]) return DEPARTMENT_CODE_BY_LOOKUP_KEY[normalized];
  const words = String(departmentName ?? "")
    .replace(/[^A-Za-z\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  return words.map((word) => word[0].toUpperCase()).join("").slice(0, 20);
}

/** True when two department labels refer to the same college (exact or alias code). */
export function departmentMatchesFilter(studentDepartment: unknown, filterValue: unknown): boolean {
  if (filterValue === "all") return true;
  const a = String(studentDepartment ?? "").trim();
  const b = String(filterValue ?? "").trim();
  if (!a || !b) return false;
  if (normalizeDepartmentLookupKey(a) === normalizeDepartmentLookupKey(b)) return true;
  const codeA = deriveDepartmentCode(a);
  const codeB = deriveDepartmentCode(b);
  return Boolean(codeA && codeB && codeA === codeB);
}

export function studentMatchesDepartmentCodes(departmentName: unknown, departmentCodes: string[] | null | undefined): boolean {
  if (!departmentCodes?.length) return true;
  const code = deriveDepartmentCode(departmentName);
  return code ? departmentCodes.includes(code) : false;
}

/** Governor role → department codes from the database. */
export const GOVERNOR_ROLE_TO_DEPARTMENT_CODES: Record<string, string[]> = {
  it_governor: ["CIT", "BSIT"],
  cba_governor: ["CBA"],
  ceas_governor: ["CEAS"],
  coc_governor: ["CCJE", "COC"],
  chm_governor: ["CHM"],
};

/** Department code → governor role for create-account. */
export const DEPARTMENT_CODE_TO_GOVERNOR_ROLE: Record<string, string> = {
  CIT: "it_governor",
  BSIT: "it_governor",
  CBA: "cba_governor",
  CEAS: "ceas_governor",
  CCJE: "coc_governor",
  COC: "coc_governor",
  CHM: "chm_governor",
};

export const DEPARTMENTS_EXCLUDED_FROM_SELECT = ["graduate school"];

export function isDepartmentExcludedFromSelect(departmentName: unknown): boolean {
  const normalized = normalizeDepartmentLookupKey(departmentName);
  if (!normalized) return false;
  return DEPARTMENTS_EXCLUDED_FROM_SELECT.includes(normalized);
}

export function departmentCodeMatchesGovernorRole(departmentCode: unknown, roleKey: string): boolean {
  const codes = GOVERNOR_ROLE_TO_DEPARTMENT_CODES[roleKey] ?? [];
  const normalizedCode = String(departmentCode ?? "").trim().toUpperCase();
  return codes.includes(normalizedCode);
}

export function formatDepartmentSelectLabel(name: unknown, code: unknown): string {
  const trimmed = String(name ?? "").trim();
  const trimmedCode = String(code ?? "").trim().toUpperCase();
  if (trimmedCode) return `${trimmedCode} — ${trimmed}`;
  return formatCollegeFilterLabel(trimmed);
}

export function formatCollegeFilterLabel(departmentName: unknown): string {
  const trimmed = String(departmentName ?? "").trim();
  if (!trimmed) return trimmed;
  const code = deriveDepartmentCode(trimmed);
  if (code && code !== "DEPT") return `${code} — ${trimmed}`;
  return trimmed;
}

/** Unique department names from roster rows, sorted for select options. */
export function buildCollegeFilterOptionsFromStudents<T>(
  students: T[],
  getDepartmentName: (student: T) => unknown,
  { allLabel = "All colleges" }: { allLabel?: string } = {},
) {
  const unique = new Set<string>();
  for (const student of students) {
    const name = String(getDepartmentName(student) ?? "").trim();
    if (name) unique.add(name);
  }
  const sorted = Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return [
    { value: "all", label: allLabel },
    ...sorted.map((name) => ({
      value: name,
      label: formatCollegeFilterLabel(name),
    })),
  ];
}

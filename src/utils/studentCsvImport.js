export const STUDENT_CSV_OPTIONAL_LEGACY_HEADERS = [
  "Student Number",
  "RFID",
  "Full Name",
  "Year Level",
  "Department",
  "Semester",
  "School Year",
  "First Name",
  "Middle Name",
  "Last Name",
  "Course",
  "Major",
];

export function normalizeCsvHeader(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

function headerSet(headers) {
  return new Set(headers.map(normalizeCsvHeader));
}

function hasStudentIdColumn(set) {
  return (
    set.has("student number") ||
    set.has("id number") ||
    set.has("student id")
  );
}

export function detectStudentCsvFormat(headers) {
  const set = headerSet(headers);
  if (!headers.length) return "unknown";
  if (hasStudentIdColumn(set)) return "flexible";
  if (set.has("full name") || set.has("first name")) return "flexible";
  if (headers.length <= 4) return "positional";
  return "flexible";
}

/** Always allow import when the file has a header row and at least one data row. */
export function validateStudentCsvHeaders(headers, rowCount = 0) {
  if (!headers.length) {
    return {
      valid: false,
      format: "unknown",
      missingRequired: [],
      message: "CSV has no header row.",
    };
  }
  if (rowCount < 1) {
    return {
      valid: false,
      format: "unknown",
      missingRequired: [],
      message: "CSV has no data rows.",
    };
  }

  return {
    valid: true,
    format: detectStudentCsvFormat(headers),
    missingRequired: [],
    message: null,
  };
}

export function getColumnKind() {
  return "optional";
}

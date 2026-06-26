/**
 * Course label with BSBA/BSED major abbreviations (aligned with Attendance student list).
 */
export function formatCourseWithMajor(
  courseRaw: string | null | undefined,
  majorRaw: string | null | undefined,
): string {
  const course = String(courseRaw ?? "").trim().toUpperCase();
  const major = String(majorRaw ?? "").trim().toLowerCase();
  if (!course || course === "—") return "—";
  if (!major) return course;

  if (course === "BSBA") {
    if (major === "financial management") return "BSBA — FM";
    if (major === "human resource development management") return "BSBA — HRDM";
    if (major === "marketing management") return "BSBA — MM";
  }

  if (course === "BSED") {
    if (major === "filipino") return "BSED — FIL";
    if (major === "math") return "BSED — MATH";
    if (major === "english") return "BSED — ENG";
  }

  return course;
}

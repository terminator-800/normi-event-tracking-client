import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useGetEvents, selectActiveOrUpcomingEvent } from "../hooks/useGetEvents";
import EventSummaryStrip from "./EventSummaryStrip";
import SidebarNavIcon from "./SidebarNavIcon";
import { SHOW_DASHBOARD_IN_NAV } from "../utils/appNav";
import UserCircleIcon from "./UserCircleIcon";
import type { DeskPageProps } from "../types/desk-pages";

type CollegeCourse = { key: string; label: string };

type College = {
  key: string;
  iconText: string;
  title: string;
  footerBadge: string;
  logoSrc: string;
  courses: CollegeCourse[];
};

type StepPillProps = {
  idx: number;
  active: boolean;
  done: boolean;
};

type StudentDetailsForm = {
  fullName: string;
  studentId: string;
  yearLevel: string;
  section: string;
  timeIn: string;
  timeOut: string;
};

type LocationCollegeState = {
  collegeKey?: string;
};

const COLLEGES: College[] = [
  {
    key: "CBA",
    iconText: "CBA",
    title: "College of Business Administration",
    footerBadge: "4 COURSES",
    logoSrc: "/cba%20logo%201.png",
    courses: [
      { key: "BSBA-FM", label: "BSBA - FM" },
      { key: "BSBA-MM", label: "BSBA - MM" },
      { key: "BSBA-HRDM", label: "BSBA - HRDM" },
      { key: "BSBA-OM", label: "BSBA - OM" },
    ],
  },
  {
    key: "COC",
    iconText: "CCJE",
    title: "College of Criminology",
    footerBadge: "1 COURSE",
    logoSrc: "/ccje%20logo%201.png",
    courses: [{ key: "BSCrim", label: "BSCrim" }],
  },
  {
    key: "CHM",
    iconText: "CHM",
    title: "College of Hospitality Management",
    footerBadge: "1 COURSE",
    logoSrc: "/chm%20logo.png",
    courses: [{ key: "BSHM", label: "BSHM" }],
  },
  {
    key: "CIT",
    iconText: "CIT",
    title: "College of Information Technology",
    footerBadge: "1 COURSE",
    logoSrc: "/cit%20logo.png",
    courses: [{ key: "BSIT", label: "BSIT" }],
  },
  {
    key: "CEAS",
    iconText: "CEAS",
    title: "College of Education, Arts and Sciences",
    footerBadge: "4 COURSES",
    logoSrc: "/cte.png",
    courses: [
      { key: "BEED", label: "BEED" },
      { key: "BSED-MATH", label: "BSED - MATH" },
      { key: "BSED-FILIPINO", label: "BSED - FILIPINO" },
      { key: "BSED-ENGLISH", label: "BSED - ENGLISH" },
    ],
  },
];

function StepPill({ idx, active, done }: StepPillProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={[
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold border",
          done
            ? "bg-green-600 text-white border-green-600"
            : active
              ? "bg-[#008000] text-white border-[#008000]"
              : "bg-gray-200 text-gray-500 border-gray-200",
        ].join(" ")}
      >
        {done ? "✓" : idx}
      </div>
      <div
        className={
          done || active
            ? "text-xs font-semibold text-gray-800"
            : "text-xs font-medium text-gray-400"
        }
      >
        {idx === 1
          ? "Select College"
          : idx === 2
            ? "Select Course"
            : idx === 3
              ? "Fill Details"
              : "Confirmation"}
      </div>
    </div>
  );
}

export default function UserDashboard({ onLogout, onNavigate }: DeskPageProps) {
  const location = useLocation() as { state?: LocationCollegeState | null };
  const { data: apiEvents = [] } = useGetEvents();
  const currentEvent = useMemo(() => selectActiveOrUpcomingEvent(apiEvents), [apiEvents]);

  const [showLogout, setShowLogout] = useState(false);
  const role = (localStorage.getItem("csg_role") || "user").toLowerCase();

  const [step, setStep] = useState(1); // 1..4
  const [selectedCollegeKey, setSelectedCollegeKey] = useState<string | null>(null);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string | null>(null);
  const [viewCollegeKey, setViewCollegeKey] = useState<string | null>(null);
  const [modalSelectedCourseKey, setModalSelectedCourseKey] = useState<string | null>(null);
  const [details, setDetails] = useState<StudentDetailsForm>({
    fullName: "",
    studentId: "",
    yearLevel: "",
    section: "",
    timeIn: "",
    timeOut: "",
  });

  useEffect(() => {
    setShowLogout(false);
  }, [role]);

  useEffect(() => {
    const key =
      location.state && typeof location.state === "object" && location.state != null
        ? location.state.collegeKey
        : null;
    if (!key || !COLLEGES.some((c) => c.key === key)) return;
    setSelectedCollegeKey(key);
    setSelectedCourseKey(null);
    setStep(2);
  }, [location.state]);

  const selectedCollege = useMemo(
    () => COLLEGES.find((c) => c.key === selectedCollegeKey) || null,
    [selectedCollegeKey],
  );
  const selectedCourse = useMemo(() => {
    if (!selectedCollege) return null;
    return (
      selectedCollege.courses.find((c) => c.key === selectedCourseKey) || null
    );
  }, [selectedCollege, selectedCourseKey]);

  const viewCollege = useMemo(
    () => COLLEGES.find((c) => c.key === viewCollegeKey) || null,
    [viewCollegeKey],
  );

  const canGoNextFromStep1 = !!selectedCollege;
  const canGoNextFromStep2 = !!selectedCourse;
  const canGoNextFromStep3 =
    details.fullName.trim() && details.studentId.trim();

  const goNext = () => {
    if (step === 1 && !canGoNextFromStep1) return;
    if (step === 2 && !canGoNextFromStep2) return;
    if (step === 3 && !canGoNextFromStep3) return;
    setStep((s) => Math.min(4, s + 1));
  };

  const goBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const resetFlow = () => {
    setStep(1);
    setSelectedCollegeKey(null);
    setSelectedCourseKey(null);
    setDetails({ fullName: "", studentId: "", yearLevel: "", section: "", timeIn: "", timeOut: "" });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col">
        <div className="p-6 space-y-4">
          <img
            src="/logo.png"
            alt="NMCI"
            className="w-16 h-16 rounded-full bg-white/10 object-contain mx-auto"
          />
          <p className="text-xs text-center font-medium uppercase tracking-wider font-[Inter,sans-serif]">
            Northern Mindanao Colleges, Inc.
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {SHOW_DASHBOARD_IN_NAV ? (
            <button
              onClick={() => onNavigate?.("dashboard")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors bg-[#055a2e] text-white"
            >
              <SidebarNavIcon navId="dashboard" />
              Governor Dashboard
            </button>
          ) : null}

          <button
            onClick={() => onNavigate?.("attendance")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
              SHOW_DASHBOARD_IN_NAV ? "text-green-100 hover:bg-white/15" : "bg-[#055a2e] text-white"
            }`}
          >
            <SidebarNavIcon navId="attendance" />
            Attendance
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("attendance_students")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors text-green-100 hover:bg-white/15"
          >
            <SidebarNavIcon navId="attendance_students" />
            Students
          </button>

          <button
            onClick={() => onNavigate?.("events")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors text-green-100 hover:bg-white/15"
          >
            <SidebarNavIcon navId="events" />
            Manage Event
          </button>

          <button
            onClick={() => onNavigate?.("students")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors text-green-100 hover:bg-white/15"
          >
            <SidebarNavIcon navId="students" />
            Department
          </button>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#008000] leading-tight">
              SELECT DEPARTMENT
            </h1>
            <p className="text-xs text-gray-500">
              Choose Your College To Log Your Attendance
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogout((prev) => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center text-[#008000] rounded-lg hover:bg-green-50"
                aria-label="Account menu"
                aria-expanded={showLogout}
                aria-haspopup="true"
              >
                <UserCircleIcon />
              </button>

              {showLogout && (
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[100px]">
                  <button
                    onClick={() => {
                      setShowLogout(false);
                      onLogout?.();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {/* Stepper */}
          <div className="flex flex-col gap-3 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <StepPill idx={1} active={step === 1} done={step > 1} />
              <StepPill idx={2} active={step === 2} done={step > 2} />
              <StepPill idx={3} active={step === 3} done={step > 3} />
              <StepPill idx={4} active={step === 4} done={false} />
            </div>
          </div>

          <div className="mb-6">
            <EventSummaryStrip event={currentEvent} onClick={() => {}} />
          </div>

          {step === 1 && (
            <>
              <h2 className="text-sm font-semibold text-gray-800 mb-3">
                Select College
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {COLLEGES.map((c) => {
                  const selected = c.key === selectedCollegeKey;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setSelectedCollegeKey(c.key);
                        setSelectedCourseKey(null);
                      }}
                      className={[
                        "rounded-lg border bg-white p-4 text-left transition-colors cursor-pointer",
                        selected
                          ? "border-[#008000] ring-2 ring-blue-400/70 shadow-sm"
                          : "border-gray-200 hover:border-[#008000]/60",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                            {c.logoSrc ? (
                              <img
                                src={c.logoSrc}
                                alt={c.key}
                                className="w-full h-full object-contain bg-white"
                              />
                            ) : (
                              <span className="text-xs font-semibold text-gray-800">
                                {c.iconText}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {c.key}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {c.title}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-end justify-between">
                        <span className="text-xs text-gray-600">
                          {c.footerBadge}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`View ${c.key} courses`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewCollegeKey(c.key);
                            setModalSelectedCourseKey(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            e.stopPropagation();
                            setViewCollegeKey(c.key);
                            setModalSelectedCourseKey(null);
                          }}
                          className="inline-flex items-center rounded-full bg-green-50 text-[#008000] border border-green-200 px-2 py-0.5 text-[10px] font-semibold cursor-pointer"
                        >
                          VIEW
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && selectedCollege && (
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  Select Course
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedCollege.courses.map((course) => {
                  const selected = course.key === selectedCourseKey;
                  return (
                    <button
                      key={course.key}
                      type="button"
                      onClick={() => setSelectedCourseKey(course.key)}
                      className={[
                        "rounded-lg border bg-white p-4 text-left transition-colors cursor-pointer",
                        selected
                          ? "border-[#008000] ring-2 ring-blue-400/70 shadow-sm"
                          : "border-gray-200 hover:border-[#008000]/60",
                      ].join(" ")}
                    >
                      <div className="text-sm font-semibold text-gray-900">
                        {course.label}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {selectedCollege.key}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 3 && selectedCollege && selectedCourse && (
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  Fill Details
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-medium text-gray-600">
                  Full Name
                  <input
                    value={details.fullName}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, fullName: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                    placeholder="Enter your full name"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Student ID
                  <input
                    value={details.studentId}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, studentId: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                    placeholder="Enter your student ID"
                  />
                </label>

                <label className="block text-xs font-medium text-gray-600">
                  Year Level
                  <select
                    value={details.yearLevel}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, yearLevel: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000] bg-white"
                  >
                    <option value="">Select year level</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Section
                  <input
                    value={details.section}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, section: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                    placeholder="e.g., A"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Time In
                  <input
                    type="time"
                    value={details.timeIn}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, timeIn: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000] bg-white"
                  />
                </label>

                <label className="block text-xs font-medium text-gray-600">
                  Time Out
                  <input
                    type="time"
                    value={details.timeOut}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, timeOut: e.target.value }))
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000] bg-white"
                  />
                </label>
              </div>
            </>
          )}

          {step === 4 && selectedCollege && selectedCourse && (
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  Confirmation
                </h2>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">Event</span>
                  <span className="font-semibold text-gray-900">{currentEvent?.name ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">College</span>
                  <span className="font-semibold text-gray-900">
                    {selectedCollege.key}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">Course</span>
                  <span className="font-semibold text-gray-900">
                    {selectedCourse.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">Full Name</span>
                  <span className="font-semibold text-gray-900">
                    {details.fullName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">Student ID</span>
                  <span className="font-semibold text-gray-900">
                    {details.studentId}
                  </span>
                </div>
                {details.yearLevel && (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-600">Year Level</span>
                    <span className="font-semibold text-gray-900">
                      {details.yearLevel}
                    </span>
                  </div>
                )}
                {details.section && (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-600">Section</span>
                    <span className="font-semibold text-gray-900">
                      {details.section}
                    </span>
                  </div>
                )}
                {details.timeIn && (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-600">Time In</span>
                    <span className="font-semibold text-gray-900">
                      {details.timeIn}
                    </span>
                  </div>
                )}
                {details.timeOut && (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-600">Time Out</span>
                    <span className="font-semibold text-gray-900">
                      {details.timeOut}
                    </span>
                  </div>
                )}

                <div className="pt-2 flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                  >
                    Start Over
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // TODO: call backend API to submit attendance / enrollment.
                      alert("Submitted (demo). Next: connect to backend API.");
                      resetFlow();
                    }}
                    className="px-4 py-2 rounded-lg bg-[#008000] text-white text-sm hover:bg-green-700 transition-colors"
                  >
                    Confirm & Submit
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Bottom actions */}
          {step < 4 && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                type="button"
                onClick={goNext}
                className="px-5 py-2 rounded-lg bg-[#008000] text-white text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  (step === 1 && !canGoNextFromStep1) ||
                  (step === 2 && !canGoNextFromStep2) ||
                  (step === 3 && !canGoNextFromStep3)
                }
              >
                Next
              </button>
            </div>
          )}
        </main>
      </div>

      {/* View College Modal */}
      {viewCollege && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={viewCollege.logoSrc}
                  alt={viewCollege.key}
                  className="w-10 h-10 rounded-full bg-white/10 object-contain"
                />
                <div className="min-w-0">
                  <h3 className="text-white font-semibold text-sm truncate">
                    {viewCollege.title}
                  </h3>
                  <p className="text-[11px] text-green-100">
                    {viewCollege.key} - {viewCollege.footerBadge}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewCollegeKey(null);
                  setModalSelectedCourseKey(null);
                }}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/15"
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-600">
                  ⌁
                </span>
                Select Your Course Or Major To Proceed
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
                {viewCollege.courses.map((course, i) => {
                  const selected = modalSelectedCourseKey === course.key;
                  return (
                    <button
                      key={course.key}
                      type="button"
                      onClick={() => setModalSelectedCourseKey(course.key)}
                      className={[
                        "w-full text-left border rounded-lg px-3 py-2 flex items-start gap-3 bg-white",
                        selected
                          ? "border-[#008000] ring-2 ring-[#008000]/20"
                          : "border-gray-200 hover:border-[#008000]/50",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "mt-0.5 w-6 h-6 rounded-full flex items-center justify-center border text-xs font-semibold",
                          selected
                            ? "bg-[#008000] text-white border-[#008000]"
                            : "bg-green-50 text-[#008000] border-green-200",
                        ].join(" ")}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-800">
                          {course.label}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {course.key === "BEED"
                            ? "Bachelor of Elementary Education"
                            : course.key.startsWith("BSED")
                              ? "Bachelor of Secondary Education"
                              : `Bachelor of ${viewCollege.title.replace(/^College of\s+/i, "")}`}
                        </div>
                      </div>
                      <div className="ml-auto mt-0.5">
                        <div
                          className={[
                            "w-4 h-4 rounded-full border flex items-center justify-center",
                            selected
                              ? "border-[#008000] bg-[#008000]"
                              : "border-gray-300 bg-white",
                          ].join(" ")}
                        >
                          {selected ? (
                            <span className="text-[10px] text-white">✓</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewCollegeKey(null);
                    setModalSelectedCourseKey(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!modalSelectedCourseKey}
                  onClick={() => {
                    setSelectedCollegeKey(viewCollege.key);
                    setSelectedCourseKey(modalSelectedCourseKey);
                    setViewCollegeKey(null);
                    setModalSelectedCourseKey(null);
                    setStep(3);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#008000] text-white text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

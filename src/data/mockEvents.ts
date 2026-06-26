/**
 * Client-only demo rows for the Events page. Appended after real API events — not a backend substitute.
 */

import type { ServerEventRaw } from "../types/events";

const STATUS_CYCLE = ["upcoming", "active", "completed"] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD */
function addDaysIso(baseYmd: string, dayOffset: number): string {
  const [y, m, d] = baseYmd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dayOffset);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** 50 mock events: Mock Event 1 … Mock Event 50 */
export const MOCK_DEMO_EVENTS: ServerEventRaw[] = Array.from({ length: 50 }, (_, i) => {
  const n = i + 1;
  const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
  const date = addDaysIso("2026-02-01", i * 3);
  const hasFineSample = i % 2 === 0;
  return {
    id: `mock-evt-${n}`,
    name: `Mock Event ${n}`,
    date,
    duration: i % 2 === 0 ? "Whole Day" : "Half Day",
    venue: `Mock Venue ${(i % 6) + 1}`,
    status,
    is_all_departments: true,
    audiences: [],
    audience_notes: "",
    created_by_username: "mock-data",
    ...(hasFineSample
      ? {
          attRate: 70 + (i % 28),
          reg: 80 + (i % 40),
        }
      : {
          fine: i % 5 === 0 ? 150 + i : null,
        }),
  };
});

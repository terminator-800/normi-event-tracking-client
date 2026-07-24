import { useEffect, useState } from "react";
import {
  downloadAttendanceJson,
  fetchEventConfigRoster,
  type EventConfigRosterDepartment,
} from "../hooks/useEventConfigTransfer";
import { getApiErrorMessage } from "../types/api";
import type { DisplayEvent } from "../types/events";

type AttendanceExportModalProps = {
  event: DisplayEvent;
  open: boolean;
  onClose: () => void;
  /** When true (CSG/admin), require department selection. Governors use their own dept. */
  requireDepartmentSelect?: boolean;
};

export default function AttendanceExportModal({
  event,
  open,
  onClose,
  requireDepartmentSelect = false,
}: AttendanceExportModalProps) {
  const [departmentCode, setDepartmentCode] = useState("");
  const [departments, setDepartments] = useState<EventConfigRosterDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const eventId = event.id;
  const needsDept = requireDepartmentSelect;
  const canExport = !needsDept || Boolean(departmentCode.trim());

  useEffect(() => {
    if (!open || eventId == null) return;
    let cancelled = false;

    setDepartmentCode("");
    setDepartments([]);
    setError(null);
    setReady(false);

    if (!needsDept) {
      setReady(true);
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        const data = await fetchEventConfigRoster(eventId, null);
        if (cancelled) return;
        setDepartments(data.departments);
        if (data.departments.length === 1) {
          setDepartmentCode(data.departments[0].code);
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Could not load departments."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, eventId, needsDept]);

  if (!open) return null;

  const handleExport = async () => {
    if (eventId == null) {
      setError("Missing event id.");
      return;
    }
    if (needsDept && !departmentCode.trim()) {
      setError("Select a department to export.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await downloadAttendanceJson(eventId, {
        departmentCode: departmentCode.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to export attendance."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#07713c]/30 bg-white shadow-xl">
        <div className="border-b border-[#07713c]/20 px-5 py-4">
          <h2 className="text-lg font-semibold text-[#07713c]">Export Attendance</h2>
          <p className="mt-1 text-xs text-black/70">
            Exports Event UUID, department, and attendance only (Student ID, Time In/Out, Status,
            Fine). Event configuration is not included.
          </p>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm text-black">
          <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] p-3">
            <p className="font-semibold">{event.name}</p>
            <p className="text-xs text-black/75">
              {event.date} · {event.duration} · {event.venue}
            </p>
          </div>

          {needsDept && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-black">Department *</label>
              <select
                value={departmentCode}
                onChange={(e) => setDepartmentCode(e.target.value)}
                disabled={loading && departments.length === 0}
                className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15 disabled:opacity-60"
              >
                <option value="">Select a department…</option>
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-black hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !canExport || !ready}
            onClick={() => void handleExport()}
            className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-medium text-white hover:bg-[#055a2e] disabled:opacity-50"
          >
            {busy ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}

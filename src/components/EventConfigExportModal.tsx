import { useEffect, useState } from "react";
import {
  downloadEventConfigForDepartments,
  fetchEventConfigRoster,
  type EventConfigRosterDepartment,
} from "../hooks/useEventConfigTransfer";
import { getApiErrorMessage } from "../types/api";
import type { DisplayEvent } from "../types/events";

type EventConfigExportModalProps = {
  event: DisplayEvent;
  open: boolean;
  onClose: () => void;
};

export default function EventConfigExportModal({
  event,
  open,
  onClose,
}: EventConfigExportModalProps) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [departments, setDepartments] = useState<EventConfigRosterDepartment[]>([]);
  const [isAllDept, setIsAllDept] = useState(Boolean(event.is_all_departments));
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const eventId = event.id;
  const multiSelect = isAllDept || departments.length > 1;
  const canExport = multiSelect ? selectedCodes.length > 0 : true;

  useEffect(() => {
    if (!open || eventId == null) return;
    let cancelled = false;

    setSelectedCodes([]);
    setDepartments([]);
    setError(null);
    setReady(false);
    setLoading(true);
    setIsAllDept(Boolean(event.is_all_departments));

    void (async () => {
      try {
        const data = await fetchEventConfigRoster(eventId, null);
        if (cancelled) return;
        setDepartments(data.departments);
        setIsAllDept(Boolean(data.is_all_departments));
        if (data.departments.length === 1) {
          setSelectedCodes([data.departments[0].code]);
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Could not load departments for this event."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, eventId, event.is_all_departments]);

  if (!open) return null;

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const selectAll = () => {
    setSelectedCodes(departments.map((d) => d.code));
  };

  const handleExport = async () => {
    if (eventId == null) {
      setError("Missing event id.");
      return;
    }
    if (multiSelect && selectedCodes.length === 0) {
      setError("Select at least one department to export.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await downloadEventConfigForDepartments(
        eventId,
        multiSelect ? selectedCodes : selectedCodes.length ? selectedCodes : [],
      );
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to export event config."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#07713c]/30 bg-white shadow-xl">
        <div className="border-b border-[#07713c]/20 px-5 py-4">
          <h2 className="text-lg font-semibold text-[#07713c]">Export Event</h2>
          <p className="mt-1 text-xs text-black/70">
            Exports event information, settings, assigned sections, Event UUID, and version.
            Attendance and student records are not included.
          </p>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm text-black">
          <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] p-3">
            <p className="font-semibold">{event.name}</p>
            <p className="text-xs text-black/75">
              {event.date} · {event.duration} · {event.venue}
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-black">
                Department Scope {multiSelect ? "*" : ""}
              </label>
              {multiSelect && departments.length > 1 && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-medium text-[#07713c] hover:underline"
                >
                  Select all
                </button>
              )}
            </div>

            {multiSelect ? (
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-[#07713c]/30 p-2">
                {loading && departments.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-black/60">Loading departments…</p>
                ) : (
                  departments.map((d) => (
                    <label
                      key={d.code}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[#07713c]/5"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCodes.includes(d.code)}
                        onChange={() => toggleCode(d.code)}
                        className="h-4 w-4 accent-[#07713c]"
                      />
                      <span className="text-sm">
                        {d.name} <span className="text-black/55">({d.code})</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-[#07713c]/25 bg-white px-3 py-2 text-sm">
                {departments[0]
                  ? `${departments[0].name} (${departments[0].code})`
                  : "This event’s departments"}
              </p>
            )}

            {isAllDept && (
              <p className="mt-1 text-[11px] text-black/65">
                One JSON file is downloaded per selected department for Department Governors to
                import.
              </p>
            )}
          </div>

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
            disabled={busy || !canExport || loading || !ready}
            onClick={() => void handleExport()}
            className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-medium text-white hover:bg-[#055a2e] disabled:opacity-50"
          >
            {busy
              ? "Exporting…"
              : multiSelect && selectedCodes.length > 1
                ? `Export (${selectedCodes.length})`
                : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}

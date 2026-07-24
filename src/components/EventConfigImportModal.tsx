import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  importEventConfigFile,
  previewEventConfigFile,
  type EventConfigPreview,
} from "../hooks/useEventConfigTransfer";
import { EVENTS_QUERY_KEY } from "../hooks/useGetEvents";
import { CURRENT_EVENT_QUERY_KEY } from "../hooks/useGetCurrentEvent";
import { getApiErrorMessage } from "../types/api";

type EventConfigImportModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function EventConfigImportModal({ open, onClose }: EventConfigImportModalProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<EventConfigPreview | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  const exists = Boolean(preview?.duplicate);
  const pkg = preview?.package;
  const eventUuid = pkg?.event?.event_uuid || pkg?.event?.master_event_uuid || "";

  const reset = () => {
    setFile(null);
    setPreview(null);
    setPassword("");
    setConfirmPassword("");
    setBusy(false);
    setError(null);
    setSuccess(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const runPreview = async (nextFile: File) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    setPreview(null);
    try {
      const result = await previewEventConfigFile(nextFile);
      setPreview(result);
      if (!result.valid && result.errors.length) {
        setError(result.errors[0]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not read config file."));
    } finally {
      setBusy(false);
    }
  };

  const onFileChange = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setError(null);
    setSuccess(null);
    if (f) void runPreview(f);
  };

  const runImport = async (action: "create" | "update" | "cancel") => {
    if (!file) {
      setError("Choose a config JSON file first.");
      return;
    }

    if (action === "cancel") {
      setBusy(true);
      setError(null);
      try {
        await importEventConfigFile({
          file,
          attendancePassword: "",
          action: "cancel",
        });
        handleClose();
      } catch (err) {
        setError(getApiErrorMessage(err, "Cancel failed."));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action === "create") {
      const pwd = password.trim();
      if (pwd.length < 6) {
        setError("Event password must be at least 6 characters.");
        return;
      }
      if (pwd !== confirmPassword.trim()) {
        setError("Passwords do not match.");
        return;
      }
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await importEventConfigFile({
        file,
        attendancePassword: action === "create" ? password.trim() : "",
        action,
      });
      if (!result.success) {
        if (result.preview) setPreview(result.preview);
        setError(result.message || "Import failed.");
        return;
      }
      setSuccess(result.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CURRENT_EVENT_QUERY_KEY }),
      ]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Import failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#07713c]/30 bg-white shadow-xl">
        <div className="border-b border-[#07713c]/20 px-5 py-4">
          <h2 className="text-lg font-semibold text-[#07713c]">Import Event</h2>
          <p className="mt-1 text-xs text-black/70">
            Imports event setup linked by Event UUID. If the UUID already exists, choose Update
            Existing Event or Cancel. Students come from this system&apos;s database for the
            assigned departments.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-black">Config file (.json)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-black file:mr-3 file:rounded-lg file:border-0 file:bg-[#07713c] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
            />
          </div>

          {pkg && (
            <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] p-3 text-sm text-black">
              <p className="font-semibold">{pkg.event.name}</p>
              <p className="text-xs text-black/80">
                {pkg.event.date} · {pkg.event.duration} · {pkg.event.venue}
              </p>
              {eventUuid && (
                <p className="mt-1 break-all text-[11px] text-black/65">
                  Event UUID: {eventUuid}
                  {pkg.event.event_version != null ? ` · v${pkg.event.event_version}` : ""}
                </p>
              )}
              <p className="mt-1 text-xs text-black/80">
                Mode: {pkg.event.event_mode === "TIME_IN_ONLY" ? "Time-In Only" : "Time In / Out"}
                {" · "}
                Audience:{" "}
                {pkg.event.is_all_departments
                  ? "All departments"
                  : `${pkg.audiences.length} audience row(s)`}
              </p>
              {!pkg.event.is_all_departments && pkg.audiences.length > 0 && (
                <p className="mt-1 text-xs text-black/80">
                  Departments:{" "}
                  {[
                    ...new Set(
                      pkg.audiences
                        .map((a) => a.department_code || a.department_name)
                        .filter(Boolean),
                    ),
                  ].join(", ") || "—"}
                </p>
              )}
            </div>
          )}

          {exists && preview?.duplicate && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-black">
              <p className="font-semibold text-amber-900">Event already exists</p>
              <p className="mt-1">
                &ldquo;{preview.duplicate.name}&rdquo; on {preview.duplicate.date} (
                {preview.duplicate.status}) matches this Event UUID (or name/date/session). Choose
                Update Existing Event or Cancel.
              </p>
            </div>
          )}

          {preview?.warnings?.length ? (
            <ul className="list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-black">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          {preview?.errors?.length ? (
            <ul className="list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-black">
              {preview.errors.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          {!exists && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-black">
                    New event password
                  </label>
                  <input
                    type="password"
                    value={password}
                    disabled={busy || !!success}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15"
                    placeholder="Min. 6 characters"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-black">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    disabled={busy || !!success}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-black focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15"
                  />
                </div>
              </div>
              <p className="text-[11px] text-black/65">
                Creates a department event linked to the master Event UUID.
              </p>
            </>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-black">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-black">
              {success}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
          {success ? (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-black hover:bg-gray-50"
            >
              Close
            </button>
          ) : exists ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runImport("cancel")}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-black hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !file || !preview?.valid}
                onClick={() => void runImport("update")}
                className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-medium text-white hover:bg-[#055a2e] disabled:opacity-50"
              >
                {busy ? "Working…" : "Update Existing Event"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-black hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !file || !preview?.valid}
                onClick={() => void runImport("create")}
                className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-medium text-white hover:bg-[#055a2e] disabled:opacity-50"
              >
                {busy ? "Working…" : "Import"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

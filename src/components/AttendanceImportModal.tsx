import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  importAttendanceJsonFile,
  previewAttendanceJsonFile,
  type AttendanceJsonPreview,
} from "../hooks/useEventConfigTransfer";
import { EVENTS_QUERY_KEY } from "../hooks/useGetEvents";
import { getApiErrorMessage } from "../types/api";

type AttendanceImportModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function AttendanceImportModal({ open, onClose }: AttendanceImportModalProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AttendanceJsonPreview | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update">("skip");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  const pkg = preview?.package;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setDuplicateAction("skip");
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
      const result = await previewAttendanceJsonFile(nextFile);
      setPreview(result);
      if (!result.valid && result.errors.length) {
        setError(result.errors[0]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not read attendance file."));
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

  const runImport = async () => {
    if (!file) {
      setError("Choose an attendance JSON file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await importAttendanceJsonFile({
        file,
        action: duplicateAction,
      });
      if (!result.success) {
        if (result.preview) setPreview(result.preview);
        setError(result.message || "Import failed.");
        return;
      }
      setSuccess(result.message);
      await queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
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
          <h2 className="text-lg font-semibold text-[#07713c]">Import Attendance</h2>
          <p className="mt-1 text-xs text-black/70">
            Locates the master event by Event UUID and merges department attendance. Matches by
            Student ID (RFID fallback).
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-black">
              Attendance file (.json)
            </label>
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
              <p className="font-semibold">
                {pkg.department.name || pkg.department.code} attendance
              </p>
              <p className="mt-1 break-all text-[11px] text-black/65">
                Event UUID: {pkg.event_uuid}
              </p>
              <p className="mt-1 text-xs text-black/80">
                {pkg.summary.present} Present · {pkg.summary.absent} Absent · {pkg.summary.total}{" "}
                total
              </p>
            </div>
          )}

          {preview?.master_event && (
            <div className="rounded-lg border border-[#07713c]/35 bg-[#07713c]/10 px-3 py-2 text-xs text-black">
              <p className="font-semibold text-[#07713c]">Master event found</p>
              <p className="mt-1">
                &ldquo;{preview.master_event.name}&rdquo; on {preview.master_event.date} (
                {preview.master_event.status})
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

          {preview?.valid && (
            <div>
              <p className="mb-1 text-xs font-semibold text-black">
                If student already has attendance
              </p>
              <div className="space-y-1.5 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="dup"
                    checked={duplicateAction === "skip"}
                    onChange={() => setDuplicateAction("skip")}
                    className="accent-[#07713c]"
                  />
                  Skip duplicate
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="dup"
                    checked={duplicateAction === "update"}
                    onChange={() => setDuplicateAction("update")}
                    className="accent-[#07713c]"
                  />
                  Update existing attendance
                </label>
              </div>
            </div>
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
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-black hover:bg-gray-50"
          >
            {success ? "Close" : "Cancel"}
          </button>
          {!success && (
            <button
              type="button"
              disabled={busy || !file || !preview?.valid}
              onClick={() => void runImport()}
              className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-medium text-white hover:bg-[#055a2e] disabled:opacity-50"
            >
              {busy ? "Importing…" : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

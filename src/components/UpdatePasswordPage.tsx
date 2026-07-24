import { useState } from "react";
import AppSidebarNav from "./AppSidebarNav";
import SidebarBrand from "./SidebarBrand";
import SidebarUserFullName from "./SidebarUserFullName";
import NavbarAcademicPeriod from "./NavbarAcademicPeriod";
import { useAppNavItems, useMyPermissions } from "../hooks/useMyPermissions";
import { useChangePassword } from "../hooks/useChangePassword";
import { getApiErrorMessage } from "../types/api";
import type { DeskPageProps } from "../types/desk-pages";

const MIN_PASSWORD_LENGTH = 6;

export default function UpdatePasswordPage({ onNavigate, onLogout }: DeskPageProps) {
  const navItems = useAppNavItems();
  const { has: hasPermission, isSuperAdmin } = useMyPermissions();
  const canUpdate = isSuperAdmin || hasPermission("nav.settings.update_password");
  const changePassword = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword) {
      setError("Current password is required.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from the current password.");
      return;
    }

    changePassword.mutate(
      { currentPassword, newPassword, confirmPassword },
      {
        onSuccess: (data) => {
          setSuccess(data.message || "Password updated successfully.");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (err) => setError(getApiErrorMessage(err, "Failed to update password.")),
      },
    );
  };

  if (!canUpdate) {
    return (
      <div className="flex min-h-screen bg-[#07713c]/[0.04] [&_button]:cursor-pointer">
        <aside className="sticky top-0 flex h-screen max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto bg-[#07713c] text-white">
          <SidebarBrand />
          <AppSidebarNav items={navItems} activeNavId="update_password" onNavigate={onNavigate} />
          <SidebarUserFullName onLogout={onLogout} />
        </aside>
        <main className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-red-700">You do not have permission to update password.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#07713c]/[0.04] [&_button]:cursor-pointer">
      <aside className="sticky top-0 flex h-screen max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto bg-[#07713c] text-white [&_p]:text-white">
        <SidebarBrand />
        <AppSidebarNav items={navItems} activeNavId="update_password" onNavigate={onNavigate} />
        <SidebarUserFullName onLogout={onLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div className="mx-auto w-full max-w-4xl">
            <h1 className="font-[Inter,sans-serif] text-[30px] font-extrabold leading-tight text-[#07713c]">
              Update Password
            </h1>
            <p className="mt-0.5 text-sm text-[#36454F]/60">
              Change the password for your signed-in account
            </p>
            <NavbarAcademicPeriod className="mt-1" />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 text-black">
          <div className="mx-auto w-full max-w-4xl">
            <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-black">Account password</h2>
              <p className="mt-1 text-sm text-black/75">
                Enter your current password, then choose a new one (at least {MIN_PASSWORD_LENGTH}{" "}
                characters).
              </p>

              <form onSubmit={handleSubmit} className="mt-5 max-w-md space-y-4">
                <label className="block text-sm font-semibold text-black">
                  Current password
                  <div className="relative mt-1.5">
                    <input
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setError("");
                        setSuccess("");
                      }}
                      autoComplete="current-password"
                      disabled={changePassword.isPending}
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2.5 pr-16 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((v) => !v)}
                      className="absolute inset-y-0 right-2 my-auto text-xs font-semibold text-[#07713c]"
                    >
                      {showCurrent ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <label className="block text-sm font-semibold text-black">
                  New password
                  <div className="relative mt-1.5">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setError("");
                        setSuccess("");
                      }}
                      autoComplete="new-password"
                      disabled={changePassword.isPending}
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2.5 pr-16 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute inset-y-0 right-2 my-auto text-xs font-semibold text-[#07713c]"
                    >
                      {showNew ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <label className="block text-sm font-semibold text-black">
                  Confirm new password
                  <input
                    type={showNew ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                      setSuccess("");
                    }}
                    autoComplete="new-password"
                    disabled={changePassword.isPending}
                    className="mt-1.5 w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2.5 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  />
                </label>

                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                {success ? <p className="text-sm text-[#07713c]">{success}</p> : null}

                <button
                  type="submit"
                  disabled={changePassword.isPending}
                  className="rounded-lg bg-[#07713c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#055c30] disabled:opacity-60"
                >
                  {changePassword.isPending ? "Saving…" : "Update Password"}
                </button>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

import { useState } from "react";
import Navbar from "./Navbar";
import { useSignIn } from "../hooks/auth";

export default function LoginDashboard({ onLoginSuccess }) {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { mutate: signIn, isPending: signInLoading } = useSignIn({
    onSuccess: (data) => {
      onLoginSuccess(data);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    signIn(
      { username, password },
      {
        onError: (err) => {
          // This is the key part for 429
          const message =
            err.response?.data?.message || // Backend JSON message
            err.response?.status === 429
              ? "Too many login attempts, please try again later."
              : "Login failed"; // fallback
          setError(message);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col [&_button]:cursor-pointer">
      <Navbar />

      <main className="relative flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Background image with low opacity (served from public/csg.jpg) */}
        <div className="pointer-events-none select-none absolute inset-y-6 right-4 sm:right-10 flex items-center justify-end"></div>

        <div className="relative z-10 w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
          {/* Left side - marketing / features */}
          <section className="md:w-1/2 bg-[#07713c] text-white relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -left-10 -top-10 w-40 h-40 border border-[#055a2e] rounded-full opacity-40" />
            <div className="absolute -right-20 bottom-0 w-56 h-56 border border-[#055a2e] rounded-full opacity-40" />

            <div className="relative z-10 h-full flex flex-col justify-center items-center px-8 sm:px-10 py-8 sm:py-10 space-y-8 sm:space-y-10 text-center">
              <div className="space-y-6 w-full max-w-md">
                <div className="flex items-center gap-3"></div>

                <div className="mt-6 space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-semibold">
                    Real-Time Attendance
                  </h1>
                  <p className="text-sm text-white/85">
                    Track time in &amp; time out live for every student and
                    staff member.
                  </p>
                </div>
              </div>
              <div className="space-y-6 w-full max-w-md text-left">
                <FeatureItem
                  icon="🕒"
                  title="Time In / Time Out Tracking"
                  description="Record attendance in real time for every session."
                />
                <FeatureItem
                  icon="🎫"
                  title="Event Management"
                  description="Create and monitor events with attendance overview."
                />
                <FeatureItem
                  icon="🏫"
                  title="Department & Student Records"
                  description="Browse departments and quickly find student details."
                />
                <FeatureItem
                  icon="🔐"
                  title="Role-Based Access"
                  description="Admin and User roles to keep actions controlled."
                />
                <FeatureItem
                  icon="📤"
                  title="Import & Export"
                  description="Move data in and out for reporting and backup."
                />
              </div>
            </div>
          </section>

          {/* Right side - login form */}
          <section className="md:w-1/2 bg-gray-50">
            <div className="h-full px-8 sm:px-12 py-8 sm:py-10 flex flex-col justify-center">
              <div className="space-y-2 mb-8">
                <p className="text-xs uppercase tracking-[0.2em] text-[#07713c]">
                  Welcome Back
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                  Sign in to Dashboard
                </h2>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-full border border-[#07713c]/40 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-[#07713c]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-full border border-[#07713c]/40 bg-white px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-[#07713c]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-[#07713c] hover:text-[#055a2e] text-xs"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={signInLoading}
                  className="w-full rounded-full bg-[#07713c] hover:bg-[#055a2e] disabled:opacity-70 text-white text-sm font-medium py-2.5 mt-2 transition-colors duration-150"
                >
                  {signInLoading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <div className="mt-4 flex justify-between items-center text-xs">
                <button
                  type="button"
                  className="text-[#07713c] hover:text-[#055a2e] font-medium"
                >
                  Forgot password?
                </button>
                <p className="text-gray-400">
                  © {new Date().getFullYear()} NORMI
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#055a2e]/80 text-lg">
        <span>{icon}</span>
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-white/85">{description}</p>
      </div>
    </div>
  );
}

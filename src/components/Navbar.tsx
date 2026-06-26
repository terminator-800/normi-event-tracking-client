import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import settingsIcon from "../assets/material-symbols_settings.svg";

type NavbarProps = {
  showSettings?: boolean;
};

export default function Navbar({ showSettings = false }: NavbarProps) {
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isSettingsOpen]);

  return (
    <nav className="fixed inset-x-0 top-0 w-screen z-50 transition-all duration-300 bg-white/90 backdrop-blur-sm border-b border-gray-200">
      <div className="relative w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 sm:h-18 md:h-20">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07713c]/40"
            aria-label="Go to home page"
          >
            <img
              src="/logo.png"
              alt="Northern Mindanao Colleges, Inc."
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-contain object-center"
            />
            <span className="text-base sm:text-lg md:text-xl font-semibold text-green-800 whitespace-nowrap font-[Inter,sans-serif]">
              Northern Mindanao Colleges, Inc.
            </span>
          </Link>
          {showSettings && (
            <div className="absolute right-4 sm:right-6 lg:right-8 top-1/2 -translate-y-1/2" ref={settingsMenuRef}>
              <button
                type="button"
                onClick={() => setIsSettingsOpen((v) => !v)}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center text-[#07713c]"
                aria-label="Settings"
                aria-expanded={isSettingsOpen}
                aria-haspopup="true"
                title="Settings"
              >
                <img src={settingsIcon} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
              </button>
              {isSettingsOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[150px] rounded-lg border border-[#07713c]/25 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full px-4 py-2.5 text-left text-sm text-[#07713c] hover:bg-[#07713c]/8"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      navigate("/login");
                    }}
                  >
                    Login
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronRight, Home, LogOut, Menu, Moon, ShieldCheck, Sun, User } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { fetchHealth } from "../utils/api";
import { pageTitle } from "./navigation";

type ApiStatus = "checking" | "up" | "down";

/** Pings /health every 30s so the indicator reflects the real API state. */
function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>("checking");
  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetchHealth()
        .then(() => !cancelled && setStatus("up"))
        .catch(() => !cancelled && setStatus("down"));
    check();
    const id = window.setInterval(check, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
  return status;
}

export default function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const status = useApiStatus();

  const dot = { checking: "bg-gray-400", up: "bg-emerald-400", down: "bg-red-500" }[status];
  const label = { checking: "Connecting", up: "API online", down: "API offline" }[status];

  return (
    <header className="h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center px-4 sm:px-6 gap-2 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors mr-1"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 min-w-0">
        <Home className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="hidden sm:inline">BAD</span>
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 hidden sm:inline" />
        <span className="text-gray-900 dark:text-slate-100 font-semibold truncate">{pageTitle(router.pathname)}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2" role="status" aria-live="polite">
          <div className={`w-2 h-2 rounded-full ${dot} ${status === "up" ? "animate-pulse" : ""}`} />
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">{label}</span>
        </div>

        <button
          onClick={toggleTheme}
          className="btn-ghost"
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {user ? (
          <div className="flex items-center gap-1.5">
            <Link
              href="/account"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300 font-medium rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700"
              title="Account settings"
            >
              {user.is_admin ? <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> : <User className="w-3.5 h-3.5" />}
              {user.username}
            </Link>
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="btn-ghost"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

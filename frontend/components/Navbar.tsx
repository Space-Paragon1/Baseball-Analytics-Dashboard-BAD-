import { useRouter } from "next/router";
import Link from "next/link";
import { ChevronRight, Home, Sun, Moon, LogOut, User, Menu } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

interface NavbarProps {
  onMenuClick?: () => void;
}

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/players": "Player Analytics",
  "/pitching": "Pitching Analytics",
  "/teams": "Team Analytics",
  "/upload": "Upload Data",
  "/compare": "Compare Players",
  "/add-game": "Add Game",
  "/game-mode": "Game Mode",
  "/login": "Login",
  "/register": "Register",
};

export default function Navbar({ onMenuClick }: NavbarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const currentLabel = routeLabels[router.pathname] || "Page";
  const isHome = router.pathname === "/";

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center px-6 gap-2 flex-shrink-0">
      {/* Hamburger menu - mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors mr-1"
        aria-label="Open sidebar menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400">
        <Home className="w-3.5 h-3.5" />
        <span>BAD</span>
        {!isHome && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-900 dark:text-slate-100 font-semibold">{currentLabel}</span>
          </>
        )}
        {isHome && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-900 dark:text-slate-100 font-semibold">Dashboard</span>
          </>
        )}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">API Live</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light" ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </button>

        {/* Auth */}
        {user ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300">
              <User className="w-3.5 h-3.5" />
              <span className="font-medium">{user.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}

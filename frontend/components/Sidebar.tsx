import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Users,
  Circle,
  UsersRound,
  Upload,
  GitCompareArrows,
  PlusSquare,
  Swords,
  LogIn,
  UserPlus,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const mainNavItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Players", href: "/players", icon: Users },
  { label: "Compare Players", href: "/compare", icon: GitCompareArrows },
  { label: "Pitching", href: "/pitching", icon: Circle },
  { label: "Teams", href: "/teams", icon: UsersRound },
  { label: "Add Game", href: "/add-game", icon: PlusSquare },
  { label: "Game Mode", href: "/game-mode", icon: Swords },
  { label: "Upload Data", href: "/upload", icon: Upload },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/");
    onClose();
  };

  const handleNavClick = () => {
    onClose();
  };

  return (
    <aside
      className={`
        w-60 min-h-screen bg-slate-900 flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300
        lg:relative lg:translate-x-0 lg:z-auto
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      {/* Logo / Branding */}
      <div className="px-5 py-6 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">BAD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">
              Baseball Analytics
            </p>
            <p className="text-slate-400 text-xs">Dashboard</p>
          </div>
          {/* Close button - mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white transition-colors p-1 rounded"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
          Navigation
        </p>
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? router.pathname === "/"
              : router.pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`sidebar-link ${isActive ? "active" : ""}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Divider */}
        <div className="border-t border-slate-700 my-3" />

        {/* Auth section */}
        {user ? (
          <>
            <div className="px-4 py-2">
              <p className="text-slate-400 text-xs truncate">{user.username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="sidebar-link w-full text-left"
            >
              <LogIn className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              onClick={handleNavClick}
              className={`sidebar-link ${router.pathname === "/login" ? "active" : ""}`}
            >
              <LogIn className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Login</span>
            </Link>
            <Link
              href="/register"
              onClick={handleNavClick}
              className={`sidebar-link ${router.pathname === "/register" ? "active" : ""}`}
            >
              <UserPlus className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Register</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs">
          &copy; 2025 BAD v2.0
        </p>
      </div>
    </aside>
  );
}

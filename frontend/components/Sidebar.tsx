import Link from "next/link";
import { useRouter } from "next/router";
import { LogIn, LogOut, ShieldCheck, UserCircle, UserPlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { NAV_SECTIONS } from "./navigation";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    onClose();
    router.push("/");
  };

  const isActive = (href: string) => (href === "/" ? router.pathname === "/" : router.pathname.startsWith(href));

  return (
    <aside
      className={`
        w-60 h-screen bg-slate-900 flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300
        lg:relative lg:translate-x-0 lg:z-auto
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      aria-label="Main navigation"
    >
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">BAD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">Baseball Analytics</p>
            <p className="text-slate-400 text-xs">Dashboard</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white transition-colors p-1 rounded"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.filter((s) => !s.adminOnly || user?.is_admin).map((section) => (
          <div key={section.heading} className="space-y-1">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-2">{section.heading}</p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`sidebar-link ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        <div className="space-y-1 border-t border-slate-700 pt-4">
          {user ? (
            <>
              <Link
                href="/account"
                onClick={onClose}
                className={`sidebar-link ${isActive("/account") ? "active" : ""}`}
                aria-current={isActive("/account") ? "page" : undefined}
              >
                <UserCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{user.username}</span>
                {user.is_admin && (
                  <span className="ml-auto inline-flex items-center gap-1 text-amber-400 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5" /> admin
                  </span>
                )}
              </Link>
              <button onClick={handleLogout} className="sidebar-link w-full text-left">
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">Sign out</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={onClose} className={`sidebar-link ${isActive("/login") ? "active" : ""}`}>
                <LogIn className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">Sign in</span>
              </Link>
              <Link href="/register" onClick={onClose} className={`sidebar-link ${isActive("/register") ? "active" : ""}`}>
                <UserPlus className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">Create account</span>
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="px-5 py-3 border-t border-slate-700">
        <p className="text-slate-500 text-xs">BAD v3.1</p>
      </div>
    </aside>
  );
}

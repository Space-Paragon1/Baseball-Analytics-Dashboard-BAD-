/** Small shared building blocks used across pages. */
import { ReactNode, useEffect, useRef } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle, Database, Lock, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-sm muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle;
  return (
    <div className={kind === "error" ? "alert-error" : "alert-success"} role={kind === "error" ? "alert" : "status"}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({ title = "No data yet", children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <Database className="w-10 h-10 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
      <p className="font-semibold text-gray-800 dark:text-slate-200">{title}</p>
      <div className="text-sm muted mt-1">
        {children ?? (
          <>
            <Link className="text-blue-600 dark:text-blue-400 hover:underline" href="/upload">
              Upload a CSV
            </Link>{" "}
            or{" "}
            <Link className="text-blue-600 dark:text-blue-400 hover:underline" href="/import">
              import real MLB games
            </Link>{" "}
            to get started.
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Shows children only to signed-in users (or admins); everyone else sees a
 * prompt to sign in. The API enforces the same rules.
 */
export function AuthGate({ admin = false, action, children }: { admin?: boolean; action: string; children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (user && (!admin || user.is_admin)) return <>{children}</>;
  return (
    <div className="card p-8 max-w-lg">
      <Lock className="w-8 h-8 text-gray-400 mb-3" />
      <p className="font-semibold text-gray-800 dark:text-slate-200">
        {user ? `Only an admin can ${action}.` : `Sign in to ${action}.`}
      </p>
      <p className="text-sm muted mt-1">
        {user
          ? "The first account created on this dashboard is the admin."
          : "Viewing stats is open to everyone; changing data needs an account."}
      </p>
      {!user && (
        <div className="flex gap-2 mt-4">
          <Link href="/login" className="btn-primary">
            Sign in
          </Link>
          <Link href="/register" className="btn-secondary">
            Create account
          </Link>
        </div>
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/50" onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card w-full ${wide ? "max-w-4xl" : "max-w-md"} my-8 p-6 outline-none`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="text-sm text-gray-600 dark:text-slate-300 mb-6">{message}</div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={danger ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={busy}>
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <span
      className={`${className} inline-block border-2 border-current border-t-transparent rounded-full animate-spin`}
      aria-hidden="true"
    />
  );
}

export function AuthCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex justify-center items-start pt-8 sm:pt-12">
      <div className="w-full max-w-md card p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white">{icon}</div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">{title}</h1>
            <p className="text-xs muted">Baseball Analytics Dashboard</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

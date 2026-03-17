import { useEffect, useState } from "react";
import { X, CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";
import { useToast, Toast, ToastType } from "../context/ToastContext";

const borderColor: Record<ToastType, string> = {
  success: "border-l-green-500",
  error: "border-l-red-500",
  info: "border-l-blue-500",
  warning: "border-l-amber-500",
};

const bgColor: Record<ToastType, string> = {
  success: "bg-white dark:bg-slate-800",
  error: "bg-white dark:bg-slate-800",
  info: "bg-white dark:bg-slate-800",
  warning: "bg-white dark:bg-slate-800",
};

const iconColor: Record<ToastType, string> = {
  success: "text-green-500",
  error: "text-red-500",
  info: "text-blue-500",
  warning: "text-amber-500",
};

function ToastIcon({ type }: { type: ToastType }) {
  const cls = `w-5 h-5 flex-shrink-0 ${iconColor[type]}`;
  switch (type) {
    case "success":
      return <CheckCircle className={cls} />;
    case "error":
      return <XCircle className={cls} />;
    case "info":
      return <Info className={cls} />;
    case "warning":
      return <AlertTriangle className={cls} />;
  }
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => removeToast(toast.id), 300);
  };

  return (
    <div
      className={`
        flex items-start gap-3 min-w-[280px] max-w-sm w-full
        border-l-4 ${borderColor[toast.type]} ${bgColor[toast.type]}
        rounded-lg shadow-lg px-4 py-3
        border border-gray-200 dark:border-slate-700
        transition-all duration-300 ease-in-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
      role="alert"
    >
      <ToastIcon type={toast.type} />
      <p className="flex-1 text-sm text-gray-800 dark:text-slate-200 font-medium leading-snug">
        {toast.message}
      </p>
      <button
        onClick={handleClose}
        className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div
      className="fixed bottom-4 right-4 flex flex-col gap-2 z-50"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

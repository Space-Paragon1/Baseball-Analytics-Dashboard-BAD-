import { AlertCircle } from "lucide-react";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="alert-error max-w-lg">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-sm">Error loading data</p>
          <p className="text-xs mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
          Try again
        </button>
      )}
    </div>
  );
}

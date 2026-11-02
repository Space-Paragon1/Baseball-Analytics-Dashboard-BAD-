export default function LoadingSpinner({ label = "Loading data..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4" role="status">
      <div className="w-10 h-10 border-4 border-blue-200 dark:border-slate-700 border-t-blue-700 dark:border-t-blue-400 rounded-full animate-spin" />
      <p className="text-gray-500 dark:text-slate-400 text-sm">{label}</p>
    </div>
  );
}

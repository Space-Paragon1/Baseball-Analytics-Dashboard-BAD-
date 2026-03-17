import { useState } from "react";
import { Calendar, X } from "lucide-react";

interface DateRangePickerProps {
  onChange: (start: string, end: string) => void;
}

export default function DateRangePicker({ onChange }: DateRangePickerProps) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const handleStartChange = (val: string) => {
    setStart(val);
    onChange(val, end);
  };

  const handleEndChange = (val: string) => {
    setEnd(val);
    onChange(start, val);
  };

  const handleClear = () => {
    setStart("");
    setEnd("");
    onChange("", "");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 shadow-sm">
      <Calendar className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500 dark:text-slate-400">From</label>
        <input
          type="date"
          value={start}
          onChange={(e) => handleStartChange(e.target.value)}
          className="input-field text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500 dark:text-slate-400">To</label>
        <input
          type="date"
          value={end}
          onChange={(e) => handleEndChange(e.target.value)}
          className="input-field text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
        />
      </div>
      {(start || end) && (
        <button
          onClick={handleClear}
          className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 hover:text-red-500 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}

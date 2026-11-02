import { Calendar, X } from "lucide-react";
import type { DateRange } from "../types";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  min?: string | null;
  max?: string | null;
}

export default function DateRangePicker({ value, onChange, min, max }: DateRangePickerProps) {
  const active = Boolean(value.start || value.end);
  return (
    <div className="flex flex-wrap items-center gap-3 card px-4 py-2.5">
      <Calendar className="w-4 h-4 muted flex-shrink-0" aria-hidden="true" />
      <label className="flex items-center gap-2 text-xs font-medium muted">
        From
        <input
          type="date"
          value={value.start}
          min={min ?? undefined}
          max={value.end || max || undefined}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
          className="input-field py-1.5"
          aria-label="Start date"
        />
      </label>
      <label className="flex items-center gap-2 text-xs font-medium muted">
        To
        <input
          type="date"
          value={value.end}
          min={value.start || min || undefined}
          max={max ?? undefined}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
          className="input-field py-1.5"
          aria-label="End date"
        />
      </label>
      {active && (
        <button type="button" onClick={() => onChange({ start: "", end: "" })} className="btn-ghost text-xs">
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}

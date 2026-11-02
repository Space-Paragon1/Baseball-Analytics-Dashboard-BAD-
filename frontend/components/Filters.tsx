import { Search } from "lucide-react";
import DateRangePicker from "./DateRangePicker";
import { useData } from "../context/DataContext";

export function SearchBox({
  value,
  onChange,
  placeholder = "Search players...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
      <input
        className="input-field w-56 pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}

export function TeamSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { meta } = useData();
  return (
    <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Team">
      <option value="">All teams</option>
      {(meta?.teams ?? []).map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

export function QualifiedToggle({
  checked,
  onChange,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  hint: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer" title={hint}>
      <input
        type="checkbox"
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      Qualified only
    </label>
  );
}

/** The shared date range, bounded by the dates that exist in the data. */
export function SharedDateRange() {
  const { range, setRange, meta } = useData();
  return <DateRangePicker value={range} onChange={setRange} min={meta?.date_range.min} max={meta?.date_range.max} />;
}

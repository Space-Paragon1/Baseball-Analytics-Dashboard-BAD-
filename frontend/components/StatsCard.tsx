import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "blue" | "green" | "amber" | "red" | "purple";
}

const colorMap = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300",
  green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300",
  red: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300",
  purple: "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300",
};

export default function StatsCard({ title, value, subtitle, icon: Icon, color = "blue" }: StatsCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 mt-1 truncate tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5 truncate">{subtitle}</p>}
        </div>
        <div className={`${colorMap[color]} p-3 rounded-xl flex-shrink-0 ml-4`} data-testid="stats-card-icon">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import React from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  color?: "blue" | "green" | "amber" | "red" | "purple";
}

const colorMap = {
  blue: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    icon: "text-blue-600",
  },
  green: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    icon: "text-emerald-600",
  },
  amber: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    icon: "text-amber-600",
  },
  red: {
    bg: "bg-red-100",
    text: "text-red-700",
    icon: "text-red-600",
  },
  purple: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    icon: "text-purple-600",
  },
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend = "neutral",
  color = "blue",
}: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-1 truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`${colors.bg} p-3 rounded-xl flex-shrink-0 ml-4`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
      </div>

      {trend !== "neutral" && (
        <div className="mt-3 flex items-center gap-1.5">
          {trend === "up" ? (
            <>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">
                Trending up
              </span>
            </>
          ) : (
            <>
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-red-600">
                Trending down
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

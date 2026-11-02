import { useTheme } from "../../context/ThemeContext";

export const SERIES_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

/** Axis, grid and tooltip colours that work in light and dark mode. */
export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return {
    grid: dark ? "#334155" : "#f0f0f0",
    axis: dark ? "#94a3b8" : "#6b7280",
    axisLine: dark ? "#475569" : "#e5e7eb",
    tooltip: {
      backgroundColor: dark ? "#1e293b" : "white",
      border: `1px solid ${dark ? "#334155" : "#e5e7eb"}`,
      borderRadius: "8px",
      fontSize: "12px",
      color: dark ? "#f1f5f9" : "#111827",
      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
    },
  };
}

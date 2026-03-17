import { Lightbulb } from "lucide-react";

interface InsightsPanelProps {
  insights: string[];
}

const insightColors = [
  "bg-blue-50 border-blue-200 text-blue-800",
  "bg-emerald-50 border-emerald-200 text-emerald-800",
  "bg-amber-50 border-amber-200 text-amber-800",
  "bg-purple-50 border-purple-200 text-purple-800",
  "bg-rose-50 border-rose-200 text-rose-800",
  "bg-cyan-50 border-cyan-200 text-cyan-800",
  "bg-indigo-50 border-indigo-200 text-indigo-800",
  "bg-orange-50 border-orange-200 text-orange-800",
];

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="chart-container">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-gray-800 text-base">
          Auto-Generated Insights
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg border ${insightColors[i % insightColors.length]}`}
          >
            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
            <p className="text-sm font-medium leading-snug">{insight}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

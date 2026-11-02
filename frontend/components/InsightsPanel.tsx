import { Lightbulb } from "lucide-react";

const insightColors = [
  "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-200",
  "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200",
  "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200",
  "bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950/40 dark:border-purple-900 dark:text-purple-200",
  "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200",
  "bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-950/40 dark:border-cyan-900 dark:text-cyan-200",
];

export default function InsightsPanel({ insights }: { insights: string[] }) {
  if (!insights || insights.length === 0) return null;

  return (
    <section className="chart-container" aria-labelledby="insights-heading">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-amber-500" />
        <h3 id="insights-heading" className="font-semibold text-gray-800 dark:text-slate-200 text-base">
          Auto-Generated Insights
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.map((insight, i) => (
          <div key={insight} className={`flex items-start gap-3 p-3 rounded-lg border ${insightColors[i % insightColors.length]}`}>
            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
            <p className="text-sm font-medium leading-snug">{insight}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

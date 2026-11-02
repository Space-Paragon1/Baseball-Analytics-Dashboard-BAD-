import {
  Bar,
  CartesianGrid,
  Legend,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "./chartTheme";

interface BarConfig {
  key: string;
  color: string;
  name: string;
}

interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  bars: BarConfig[];
  title?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
}

export default function BarChart({ data, xKey, bars, title, height = 300, valueFormatter }: BarChartProps) {
  const t = useChartTheme();
  return (
    <div className="chart-container">
      {title && <h3 className="card-title mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: t.axis }} axisLine={{ stroke: t.axisLine }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: t.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={valueFormatter}
          />
          <Tooltip
            contentStyle={t.tooltip}
            cursor={{ fill: t.grid, opacity: 0.4 }}
            formatter={valueFormatter ? (v) => valueFormatter(Number(v)) : undefined}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} fill={bar.color} name={bar.name} radius={[3, 3, 0, 0]} />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "./chartTheme";

interface LineConfig {
  key: string;
  color: string;
  name: string;
  dashed?: boolean;
}

interface LineChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  lines: LineConfig[];
  title?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
  domain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
}

export default function LineChart({ data, xKey, lines, title, height = 300, valueFormatter, domain }: LineChartProps) {
  const t = useChartTheme();
  return (
    <div className="chart-container">
      {title && <h3 className="card-title mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: t.axis }} axisLine={{ stroke: t.axisLine }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: t.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={valueFormatter}
            domain={domain ?? ["auto", "auto"]}
          />
          <Tooltip
            contentStyle={t.tooltip}
            formatter={valueFormatter ? (v) => valueFormatter(Number(v)) : undefined}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              name={line.name}
              strokeWidth={2}
              strokeDasharray={line.dashed ? "5 4" : undefined}
              dot={data.length <= 30 ? { fill: line.color, r: 3 } : false}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

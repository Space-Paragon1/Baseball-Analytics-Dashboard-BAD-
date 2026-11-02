import { Cell, Legend, Pie, PieChart as RechartsPieChart, PieLabelRenderProps, ResponsiveContainer, Tooltip } from "recharts";
import { SERIES_COLORS, useChartTheme } from "./chartTheme";

interface PieChartProps {
  data: { name: string; value: number }[];
  title?: string;
  height?: number;
}

const RADIAN = Math.PI / 180;

function renderLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as PieLabelRenderProps & {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  };
  if (percent < 0.06) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function PieChart({ data, title, height = 300 }: PieChartProps) {
  const t = useChartTheme();
  return (
    <div className="chart-container">
      {title && <h3 className="card-title mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie data={data} cx="50%" cy="50%" labelLine={false} label={renderLabel} outerRadius={height * 0.35} dataKey="value">
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={t.tooltip} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

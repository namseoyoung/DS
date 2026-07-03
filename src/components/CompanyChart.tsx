import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { PricePoint } from "../types";

type CompanyChartProps = {
  data: PricePoint[];
  color: string;
};

export function CompanyChart({ data, color }: CompanyChartProps) {
  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis domain={["dataMin - 2", "dataMax + 2"]} hide />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={3}
            dot={false}
            isAnimationActive
            animationDuration={650}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

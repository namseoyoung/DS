import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { PricePoint } from "../types";
import { formatValue } from "../utils/format";

type CompanyChartProps = {
  data: PricePoint[];
  color: string;
  heightClassName?: string;
};

export function CompanyChart({ data, color, heightClassName = "h-20" }: CompanyChartProps) {
  return (
    <div className={`${heightClassName} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis domain={["dataMin - 2", "dataMax + 2"]} hide />
          <Tooltip formatter={(value) => formatValue(Number(value))} />
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

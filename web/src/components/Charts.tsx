import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint, Trend } from "../types";
import { yearOf } from "../format";
import "./Charts.css";

const BLUE = "#1d4ed8";
const ORANGE = "#b4410b";
const GRID = "#d5dbe1";
const STRONG = "#8a96a3";

const AXIS_STYLE = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 11,
  fill: "#44525f",
};

function yearTicks(series: SeriesPoint[]): string[] {
  const ticks: string[] = [];
  let lastYear = "";
  for (const p of series) {
    const y = yearOf(p.t);
    if (y !== lastYear && Number(y) % 5 === 0) {
      ticks.push(p.t);
      lastYear = y;
    }
  }
  return ticks;
}

/** Exhibit A: raw monthly series as a blue line on a grey panel. */
export function EvidenceChart({ series, units }: { series: SeriesPoint[]; units: string }) {
  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={series} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="t"
            ticks={yearTicks(series)}
            tickFormatter={yearOf}
            tick={AXIS_STYLE}
            stroke={STRONG}
          />
          <YAxis
            tick={AXIS_STYLE}
            stroke={STRONG}
            width={48}
            tickFormatter={(v: number) => v.toFixed(0)}
            label={{
              value: units,
              angle: -90,
              position: "insideLeft",
              style: { ...AXIS_STYLE, textAnchor: "middle" },
            }}
          />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(2)} ${units}`, "Value"]}
            labelFormatter={(t) => t}
            contentStyle={tooltipStyle}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={BLUE}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Exhibit B: anomalies as a thin blue line, dashed zero, Sen's slope trend
 * as a thick orange line. */
export function AnomalyChart({
  series,
  trend,
  units,
}: {
  series: SeriesPoint[];
  trend: Trend;
  units: string;
}) {
  // Build the Sen's slope trend line across the window: slope is per decade
  // (= per 120 months). Anchor it so the trend passes through zero at the
  // midpoint of the anomaly series (anomalies are mean-centred).
  const n = series.length;
  const perMonth = trend.sen_slope_per_decade / 120;
  const mid = (n - 1) / 2;
  const data = series.map((p, i) => ({
    ...p,
    trend: perMonth * (i - mid),
  }));

  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="t"
            ticks={yearTicks(series)}
            tickFormatter={yearOf}
            tick={AXIS_STYLE}
            stroke={STRONG}
          />
          <YAxis
            tick={AXIS_STYLE}
            stroke={STRONG}
            width={48}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{
              value: `anomaly (${units})`,
              angle: -90,
              position: "insideLeft",
              style: { ...AXIS_STYLE, textAnchor: "middle" },
            }}
          />
          <ReferenceLine y={0} stroke={STRONG} strokeDasharray="4 4" />
          <Tooltip
            formatter={(v, name) => {
              const num = Number(v);
              return [
                `${num >= 0 ? "+" : ""}${num.toFixed(2)} ${units}`,
                name === "anomaly" ? "Anomaly" : "Trend",
              ];
            }}
            labelFormatter={(t) => t}
            contentStyle={tooltipStyle}
          />
          <Line
            type="monotone"
            dataKey="anomaly"
            stroke={BLUE}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="trend"
            stroke={ORANGE}
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const tooltipStyle = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 12,
  border: "1px solid #d5dbe1",
  borderRadius: 8,
};

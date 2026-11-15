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

/** Tidy step for ~5 ticks across a span. */
function niceStep(span: number): number {
  const raw = span / 5;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return m * mag;
  return 10 * mag;
}

function ticksBetween(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/** Exhibit A: raw monthly series as a blue line on a grey panel.
 * Temperature gets an axis fitted to the data (starting at 0 °C flattened the
 * whole signal); amounts such as rainfall keep 0 as the floor. */
/** Centred 12-month running mean (null at the ends), to see past the seasons. */
function runningMean12(series: SeriesPoint[]): (number | null)[] {
  return series.map((_, i) => {
    if (i < 6 || i + 6 > series.length) return null;
    let sum = 0;
    for (let k = i - 6; k < i + 6; k++) sum += series[k].value;
    return sum / 12;
  });
}

export function EvidenceChart({
  series,
  units,
  zeroBased,
  showAverage = false,
}: {
  series: SeriesPoint[];
  units: string;
  zeroBased: boolean;
  /** Overlay a 12-month running average to make slow drifts visible. */
  showAverage?: boolean;
}) {
  const avg = showAverage ? runningMean12(series) : null;
  const chartData = avg ? series.map((p, i) => ({ ...p, avg12: avg[i] })) : series;
  const vals = series.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const step = niceStep((max - (zeroBased ? 0 : min)) * 1.1);
  const lo = zeroBased ? 0 : Math.floor((min - step * 0.25) / step) * step;
  const hi = Math.ceil((max + step * 0.25) / step) * step;
  const ticks = ticksBetween(lo, hi, step);
  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
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
            domain={[lo, hi]}
            ticks={ticks}
            tickFormatter={(v: number) => (Number.isInteger(step) ? v.toFixed(0) : v.toFixed(1))}
            label={{
              value: units,
              angle: -90,
              position: "insideLeft",
              style: { ...AXIS_STYLE, textAnchor: "middle" },
            }}
          />
          <Tooltip
            formatter={(v, name) => [`${Number(v).toFixed(2)} ${units}`, name === "avg12" ? "12-month average" : "Value"]}
            labelFormatter={(t) => t}
            contentStyle={tooltipStyle}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={BLUE}
            strokeWidth={1.5}
            strokeOpacity={showAverage ? 0.45 : 1}
            dot={false}
            isAnimationActive={false}
          />
          {showAverage && (
            <Line
              type="monotone"
              dataKey="avg12"
              stroke="#0f1a24"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
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
  // Symmetric axis around zero with round ticks (was 1.9 / 0.9 / -0.9 ...).
  const maxAbs = Math.max(...series.map((p) => Math.abs(p.anomaly)), Math.abs(perMonth * mid));
  const aStep = niceStep(maxAbs * 2.2);
  const aLim = Math.ceil(maxAbs / aStep) * aStep;
  const aTicks = ticksBetween(-aLim, aLim, aStep);

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
            domain={[-aLim, aLim]}
            ticks={aTicks}
            tickFormatter={(v: number) => (Number.isInteger(aStep) ? v.toFixed(0) : v.toFixed(1))}
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

/** Accessible table of every month, collapsed by default. */
export function DataTable({ series, units }: { series: SeriesPoint[]; units: string }) {
  return (
    <details className="data-table">
      <summary>Show the numbers ({series.length} months)</summary>
      <div className="data-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Value ({units})</th>
              <th scope="col">Usual for that month</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.t}>
                <td>{p.t}</td>
                <td>{p.value.toFixed(2)}</td>
                <td>{p.climatology.toFixed(2)}</td>
                <td>
                  {p.anomaly >= 0 ? "+" : ""}
                  {p.anomaly.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}


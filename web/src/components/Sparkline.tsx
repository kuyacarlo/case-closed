// Yearly averages as a small line with the Sen's slope trend drawn through
// their middle. Pure SVG, no chart library: it renders instantly in the card.
interface SparklineProps {
  values: number[];
  firstYear: number;
  /** Trend per decade (Sen's slope), in the same units as values. */
  senPerDecade: number;
  units: string;
  colour: string;
}

export function Sparkline({ values, firstYear, senPerDecade, units, colour }: SparklineProps) {
  const W = 320;
  const H = 72;
  const PAD = 6;
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const trend = values.map((_, i) => mean + (senPerDecade / 10) * (i - (n - 1) / 2));
  const lo = Math.min(...values, ...trend);
  const hi = Math.max(...values, ...trend);
  const x = (i: number) => PAD + (i / (n - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo || 1)) * (H - 2 * PAD);
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = firstYear + n - 1;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  return (
    <figure className="sparkline">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Yearly average ${firstYear} to ${last}: lowest ${minV.toFixed(1)}, highest ${maxV.toFixed(1)} ${units}.`}
      >
        <polyline points={line} fill="none" stroke="#8a96a3" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <line
          x1={x(0)}
          y1={y(trend[0])}
          x2={x(n - 1)}
          y2={y(trend[n - 1])}
          stroke={colour}
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={x(n - 1)} cy={y(values[n - 1])} r="3" fill="#0f1a24" />
      </svg>
      <figcaption className="sparkline-axis num">
        <span>{firstYear}</span>
        <span>yearly average and trend</span>
        <span>{last}</span>
      </figcaption>
    </figure>
  );
}

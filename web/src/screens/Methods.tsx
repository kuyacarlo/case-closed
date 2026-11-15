import { useEffect } from "react";
import type { Overview } from "../data";
import "./Screens.css";

interface MethodsProps {
  overview: Overview | null;
  anchor?: string;
  onBack: () => void;
}

/** National mean rainfall by year, with the 1999 break marked. */
function RainBreakChart({ overview }: { overview: Overview }) {
  const { first_year, values } = overview.summary.rain_national_annual;
  const W = 720;
  const H = 220;
  const L = 36;
  const B = 24;
  const max = Math.ceil(Math.max(...values));
  const bw = (W - L) / values.length;
  const y = (v: number) => H - B - (v / max) * (H - B - 10);
  const breakIdx = 1999 - first_year;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const before = mean(values.slice(0, breakIdx));
  const after = mean(values.slice(breakIdx));
  const last = first_year + values.length - 1;

  return (
    <figure className="rain-break">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Average rainfall over all Philippine land squares, ${first_year} to ${last}. About ${before.toFixed(1)} mm per day before 1999 and ${after.toFixed(1)} after.`}
      >
        {[0, 2, 4, 6, 8, 10].filter((t) => t <= max).map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#d5dbe1" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">
              {t}
            </text>
          </g>
        ))}
        {values.map((v, i) => (
          <rect
            key={i}
            x={L + i * bw + 1}
            y={y(v)}
            width={bw - 2}
            height={H - B - y(v)}
            fill={i < breakIdx ? "#8a96a3" : "#0f766e"}
          />
        ))}
        <line x1={L} x2={L + breakIdx * bw} y1={y(before)} y2={y(before)} stroke="#0f1a24" strokeDasharray="5 4" strokeWidth="2" />
        <line x1={L + breakIdx * bw} x2={W} y1={y(after)} y2={y(after)} stroke="#0f1a24" strokeDasharray="5 4" strokeWidth="2" />
        {[first_year, 1990, 1999, 2010, last].map((yr) => (
          <text key={yr} x={L + (yr - first_year + 0.5) * bw} y={H - 6} textAnchor="middle" className="axis">
            {yr}
          </text>
        ))}
      </svg>
      <figcaption>
        Average rainfall across all {overview.cells.length} Philippine land squares (mm/day,
        yearly). Before 1999: about {before.toFixed(1)}. From 1999: about {after.toFixed(1)}.
      </figcaption>
    </figure>
  );
}

export function Methods({ overview, anchor, onBack }: MethodsProps) {
  useEffect(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
  }, [anchor]);

  return (
    <div className="container methods stack-lg">
      <section className="stack-sm">
        <p className="eyebrow">How it works</p>
        <h1 className="h1-screen">How Case Closed reaches a verdict</h1>
        <p className="lead">
          What the data is, how we test it, and what it can’t tell you.
        </p>
      </section>

      <section className="stack-sm">
        <h2>The data</h2>
        <div className="table-scroll">
          <table className="methods-table">
            <thead>
              <tr>
                <th scope="col">Topic</th>
                <th scope="col">Dataset</th>
                <th scope="col">Made by</th>
                <th scope="col">Type</th>
                <th scope="col">Area per value</th>
                <th scope="col">Years used</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Air temperature</td>
                <td>NASA POWER <code>T2M</code> (monthly)</td>
                <td>NASA, from the MERRA-2 reanalysis</td>
                <td>Model-based reanalysis</td>
                <td>0.5° × 0.625° square, about 55 × 67 km</td>
                <td>1981–2025</td>
              </tr>
              <tr>
                <td>Rainfall</td>
                <td>NASA POWER <code>PRECTOTCORR</code> (monthly)</td>
                <td>NASA, from MERRA-2, bias-corrected</td>
                <td>Model-based reanalysis</td>
                <td>Same squares</td>
                <td>2000–2025 (see below)</td>
              </tr>
              <tr>
                <td>Nitrogen dioxide</td>
                <td>Sentinel-5P TROPOMI tropospheric NO₂ (offline L3)</td>
                <td>ESA / Copernicus, via Google Earth Engine</td>
                <td>Satellite measurement</td>
                <td>Point over Metro Manila only</td>
                <td>2018–2024</td>
              </tr>
              <tr>
                <td>Places</td>
                <td>geoBoundaries PHL, regions to municipalities</td>
                <td>NAMRIA, PSA, OCHA Philippines (CC BY 3.0 IGO)</td>
                <td>Boundaries (2020)</td>
                <td>17 regions, 87 provinces, 1,647 cities and towns</td>
                <td>–</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack-sm">
        <h2>What “your town” means</h2>
        <p>
          NASA POWER gives one value for each square of the grid, roughly 55 km across.
          When you pick a town, we use the square it sits in. That value is an average over
          the whole square: cities, mountains and sea alike. It is not a weather-station
          reading, and two towns in the same square get the same answer. Baguio, for
          example, sits in a square whose average temperature is about 3 °C warmer than the
          city itself, because the square includes lowland too.
        </p>
      </section>

      <section className="stack-sm">
        <h2>How the verdict works</h2>
        <ol className="method-steps">
          <li><strong>Remove the seasons.</strong> Subtract each calendar month’s usual value.</li>
          <li><strong>Measure the trend.</strong> Sen’s slope: the middle of all the slopes between pairs of months, so a few extreme months can’t drag it.</li>
          <li><strong>Test it honestly.</strong> Mann-Kendall test with the Hamed-Rao correction, because neighbouring months are alike and would otherwise overstate the evidence.</li>
          <li><strong>Check for a jump.</strong> Pettitt test on yearly averages. If the record is level after the biggest shift, we say “mostly a jump”.</li>
          <li><strong>Refuse short records.</strong> Under 20 years we don’t call a trend at all.</li>
          <li><strong>Across the map,</strong> we test about 180 squares at once, so we also report how many trends survive a Benjamini-Hochberg correction for multiple testing.</li>
        </ol>
        <p className="muted small">
          References: Sen (1968); Mann (1945); Kendall (1975); Hamed &amp; Rao (1998);
          Pettitt (1979); Benjamini &amp; Hochberg (1995); Weatherhead et al. (1998).
        </p>
      </section>

      <section className="stack-sm" id="rain-break">
        <h2>The faulty witness: rainfall before 2000</h2>
        <p>
          When we ran every square in the Philippines, the rainfall record jumped by about
          half in 1999 almost everywhere at once, then stayed high. Real climate doesn’t
          switch a whole country’s rainfall in one year and hold it there for 25 years.
          That pattern points to a change in how the dataset was put together. So for
          rainfall we only use 2000 onwards, after the break. Checking it against rain
          gauges or NASA’s GPM IMERG satellite rainfall is the next step.
        </p>
        {overview && <RainBreakChart overview={overview} />}
      </section>

      <section className="stack-sm">
        <h2>What this can’t tell you</h2>
        <ul className="method-steps">
          <li>Why the climate changed. A trend is not a cause.</li>
          <li>What happens next. These are past records, not forecasts.</li>
          <li>Street- or barangay-level detail. Each value covers a square about 55 km wide.</li>
          <li>Whether a jump is real weather or a change in the data, without a second source.</li>
        </ul>
      </section>

      <section className="actions">
        <button className="btn btn-primary" onClick={onBack}>
          Back to the map
        </button>
      </section>
    </div>
  );
}

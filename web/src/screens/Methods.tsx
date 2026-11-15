import { useEffect } from "react";
import type { OverviewIndex } from "../data";
import type { VariableInfo } from "../types";
import "./Screens.css";

interface MethodsProps {
  index: OverviewIndex | null;
  variables: VariableInfo[];
  anchor?: string;
  onBack: () => void;
}

/** National mean rainfall by year, with the 1999 break marked. */
function RainBreakChart({ index }: { index: OverviewIndex }) {
  const { first_year, values } = index.rain_national_annual;
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
        Average rainfall across all {index.vars.PRECTOTCORR?.squares ?? ""} Philippine land squares (mm/day,
        yearly). Before 1999: about {before.toFixed(1)}. From 1999: about {after.toFixed(1)}.
      </figcaption>
    </figure>
  );
}

export function Methods({ index, variables, anchor, onBack }: MethodsProps) {
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
        <p>
          Every variable, where it comes from, and the years we analyse. Click a definition
          to remember what a variable means.
        </p>
        <div className="table-scroll">
          <table className="methods-table">
            <thead>
              <tr>
                <th scope="col">Variable</th>
                <th scope="col">What it means</th>
                <th scope="col">Source</th>
                <th scope="col">Years used</th>
                <th scope="col">Squares with a significant trend</th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => {
                const s = index?.vars[v.code];
                return (
                  <tr key={v.code}>
                    <td>
                      <strong>{v.label}</strong>
                      <br />
                      <code>{v.code}</code> · {v.units}
                    </td>
                    <td>{v.definition}</td>
                    <td>{v.source}</td>
                    <td className="num">
                      {s ? `${s.window[0]}–${s.window[1]}` : v.static_place ? "2018–2024" : `${v.first_year}–2025`}
                      {v.first_year_note && <span className="muted small"> · {v.first_year_note}</span>}
                    </td>
                    <td className="num">
                      {s
                        ? `${s.significant} of ${s.squares} (▲${s.rising} ▼${s.falling}); ${s.significant_after_correction} after correction`
                        : `${v.static_place} only`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Places: geoBoundaries PHL (NAMRIA, PSA, OCHA Philippines; CC BY 3.0 IGO), 17
          regions, 87 provinces, 1,647 cities and municipalities.
        </p>
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
          <li><strong>Always report the trend.</strong> Direction and size are shown even when the trend isn’t significant; a longer record might make it so.</li>
          <li><strong>Refuse short records.</strong> Under 20 years we don’t call a trend significant at all.</li>
          <li><strong>Significant</strong> means the honest p-value is below 0.05: a trend this strong would turn up by chance less than 5 times in 100.</li>
          <li><strong>Across the map,</strong> we test about 220 squares at once, so we also report how many trends survive a Benjamini-Hochberg correction for multiple testing.</li>
        </ol>
        <p className="muted small">
          References: Sen (1968); Mann (1945); Kendall (1975); Hamed &amp; Rao (1998);
          Pettitt (1979); Benjamini &amp; Hochberg (1995); Weatherhead et al. (1998).
        </p>
      </section>

      <section className="stack-sm" id="rain-break">
        <h2>The faulty witness: a 1999 break in the data</h2>
        <p>
          When we ran every square in the Philippines, rainfall jumped by about half in 1999
          almost everywhere at once, then stayed high. Real climate doesn’t switch a whole
          country’s rainfall in one year and hold it there for 25 years. That points to a
          change in how the dataset was put together.
        </p>
        <p>
          So we built a <strong>data-break detector</strong>: for each variable it checks
          whether many squares jump in the same year. It found the same 1999 break on its
          own in:
        </p>
        <ul className="method-steps">
          {index &&
            Object.entries(index.vars)
              .filter(([, s]) => s.data_break)
              .map(([code, s]) => {
                const v = variables.find((x) => x.code === code);
                return (
                  <li key={code}>
                    <strong>{v?.label ?? code}</strong>: {s.data_break!.squares} squares (
                    {Math.round(s.data_break!.share * 100)}%) jump around {s.data_break!.year}.
                    Now analysed from {s.window[0]}.
                  </li>
                );
              })}
        </ul>
        <p>
          Humidity jumps in the same year, so it starts in 2000 too. Sunlight and cloud start
          in 2001, because NASA POWER joins an older satellite product (GEWEX SRB) to CERES
          around then. Checking against rain gauges or NASA’s GPM IMERG satellite rainfall
          is the next step.
        </p>
        {index && <RainBreakChart index={index} />}
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

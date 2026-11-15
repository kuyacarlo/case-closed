import { AnomalyChart, DataTable, EvidenceChart } from "../components/Charts";
import { PhMap } from "../components/PhMap";
import { describeSeries, yearOf } from "../format";
import { cellSizeKm } from "../grid";
import type { CaseResponse } from "../types";
import "./Screens.css";

interface EvidenceProps {
  data: CaseResponse;
  question: string;
  placeName: string;
  alsoCovers: string;
  onCrossExamine: () => void;
}

export function Evidence({ data, question, placeName, alsoCovers, onCrossExamine }: EvidenceProps) {
  const { meta, series, trend } = data;
  const startYear = yearOf(meta.start);
  const endYear = yearOf(meta.end);
  const years = Number(endYear) - Number(startYear) + 1;
  const zeroBased = meta.variable !== "T2M";
  const size = meta.cell ? cellSizeKm(meta.cell.lat) : null;

  return (
    <div className="container stack-lg">
      <section className="stack-sm">
        <p className="eyebrow">Case · {meta.label}</p>
        <h1 className="h1-screen">{question}</h1>
      </section>

      <div className="scene">
        <div className="card scene-facts">
          <div>
            <span className="strip-label">Where</span>
            <p>
              {placeName}
              {size ? (
                <span className="muted">
                  {" "}
                  · one NASA data square, about {size.ns} × {size.ew} km, centred on{" "}
                  <span className="num">
                    {meta.cell!.lat.toFixed(2)}°N, {meta.cell!.lon.toFixed(2)}°E
                  </span>
                </span>
              ) : (
                <span className="muted"> · satellite measurements over this point</span>
              )}
            </p>
            {alsoCovers && <p className="muted small">The same square also covers {alsoCovers}.</p>}
          </div>
          <div>
            <span className="strip-label">What</span>
            <p>{meta.definition}</p>
          </div>
          <div>
            <span className="strip-label">Source</span>
            <p>{meta.source}</p>
          </div>
          <div>
            <span className="strip-label">Record</span>
            <p className="num">
              {startYear}–{endYear} · {years} years · {meta.n_months} months
            </p>
          </div>
        </div>
        {meta.cell && (
          <PhMap
            overview={null}
            code="T2M"
            selected={{ lat: meta.cell.lat, lon: meta.cell.lon }}
            mini
            label={`Map showing the data square for ${placeName}`}
          />
        )}
      </div>

      {meta.warnings.length > 0 && (
        <div className="notice" role="note">
          {meta.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <section className="section stack-md">
        <h2>
          <span className="exhibit">Exhibit A</span> Collect the evidence
        </h2>
        <p className="lead">
          Every month of {meta.label.toLowerCase()} in this square, from {meta.source.split(" · ")[0]}.
          The regular waves are the seasons.
        </p>
        <EvidenceChart series={series} units={meta.units} zeroBased={zeroBased} />
        <p className="chart-summary">{describeSeries(series, meta.units)}</p>
      </section>

      <section className="section stack-md">
        <h2>
          <span className="exhibit">Exhibit B</span> Remove the seasons
        </h2>
        <p className="lead">
          Subtract each month’s usual value. What’s left is how unusual each month was,
          and the orange line is the steady trend through it.
        </p>
        <AnomalyChart series={series} trend={trend} units={meta.units} />
        <div className="legend">
          <span className="legend-item">
            <span className="legend-swatch blue" /> Difference from usual
          </span>
          <span className="legend-item">
            <span className="legend-swatch dashed" /> Usual (zero)
          </span>
          <span className="legend-item">
            <span className="legend-swatch orange" /> Trend (Sen’s slope)
          </span>
        </div>
        <DataTable series={series} units={meta.units} />
      </section>

      <section className="section closing-row card">
        <p className="lead" style={{ margin: 0 }}>
          There’s a line. Is it a real change, or could natural ups and downs draw it?
        </p>
        <button className="btn btn-primary" onClick={onCrossExamine}>
          See the verdict
        </button>
      </section>
    </div>
  );
}

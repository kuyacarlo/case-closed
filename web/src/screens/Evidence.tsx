import type { CaseResponse } from "../types";
import { AnomalyChart, EvidenceChart } from "../components/Charts";
import { yearOf } from "../format";
import "./Screens.css";

interface EvidenceProps {
  data: CaseResponse;
  question: string;
  onCrossExamine: () => void;
}

export function Evidence({ data, question, onCrossExamine }: EvidenceProps) {
  const { meta, series, trend } = data;
  const startYear = yearOf(meta.start);
  const endYear = yearOf(meta.end);
  const years = Number(endYear) - Number(startYear) + 1;

  return (
    <div className="container stack-lg">
      <section className="stack-sm">
        <p className="eyebrow">Case · {meta.label}</p>
        <h1 className="h1-screen">{question}</h1>
      </section>

      <div className="card variable-strip">
        <div>
          <span className="strip-label">Definition</span>
          <p>{meta.definition}</p>
        </div>
        <div>
          <span className="strip-label">Source</span>
          <p>{meta.source}</p>
        </div>
        <div>
          <span className="strip-label">Record</span>
          <p className="num">
            {meta.n_months} months · {years} years
          </p>
        </div>
      </div>

      {meta.warnings.length > 0 && (
        <p className="definition-box">{meta.warnings.join(" ")}</p>
      )}

      <section className="section stack-md">
        <h2>
          <span className="exhibit">Exhibit A</span> Collect the evidence
        </h2>
        <p className="lead">
          The raw monthly {meta.label.toLowerCase()} for this place, straight
          from NASA POWER.
        </p>
        <EvidenceChart series={series} units={meta.units} />
        <div className="chart-axis-note">
          <span>{startYear}</span>
          <span>{endYear}</span>
        </div>
      </section>

      <section className="section stack-md">
        <h2>
          <span className="exhibit">Exhibit B</span> Rule out the alibi
        </h2>
        <p className="lead">
          Subtract each month's usual value to remove the seasons. What's left
          is the anomaly — and the orange line is the trend through it.
        </p>
        <AnomalyChart series={series} trend={trend} units={meta.units} />
        <div className="legend">
          <span className="legend-item">
            <span className="legend-swatch blue" /> Monthly anomaly
          </span>
          <span className="legend-item">
            <span className="legend-swatch dashed" /> Zero (no anomaly)
          </span>
          <span className="legend-item">
            <span className="legend-swatch orange" /> Trend (Sen's slope)
          </span>
        </div>
      </section>

      <section className="section closing-row card">
        <p className="lead" style={{ margin: 0 }}>
          There is a line. Is it a real trend, or could noise draw it?
        </p>
        <button className="btn btn-primary" onClick={onCrossExamine}>
          Cross-examine the trend
        </button>
      </section>
    </div>
  );
}

import type { CaseResponse } from "../types";
import { formatP, yearOf } from "../format";
import "./Screens.css";

interface VerdictProps {
  data: CaseResponse;
  /** Current window start year, driven by the slider. */
  startYear: number;
  minYear: number;
  maxYear: number;
  loading: boolean;
  onStartYearChange: (year: number) => void;
  onBackToEvidence: () => void;
  onOpenAnother: () => void;
}

export function VerdictScreen({
  data,
  startYear,
  minYear,
  maxYear,
  loading,
  onStartYearChange,
  onBackToEvidence,
  onOpenAnother,
}: VerdictProps) {
  const { meta, trend, verdict } = data;
  const units = meta.units;
  const confirmed = verdict.state === "confirmed";
  const windowEnd = yearOf(meta.end);

  return (
    <div className="container stack-lg">
      <section className="stack-sm">
        <h1 className="h1-screen">Cross-examine the trend</h1>
        <p className="lead">
          A p-value is the chance of seeing a line this steep if nothing were
          really changing. Smaller means harder to dismiss as luck.
        </p>
      </section>

      <section className="card-row tests">
        <article className="card test-card test-naive">
          <p className="eyebrow">The naive test</p>
          <p className="test-method">Plain Mann-Kendall</p>
          <p className="test-p num">{formatP(trend.p_naive)}</p>
          <p className="test-note">
            It assumes every month is independent, so it treats a slow drift as
            far more evidence than it is. Overconfident.
          </p>
        </article>
        <article className="card test-card test-honest">
          <p className="eyebrow">The honest test</p>
          <p className="test-method">Hamed-Rao modified Mann-Kendall</p>
          <p className="test-p num">{formatP(trend.p_honest)}</p>
          <p className="test-note">
            Warm months follow warm months (lag-1 autocorrelation{" "}
            <span className="num">{trend.lag1.toFixed(2)}</span>), so the{" "}
            {meta.n_months} months really count like{" "}
            <span className="num">{trend.n_eff}</span>. This p-value accounts
            for that.
          </p>
        </article>
      </section>

      <section className="verdict-block">
        <span className="verdict-stamp">
          {confirmed ? "Verdict: Trend confirmed" : "Verdict: Not enough evidence yet"}
        </span>
        <p className="verdict-text">{verdict.text}</p>
        <p className="verdict-secondary num">
          Least squares: {trend.ols_slope_per_decade.toFixed(2)} &plusmn;{" "}
          {trend.ci95.toFixed(2)} {units} per decade
        </p>
        {!confirmed && trend.years_needed != null && (
          <p className="verdict-secondary">
            At this noise level, about {trend.years_needed} years of record
            would be needed to call it.
          </p>
        )}
      </section>

      <section className="section stack-md">
        <h2>Change the window</h2>
        <p className="lead">
          Move the start year and watch the verdict update. A shorter record is
          noisier and harder to call.
        </p>
        <div className="card slider-card">
          <input
            type="range"
            min={minYear}
            max={Math.max(minYear + 1, maxYear - 5)}
            value={startYear}
            onChange={(e) => onStartYearChange(Number(e.target.value))}
            aria-label="Start year"
          />
          <p className="slider-window num">
            Window: {startYear}–{windowEnd}
            {loading && <span className="slider-loading"> · updating…</span>}
          </p>
        </div>
      </section>

      <section className="section actions">
        <button className="btn btn-outline" onClick={onBackToEvidence}>
          Back to the evidence
        </button>
        <button className="btn btn-primary" onClick={onOpenAnother}>
          Open another case
        </button>
      </section>
    </div>
  );
}

import { useState } from "react";
import { MIN_YEARS_FOR_VERDICT } from "../api";
import { formatP, yearOf } from "../format";
import type { CaseResponse, Verdict } from "../types";
import "./Screens.css";

interface VerdictProps {
  data: CaseResponse;
  question: string;
  placeName: string;
  /** Verdict for the full record, kept fixed while the slider moves. */
  fullVerdict: Verdict | null;
  fullFrom: number;
  /** e.g. "Warming faster than 72% of the Philippines' land areas." */
  nationalContext: string | null;
  startYear: number;
  minYear: number;
  maxYear: number;
  loading: boolean;
  onStartYearChange: (year: number) => void;
  onBackToEvidence: () => void;
  onOpenAnother: () => void;
}

const STAMP: Record<Verdict["state"], string> = {
  confirmed: "Verdict: Significant trend",
  step: "Verdict: Mostly one jump",
  not_yet: "Verdict: Trend not significant yet",
  too_short: "Verdict: Too short to judge",
};

function signed(x: number, d: number): string {
  return `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;
}

export function VerdictScreen(props: VerdictProps) {
  const { data, startYear, minYear, maxYear, loading, fullVerdict } = props;
  const { meta, trend, verdict } = data;
  const units = meta.units;
  const d = Math.abs(verdict.rate_per_decade) < 0.1 ? 3 : 2;
  const windowEnd = Number(yearOf(meta.end));
  const windowYears = windowEnd - startYear + 1;
  const exploratory = windowYears < MIN_YEARS_FOR_VERDICT;
  const sliderMax = Math.max(minYear + 1, maxYear - 5);
  // Start years after this give windows under the minimum.
  const shortFrom = maxYear - MIN_YEARS_FOR_VERDICT + 2;
  const shortPct = Math.max(0, Math.min(100, ((shortFrom - minYear) / (sliderMax - minYear)) * 100));
  const atFull = startYear === props.fullFrom;
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    window.setTimeout(() => setCopied("idle"), 2500);
  }

  // Every 5 years; every 10 on narrow screens so labels don't collide.
  const tickStep = typeof window !== "undefined" && window.innerWidth < 480 ? 10 : 5;
  const tickYears: number[] = [];
  for (let y = Math.ceil(minYear / tickStep) * tickStep; y <= sliderMax; y += tickStep) tickYears.push(y);

  return (
    <div className="container stack-lg">
      <section className="stack-sm">
        <p className="eyebrow">
          Case · {meta.label} · {props.placeName}
        </p>
        <h1 className="h1-screen">{props.question}</h1>
      </section>

      <section
        className={`verdict-block case-summary verdict-${verdict.state}`}
        aria-live="polite"
        aria-busy={loading}
      >
        <span className="verdict-stamp">{STAMP[verdict.state]}</span>
        <p className="verdict-text">{verdict.headline}</p>
        <dl className="summary-rows">
          <div>
            <dt>Is there a trend?</dt>
            <dd>
              {verdict.direction === "flat"
                ? "Essentially flat"
                : verdict.significant
                  ? `Yes, ${verdict.direction}`
                  : `A slight ${verdict.direction === "rising" ? "rise" : "fall"}`}
            </dd>
          </div>
          <div>
            <dt>How much?</dt>
            <dd className="num">
              {signed(verdict.rate_per_decade, d)} {units} per decade · about{" "}
              {signed(verdict.total_change, d)} {units} over {Math.round(verdict.years)} years
            </dd>
          </div>
          <div>
            <dt>Is it significant?</dt>
            <dd>
              {verdict.state === "too_short"
                ? "Too short to judge (under 20 years)"
                : verdict.significant
                  ? `Yes. p = ${formatP(verdict.p)}, below the 0.05 line`
                  : `Not yet. p = ${formatP(verdict.p)}, above the 0.05 line`}
              <span className="row-note">
                Significant means a trend this strong would turn up by chance less than 5
                times in 100, even after allowing for similar neighbouring months.
              </span>
            </dd>
          </div>
          <div>
            <dt>How sure?</dt>
            <dd>
              {verdict.detail}
              <span className="row-note num">
                95% range for the rate: {signed(trend.ols_slope_per_decade - trend.ci95, d)} to{" "}
                {signed(trend.ols_slope_per_decade + trend.ci95, d)} {units}/decade
                {trend.ols_slope_per_decade - trend.ci95 > 0 || trend.ols_slope_per_decade + trend.ci95 < 0
                  ? " (doesn’t include zero)"
                  : " (includes zero)"}
              </span>
            </dd>
          </div>
        </dl>
        {props.nationalContext && verdict.significant && atFull && (
          <p className="verdict-secondary">{props.nationalContext}</p>
        )}
        <p className="verdict-secondary num">
          Window {startYear}–{windowEnd} · {meta.n_months} months · {meta.source}
        </p>
      </section>

      <section className="section stack-md">
        <h2>Try a different start year</h2>
        <p className="lead">
          A shorter window is noisier. Picking start years until the answer looks
          exciting is a way to fool yourself, so treat the full record as the answer.
        </p>
        <div className="card slider-card">
          {fullVerdict && (
            <p className="slider-anchor">
              <span className="strip-label">Full record, {props.fullFrom}–{maxYear}</span>
              {fullVerdict.headline}
            </p>
          )}
          <div className="slider-track-wrap">
            <div
              className="slider-short-zone"
              style={{ left: `${shortPct}%` }}
              aria-hidden="true"
              title="Under 20 years: exploratory only"
            />
            <input
              type="range"
              min={minYear}
              max={sliderMax}
              value={startYear}
              onChange={(e) => props.onStartYearChange(Number(e.target.value))}
              aria-label="Start year"
              aria-valuetext={`Start year ${startYear}, ${windowYears}-year window`}
            />
          </div>
          <div className="slider-ticks num" aria-hidden="true">
            {tickYears.map((y) => (
              <span key={y} style={{ left: `${((y - minYear) / (sliderMax - minYear)) * 100}%` }}>
                {y}
              </span>
            ))}
          </div>
          <div className="slider-readout">
            <p className="num">
              Window: {startYear}–{windowEnd} · {windowYears} years
              {exploratory && <span className="chip-short">Exploratory</span>}
              {loading && <span className="slider-loading"> · updating…</span>}
            </p>
            {!atFull && (
              <button className="link-btn" onClick={() => props.onStartYearChange(props.fullFrom)}>
                Reset to full record
              </button>
            )}
          </div>
          <p className="slider-key">
            <span className="key-short" /> Shaded: windows under {MIN_YEARS_FOR_VERDICT} years,
            too short to call
          </p>
        </div>
      </section>

      <details className="section how-sure card">
        <summary>
          <h2>How sure are we?</h2>
          <span className="muted">The statistics behind the verdict</span>
        </summary>
        <div className="stack-md how-sure-body">
          <p>
            A p-value is the chance of seeing a line this steep if nothing were really
            changing. Smaller means harder to dismiss as luck.
          </p>
          <div className="card-row tests">
            <article className="card test-card test-naive">
              <p className="eyebrow">The naive test</p>
              <p className="test-method">Plain Mann-Kendall</p>
              <p className="test-p num">{formatP(trend.p_naive)}</p>
              <p className="test-note">
                Treats every month as independent, so a slow drift looks like far more
                evidence than it is. Overconfident.
              </p>
            </article>
            <article className="card test-card test-honest">
              <p className="eyebrow">The honest test (used for the verdict)</p>
              <p className="test-method">Hamed-Rao modified Mann-Kendall</p>
              <p className="test-p num">{formatP(trend.p_honest)}</p>
              <p className="test-note">
                Warm months follow warm months (lag-1 autocorrelation{" "}
                <span className="num">{trend.lag1.toFixed(2)}</span>), so the {meta.n_months}{" "}
                months count like <span className="num">{trend.n_eff}</span> independent ones.
              </p>
            </article>
          </div>
          <p>
            <strong>Two estimates of the rate.</strong> Sen’s slope (
            <span className="num">
              {trend.sen_slope_per_decade.toFixed(2)} {units}/decade
            </span>
            ) ignores a few extreme months; least squares (
            <span className="num">
              {trend.ols_slope_per_decade.toFixed(2)} ± {trend.ci95.toFixed(2)}
            </span>
            ) gives the 95% range. If they disagree a lot, a few unusual months are driving
            the line.
          </p>
          {trend.changepoint && (
            <p>
              <strong>Was it a jump?</strong> The biggest shift in yearly averages was around{" "}
              {trend.changepoint.year} (p = {formatP(trend.changepoint.p)}).{" "}
              {trend.changepoint.step_dominated
                ? "The record stays roughly level after it, so most of the change is that jump."
                : "The record keeps changing after it, so this is a trend, not a single jump."}
            </p>
          )}
        </div>
      </details>

      <section className="section actions">
        <button className="btn btn-outline" onClick={props.onBackToEvidence}>
          Back to the evidence
        </button>
        <button className="btn btn-primary" onClick={props.onOpenAnother}>
          Pick another place
        </button>
        <button className="btn btn-outline" onClick={copyLink} aria-live="polite">
          {copied === "ok" ? "Link copied" : copied === "fail" ? "Copy the address bar instead" : "Copy link to this case"}
        </button>
      </section>
    </div>
  );
}

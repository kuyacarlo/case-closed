import { AnomalyChart, DataTable, EvidenceChart } from "../components/Charts";
import { PhMap } from "../components/PhMap";
import { WitnessPanel, type Witness } from "../components/WitnessPanel";
import { describeSeries, yearOf } from "../format";
import { cellSizeKm } from "../grid";
import { useState } from "react";
import type { CaseResponse } from "../types";
import type { Guess } from "../url";
import "./Screens.css";

interface EvidenceProps {
  data: CaseResponse;
  question: string;
  placeName: string;
  alsoCovers: string;
  /** The case's own variable and its second witness, when both are mapped. */
  witnesses: [Witness, Witness] | null;
  /** Region squares to outline on the mini map. */
  highlight: [number, number][] | null;
  guess: Guess | undefined;
  onGuess: (g: Guess) => void;
  onCrossExamine: () => void;
}

const GUESSES: { g: Guess; label: string }[] = [
  { g: "rising", label: "▲ Rising" },
  { g: "falling", label: "▼ Falling" },
  { g: "none", label: "■ No clear trend" },
];

export function Evidence({
  data,
  question,
  placeName,
  alsoCovers,
  witnesses,
  highlight,
  guess,
  onGuess,
  onCrossExamine,
}: EvidenceProps) {
  const [showAverage, setShowAverage] = useState(true);
  const { meta, series, trend } = data;
  const startYear = yearOf(meta.start);
  const endYear = yearOf(meta.end);
  const years = Number(endYear) - Number(startYear) + 1;
  // Amounts (rain, evaporation, runoff, sunlight, NO2) keep 0 as the floor;
  // temperatures, humidity and similar get an axis fitted to the data.
  const zeroBased = ["PRECTOTCORR", "EVLAND", "ALLSKY_SFC_SW_DWN", "WS2M", "NO2", "IMERG", "GLDAS_EVAP", "GLDAS_RUNOFF", "OMI_NO2"].includes(meta.variable);
  const size = meta.cell ? cellSizeKm(meta.cell.lat) : null;

  return (
    <div className="container stack-lg">
      <section className="stack-sm">
        <p className="eyebrow">{meta.label}</p>
        <h1 className="h1-screen">{question}</h1>
      </section>

      <div className="scene">
        <div className="card scene-facts">
          <div>
            <span className="strip-label">Where</span>
            <p>
              {placeName}
              {meta.area ? (
                <span className="muted">
                  , average of {meta.area.squares} NASA data squares, weighted by land area
                </span>
              ) : size ? (
                <span className="muted">
                  , one NASA data square, about {size.ns} × {size.ew} km, centred on{" "}
                  <span className="num">
                    {meta.cell!.lat.toFixed(2)}°N, {meta.cell!.lon.toFixed(2)}°E
                  </span>
                </span>
              ) : (
                <span className="muted">, satellite measurements over this point</span>
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
              {startYear}–{endYear}, {years} years, {meta.n_months} months
            </p>
          </div>
        </div>
        {(meta.cell || (highlight && highlight.length > 0)) && (
          <PhMap
            highlight={highlight}
            layer={null}
            theme="heat"
            max={1}
            selected={meta.cell ? { lat: meta.cell.lat, lon: meta.cell.lon } : null}
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

      <section className="section stack-md" id="exhibit-a">
        <h2>
          <span className="exhibit">Exhibit A</span> Collect the evidence
        </h2>
        <p className="lead">
          Every month of {meta.label.toLowerCase()} in this square, from {meta.source.split(" · ")[0]}.
          The regular waves are the seasons.{" "}
          <span className="muted">{meta.definition}</span>
        </p>
        <label className="switch">
          <input type="checkbox" checked={showAverage} onChange={(e) => setShowAverage(e.target.checked)} />
          Show the 12-month average (smooths out the seasons)
        </label>
        <EvidenceChart series={series} units={meta.units} zeroBased={zeroBased} showAverage={showAverage} />
        <p className="chart-summary">{describeSeries(series, meta.units)}</p>
      </section>

      <section className="section stack-md" id="exhibit-b">
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

      {witnesses && <WitnessPanel main={witnesses[0]} second={witnesses[1]} />}

      <section className="section card your-call stack-md" id="your-call">
        <h2>
          <span className="exhibit">Your call</span> Does it look like a trend?
        </h2>
        <p className="lead">
          Look at the two exhibits. Before any statistics, what does your eye say? Then the
          test will tell you whether it could just be chance.
        </p>
        <div className="guess-buttons" role="group" aria-label="Your call">
          {GUESSES.map(({ g, label }) => (
            <button
              key={g}
              type="button"
              className={`btn ${guess === g ? "btn-primary" : "btn-outline"}`}
              aria-pressed={guess === g}
              onClick={() => onGuess(g)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="closing-row">
          <p className="muted" style={{ margin: 0 }}>
            {guess ? "Locked in. Now test it." : "Make your call, or skip straight to the test."}
          </p>
          <button className="btn btn-primary" onClick={onCrossExamine}>
            Test for significance
          </button>
        </div>
      </section>
    </div>
  );
}

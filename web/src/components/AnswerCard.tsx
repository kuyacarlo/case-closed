import type { Layer, LayerCell, RawPlace } from "../data";
import { slopePercentile } from "../data";
import { cellSizeKm } from "../grid";
import type { Place, VariableInfo } from "../types";
import { directionColour } from "./colour";
import { Sparkline } from "./Sparkline";
import { trendAnswers } from "./trendAnswers";
import "./AnswerCard.css";

interface AnswerCardProps {
  place: Place;
  cell: LayerCell | undefined;
  layer: Layer;
  info: VariableInfo;
  towns: RawPlace[];
  onEvidence: () => void;
}

function listTowns(towns: RawPlace[], exclude: string): string {
  const names = towns.map((t) => t.n).filter((n) => n !== exclude);
  if (names.length === 0) return "";
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

export function AnswerCard({ place, cell, layer, info, towns, onEvidence }: AnswerCardProps) {
  if (!cell) {
    return (
      <section className="answer-card card" aria-live="polite">
        <p className="eyebrow">{place.name}</p>
        <h2 className="answer-headline">No {info.label.toLowerCase()} data here</h2>
        <p className="answer-body">
          This square is mostly sea, or the dataset doesn’t cover it for this variable. Pick
          a square over land, or search for a town by name.
        </p>
      </section>
    );
  }

  const lastYear = layer.window[1];
  const a = trendAnswers(cell, info, lastYear);
  const size = cellSizeKm(cell.lat);
  const also = listTowns(towns, place.name);
  const pct = slopePercentile(layer, cell.sen);
  const STATE: Record<LayerCell["state"], string> = {
    confirmed: "Significant",
    step: "Mostly a jump",
    not_yet: "Not significant",
    too_short: "Too short",
  };

  return (
    <section className="answer-card card" aria-live="polite">
      <div className="answer-top">
        <div>
          <p className="eyebrow">
            {info.label} · {cell.first_year}–{lastYear}
          </p>
          <p className="answer-place">{place.name}</p>
          {place.context && <p className="answer-context">{place.context}</p>}
        </div>
        <span className={`state-chip state-${cell.state}`}>{STATE[cell.state]}</span>
      </div>

      <h2 className="answer-headline">{cell.text}</h2>

      <dl className="answers">
        <div>
          <dt>Is there a trend?</dt>
          <dd>{a.trend}</dd>
        </div>
        <div>
          <dt>How much?</dt>
          <dd className="num">{a.howMuch}</dd>
        </div>
        <div>
          <dt>Is it significant?</dt>
          <dd>{a.significant}</dd>
        </div>
        <div>
          <dt>How sure?</dt>
          <dd>{a.sure}</dd>
        </div>
      </dl>

      <Sparkline
        values={cell.annual}
        firstYear={cell.first_year}
        senPerDecade={cell.sen}
        units={info.units}
        colour={cell.sig ? directionColour(info.theme, cell.sen) : "#8a96a3"}
      />

      <p className="answer-cell">
        {cell.sig && cell.dir !== "flat" && `Changing faster than ${pct}% of the Philippines’ land squares. `}
        Based on one NASA data square of about {size.ns} × {size.ew} km (average{" "}
        {cell.mean.toFixed(info.digits)} {info.units}).
        {also && ` It also covers ${also}.`}
      </p>

      <div className="answer-actions">
        <button className="btn btn-primary" onClick={onEvidence}>
          See the evidence
        </button>
      </div>
    </section>
  );
}

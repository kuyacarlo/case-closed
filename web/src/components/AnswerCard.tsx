import type { OverviewCell, OverviewCode, Overview, RawPlace } from "../data";
import { slopePercentile } from "../data";
import { cellSizeKm } from "../grid";
import type { Place, VariableInfo } from "../types";
import { slopeColour } from "./colour";
import { Sparkline } from "./Sparkline";
import "./AnswerCard.css";

interface AnswerCardProps {
  place: Place;
  cell: OverviewCell | undefined;
  overview: Overview;
  code: OverviewCode;
  variables: VariableInfo[];
  towns: RawPlace[];
  onEvidence: () => void;
  onSwitch: (code: OverviewCode) => void;
}

const STATE_LABEL = {
  confirmed: "Clear trend",
  step: "Mostly a jump",
  not_yet: "No clear change",
  too_short: "Too short to call",
} as const;

function listTowns(towns: RawPlace[], exclude: string): string {
  const names = towns.map((t) => t.n).filter((n) => n !== exclude);
  if (names.length === 0) return "";
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

export function AnswerCard({ place, cell, overview, code, variables, towns, onEvidence, onSwitch }: AnswerCardProps) {
  const info = variables.find((v) => v.code === code);
  const units = info?.units ?? "";

  if (!cell) {
    return (
      <section className="answer-card card" aria-live="polite">
        <p className="eyebrow">{place.name}</p>
        <h2 className="answer-headline">This spot is mostly sea</h2>
        <p className="answer-body">
          Each case covers one NASA data square about 55 km across. Pick a square
          that covers land in the Philippines, or search for a town by name.
        </p>
      </section>
    );
  }

  const v = cell[code];
  const otherCode: OverviewCode = code === "T2M" ? "PRECTOTCORR" : "T2M";
  const other = cell[otherCode];
  const otherInfo = variables.find((x) => x.code === otherCode);
  const lastYear = overview.window[code][1];
  const totalChange = (v.sen * (lastYear - v.first_year)) / 10;
  const clear = v.state === "confirmed" || v.state === "step";
  const pct = slopePercentile(overview, code, v.sen);
  const size = cellSizeKm(cell.lat);
  const also = listTowns(towns, place.name);
  const verb = code === "T2M" ? (v.sen >= 0 ? "Warming" : "Cooling") : v.sen >= 0 ? "Getting wetter" : "Getting drier";

  return (
    <section className="answer-card card" aria-live="polite">
      <div className="answer-top">
        <div>
          <p className="eyebrow">
            {code === "T2M" ? "Temperature" : "Rainfall"} · {v.first_year}–{lastYear}
          </p>
          <p className="answer-place">{place.name}</p>
          {place.context && <p className="answer-context">{place.context}</p>}
        </div>
        <span className={`state-chip state-${v.state}`}>{STATE_LABEL[v.state]}</span>
      </div>

      <h2 className="answer-headline">{v.text}</h2>

      {clear ? (
        <p className="answer-body">
          {v.state === "step" && v.cp
            ? `Most of the change came as a jump around ${v.cp}. `
            : ""}
          That adds up to about{" "}
          <strong className="num">
            {totalChange >= 0 ? "+" : ""}
            {totalChange.toFixed(code === "T2M" ? 1 : 2)} {units}
          </strong>{" "}
          since {v.first_year}. {verb} faster than {pct}% of the Philippines’ land areas.
        </p>
      ) : (
        <p className="answer-body">
          The ups and downs from year to year are bigger than any steady change, so
          there’s no trend you could defend yet.
        </p>
      )}

      <Sparkline
        values={v.annual}
        firstYear={v.first_year}
        senPerDecade={v.sen}
        units={units}
        colour={clear ? slopeColour(code, v.sen > 0 ? 1e9 : -1e9) : "#8a96a3"}
      />

      <p className="answer-cell">
        Based on one NASA data square of about {size.ns} × {size.ew} km (average{" "}
        {v.mean.toFixed(1)} {units}).
        {also && ` It also covers ${also}.`}
      </p>

      <div className="answer-actions">
        <button className="btn btn-primary" onClick={onEvidence}>
          See the evidence
        </button>
        <button className="btn btn-outline" onClick={() => onSwitch(otherCode)}>
          {otherInfo?.label}: {STATE_LABEL[other.state].toLowerCase()}
        </button>
      </div>
    </section>
  );
}

import type { LayerCell } from "../data";
import { formatP, plainSource } from "../format";
import type { VariableInfo } from "../types";
import { directionColour } from "./colour";
import { Sparkline } from "./Sparkline";

export interface Witness {
  info: VariableInfo;
  cell: LayerCell;
}

interface WitnessPanelProps {
  main: Witness;
  second: Witness;
}

function agreement(a: LayerCell, b: LayerCell): string {
  if (a.sig && b.sig) {
    return a.dir === b.dir
      ? "Both witnesses agree: a significant trend in the same direction. The case is stronger."
      : "The witnesses disagree: significant trends in opposite directions. Treat the verdict with caution.";
  }
  if (a.sig || b.sig) {
    return a.dir === b.dir
      ? "Same direction, but only one witness is significant. Suggestive, not settled."
      : "Only one witness is significant, and they point different ways. The evidence is mixed.";
  }
  return a.dir === b.dir
    ? "Neither witness shows a significant trend, though both lean the same way."
    : "Neither witness shows a significant trend.";
}

/** Exhibit C: the same quantity measured another way, for the same square. */
export function WitnessPanel({ main, second }: WitnessPanelProps) {
  const rows = [main, second];
  return (
    <section className="section stack-md" id="exhibit-c">
      <h2>
        <span className="exhibit">Exhibit C</span> Call a second witness
      </h2>
      <p className="lead">
        The same thing, measured another way for the same square. If two independent
        sources agree, the case is stronger.
      </p>
      <div className="witness-grid">
        {rows.map(({ info, cell }) => (
          <article key={info.code} className="card witness-card">
            <p className="eyebrow">{info.label}</p>
            <p className="muted small">{plainSource(info.source)}</p>
            <p className="witness-verdict">{cell.text}</p>
            <p className="small num">
              {cell.first_year}–{cell.first_year + cell.annual.length - 1}, p = {formatP(cell.p)},{" "}
              {cell.sig ? "significant" : "not significant"}
            </p>
            <Sparkline
              values={cell.annual}
              firstYear={cell.first_year}
              senPerDecade={cell.sen}
              units={info.units}
              colour={cell.sig ? directionColour(info.theme, cell.sen) : "#8a96a3"}
            />
          </article>
        ))}
      </div>
      <p className="notice">{agreement(main.cell, second.cell)}</p>
    </section>
  );
}

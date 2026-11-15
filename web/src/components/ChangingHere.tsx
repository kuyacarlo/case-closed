import { useEffect, useState } from "react";
import { changingHere, loadCellsSummary, type ChangingRow } from "../data";
import type { CellCentre } from "../grid";
import type { VariableInfo } from "../types";
import { directionColour } from "./colour";

interface ChangingHereProps {
  cell: CellCentre;
  variables: VariableInfo[];
  current: string;
  onPick: (code: string) => void;
}

/** "What's changing here?": every variable for this square, significant first. */
export function ChangingHere({ cell, variables, current, onPick }: ChangingHereProps) {
  const [rows, setRows] = useState<ChangingRow[] | null>(null);

  useEffect(() => {
    let live = true;
    loadCellsSummary().then(
      (s) => live && setRows(changingHere(s, cell)),
      () => live && setRows([]),
    );
    return () => {
      live = false;
    };
  }, [cell]);

  if (!rows || rows.length === 0) return null;
  const sig = rows.filter((r) => r.significant).length;

  return (
    <section className="card changing-here" aria-labelledby="changing-here-title">
      <h3 id="changing-here-title">What’s changing here?</h3>
      <p className="muted small">
        {sig} of {rows.length} variables show a significant trend in this square. Pick one to
        investigate it.
      </p>
      <ul>
        {rows.map((r) => {
          const v = variables.find((x) => x.code === r.code);
          if (!v) return null;
          const arrow = r.dir === "rising" ? "▲" : r.dir === "falling" ? "▼" : "■";
          return (
            <li key={r.code}>
              <button
                type="button"
                className={r.code === current ? "is-on" : undefined}
                aria-pressed={r.code === current}
                onClick={() => onPick(r.code)}
              >
                <span
                  className="ch-arrow"
                  aria-hidden="true"
                  style={{ color: r.significant ? directionColour(v.theme, r.sen) : "#8a96a3" }}
                >
                  {arrow}
                </span>
                <span className="ch-label">{v.label}</span>
                <span className="ch-rate num">
                  {r.sen >= 0 ? "+" : "−"}
                  {Math.abs(r.sen).toFixed(v.digits)} {v.units}/decade
                </span>
                <span className={`ch-sig${r.significant ? " yes" : ""}`}>
                  {r.significant ? "significant" : "not significant"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

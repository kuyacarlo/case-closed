import type { IslandGroup, Layer, VarSummary } from "../data";
import type { VariableInfo } from "../types";
import { NOT_CLEAR, slopeColour } from "./colour";

interface MapLegendProps {
  layer: Layer;
  summary: VarSummary | undefined;
  info: VariableInfo;
  max: number;
  significantOnly: boolean;
  onSignificantOnly: (on: boolean) => void;
}

const GROUPS: IslandGroup[] = ["Luzon", "Visayas", "Mindanao"];

function mostlyIn(summary: VarSummary, key: "rising" | "falling"): string {
  const counts = GROUPS.map((g) => [g, summary.by_group[g][key]] as const).sort((a, b) => b[1] - a[1]);
  const [top, n] = counts[0];
  const total = counts.reduce((s, [, v]) => s + v, 0);
  if (!total) return "";
  return n / total >= 0.6 ? `, mostly in ${top}` : ", spread across the islands";
}

/** Explains the colours and answers "where is it changing, and which way?" */
export function MapLegend({ layer, summary, info, max, significantOnly, onSignificantOnly }: MapLegendProps) {
  const theme = info.theme;
  const stops = [-1, -0.5, 0, 0.5, 1].map((t) => slopeColour(theme, t * max, max));
  const [from, to] = layer.window;
  const d = info.digits;

  return (
    <div className="map-legend">
      <div className="legend-head">
        <p className="legend-title">
          {info.label}: change per decade, {from}–{to}
        </p>
        <label className="switch">
          <input
            type="checkbox"
            checked={significantOnly}
            onChange={(e) => onSignificantOnly(e.target.checked)}
          />
          Significant only
        </label>
      </div>
      <div className="legend-ramp" style={{ background: `linear-gradient(90deg, ${stops.join(",")})` }} />
      <div className="legend-ends num">
        <span>
          −{max.toFixed(d)} {info.units} falling
        </span>
        <span>+{max.toFixed(d)} rising</span>
      </div>
      <ul className="legend-keys">
        <li>
          <span className="key" style={{ background: stops[4] }} /> Significant trend
        </li>
        <li>
          <span className="key" style={{ background: stops[4], opacity: 0.35 }} /> Trend, not significant
        </li>
        <li>
          <span className="key key-dashed" /> Mostly one jump
        </li>
        <li>
          <span className="key" style={{ background: NOT_CLEAR, opacity: 0.6 }} /> Flat
        </li>
      </ul>

      {summary && (
        <div className="legend-where">
          <p>
            <strong>Where is it changing?</strong> Significant rises in{" "}
            <strong className="num">{summary.rising}</strong> squares
            {mostlyIn(summary, "rising")}; significant falls in{" "}
            <strong className="num">{summary.falling}</strong>
            {summary.falling ? mostlyIn(summary, "falling") : ""}; no significant trend in{" "}
            <span className="num">{summary.squares - summary.significant}</span>.
          </p>
          {summary.rising >= 3 && summary.falling >= 3 && (
            <p className="legend-opposite">
              Rising in some places and falling in others: the same climate can push a
              variable opposite ways in different regions.
            </p>
          )}
          <table className="legend-groups num">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">Rising</th>
                <th scope="col">Falling</th>
                <th scope="col">Not sig.</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <tr key={g}>
                  <th scope="row">{g}</th>
                  <td>{summary.by_group[g].rising}</td>
                  <td>{summary.by_group[g].falling}</td>
                  <td>{summary.by_group[g].not_sig}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="legend-note">
            Testing {summary.squares} squares at once means a few could look significant by
            luck. After correcting for that (Benjamini-Hochberg),{" "}
            {summary.significant_after_correction} of {summary.significant} still hold up.
          </p>
          {summary.data_break && from > summary.data_break.year && (
            <p className="legend-note">
              Our data-break check found a jump in this dataset in {summary.data_break.year}{" "}
              ({Math.round(summary.data_break.share * 100)}% of squares at once), so this map
              starts in {from}.
            </p>
          )}
          {!summary.data_break && info.first_year_note && <p className="legend-note">{info.first_year_note}</p>}
        </div>
      )}
    </div>
  );
}

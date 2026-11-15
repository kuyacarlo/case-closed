import type { Overview, OverviewCode } from "../data";
import { NOT_CLEAR, scaleMax, slopeColour } from "./colour";

interface MapLegendProps {
  overview: Overview;
  code: OverviewCode;
  units: string;
}

/** Explains colour (rate), faded squares (no clear trend) and dashed squares. */
export function MapLegend({ overview, code, units }: MapLegendProps) {
  const max = scaleMax(code);
  const s = overview.summary[code];
  const stops = [-1, -0.5, 0, 0.5, 1].map((t) => slopeColour(code, t * max));
  const [lowWord, highWord] = code === "T2M" ? ["cooling", "warming"] : ["drier", "wetter"];
  const [from, to] = overview.window[code];

  return (
    <div className="map-legend">
      <p className="legend-title">
        Change per decade, {from}–{to}
      </p>
      <div className="legend-ramp" style={{ background: `linear-gradient(90deg, ${stops.join(",")})` }} />
      <div className="legend-ends num">
        <span>
          −{max} {units} {lowWord}
        </span>
        <span>
          +{max} {highWord}
        </span>
      </div>
      <ul className="legend-keys">
        <li>
          <span className="key" style={{ background: stops[3] }} /> Clear trend (colour = rate)
        </li>
        <li>
          <span className="key" style={{ background: NOT_CLEAR, opacity: 0.6 }} /> No clear change
        </li>
        <li>
          <span className="key key-dashed" /> Mostly one jump
        </li>
      </ul>
      <p className="legend-note">
        {s.clear} of {s.cells} land squares show a clear change. Testing {s.cells} squares at
        once means a few could look clear by luck; after correcting for that,{" "}
        {s.clear_after_correction} still hold up.
      </p>
    </div>
  );
}

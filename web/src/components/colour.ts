// Diverging colour scales for the overview map and legend. Each theme has
// intuitive ends (warmer = red, wetter = teal, ...), and each variable's
// scale is set from its own spread of rates across the Philippines.
import type { Layer } from "../data";
import type { Theme } from "../types";

type RGB = [number, number, number];
const hex = (c: RGB) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;

const NEUTRAL: RGB = [246, 240, 230];
const ENDS: Record<Theme, { up: RGB; down: RGB }> = {
  heat: { up: [168, 40, 10], down: [29, 78, 216] }, // warmer red, cooler blue
  water: { up: [15, 118, 110], down: [140, 90, 30] }, // wetter teal, drier brown
  land: { up: [15, 118, 110], down: [140, 90, 30] },
  air: { up: [109, 40, 217], down: [180, 120, 10] }, // more violet, less amber
  sky: { up: [109, 40, 217], down: [180, 120, 10] },
};

/** Fill for "no clear direction" (essentially flat). */
export const NOT_CLEAR = "#b8c1ca";

/** A tidy scale limit: about the 90th percentile of |rate| across squares. */
export function scaleMax(layer: Layer): number {
  const abs = layer.cells.map((c) => Math.abs(c.sen)).sort((a, b) => a - b);
  const p90 = abs[Math.floor(abs.length * 0.9)] || 1;
  const mag = 10 ** Math.floor(Math.log10(p90));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) if (m * mag >= p90) return m * mag;
  return 10 * mag;
}

export function slopeColour(theme: Theme, sen: number, max: number): string {
  const e = ENDS[theme];
  const t = Math.max(-1, Math.min(1, sen / (max || 1)));
  return hex(t >= 0 ? mix(NEUTRAL, e.up, t) : mix(NEUTRAL, e.down, -t));
}

/** Full-strength colour for a direction, used for chips and sparklines. */
export function directionColour(theme: Theme, sen: number): string {
  return hex(sen >= 0 ? ENDS[theme].up : ENDS[theme].down);
}

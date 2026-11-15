// Diverging colour scales for the overview map and legend.
import type { OverviewCode } from "../data";

type RGB = [number, number, number];
const hex = (c: RGB) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;

const NEUTRAL: RGB = [250, 236, 214];
const SCALES: Record<OverviewCode, { neg: RGB; pos: RGB; max: number }> = {
  // Cooler = blue, warmer = brand orange-red.
  T2M: { neg: [29, 78, 216], pos: [168, 40, 10], max: 0.25 },
  // Drier = brown, wetter = teal.
  PRECTOTCORR: { neg: [140, 90, 30], pos: [15, 118, 110], max: 1.5 },
};

export function slopeColour(code: OverviewCode, sen: number): string {
  const s = SCALES[code];
  const t = Math.max(-1, Math.min(1, sen / s.max));
  return hex(t >= 0 ? mix(NEUTRAL, s.pos, t) : mix(NEUTRAL, s.neg, -t));
}

export function scaleMax(code: OverviewCode): number {
  return SCALES[code].max;
}

/** Fill for squares with no clear change, so colour always means "clear". */
export const NOT_CLEAR = "#b8c1ca";

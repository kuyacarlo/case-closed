// Types mirroring the backend /api/case contract.

export interface Cell {
  lat: number;
  lon: number;
  dlat: number;
  dlon: number;
}

export interface CaseMeta {
  variable: string;
  label: string;
  definition: string;
  units: string;
  source: string;
  lat: number;
  lon: number;
  /** POWER grid cell the case covers; null for point exports (NO2). */
  cell: Cell | null;
  /** Code of a variable that measures the same thing another way. */
  witness: string | null;
  start: string; // YYYY-MM
  end: string; // YYYY-MM
  n_months: number;
  baseline: string;
  from_cache: boolean;
  warnings: string[];
}

export interface SeriesPoint {
  t: string; // YYYY-MM
  value: number;
  climatology: number;
  anomaly: number;
}

export interface ChangePoint {
  year: number;
  p: number;
  mean_before: number;
  mean_after: number;
  slope_after_per_decade: number | null;
  step_dominated: boolean;
}

export interface Trend {
  sen_slope_per_decade: number;
  ols_slope_per_decade: number;
  ci95: number;
  p_naive: number;
  p_honest: number;
  lag1: number;
  n_eff: number;
  years_needed: number | null;
  changepoint: ChangePoint | null;
}

export type VerdictState = "confirmed" | "not_yet" | "too_short" | "step";

export type Direction = "rising" | "falling" | "flat";

/** Trend-first verdict: always says direction and size, then significance. */
export interface Verdict {
  state: VerdictState;
  direction: Direction;
  rate_per_decade: number;
  total_change: number;
  years: number;
  significant: boolean;
  p: number;
  headline: string;
  text: string;
  detail: string;
}

export interface CaseResponse {
  meta: CaseMeta;
  series: SeriesPoint[];
  trend: Trend;
  verdict: Verdict;
}

export type Theme = "heat" | "water" | "land" | "sky" | "air";

export interface VariableInfo {
  code: string;
  label: string;
  units: string;
  definition: string;
  source: string;
  theme: Theme;
  why_it_matters: string;
  digits: number;
  static_place: string | null;
  first_year: number;
  first_year_note: string | null;
}

/** A place the user can pick: from search, the map, or a featured case. */
export interface Place {
  name: string;
  /** "Benguet · CAR" style context line. */
  context: string;
  lat: number;
  lon: number;
}

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

export interface Verdict {
  state: VerdictState;
  text: string;
  detail: string;
}

export interface CaseResponse {
  meta: CaseMeta;
  series: SeriesPoint[];
  trend: Trend;
  verdict: Verdict;
}

export interface VariableInfo {
  code: string;
  label: string;
  units: string;
  definition: string;
  source: string;
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

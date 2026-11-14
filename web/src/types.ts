// Types mirroring the backend /api/case contract (HANDOFF).

export interface CaseMeta {
  variable: string;
  label: string;
  definition: string;
  units: string;
  source: string;
  lat: number;
  lon: number;
  start: string; // YYYY-MM
  end: string; // YYYY-MM
  n_months: number;
  warnings: string[];
}

export interface SeriesPoint {
  t: string; // YYYY-MM
  value: number;
  climatology: number;
  anomaly: number;
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
}

export type VerdictState = "confirmed" | "not_yet";

export interface Verdict {
  state: VerdictState;
  text: string;
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
}

// API client for the Case Closed backend. No silent fallback: if the API
// fails, the caller gets an error and shows it. Never show one place's data
// under another place's name.
import type { CaseResponse, VariableInfo } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export const FIRST_YEAR = 1981;
export const LAST_YEAR = 2025;
/** Below this the API refuses to call a trend (keep in step with verdict.py). */
export const MIN_YEARS_FOR_VERDICT = 20;

export interface CaseQuery {
  lat: number;
  lon: number;
  variable: string;
  start: number;
  end: number;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchCase(q: CaseQuery, signal?: AbortSignal): Promise<CaseResponse> {
  const params = new URLSearchParams({
    lat: String(q.lat),
    lon: String(q.lon),
    variable: q.variable,
    start: String(q.start),
    end: String(q.end),
  });
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/case?${params}`, { signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("We couldn't reach the data service.", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail ?? `Request failed (${res.status}).`, res.status);
  }
  return res.json();
}

/** Used until /api/variables answers; mirrors api/case_closed/variables.py. */
export const DEFAULT_VARIABLES: VariableInfo[] = [
  {
    code: "T2M",
    label: "Air temperature",
    units: "°C",
    definition: "How warm the air is 2 meters above the ground.",
    source: "NASA POWER · MERRA-2 reanalysis (model-based)",
    static_place: null,
    first_year: 1981,
    first_year_note: null,
  },
  {
    code: "PRECTOTCORR",
    label: "Rainfall",
    units: "mm/day",
    definition: "How much rain falls, averaged over each day of the month.",
    source: "NASA POWER · MERRA-2 reanalysis, bias-corrected (model-based)",
    static_place: null,
    first_year: 2000,
    first_year_note:
      "Rainfall is analysed from 2000. Before then the record jumps by about 50% across the whole country in 1999, which points to a change in the data, not the weather.",
  },
];

export async function fetchVariables(): Promise<VariableInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/api/variables`);
    if (!res.ok) throw new Error();
    const body = await res.json();
    return body.variables as VariableInfo[];
  } catch {
    return DEFAULT_VARIABLES;
  }
}

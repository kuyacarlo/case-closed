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
  /** Region-average case; when set, lat/lon only position the map. */
  area?: string;
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
    variable: q.variable,
    start: String(q.start),
    end: String(q.end),
  });
  if (q.area) params.set("area", q.area);
  else {
    params.set("lat", String(q.lat));
    params.set("lon", String(q.lon));
  }
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

/** Used until /api/variables answers (and if it fails); the API is the
 * source of truth for the full catalogue in api/case_closed/variables.py. */
export const DEFAULT_VARIABLES: VariableInfo[] = [
  {
    code: "T2M",
    label: "Air temperature",
    units: "\u00b0C",
    definition: "How warm the air is 2 meters above the ground, averaged over the month.",
    source: "NASA POWER · MERRA-2 reanalysis (model-based)",
    theme: "heat",
    why_it_matters: "The most direct sign of a warming climate.",
    digits: 2,
    static_place: null,
    first_year: 1981,
    first_year_note: null,
  },
];

export const DEFAULT_THEMES: Record<string, string> = {
  heat: "Heat",
  water: "Rain & water",
  land: "Land & farming",
  sky: "Sun & sky",
  air: "Air",
};

export async function fetchVariables(): Promise<{
  variables: VariableInfo[];
  themes: Record<string, string>;
  setAside: Record<string, string>;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/variables`);
    if (!res.ok) throw new Error();
    const body = await res.json();
    return {
      variables: body.variables as VariableInfo[],
      themes: body.themes ?? DEFAULT_THEMES,
      setAside: body.set_aside ?? {},
    };
  } catch {
    return { variables: DEFAULT_VARIABLES, themes: DEFAULT_THEMES, setAside: {} };
  }
}

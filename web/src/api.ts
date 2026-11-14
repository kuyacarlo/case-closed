// API client for the Case Closed backend. Falls back to the hard-coded demo
// case when the API is unreachable, so the screens always render (HANDOFF
// item 4: "frontend shell on a hard-coded response").
import type { CaseResponse, VariableInfo } from "./types";
import { MOCK_CASE } from "./mockCase";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export interface CaseQuery {
  lat: number;
  lon: number;
  variable: string;
  start: number;
  end: number;
}

export async function fetchCase(q: CaseQuery): Promise<CaseResponse> {
  const params = new URLSearchParams({
    lat: String(q.lat),
    lon: String(q.lon),
    variable: q.variable,
    start: String(q.start),
    end: String(q.end),
  });
  const res = await fetch(`${API_BASE}/api/case?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchCaseOrMock(q: CaseQuery): Promise<{
  data: CaseResponse;
  usedFallback: boolean;
}> {
  try {
    const data = await fetchCase(q);
    return { data, usedFallback: false };
  } catch {
    // Backend not running or point not available: serve the demo case so the
    // walkthrough still works. The demo is real NASA POWER Metro Manila data.
    return { data: MOCK_CASE, usedFallback: true };
  }
}

const DEFAULT_VARIABLES: VariableInfo[] = [
  {
    code: "T2M",
    label: "Air temperature",
    units: "\u00b0C",
    definition: "How warm the air is 2 meters above the ground.",
  },
  {
    code: "PRECTOTCORR",
    label: "Rainfall",
    units: "mm/day",
    definition: "How much rain falls, averaged over each day of the month.",
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

export { DEFAULT_VARIABLES };

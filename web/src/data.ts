// Static Philippines datasets built by tools/build_places.py and
// tools/build_ph_overview.py, served from web/public/data/.
import { cellKey, snap, type CellCentre } from "./grid";
import type { Place } from "./types";

export interface RawPlace {
  n: string; // display name
  o?: string; // original geoBoundaries name, when different
  k: "region" | "province" | "town";
  p?: string; // province (towns)
  r?: string; // region
  lat: number;
  lon: number;
}

export interface OverviewVar {
  sen: number;
  p: number;
  q: number;
  state: "confirmed" | "not_yet" | "too_short" | "step";
  text: string;
  cp: number | null;
  mean: number;
  first_year: number;
  annual: number[];
}

export interface OverviewCell {
  lat: number;
  lon: number;
  T2M: OverviewVar;
  PRECTOTCORR: OverviewVar;
}

export interface OverviewSummary {
  cells: number;
  clear: number;
  clear_after_correction: number;
  step: number;
  median_sen: number;
}

export interface Overview {
  built: string;
  source: string;
  window: Record<string, [number, number]>;
  summary: {
    T2M: OverviewSummary;
    PRECTOTCORR: OverviewSummary;
    rain_national_annual: { first_year: number; values: number[] };
  };
  cells: OverviewCell[];
}

export type OverviewCode = "T2M" | "PRECTOTCORR";

let placesPromise: Promise<RawPlace[]> | null = null;
let overviewPromise: Promise<Overview> | null = null;

export function loadPlaces(): Promise<RawPlace[]> {
  placesPromise ??= fetch("/data/ph_places.json")
    .then((r) => {
      if (!r.ok) throw new Error("places");
      return r.json();
    })
    .then((b) => b.places as RawPlace[]);
  return placesPromise;
}

export function loadOverview(): Promise<Overview> {
  overviewPromise ??= fetch("/data/ph_overview.json").then((r) => {
    if (!r.ok) throw new Error("overview");
    return r.json();
  });
  return overviewPromise;
}

/** Lower-case, strip accents and punctuation: "Las Piñas" -> "las pinas". */
export function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toPlace(p: RawPlace): Place {
  const context =
    p.k === "town"
      ? [p.p, p.r].filter(Boolean).join(" · ")
      : p.k === "province"
        ? `Province · ${p.r ?? ""}`
        : "Region";
  return { name: p.n, context, lat: p.lat, lon: p.lon };
}

const KIND_RANK = { town: 0, province: 1, region: 2 } as const;

/** Rank: exact > starts-with > word-starts-with > contains; towns first. */
export function searchPlaces(all: RawPlace[], query: string, limit = 8): RawPlace[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const scored: { p: RawPlace; s: number }[] = [];
  for (const p of all) {
    const names = [fold(p.n), p.o ? fold(p.o) : ""];
    let best = Infinity;
    for (const n of names) {
      if (!n) continue;
      // "City of Tagum" should match "tagum" as strongly as "Tagum City".
      const bare = n.replace(/^city of /, "").replace(/ city$/, "");
      if (n === q || bare === q) best = Math.min(best, 0);
      else if (n.startsWith(q) || bare.startsWith(q)) best = Math.min(best, 1);
      else if (n.split(" ").some((w) => w.startsWith(q))) best = Math.min(best, 2);
      else if (n.includes(q)) best = Math.min(best, 3);
    }
    if (best < Infinity) scored.push({ p, s: best * 10 + KIND_RANK[p.k] });
  }
  scored.sort((a, b) => a.s - b.s || a.p.n.localeCompare(b.p.n));
  return scored.slice(0, limit).map((x) => x.p);
}

/** Cities and municipalities whose representative point falls in this cell. */
export function townsInCell(all: RawPlace[], c: CellCentre): RawPlace[] {
  const key = cellKey(c);
  return all.filter((p) => p.k === "town" && cellKey(snap(p.lat, p.lon)) === key);
}

/** Nearest named town to a point, for naming a map tap. */
export function nearestTown(all: RawPlace[], lat: number, lon: number): RawPlace | null {
  let best: RawPlace | null = null;
  let bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const p of all) {
    if (p.k !== "town") continue;
    const d = (p.lat - lat) ** 2 + ((p.lon - lon) * k) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function overviewCell(ov: Overview, c: CellCentre): OverviewCell | undefined {
  const key = cellKey(c);
  return ov.cells.find((x) => cellKey(x) === key);
}

/** Share of PH land cells with a smaller slope than this one (0-100). */
export function slopePercentile(ov: Overview, code: OverviewCode, sen: number): number {
  const below = ov.cells.filter((c) => c[code].sen < sen).length;
  return Math.round((below / ov.cells.length) * 100);
}

// Static Philippines datasets built by tools/build_places.py and
// tools/build_ph_overview.py, served from web/public/data/.
import { cellKey, snap, type CellCentre } from "./grid";
import type { Place } from "./types";

export interface RawPlace {
  n: string; // display name
  o?: string; // original geoBoundaries name, when different
  k: "country" | "group" | "region" | "province" | "town";
  a?: string; // area id, for region-average cases
  p?: string; // province (towns)
  r?: string; // region
  g?: "Luzon" | "Visayas" | "Mindanao"; // island group (towns)
  lat: number;
  lon: number;
}

export type IslandGroup = "Luzon" | "Visayas" | "Mindanao";

/** One square in a variable's overview layer (tools/build_ph_overview.py). */
export interface LayerCell {
  lat: number;
  lon: number;
  g: IslandGroup;
  sen: number;
  p: number;
  q: number;
  state: "confirmed" | "not_yet" | "too_short" | "step";
  sig: boolean;
  dir: "rising" | "falling" | "flat";
  total: number;
  text: string;
  cp: number | null;
  mean: number;
  first_year: number;
  annual: number[];
}

export interface Layer {
  code: string;
  window: [number, number];
  cells: LayerCell[];
}

export interface GroupCounts {
  rising: number;
  falling: number;
  not_sig: number;
}

export interface VarSummary {
  window: [number, number];
  squares: number;
  significant: number;
  significant_after_correction: number;
  rising: number;
  falling: number;
  step: number;
  median_sen: number;
  by_group: Record<IslandGroup, GroupCounts>;
  data_break: { year: number; squares: number; share: number } | null;
}

export interface OverviewIndex {
  built: string;
  source: string;
  last_year: number;
  vars: Record<string, VarSummary>;
  rain_national_annual: { first_year: number; values: number[] };
}

/** cells.json: per square, every variable as [sen, significant, dir, state]. */
export interface CellsSummary {
  codes: string[];
  cells: { lat: number; lon: number; v: Record<string, [number, 0 | 1, "rising" | "falling" | "flat", string]> }[];
}

let placesPromise: Promise<RawPlace[]> | null = null;
let indexPromise: Promise<OverviewIndex> | null = null;
let cellsPromise: Promise<CellsSummary> | null = null;
const layerPromises = new Map<string, Promise<Layer>>();

function getJson<T>(url: string): Promise<T> {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(url);
    return r.json() as Promise<T>;
  });
}

export function loadPlaces(): Promise<RawPlace[]> {
  placesPromise ??= getJson<{ places: RawPlace[] }>("/data/ph_places.json").then((b) => b.places);
  return placesPromise;
}

export function loadIndex(): Promise<OverviewIndex> {
  indexPromise ??= getJson<OverviewIndex>("/data/overview/index.json");
  return indexPromise;
}

export function loadCellsSummary(): Promise<CellsSummary> {
  cellsPromise ??= getJson<CellsSummary>("/data/overview/cells.json");
  return cellsPromise;
}

/** One variable's map layer, fetched on demand and cached. */
export function loadLayer(code: string): Promise<Layer> {
  let p = layerPromises.get(code);
  if (!p) {
    p = getJson<Layer>(`/data/overview/${code}.json`);
    p.catch(() => layerPromises.delete(code));
    layerPromises.set(code, p);
  }
  return p;
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
      ? [p.p, p.r].filter(Boolean).join(", ")
      : p.k === "province"
        ? `Province, ${p.r ?? ""}, region average`
        : p.k === "region"
          ? "Region, region average"
          : p.k === "group"
            ? "Island group, region average"
            : "Whole country, national average";
  return { name: p.n, context, lat: p.lat, lon: p.lon, area: p.k === "town" ? undefined : p.a };
}

const KIND_RANK = { town: 0, province: 1, region: 2, group: 3, country: 4 } as const;

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

export function layerCell(layer: Layer, c: CellCentre): LayerCell | undefined {
  const key = cellKey(c);
  return layer.cells.find((x) => cellKey(x) === key);
}

/** Share of PH land squares changing more slowly (smaller |rate|) than this one. */
export function slopePercentile(layer: Layer, sen: number): number {
  const below = layer.cells.filter((c) => Math.abs(c.sen) < Math.abs(sen)).length;
  return Math.round((below / layer.cells.length) * 100);
}

export interface ChangingRow {
  code: string;
  sen: number;
  significant: boolean;
  dir: "rising" | "falling" | "flat";
  state: string;
}

/** Every variable for one square, significant first, then by how unusual the
 * rate is nationally (|rate| relative to that variable's median |rate|). */
export function changingHere(summary: CellsSummary, c: CellCentre): ChangingRow[] {
  const key = cellKey(c);
  const cell = summary.cells.find((x) => cellKey(x) === key);
  if (!cell) return [];
  const typical: Record<string, number> = {};
  for (const code of summary.codes) {
    const vals = summary.cells
      .map((x) => x.v[code]?.[0])
      .filter((v): v is number => v != null)
      .map(Math.abs)
      .sort((a, b) => a - b);
    typical[code] = vals[Math.floor(vals.length / 2)] || 1;
  }
  return Object.entries(cell.v)
    .map(([code, [sen, sig, d, state]]) => ({
      code,
      sen,
      significant: sig === 1,
      dir: d,
      state,
    }))
    .sort(
      (a, b) =>
        Number(b.significant) - Number(a.significant) ||
        Math.abs(b.sen) / typical[b.code] - Math.abs(a.sen) / typical[a.code],
    );
}

/** Region average: the same per-variable answers as a map square. */
export interface AreaSummary {
  id: string;
  name: string;
  kind: string;
  n_squares: number;
  squares: [number, number][];
  vars: Record<string, Omit<LayerCell, "lat" | "lon" | "g">>;
}

const areaPromises = new Map<string, Promise<AreaSummary>>();

export function loadArea(id: string): Promise<AreaSummary> {
  let p = areaPromises.get(id);
  if (!p) {
    p = getJson<AreaSummary>(`/data/areas/${encodeURIComponent(id)}.json`);
    p.catch(() => areaPromises.delete(id));
    areaPromises.set(id, p);
  }
  return p;
}

/** An area's answer for one variable, shaped like a map square. */
export function areaCell(area: AreaSummary, code: string, lat: number, lon: number): LayerCell | undefined {
  const v = area.vars[code];
  return v ? { ...v, lat, lon, g: "Luzon" } : undefined;
}

/** "What's changing here?" rows for an area. */
export function changingInArea(area: AreaSummary): ChangingRow[] {
  return Object.entries(area.vars)
    .map(([code, v]) => ({ code, sen: v.sen, significant: v.sig, dir: v.dir, state: v.state }))
    .sort((a, b) => Number(b.significant) - Number(a.significant) || a.code.localeCompare(b.code));
}

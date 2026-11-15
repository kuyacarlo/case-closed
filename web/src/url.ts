// App state <-> query string, so a case can be shared, bookmarked, refreshed
// and navigated with Back/Forward. No router library needed.
import type { Step } from "./components/Header";

export interface UrlState {
  step: Step | "methods";
  variable: string;
  lat?: number;
  lon?: number;
  place?: string;
  /** Area case (province / region / island group / whole country) id. */
  area?: string;
  start?: number;
  end?: number;
  /** The user's "does it look like a trend?" call. */
  guess?: Guess;
}

export type Guess = "rising" | "falling" | "none";

export function readUrl(): UrlState {
  const q = new URLSearchParams(window.location.search);
  const num = (k: string) => {
    const v = q.get(k);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const stepRaw = q.get("view");
  const step: UrlState["step"] =
    stepRaw === "evidence" ? 2 : stepRaw === "verdict" ? 3 : stepRaw === "methods" ? "methods" : 1;
  return {
    step,
    variable: q.get("var") ?? "T2M",
    lat: num("lat"),
    lon: num("lon"),
    place: q.get("place") ?? undefined,
    area: q.get("area") ?? undefined,
    start: num("start"),
    end: num("end"),
    guess: (["rising", "falling", "none"] as const).find((g) => g === q.get("guess")),
  };
}

export function writeUrl(s: UrlState, mode: "push" | "replace" = "push"): void {
  const q = new URLSearchParams();
  const view = s.step === 2 ? "evidence" : s.step === 3 ? "verdict" : s.step === "methods" ? "methods" : null;
  if (view) q.set("view", view);
  q.set("var", s.variable);
  if (s.lat != null && s.lon != null) {
    q.set("lat", s.lat.toFixed(4));
    q.set("lon", s.lon.toFixed(4));
  }
  if (s.place) q.set("place", s.place);
  if (s.area) q.set("area", s.area);
  if (s.start != null) q.set("start", String(s.start));
  if (s.end != null) q.set("end", String(s.end));
  if (s.guess) q.set("guess", s.guess);
  const url = `${window.location.pathname}?${q}`;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

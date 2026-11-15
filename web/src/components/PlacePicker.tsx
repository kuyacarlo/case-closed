import { useEffect, useMemo, useState } from "react";
import { loadPlaces, toPlace, type RawPlace } from "../data";
import type { Place } from "../types";
import { PlaceSearch } from "./PlaceSearch";
import "./PlacePicker.css";

interface PlacePickerProps {
  onPick: (place: Place) => void;
  /** Id of the first control, so other parts of the page can focus it. */
  inputId?: string;
}

const GROUPS = ["Luzon", "Visayas", "Mindanao"] as const;
const WHOLE = "__whole__";

/**
 * Choose a region the way people think about places: island group → region
 * → province → city or municipality, as plain dropdowns. Each choice applies
 * straight away at that level (a region or province gives a region average,
 * a town gives its own NASA square). "Search by name" stays as an option.
 */
export function PlacePicker({ onPick, inputId = "region-search" }: PlacePickerProps) {
  const [all, setAll] = useState<RawPlace[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<"browse" | "search">("browse");
  const [region, setRegion] = useState("");
  const [province, setProvince] = useState("");
  const [town, setTown] = useState("");

  useEffect(() => {
    loadPlaces().then(setAll, () => setFailed(true));
  }, []);

  // Island group of each region, from its towns.
  const regionGroup = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of all ?? []) if (p.k === "town" && p.r && p.g) m.set(p.r, p.g);
    return m;
  }, [all]);

  const byName = (a: RawPlace, b: RawPlace) => a.n.localeCompare(b.n);
  const country = all?.find((p) => p.k === "country");
  const groups = (all ?? []).filter((p) => p.k === "group");
  const regions = (all ?? []).filter((p) => p.k === "region").sort(byName);
  const provinces = (all ?? []).filter((p) => p.k === "province" && p.r === region).sort(byName);
  const towns = (all ?? [])
    .filter((p) => p.k === "town" && p.p === province)
    .sort(byName);

  function chooseRegion(v: string) {
    setRegion(v);
    setProvince("");
    setTown("");
    if (v === WHOLE && country) return onPick(toPlace(country));
    const g = groups.find((x) => `group:${x.n}` === v);
    if (g) return onPick(toPlace(g));
    const r = regions.find((x) => x.n === v);
    if (r) onPick(toPlace(r));
  }

  function chooseProvince(v: string) {
    setProvince(v);
    setTown("");
    const p = provinces.find((x) => x.n === v);
    if (p) onPick(toPlace(p));
    else {
      const r = regions.find((x) => x.n === region);
      if (r) onPick(toPlace(r));
    }
  }

  function chooseTown(v: string) {
    setTown(v);
    const t = towns.find((x) => x.n === v);
    if (t) onPick(toPlace(t));
    else {
      const p = provinces.find((x) => x.n === province);
      if (p) onPick(toPlace(p));
    }
  }

  const isRegion = region && region !== WHOLE && !region.startsWith("group:");

  return (
    <div className="place-picker">
      <div className="pp-tabs" role="tablist" aria-label="How to choose a place">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "browse"}
          className={mode === "browse" ? "is-on" : undefined}
          onClick={() => setMode("browse")}
        >
          Choose from a list
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "search"}
          className={mode === "search" ? "is-on" : undefined}
          onClick={() => setMode("search")}
        >
          Search by name
        </button>
      </div>

      {mode === "search" ? (
        <PlaceSearch onPick={onPick} inputId="place-search" autoFocus />
      ) : (
        <div className="pp-selects">
          {failed && <p className="inline-error">Place names didn’t load. You can still tap the map.</p>}
          <label className="pp-field" htmlFor={inputId}>
            <span>Region</span>
            <select id={inputId} value={region} onChange={(e) => chooseRegion(e.target.value)} disabled={!all}>
              <option value="">{all ? "Choose a region…" : "Loading places…"}</option>
              <option value={WHOLE}>Whole Philippines (national average)</option>
              <optgroup label="Island groups">
                {GROUPS.map((g) => (
                  <option key={g} value={`group:${g}`}>
                    All of {g}
                  </option>
                ))}
              </optgroup>
              {GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {regions
                    .filter((r) => regionGroup.get(r.n) === g)
                    .map((r) => (
                      <option key={r.n} value={r.n}>
                        {r.n}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="pp-field" htmlFor={`${inputId}-province`}>
            <span>Province</span>
            <select
              id={`${inputId}-province`}
              value={province}
              onChange={(e) => chooseProvince(e.target.value)}
              disabled={!isRegion}
            >
              <option value="">{isRegion ? "Whole region (or choose a province…)" : "Choose a region first"}</option>
              {provinces.map((p) => (
                <option key={p.n} value={p.n}>
                  {p.n}
                </option>
              ))}
            </select>
          </label>

          <label className="pp-field" htmlFor={`${inputId}-town`}>
            <span>City or municipality</span>
            <select
              id={`${inputId}-town`}
              value={town}
              onChange={(e) => chooseTown(e.target.value)}
              disabled={!province}
            >
              <option value="">{province ? "Whole province (or choose a town…)" : "Choose a province first"}</option>
              {towns.map((t) => (
                <option key={`${t.n}-${t.lat}`} value={t.n}>
                  {t.n}
                </option>
              ))}
            </select>
          </label>

          <p className="pp-hint muted small">
            A region or province gives the average of its NASA squares. A city or
            municipality gives its own square. Or tap the map.
          </p>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";
import { AnswerCard } from "../components/AnswerCard";
import { MapLegend } from "../components/MapLegend";
import { PhMap } from "../components/PhMap";
import { PlaceSearch } from "../components/PlaceSearch";
import type { Overview, OverviewCell, OverviewCode, RawPlace } from "../data";
import type { CellCentre } from "../grid";
import type { Place, VariableInfo } from "../types";
import "./Screens.css";

interface ExploreProps {
  variables: VariableInfo[];
  code: OverviewCode;
  onCode: (code: OverviewCode) => void;
  overview: Overview | null;
  overviewFailed: boolean;
  place: Place | null;
  cell: CellCentre | null;
  overviewCell: OverviewCell | undefined;
  towns: RawPlace[];
  onPlace: (place: Place) => void;
  onMapPick: (lat: number, lon: number) => void;
  onEvidence: () => void;
  onFeatured: (id: "manila-heat" | "manila-no2") => void;
  onMethods: (anchor?: string) => void;
}

const TOGGLE: { code: OverviewCode; label: string }[] = [
  { code: "T2M", label: "Temperature" },
  { code: "PRECTOTCORR", label: "Rainfall" },
];

export function Explore(props: ExploreProps) {
  const { variables, code, onCode, overview, overviewFailed, place, cell, overviewCell, towns } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const units = variables.find((v) => v.code === code)?.units ?? "";

  // After a map tap on a phone, bring the answer into view.
  useEffect(() => {
    if (place && window.matchMedia("(max-width: 900px)").matches) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [place]);

  return (
    <div className="container stack-lg">
      <section className="hero hero-compact stack-sm">
        <p className="eyebrow">Earth System Trend Detective · Philippines</p>
        <h1 className="h1-explore">Is the climate where you live changing?</h1>
        <p className="lead">
          Search your town or tap the map. You get a plain answer from decades of NASA
          data, and the evidence behind it.
        </p>
      </section>

      <div className="explore-grid">
        <div className="explore-panel stack-md">
          <PlaceSearch onPick={props.onPlace} />

          <fieldset className="toggle" aria-label="What to check">
            {TOGGLE.map((t) => (
              <label key={t.code} className={code === t.code ? "is-on" : undefined}>
                <input
                  type="radio"
                  name="topic"
                  value={t.code}
                  checked={code === t.code}
                  onChange={() => onCode(t.code)}
                />
                {t.label}
              </label>
            ))}
          </fieldset>

          <div ref={cardRef}>
            {place && overview ? (
              <AnswerCard
                place={place}
                cell={overviewCell}
                overview={overview}
                code={code}
                variables={variables}
                towns={towns}
                onEvidence={props.onEvidence}
                onSwitch={onCode}
              />
            ) : (
              <div className="card explore-empty">
                <h2>Start with a place</h2>
                <p>
                  Every coloured square on the map is one NASA data square, about 55 km
                  across. Its colour shows how fast {code === "T2M" ? "temperature" : "rainfall"}{" "}
                  has been changing there.
                </p>
                {overviewFailed && (
                  <p className="inline-error">
                    The map data didn’t load. Search still works; refresh to try the map again.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="explore-map stack-sm">
          <PhMap
            overview={overview}
            code={code}
            selected={cell}
            onPick={props.onMapPick}
            label="Map of the Philippines. Tap a square to see its answer, or use the search box."
          />
          {overview && <MapLegend overview={overview} code={code} units={units} />}
        </div>
      </div>

      <section className="section stack-md">
        <h2>Featured cases</h2>
        <div className="card-row">
          <article className="card stack-sm">
            <p className="eyebrow">Case 01 · Temperature</p>
            <h3 className="case-title">Is Metro Manila getting hotter?</h3>
            <p className="case-detail">45 years of NASA POWER data, 1981 to 2025.</p>
            <button className="btn btn-primary" onClick={() => props.onFeatured("manila-heat")}>
              Open case
            </button>
          </article>
          <article className="card stack-sm">
            <p className="eyebrow">Case 02 · A faulty witness</p>
            <h3 className="case-title">Why rainfall starts in 2000</h3>
            <p className="case-detail">
              In 1999 the rainfall record jumps about 50% across the whole country at
              once. We caught it, and here’s why we don’t trust it.
            </p>
            <button className="btn btn-outline" onClick={() => props.onMethods("rain-break")}>
              Read the case file
            </button>
          </article>
          <article className="card stack-sm">
            <p className="eyebrow">
              Case 03 · Air quality <span className="chip-short">Short record</span>
            </p>
            <h3 className="case-title">Did Manila’s air get cleaner?</h3>
            <p className="case-detail">
              Nitrogen dioxide from the Sentinel-5P satellite (ESA), 2018 to 2024. Only 7
              years, so watch how the verdict handles it.
            </p>
            <button className="btn btn-outline" onClick={() => props.onFeatured("manila-no2")}>
              Open case
            </button>
          </article>
        </div>
      </section>

      <footer className="section footer-note">
        Temperature and rainfall: NASA POWER, MERRA-2 reanalysis (model-based). NO₂:
        Sentinel-5P TROPOMI (ESA/Copernicus). Boundaries: geoBoundaries (CC BY 3.0 IGO).{" "}
        <button className="link-btn" onClick={() => props.onMethods()}>
          How it works
        </button>
      </footer>
    </div>
  );
}

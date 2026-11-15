import { useEffect, useRef } from "react";
import { AnswerCard } from "../components/AnswerCard";
import { ChangingHere } from "../components/ChangingHere";
import { MapLegend } from "../components/MapLegend";
import { PhMap } from "../components/PhMap";
import { PlaceSearch } from "../components/PlaceSearch";
import { ThemePicker } from "../components/ThemePicker";
import { scaleMax } from "../components/colour";
import type { Layer, LayerCell, RawPlace, VarSummary } from "../data";
import type { CellCentre } from "../grid";
import type { Place, Theme, VariableInfo } from "../types";
import "./Screens.css";

export type DemoId = "manila" | "not-yet";

interface ExploreProps {
  variables: VariableInfo[];
  themes: Record<string, string>;
  theme: Theme;
  code: string;
  onTheme: (t: Theme) => void;
  onCode: (code: string) => void;
  layer: Layer | null;
  summary: VarSummary | undefined;
  layerFailed: boolean;
  place: Place | null;
  cell: CellCentre | null;
  layerCell: LayerCell | undefined;
  towns: RawPlace[];
  significantOnly: boolean;
  onSignificantOnly: (on: boolean) => void;
  onPlace: (place: Place) => void;
  onMapPick: (lat: number, lon: number) => void;
  onEvidence: () => void;
  onFeatured: (id: "manila-no2") => void;
  onDemo: (id: DemoId) => void;
  onMethods: (anchor?: string) => void;
}

export function Explore(props: ExploreProps) {
  const { variables, code, layer, place, cell, layerCell, towns } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const info = variables.find((v) => v.code === code) ?? variables[0];
  const max = layer ? scaleMax(layer) : 1;

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
        <h1 className="h1-explore">What’s changing where you live?</h1>
        <p className="lead">
          Pick something to investigate and a place. We test decades of NASA data and tell
          you if there’s a trend, how big it is, and whether it’s significant.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary demo-btn" onClick={() => props.onDemo("manila")}>
            ▶ Watch a 1-minute demo
          </button>
        </div>
      </section>

      <div className="explore-grid">
        <div className="explore-panel stack-md">
          <ThemePicker
            variables={variables}
            themes={props.themes}
            theme={props.theme}
            code={code}
            onTheme={props.onTheme}
            onCode={props.onCode}
          />
          {info && <p className="definition-box small">{info.definition}</p>}

          <div className="where-step">
            <p className="field">2 · Where?</p>
            <PlaceSearch onPick={props.onPlace} />
          </div>

          <div ref={cardRef} className="stack-md">
            <p className="field">3 · The answer</p>
            {place && layer && info ? (
              <>
                <AnswerCard
                  place={place}
                  cell={layerCell}
                  layer={layer}
                  info={info}
                  towns={towns}
                  onEvidence={props.onEvidence}
                />
                {cell && (
                  <ChangingHere cell={cell} variables={variables} current={code} onPick={props.onCode} />
                )}
              </>
            ) : (
              <div className="card explore-empty">
                <h2>Pick a place</h2>
                <p>
                  Search above or tap a square on the map. Each square is one NASA data
                  square, about 55 km across. Its colour shows which way{" "}
                  {info?.label.toLowerCase()} has been changing there, and how fast.
                </p>
                {props.layerFailed && (
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
            layer={layer}
            theme={info?.theme ?? "heat"}
            max={max}
            significantOnly={props.significantOnly}
            selected={cell}
            onPick={props.onMapPick}
            label="Map of the Philippines. Tap a square to see its answer, or use the search box."
          />
          {layer && info && (
            <MapLegend
              layer={layer}
              summary={props.summary}
              info={info}
              max={max}
              significantOnly={props.significantOnly}
              onSignificantOnly={props.onSignificantOnly}
            />
          )}
        </div>
      </div>

      <section className="section stack-md">
        <h2>Featured cases</h2>
        <div className="card-row featured-cases">
          <article className="card stack-sm">
            <p className="eyebrow">Demo · A significant trend</p>
            <h3 className="case-title">Is Metro Manila getting hotter?</h3>
            <p className="case-detail">
              Follow a full investigation: the raw data, removing the seasons, the trend,
              and the honest significance test.
            </p>
            <button className="btn btn-outline" onClick={() => props.onDemo("manila")}>
              ▶ Watch the demo
            </button>
          </article>
          <article className="card stack-sm">
            <p className="eyebrow">Demo · Not significant yet</p>
            <h3 className="case-title">A trend that needs more years</h3>
            <p className="case-detail">
              Tuguegarao’s average temperature rises a little, but not significantly. See
              why, and what is changing clearly there.
            </p>
            <button className="btn btn-outline" onClick={() => props.onDemo("not-yet")}>
              ▶ Watch the demo
            </button>
          </article>
          <article className="card stack-sm">
            <p className="eyebrow">Case · A faulty witness</p>
            <h3 className="case-title">The 1999 data break</h3>
            <p className="case-detail">
              Rainfall, evaporation and soil moisture all jump in 1999 across the whole
              country at once. Our break detector caught it.
            </p>
            <button className="btn btn-outline" onClick={() => props.onMethods("rain-break")}>
              Read the case file
            </button>
          </article>
          <article className="card stack-sm">
            <p className="eyebrow">
              Case · Air quality <span className="chip-short">Short record</span>
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
        Data: NASA POWER (MERRA-2 reanalysis; CERES SYN1deg for sunlight and cloud).
        NO₂: Sentinel-5P TROPOMI (ESA/Copernicus). Boundaries: geoBoundaries (CC BY 3.0 IGO).{" "}
        <button className="link-btn" onClick={() => props.onMethods()}>
          How it works
        </button>
      </footer>
    </div>
  );
}

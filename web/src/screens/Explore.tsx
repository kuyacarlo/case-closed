import { useEffect, useRef } from "react";
import { AnswerCard } from "../components/AnswerCard";
import { ChangingHere } from "../components/ChangingHere";
import { MapLegend } from "../components/MapLegend";
import { PhMap } from "../components/PhMap";
import { PeriodPicker } from "../components/PeriodPicker";
import { PlacePicker } from "../components/PlacePicker";
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
  highlight: [number, number][] | null;
  /** Set when a header step was clicked before any place was picked. */
  needPlace?: boolean;
  areaSquares?: number;
  changingRows?: import("../data").ChangingRow[];
  period: { start: number; end: number };
  periodMin: number;
  periodMax: number;
  onPeriod: (start: number, end: number) => void;
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
      <section className="hero-case">
        <div className="hero-case-text stack-sm">
          <img className="hero-mark" src="/logo-mark-on-dark.svg" width={44} height={44} alt="" />
          <h1 className="h1-explore">What’s changing where you live?</h1>
          <p className="lead">
            Pick something to investigate and a place. We test decades of NASA data and tell
            you if there’s a trend, how big it is, and whether it’s significant.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary demo-btn" onClick={() => props.onDemo("manila")}>
              <svg className="play-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 1v10l9-5Z" fill="currentColor" /></svg>{" "}
              Watch a 1-minute demo
            </button>
          </div>
        </div>
        <figure className="hero-photo">
          <img
            src="/photos/philippines-viirs-2022-04-18.jpg"
            width={1200}
            height={900}
            alt="The Philippines seen from orbit on a mostly clear day, with scattered cloud over the islands."
          />
          <figcaption>The Philippines, 18 April 2022. NASA Worldview, Suomi NPP VIIRS.</figcaption>
        </figure>
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
            <p className="field">Region: where?</p>
            {props.needPlace && (
              <p className="notice small" role="status">
                Pick a place first: choose one below or tap the map. Then the time series and
                the significance test are one click away.
              </p>
            )}
            <PlacePicker onPick={props.onPlace} inputId="region-search" />
          </div>

          <PeriodPicker
            idPrefix="home-period"
            label="Time period"
            min={props.periodMin}
            max={props.periodMax}
            start={props.period.start}
            end={props.period.end}
            onChange={props.onPeriod}
          />

          <div ref={cardRef} className="stack-md">
            <p className="field">Quick answer (full record)</p>
            {place &&
              (props.period.start !== props.periodMin || props.period.end !== props.periodMax) && (
                <p className="notice small">
                  The map and this quick answer use the full record ({props.periodMin}–
                  {props.periodMax}). Your time series will use {props.period.start}–
                  {props.period.end}.
                </p>
              )}
            {place && (layer || props.areaSquares) && info ? (
              <>
                <AnswerCard
                  place={place}
                  cell={layerCell}
                  layer={layer ?? { code, window: [props.periodMin, props.periodMax], cells: [] }}
                  info={info}
                  towns={towns}
                  areaSquares={props.areaSquares}
                  onEvidence={props.onEvidence}
                />
                {(cell || props.changingRows) && (
                  <ChangingHere
                    cell={cell}
                    rows={props.changingRows}
                    variables={variables}
                    current={code}
                    onPick={props.onCode}
                  />
                )}
              </>
            ) : (
              <div className="card explore-empty">
                <svg className="empty-art" viewBox="0 0 150 96" aria-hidden="true">
                  <g className="empty-art-grid">
                    <rect x="8" y="8" width="22" height="22" rx="3" className="sq-2" />
                    <rect x="34" y="8" width="22" height="22" rx="3" className="sq-3" />
                    <rect x="60" y="8" width="22" height="22" rx="3" className="sq-1" />
                    <rect x="8" y="34" width="22" height="22" rx="3" className="sq-1" />
                    <rect x="34" y="34" width="22" height="22" rx="3" className="sq-4" />
                    <rect x="60" y="34" width="22" height="22" rx="3" className="sq-3" />
                    <rect x="86" y="34" width="22" height="22" rx="3" className="sq-2" />
                    <rect x="34" y="60" width="22" height="22" rx="3" className="sq-0" />
                    <rect x="60" y="60" width="22" height="22" rx="3" className="sq-2" />
                    <rect x="86" y="60" width="22" height="22" rx="3" className="sq-1" />
                  </g>
                  <g className="empty-art-glass">
                    <circle cx="84" cy="44" r="25" />
                    <path d="M102 62 L130 88" />
                    <path className="empty-art-trend" d="M68 54 L78 44 L86 50 L100 32" />
                  </g>
                </svg>
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
            highlight={props.highlight}
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
            <figure className="case-photo">
              <img src="/photos/manila-viirs-2024-04-24.jpg" width={640} height={480} loading="lazy" alt="Metro Manila and Manila Bay from orbit, with small clouds over the land." />
              <figcaption>Metro Manila, 24 April 2024. NASA Worldview, Suomi NPP VIIRS.</figcaption>
            </figure>
            <h3 className="case-title">Is Metro Manila getting hotter?</h3>
            <p className="case-detail">
              Follow a full investigation: the raw data, removing the seasons, the trend,
              and the honest significance test.
            </p>
            <button className="btn btn-outline" onClick={() => props.onDemo("manila")}>
              <svg className="play-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 1v10l9-5Z" fill="currentColor" /></svg>{" "}
              Watch the demo
            </button>
          </article>
          <article className="card stack-sm">
            <figure className="case-photo">
              <img src="/photos/cagayan-viirs-2024-04-24.jpg" width={640} height={480} loading="lazy" alt="Northern Luzon from orbit, with the Cagayan Valley between two mountain ranges." />
              <figcaption>Cagayan Valley, 24 April 2024. NASA Worldview, Suomi NPP VIIRS.</figcaption>
            </figure>
            <h3 className="case-title">A trend that needs more years</h3>
            <p className="case-detail">
              Tuguegarao’s average temperature rises a little, but not significantly. See
              why, and what is changing clearly there.
            </p>
            <button className="btn btn-outline" onClick={() => props.onDemo("not-yet")}>
              <svg className="play-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 1v10l9-5Z" fill="currentColor" /></svg>{" "}
              Watch the demo
            </button>
          </article>
          <article className="card stack-sm">
            <figure className="case-photo">
              <img src="/photos/monsoon-viirs-2024-08-20.jpg" width={640} height={480} loading="lazy" alt="Thick monsoon cloud covering most of Luzon, seen from orbit." />
              <figcaption>Monsoon cloud over Luzon, 20 August 2024. NASA Worldview, Suomi NPP VIIRS.</figcaption>
            </figure>
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
            <figure className="case-photo">
              <img src="/photos/manila-night-black-marble-2016.jpg" width={640} height={480} loading="lazy" alt="City lights of Metro Manila at night, seen from orbit." />
              <figcaption>Metro Manila at night, 2016. NASA Earth Observatory, Black Marble.</figcaption>
            </figure>
            <h3 className="case-title">Did Manila’s air get cleaner?</h3>
            <p className="case-detail">
              Nitrogen dioxide from NASA’s OMI satellite, 2005 to 2025: 21 years, long
              enough to test. Try it for any city on the map too.
            </p>
            <button className="btn btn-outline" onClick={() => props.onFeatured("manila-no2")}>
              Open case
            </button>
          </article>
        </div>
      </section>

      <footer className="section site-footer">
        <div className="footer-lockup">
          <img src="/logo-mark.svg" width={40} height={40} alt="" />
          <div>
            <p className="footer-name">Case Closed</p>
            <p className="footer-by">
              An Earth System Trend Detective for the Philippines, by team Earth Detectives.
              Made in Manila for the NASA Space Apps Challenge 2026.
            </p>
          </div>
        </div>
        <p className="footer-note">
          Data: NASA GPM IMERG, GLDAS, Aura OMI and Aqua AIRS via Giovanni; NASA POWER
          (MERRA-2 reanalysis; CERES SYN1deg for sunlight and cloud). Manila NO₂ also from
          Sentinel-5P TROPOMI (ESA/Copernicus). Boundaries: geoBoundaries (CC BY 3.0 IGO).
          Satellite photos courtesy of NASA Worldview (EOSDIS) and NASA Earth Observatory.{" "}
          <button className="link-btn" onClick={() => props.onMethods()}>
            How it works
          </button>
        </p>
      </footer>
    </div>
  );
}

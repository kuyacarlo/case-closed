import { useRef, useState } from "react";
import type { VariableInfo } from "../types";
import type { CaseQuery } from "../api";
import "./Screens.css";

interface OpenCaseProps {
  variables: VariableInfo[];
  onOpenCase: (q: CaseQuery, question: string) => void;
}

// Prepared demo places. CASE 01 is the validated Metro Manila air-temp case.
const MANILA: CaseQuery = {
  lat: 14.6,
  lon: 121.0,
  variable: "T2M",
  start: 1981,
  end: 2024,
};

// CASE 02: Sentinel-5P NO2 over Metro Manila (2018-2024), served from a
// bundled JSON exported from Google Earth Engine.
const MANILA_NO2: CaseQuery = {
  lat: 14.6,
  lon: 121.0,
  variable: "NO2",
  start: 2018,
  end: 2024,
};

// A small city list stands in for the Leaflet picker (item 8, out of MVP).
const PLACES: Record<string, { lat: number; lon: number }> = {
  "Metro Manila": { lat: 14.6, lon: 121.0 },
  "Cebu City": { lat: 10.32, lon: 123.9 },
  "Davao City": { lat: 7.07, lon: 125.6 },
  "Baguio City": { lat: 16.41, lon: 120.6 },
  "Iloilo City": { lat: 10.72, lon: 122.56 },
};

export function OpenCase({ variables, onOpenCase }: OpenCaseProps) {
  const [variable, setVariable] = useState(variables[0]?.code ?? "T2M");
  const [place, setPlace] = useState("Metro Manila");
  const formRef = useRef<HTMLDivElement>(null);

  const selectedVar = variables.find((v) => v.code === variable) ?? variables[0];

  function openOwn() {
    const coord = PLACES[place];
    const q =
      variable === "T2M"
        ? `Is ${place} getting hotter?`
        : variable === "PRECTOTCORR"
          ? `Is ${place} getting wetter?`
          : `Is ${place}'s ${selectedVar?.label.toLowerCase()} changing?`;
    onOpenCase({ lat: coord.lat, lon: coord.lon, variable, start: 1981, end: 2024 }, q);
  }

  // Own-case picker offers only live (POWER) variables; static cases such as
  // NO2 are Manila-only prepared cases, offered as Case 02 above.
  const ownCaseVariables = variables.filter((v) => v.code !== "NO2");

  return (
    <div className="container stack-lg">
      <section className="hero stack-md">
        <p className="eyebrow">Earth System Trend Detective</p>
        <h1 className="h1-home">Is your climate actually changing?</h1>
        <p className="lead">
          Pick a case. Check the evidence from NASA data. Get a verdict you can
          defend, with an honest answer about how sure we are.
        </p>
      </section>

      <section className="section stack-md">
        <h2>Open a prepared case</h2>
        <div className="card-row">
          <article className="card stack-sm">
            <p className="eyebrow">Case 01 · Air temperature</p>
            <h3 className="case-title">Is Metro Manila getting hotter?</h3>
            <p className="case-detail">
              NASA POWER, 1981 to 2024. 528 months of evidence.
            </p>
            <button
              className="btn btn-primary"
              onClick={() =>
                onOpenCase(MANILA, "Is Metro Manila getting hotter?")
              }
            >
              Open case
            </button>
          </article>

          <article className="card stack-sm">
            <p className="eyebrow">Case 02 · Nitrogen dioxide</p>
            <h3 className="case-title">Did Manila's air get cleaner?</h3>
            <p className="case-detail">
              Satellite NO<sub>2</sub>, 2018 to 2024. 79 months of evidence.
            </p>
            <button
              className="btn btn-primary"
              onClick={() =>
                onOpenCase(MANILA_NO2, "Did Manila's air get cleaner?")
              }
            >
              Open case
            </button>
          </article>

          <article className="card stack-sm">
            <p className="eyebrow">Case 03 · Your choice</p>
            <h3 className="case-title">What about your hometown?</h3>
            <p className="case-detail">
              Pick a place and a variable, open your own case.
            </p>
            <button
              className="btn btn-outline"
              onClick={() =>
                formRef.current?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Choose a place
            </button>
          </article>
        </div>
      </section>

      <section className="section stack-md" ref={formRef}>
        <h2>Open your own case</h2>
        <div className="card own-case stack-md">
          <div className="own-case-grid">
            <div>
              <label className="field" htmlFor="topic">
                Topic
              </label>
              <select
                id="topic"
                value={variable}
                onChange={(e) => setVariable(e.target.value)}
              >
                {ownCaseVariables.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field" htmlFor="place">
                Place
              </label>
              <select
                id="place"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
              >
                {Object.keys(PLACES).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="own-case-action">
              <button className="btn btn-primary" onClick={openOwn}>
                Open case
              </button>
            </div>
          </div>
          {selectedVar && (
            <p className="definition-box">
              <strong>{selectedVar.label}:</strong> {selectedVar.definition}
            </p>
          )}
        </div>
      </section>

      <footer className="section footer-note">
        Data: NASA POWER, built on MERRA-2 and CERES. Values are model-based.
      </footer>
    </div>
  );
}

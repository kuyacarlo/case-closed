import { useRef, useState } from "react";
import type { VariableInfo } from "../types";
import { fetchCase, type CaseQuery } from "../api";
import { formatP, signed } from "../format";
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
  "Laoag City": { lat: 18.2, lon: 120.59 },
  "Tuguegarao City": { lat: 17.61, lon: 121.73 },
  "Legazpi City": { lat: 13.14, lon: 123.74 },
  "Puerto Princesa": { lat: 9.74, lon: 118.74 },
  "Tacloban City": { lat: 11.24, lon: 125.0 },
  "Bacolod City": { lat: 10.68, lon: 122.95 },
  "Cagayan de Oro": { lat: 8.48, lon: 124.65 },
  "Butuan City": { lat: 8.95, lon: 125.54 },
  "Zamboanga City": { lat: 6.91, lon: 122.07 },
  "General Santos": { lat: 6.11, lon: 125.17 },
};

interface LineupRow {
  place: string;
  slope: number;
  p: number;
  confirmed: boolean;
}

// The case question for each variable.
const QUESTIONS: Record<string, (place: string) => string> = {
  T2M: (p) => `Is ${p} getting hotter?`,
  PRECTOTCORR: (p) => `Is ${p} getting wetter?`,
  T2M_MAX: (p) => `Are the hottest days in ${p} getting hotter?`,
  T2M_MIN: (p) => `Are the coldest nights in ${p} getting warmer?`,
  TS: (p) => `Is the ground in ${p} getting hotter?`,
  RH2M: (p) => `Is ${p} getting more humid?`,
  WS2M: (p) => `Is ${p} getting windier?`,
};

export function OpenCase({ variables, onOpenCase }: OpenCaseProps) {
  const [variable, setVariable] = useState(variables[0]?.code ?? "T2M");
  const [place, setPlace] = useState("Metro Manila");
  const formRef = useRef<HTMLDivElement>(null);
  const [lineup, setLineup] = useState<LineupRow[]>([]);
  const [lineupVar, setLineupVar] = useState<VariableInfo | null>(null);
  const [lineupBusy, setLineupBusy] = useState(false);

  const selectedVar = variables.find((v) => v.code === variable) ?? variables[0];

  function openOwn() {
    const coord = PLACES[place];
    const q = questionFor(variable, selectedVar?.label ?? "", place);
    onOpenCase({ lat: coord.lat, lon: coord.lon, variable, start: 1981, end: 2024 }, q);
  }

  function questionFor(code: string, label: string, where: string) {
    return (
      QUESTIONS[code]?.(where) ?? `Is ${where}'s ${label.toLowerCase()} changing?`
    );
  }

  // Runs the same case for every place, three at a time.
  async function runLineup() {
    if (!selectedVar) return;
    setLineup([]);
    setLineupVar(selectedVar);
    setLineupBusy(true);
    const queue = Object.entries(PLACES);
    async function worker() {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [name, coord] = next;
        try {
          const d = await fetchCase({
            lat: coord.lat,
            lon: coord.lon,
            variable: selectedVar!.code,
            start: 1981,
            end: 2024,
          });
          const row = {
            place: name,
            slope: d.trend.sen_slope_per_decade,
            p: d.trend.p_honest,
            confirmed: d.verdict.state === "confirmed",
          };
          setLineup((rows) => [...rows, row].sort((x, y) => y.slope - x.slope));
        } catch {
          // A place that fails to load is left out of the table.
        }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    setLineupBusy(false);
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

      <section className="section stack-md">
        <h2>Where is it changing?</h2>
        <p className="lead">
          Run the same test on all {Object.keys(PLACES).length} places and see
          which trends hold up.
        </p>
        <div>
          <button
            className="btn btn-outline"
            onClick={runLineup}
            disabled={lineupBusy}
          >
            {lineupBusy
              ? `Checking ${lineup.length} of ${Object.keys(PLACES).length}`
              : `Compare ${selectedVar?.label.toLowerCase()} across places`}
          </button>
        </div>
        {lineupVar && lineup.length > 0 && (
          <div className="card lineup">
            <table>
              <caption>
                {lineupVar.label}, 1981 to 2024, sorted by rate of change
              </caption>
              <thead>
                <tr>
                  <th scope="col">Place</th>
                  <th scope="col">Change per decade</th>
                  <th scope="col">Honest p-value</th>
                  <th scope="col">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {lineup.map((r) => (
                  <tr key={r.place}>
                    <th scope="row">
                      <button
                        className="link-btn"
                        onClick={() =>
                          onOpenCase(
                            {
                              ...PLACES[r.place],
                              variable: lineupVar.code,
                              start: 1981,
                              end: 2024,
                            },
                            questionFor(lineupVar.code, lineupVar.label, r.place),
                          )
                        }
                      >
                        {r.place}
                      </button>
                    </th>
                    <td className="num">
                      {signed(r.slope)} {lineupVar.units}
                    </td>
                    <td className="num">{formatP(r.p)}</td>
                    <td>{r.confirmed ? "Confirmed" : "Not enough evidence yet"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="section footer-note">
        Data: NASA POWER, built on MERRA-2 and CERES. Values are model-based.
      </footer>
    </div>
  );
}

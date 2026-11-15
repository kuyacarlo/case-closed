import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header, type Step } from "./components/Header";
import { Explore } from "./screens/Explore";
import { Evidence } from "./screens/Evidence";
import { VerdictScreen } from "./screens/VerdictScreen";
import { Methods } from "./screens/Methods";
import { ApiError, DEFAULT_VARIABLES, fetchCase, fetchVariables, LAST_YEAR, type CaseQuery } from "./api";
import {
  loadOverview,
  loadPlaces,
  nearestTown,
  overviewCell,
  slopePercentile,
  toPlace,
  townsInCell,
  type Overview,
  type OverviewCode,
  type RawPlace,
} from "./data";
import { snap, type CellCentre } from "./grid";
import { readUrl, writeUrl } from "./url";
import { yearOf } from "./format";
import type { CaseResponse, Place, VariableInfo, Verdict } from "./types";

type View = Step | "methods";
type Status = "idle" | "loading" | "ready" | "error";

const MANILA: Place = { name: "City of Manila", context: "Metro Manila (NCR)", lat: 14.5996, lon: 120.9851 };

function questionFor(variable: string, name: string): string {
  if (variable === "T2M") return `Is ${name} getting hotter?`;
  if (variable === "PRECTOTCORR") return `Is ${name} getting wetter?`;
  if (variable === "NO2") return "Did Manila’s air get cleaner?";
  return `Is ${name} changing?`;
}

function isOverviewCode(v: string): v is OverviewCode {
  return v === "T2M" || v === "PRECTOTCORR";
}

export default function App() {
  const [view, setView] = useState<View>(1);
  const [methodsAnchor, setMethodsAnchor] = useState<string | undefined>();
  const [variables, setVariables] = useState<VariableInfo[]>(DEFAULT_VARIABLES);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewFailed, setOverviewFailed] = useState(false);
  const [places, setPlaces] = useState<RawPlace[]>([]);

  // What the user is looking at.
  const [code, setCode] = useState<OverviewCode>("T2M");
  const [place, setPlace] = useState<Place | null>(null);
  const [cell, setCell] = useState<CellCentre | null>(null);

  // The open case.
  const [query, setQuery] = useState<CaseQuery | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<CaseResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [fullVerdict, setFullVerdict] = useState<Verdict | null>(null);
  const [fullFrom, setFullFrom] = useState<number>(1981);
  const [announce, setAnnounce] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchVariables().then(setVariables);
    loadOverview().then(setOverview, () => setOverviewFailed(true));
    loadPlaces().then(setPlaces, () => undefined);
  }, []);

  const firstYearOf = useCallback(
    (v: string) => variables.find((x) => x.code === v)?.first_year ?? 1981,
    [variables],
  );

  /** Fetch a case. `fresh` = a new place/variable (clear old data first). */
  const load = useCallback(async (q: CaseQuery, fresh: boolean) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    setAnnounce("Loading case");
    if (fresh) {
      setData(null);
      setFullVerdict(null);
    }
    try {
      const d = await fetchCase(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setData(d);
      setStatus("ready");
      setAnnounce(`Verdict: ${d.verdict.text}`);
      if (fresh) {
        setFullVerdict(d.verdict);
        setFullFrom(Number(yearOf(d.meta.start)));
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Something went wrong loading this case.");
      setStatus("error");
      setAnnounce("Couldn't load case");
    }
  }, []);

  function openCase(variable: string, p: Place, nextView: Step = 2, start?: number, push = true) {
    const q: CaseQuery = {
      lat: p.lat,
      lon: p.lon,
      variable,
      start: start ?? firstYearOf(variable),
      end: LAST_YEAR,
    };
    setPlace(p);
    setCell(snap(p.lat, p.lon));
    if (isOverviewCode(variable)) setCode(variable);
    setQuery(q);
    void load(q, start == null || start === firstYearOf(variable));
    setView(nextView);
    if (push) writeUrl({ step: nextView, variable, lat: p.lat, lon: p.lon, place: p.name, start });
    window.scrollTo({ top: 0 });
  }

  function pickPlace(p: Place) {
    setPlace(p);
    setCell(snap(p.lat, p.lon));
    writeUrl({ step: 1, variable: code, lat: p.lat, lon: p.lon, place: p.name });
  }

  function pickPoint(lat: number, lon: number) {
    const c = snap(lat, lon);
    const inCell = townsInCell(places, c);
    // Name the tap after the nearest town in the same square.
    let best: RawPlace | null = null;
    let bestD = Infinity;
    for (const t of inCell) {
      const d = (t.lat - lat) ** 2 + (t.lon - lon) ** 2;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    const near = best ?? nearestTown(places, lat, lon);
    const p: Place = best
      ? { ...toPlace(best), lat: c.lat, lon: c.lon }
      : {
          name: near ? `Near ${near.n}` : "This spot",
          context: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
          lat: c.lat,
          lon: c.lon,
        };
    pickPlace(p);
  }

  function goTo(v: View, anchor?: string) {
    setView(v);
    setMethodsAnchor(anchor);
    writeUrl({
      step: v,
      variable: query?.variable ?? code,
      lat: place?.lat,
      lon: place?.lon,
      place: place?.name,
      start: v === 3 && query && query.start !== fullFrom ? query.start : undefined,
    });
    window.scrollTo({ top: 0 });
  }

  function goHome() {
    goTo(1);
  }

  function changeCode(c: OverviewCode) {
    setCode(c);
    writeUrl({ step: view, variable: c, lat: place?.lat, lon: place?.lon, place: place?.name }, "replace");
  }

  // Slider: debounce, cancel stale requests, keep the URL in step.
  const debounceRef = useRef<number | undefined>(undefined);
  function onStartYearChange(year: number) {
    if (!query) return;
    const next = { ...query, start: year };
    setQuery(next);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void load(next, false);
      writeUrl(
        {
          step: 3,
          variable: next.variable,
          lat: next.lat,
          lon: next.lon,
          place: place?.name,
          start: year === fullFrom ? undefined : year,
        },
        "replace",
      );
    }, 250);
  }

  // Restore state from the URL on first load and on Back/Forward.
  const applyUrl = useCallback(() => {
    const u = readUrl();
    if (u.step === "methods") {
      setView("methods");
      return;
    }
    if (isOverviewCode(u.variable)) setCode(u.variable);
    if (u.lat == null || u.lon == null) {
      setPlace(null);
      setCell(null);
      setView(1);
      return;
    }
    const p: Place = { name: u.place ?? "This place", context: "", lat: u.lat, lon: u.lon };
    if (u.step === 1) {
      setPlace(p);
      setCell(snap(p.lat, p.lon));
      setView(1);
      return;
    }
    openCase(u.variable, p, u.step, u.start, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variables]);

  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      applyUrl();
    }
    window.addEventListener("popstate", applyUrl);
    return () => window.removeEventListener("popstate", applyUrl);
  }, [applyUrl]);

  // Fill in the context line for places restored from a URL.
  useEffect(() => {
    if (place && !place.context && places.length) {
      const match = places.find((x) => x.n === place.name);
      if (match) setPlace({ ...place, context: toPlace(match).context });
    }
  }, [place, places]);

  const towns = useMemo(() => (cell ? townsInCell(places, cell) : []), [places, cell]);
  const ovCell = overview && cell ? overviewCell(overview, cell) : undefined;

  const alsoCovers = useMemo(() => {
    const names = towns.map((t) => t.n).filter((n) => n !== place?.name);
    if (!names.length) return "";
    return names.length > 4 ? `${names.slice(0, 4).join(", ")} and ${names.length - 4} more` : names.join(", ");
  }, [towns, place]);

  const nationalContext = useMemo(() => {
    if (!overview || !ovCell || !query || !isOverviewCode(query.variable)) return null;
    const v = ovCell[query.variable];
    if (v.state !== "confirmed" && v.state !== "step") return null;
    const pct = slopePercentile(overview, query.variable, v.sen);
    const verb =
      query.variable === "T2M" ? (v.sen >= 0 ? "Warming" : "Cooling") : v.sen >= 0 ? "Getting wetter" : "Getting drier";
    return `${verb} faster than ${pct}% of the Philippines’ land areas over the same years.`;
  }, [overview, ovCell, query]);

  const enabled: Step[] = query ? [1, 2, 3] : [1];
  const question = query && place ? questionFor(query.variable, query.variable === "NO2" ? "Manila" : place.name) : "";

  return (
    <>
      <Header current={view} onHome={goHome} onStep={(s) => goTo(s)} onMethods={() => goTo("methods")} enabled={enabled} />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <main id="main">
        {view === 1 && (
          <Explore
            variables={variables}
            code={code}
            onCode={changeCode}
            overview={overview}
            overviewFailed={overviewFailed}
            place={place}
            cell={cell}
            overviewCell={ovCell}
            towns={towns}
            onPlace={pickPlace}
            onMapPick={pickPoint}
            onEvidence={() => place && openCase(code, place)}
            onFeatured={(id) =>
              id === "manila-heat"
                ? openCase("T2M", MANILA)
                : openCase("NO2", { name: "Metro Manila", context: "NCR", lat: 14.6, lon: 121.0 })
            }
            onMethods={(a) => goTo("methods", a)}
          />
        )}

        {view === "methods" && <Methods overview={overview} anchor={methodsAnchor} onBack={goHome} />}

        {(view === 2 || view === 3) && status === "error" && (
          <div className="container">
            <section className="card error-card stack-md" role="alert">
              <p className="eyebrow">{question}</p>
              <h1 className="h1-screen">We couldn’t load this case</h1>
              <p className="lead">{error} Nothing on this page is from another place.</p>
              <div className="actions">
                <button className="btn btn-primary" onClick={() => query && load(query, !data)}>
                  Try again
                </button>
                <button className="btn btn-outline" onClick={goHome}>
                  Back to the map
                </button>
              </div>
            </section>
          </div>
        )}

        {(view === 2 || view === 3) && status !== "error" && !data && (
          <div className="container stack-lg" aria-busy="true">
            <section className="stack-sm">
              <p className="eyebrow">Case</p>
              <h1 className="h1-screen">{question}</h1>
              <p className="muted num">Fetching monthly data from NASA POWER…</p>
            </section>
            <div className="skeleton" style={{ height: 120 }} />
            <div className="skeleton" style={{ height: 300 }} />
            <div className="skeleton" style={{ height: 300 }} />
          </div>
        )}

        {view === 2 && data && status !== "error" && place && (
          <Evidence
            data={data}
            question={question}
            placeName={place.name}
            alsoCovers={data.meta.cell ? alsoCovers : ""}
            onCrossExamine={() => goTo(3)}
          />
        )}

        {view === 3 && data && status !== "error" && query && place && (
          <VerdictScreen
            data={data}
            question={question}
            placeName={place.name}
            fullVerdict={fullVerdict}
            fullFrom={fullFrom}
            nationalContext={nationalContext}
            startYear={query.start < fullFrom ? fullFrom : query.start}
            minYear={fullFrom}
            maxYear={Number(yearOf(data.meta.end))}
            loading={status === "loading"}
            onStartYearChange={onStartYearChange}
            onBackToEvidence={() => goTo(2)}
            onOpenAnother={goHome}
          />
        )}
      </main>
    </>
  );
}

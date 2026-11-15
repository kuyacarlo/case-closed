import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header, type Step } from "./components/Header";
import { Tour, type TourStep } from "./components/Tour";
import type { Witness } from "./components/WitnessPanel";
import { Explore, type DemoId } from "./screens/Explore";
import { Evidence } from "./screens/Evidence";
import { VerdictScreen } from "./screens/VerdictScreen";
import { Methods } from "./screens/Methods";
import {
  ApiError,
  DEFAULT_THEMES,
  DEFAULT_VARIABLES,
  fetchCase,
  fetchVariables,
  LAST_YEAR,
  type CaseQuery,
} from "./api";
import {
  layerCell,
  loadIndex,
  loadLayer,
  loadPlaces,
  nearestTown,
  slopePercentile,
  toPlace,
  townsInCell,
  type Layer,
  type OverviewIndex,
  type RawPlace,
} from "./data";
import { snap, type CellCentre } from "./grid";
import { readUrl, writeUrl } from "./url";
import { yearOf } from "./format";
import type { CaseResponse, Place, Theme, VariableInfo, Verdict } from "./types";

type View = Step | "methods";
type Status = "idle" | "loading" | "ready" | "error";

const MANILA: Place = { name: "City of Manila", context: "Metro Manila (NCR)", lat: 14.5996, lon: 120.9851 };
const TUGUEGARAO: Place = { name: "Tuguegarao City", context: "Cagayan · Cagayan Valley", lat: 17.6066, lon: 121.7319 };

function questionFor(code: string, label: string, name: string): string {
  switch (code) {
    case "T2M":
      return `Is ${name} getting hotter?`;
    case "T2M_MAX":
      return `Are the hottest days in ${name} getting hotter?`;
    case "T2M_MIN":
      return `Are the coolest nights in ${name} getting warmer?`;
    case "PRECTOTCORR":
      return `Is ${name} getting wetter or drier?`;
    case "NO2":
      return "Did Manila’s air get cleaner?";
    default:
      return `Is ${label.toLowerCase()} changing in ${name}?`;
  }
}

export default function App() {
  const [view, setView] = useState<View>(1);
  const [methodsAnchor, setMethodsAnchor] = useState<string | undefined>();
  const [variables, setVariables] = useState<VariableInfo[]>(DEFAULT_VARIABLES);
  const [themes, setThemes] = useState<Record<string, string>>(DEFAULT_THEMES);
  const [index, setIndex] = useState<OverviewIndex | null>(null);
  const [places, setPlaces] = useState<RawPlace[]>([]);

  // What the user is investigating.
  const [theme, setTheme] = useState<Theme>("heat");
  const [code, setCode] = useState<string>("T2M");
  const [layer, setLayer] = useState<Layer | null>(null);
  const [layerFailed, setLayerFailed] = useState(false);
  const [significantOnly, setSignificantOnly] = useState(false);
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
  const [demo, setDemo] = useState<DemoId | null>(null);
  const [caseLayers, setCaseLayers] = useState<{ main: Layer; witness: Layer } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchVariables().then(({ variables, themes }) => {
      setVariables(variables);
      setThemes(themes);
    });
    loadIndex().then(setIndex, () => undefined);
    loadPlaces().then(setPlaces, () => undefined);
  }, []);

  // Load the map layer for the chosen variable (point-only variables have none).
  useEffect(() => {
    const info = variables.find((v) => v.code === code);
    if (info?.static_place) return;
    let live = true;
    setLayerFailed(false);
    loadLayer(code).then(
      (l) => live && setLayer(l),
      () => live && setLayerFailed(true),
    );
    return () => {
      live = false;
    };
  }, [code, variables]);

  // For the Evidence page: the case variable's layer and its second witness.
  const witnessCode = data?.meta.witness ?? null;
  const caseCode = data?.meta.variable ?? null;
  useEffect(() => {
    setCaseLayers(null);
    if (!witnessCode || !caseCode) return;
    let live = true;
    Promise.all([loadLayer(caseCode), loadLayer(witnessCode)]).then(
      ([main, witness]) => live && setCaseLayers({ main, witness }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [caseCode, witnessCode]);

  const infoOf = useCallback((c: string) => variables.find((v) => v.code === c), [variables]);
  const firstYearOf = useCallback((c: string) => infoOf(c)?.first_year ?? 1981, [infoOf]);

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
      setAnnounce(`Verdict: ${d.verdict.headline}`);
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
    if (!infoOf(variable)?.static_place) setCode(variable);
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
    pickPlace(
      best
        ? { ...toPlace(best), lat: c.lat, lon: c.lon }
        : {
            name: near ? `Near ${near.n}` : "This spot",
            context: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
            lat: c.lat,
            lon: c.lon,
          },
    );
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

  function changeCode(c: string) {
    const info = infoOf(c);
    if (info) setTheme(info.theme);
    setCode(c);
    writeUrl({ step: view, variable: c, lat: place?.lat, lon: place?.lon, place: place?.name }, "replace");
  }

  function changeTheme(t: Theme) {
    setTheme(t);
    // Keep the variable if it belongs to the theme; otherwise pick the theme's first.
    const first = variables.find((v) => v.theme === t && !v.static_place);
    if (first && infoOf(code)?.theme !== t) changeCode(first.code);
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
    const info = variables.find((v) => v.code === u.variable);
    if (info && !info.static_place) {
      setCode(u.variable);
      setTheme(info.theme);
    }
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
  const lCell = layer && cell ? layerCell(layer, cell) : undefined;

  const alsoCovers = useMemo(() => {
    const names = towns.map((t) => t.n).filter((n) => n !== place?.name);
    if (!names.length) return "";
    return names.length > 4 ? `${names.slice(0, 4).join(", ")} and ${names.length - 4} more` : names.join(", ");
  }, [towns, place]);

  const nationalContext = useMemo(() => {
    if (!layer || !lCell || !query || layer.code !== query.variable || !lCell.sig) return null;
    const pct = slopePercentile(layer, lCell.sen);
    return `Changing faster than ${pct}% of the Philippines’ land squares over the same years.`;
  }, [layer, lCell, query]);

  // ---------- Demos: watchable walkthroughs that drive the real app ----------
  function openHowSure() {
    window.setTimeout(() => document.querySelector(".how-sure")?.setAttribute("open", ""), 300);
  }
  const demos: Record<DemoId, { name: string; steps: TourStep[] }> = {
    manila: {
      name: "Is Metro Manila getting hotter?",
      steps: [
        {
          title: "1. Choose what to investigate",
          body: "A data detective starts with a question. We pick Heat, then Air temperature. Each variable has a plain definition and a reason it matters.",
          target: ".theme-picker",
          run: () => {
            goHome();
            changeTheme("heat");
            changeCode("T2M");
          },
        },
        {
          title: "2. Choose a place",
          body: "We search for Manila. Every place snaps to one NASA data square about 55 km wide, outlined on the map. The data is an average over that whole square.",
          target: ".ph-map",
          run: () => pickPlace(MANILA),
        },
        {
          title: "3. Four questions, answered",
          body: "Is there a trend? How much? Is it significant? How sure? Here: rising about 0.14 °C per decade since 1981, and significant.",
          target: ".answer-card .answers",
        },
        {
          title: "Where else is it changing?",
          body: "Colour shows which way and how fast each square is changing. Faded squares have a trend that isn’t significant. The legend counts rises and falls by island group.",
          target: ".map-legend",
        },
        {
          title: "What else is changing here?",
          body: "Every variable for Manila’s square, significant trends first. Detectives look for which variables are actually trending.",
          target: ".changing-here",
        },
        {
          title: "Exhibit A: the raw evidence",
          body: "Every month since 1981, straight from NASA POWER (MERRA-2). The regular waves are the seasons, and they hide any slow change.",
          target: "#exhibit-a .chart-panel",
          run: () => openCase("T2M", MANILA),
        },
        {
          title: "Exhibit B: remove the seasons",
          body: "Subtract each month’s usual value. What’s left is how unusual each month was. The orange line is the trend through it (Sen’s slope).",
          target: "#exhibit-b .chart-panel",
        },
        {
          title: "The verdict",
          body: "Rising, how much, and significant: a trend this strong would turn up by chance less than 5 times in 100. The 95% range for the rate doesn’t include zero.",
          target: ".case-summary",
          run: () => goTo(3),
        },
        {
          title: "Why the ‘honest’ test?",
          body: "Warm months follow warm months, so 540 months count like far fewer independent ones. The naive test is overconfident; the honest one corrects for it.",
          target: ".how-sure",
          run: openHowSure,
        },
        {
          title: "Short windows fool you",
          body: "Start in 2019 and the slope looks huge, but six years is too short to judge. That’s why the full record is the answer.",
          target: ".slider-card",
          run: () => onStartYearChange(2019),
        },
        {
          title: "Your turn",
          body: "Pick something to investigate and a place anywhere in the Philippines.",
          run: () => {
            onStartYearChange(fullFrom);
            goHome();
          },
        },
      ],
    },
    "not-yet": {
      name: "A trend that needs more years",
      steps: [
        {
          title: "A slight rise, not significant",
          body: "Tuguegarao’s average temperature rises about 0.06 °C per decade since 1981, but that’s small next to the year-to-year swings.",
          target: ".answer-card",
          run: () => {
            goHome();
            changeTheme("heat");
            changeCode("T2M");
            pickPlace(TUGUEGARAO);
          },
        },
        {
          title: "Not significant yet ≠ no trend",
          body: "The trend is still there and still worth knowing. Natural ups and downs could draw it by chance (p ≈ 0.26). A longer record would settle it.",
          target: ".answer-card .answers",
        },
        {
          title: "The full verdict",
          body: "The 95% range for the rate includes zero, so we can’t rule out ‘no change’ yet. The verdict says how many years it might take.",
          target: ".case-summary",
          run: () => openCase("T2M", TUGUEGARAO, 3),
        },
        {
          title: "But the nights are warming",
          body: "Switch to the coolest temperature of the month: +0.16 °C per decade, clearly significant. Same place, a different variable, a different answer.",
          target: ".answer-card",
          run: () => {
            goHome();
            changeCode("T2M_MIN");
          },
        },
        {
          title: "What’s changing here?",
          body: "This list ranks every variable for Tuguegarao’s square. Significant trends come first. Try clicking one.",
          target: ".changing-here",
        },
      ],
    },
  };

  const witnesses = useMemo((): [Witness, Witness] | null => {
    if (!caseLayers || !cell) return null;
    const a = layerCell(caseLayers.main, cell);
    const b = layerCell(caseLayers.witness, cell);
    const ia = infoOf(caseLayers.main.code);
    const ib = infoOf(caseLayers.witness.code);
    return a && b && ia && ib ? [{ info: ia, cell: a }, { info: ib, cell: b }] : null;
  }, [caseLayers, cell, infoOf]);

  const enabled: Step[] = query ? [1, 2, 3] : [1];
  const qInfo = query ? infoOf(query.variable) : undefined;
  const question =
    query && place ? questionFor(query.variable, qInfo?.label ?? query.variable, query.variable === "NO2" ? "Manila" : place.name) : "";

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
            themes={themes}
            theme={theme}
            code={code}
            onTheme={changeTheme}
            onCode={changeCode}
            layer={layer && layer.code === code ? layer : null}
            summary={index?.vars[code]}
            layerFailed={layerFailed}
            place={place}
            cell={cell}
            layerCell={layer && layer.code === code ? lCell : undefined}
            towns={towns}
            significantOnly={significantOnly}
            onSignificantOnly={setSignificantOnly}
            onPlace={pickPlace}
            onMapPick={pickPoint}
            onEvidence={() => place && openCase(code, place)}
            onFeatured={() => openCase("NO2", { name: "Metro Manila", context: "NCR", lat: 14.6, lon: 121.0 })}
            onDemo={setDemo}
            onMethods={(a) => goTo("methods", a)}
          />
        )}

        {view === "methods" && (
          <Methods index={index} variables={variables} anchor={methodsAnchor} onBack={goHome} />
        )}

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
              <p className="muted num">Fetching monthly data from NASA…</p>
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
            witnesses={witnesses}
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
      {demo && <Tour key={demo} name={demos[demo].name} steps={demos[demo].steps} onExit={() => setDemo(null)} />}
    </>
  );
}

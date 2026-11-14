import { useCallback, useEffect, useRef, useState } from "react";
import { Header, type Step } from "./components/Header";
import { OpenCase } from "./screens/OpenCase";
import { Evidence } from "./screens/Evidence";
import { VerdictScreen } from "./screens/VerdictScreen";
import {
  DEFAULT_VARIABLES,
  fetchCaseOrMock,
  fetchVariables,
  type CaseQuery,
} from "./api";
import type { CaseResponse, VariableInfo } from "./types";

const MIN_YEAR = 1981;
const MAX_YEAR = 2024;

export default function App() {
  const [step, setStep] = useState<Step>(1);
  const [variables, setVariables] = useState<VariableInfo[]>(DEFAULT_VARIABLES);
  const [query, setQuery] = useState<CaseQuery | null>(null);
  const [question, setQuestion] = useState("");
  const [data, setData] = useState<CaseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    fetchVariables().then(setVariables);
  }, []);

  const load = useCallback(async (q: CaseQuery) => {
    setLoading(true);
    const { data, usedFallback } = await fetchCaseOrMock(q);
    setData(data);
    setUsedFallback(usedFallback);
    setLoading(false);
  }, []);

  function openCase(q: CaseQuery, q2: string) {
    setQuery(q);
    setQuestion(q2);
    void load(q);
    setStep(2);
    window.scrollTo({ top: 0 });
  }

  function goHome() {
    setStep(1);
    window.scrollTo({ top: 0 });
  }

  // Window slider: update the start year, debounce, refetch, verdict updates.
  const debounceRef = useRef<number | undefined>(undefined);
  function onStartYearChange(year: number) {
    if (!query) return;
    const next = { ...query, start: year };
    setQuery(next);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void load(next), 250);
  }

  const enabled: Step[] = data ? [1, 2, 3] : [1];

  function goToStep(s: Step) {
    setStep(s);
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      <Header current={step} onHome={goHome} onStep={goToStep} enabled={enabled} />
      <main>
        {step === 1 && (
          <OpenCase variables={variables} onOpenCase={openCase} />
        )}
        {step === 2 && data && (
          <Evidence
            data={data}
            question={question}
            onCrossExamine={() => goToStep(3)}
          />
        )}
        {step === 3 && data && query && (
          <VerdictScreen
            data={data}
            startYear={query.start}
            minYear={MIN_YEAR}
            maxYear={MAX_YEAR}
            loading={loading}
            onStartYearChange={onStartYearChange}
            onBackToEvidence={() => goToStep(2)}
            onOpenAnother={goHome}
          />
        )}
        {usedFallback && step !== 1 && (
          <div className="container">
            <p className="footer-note" style={{ marginTop: 24 }}>
              Showing the saved Metro Manila demo case (live API unreachable).
            </p>
          </div>
        )}
      </main>
    </>
  );
}

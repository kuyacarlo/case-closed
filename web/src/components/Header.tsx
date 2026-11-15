import "./Header.css";

export type Step = 1 | 2 | 3;

interface HeaderProps {
  current: Step | "methods";
  onHome: () => void;
  onStep?: (step: Step) => void;
  onMethods: () => void;
  /** Steps the user is allowed to jump to (a place must be chosen for 2 and 3). */
  enabled?: Step[];
}

// The challenge's workflow: 1-3 (variable, region, time period) are set up on
// the home page, 4 is the time series, 5 is the significance test.
const STEPS: { n: Step; label: string; covers: string }[] = [
  { n: 1, label: "Set up", covers: "Steps 1–3: variable, region, time period" },
  { n: 2, label: "Time series", covers: "Step 4: create the time series and examine it" },
  { n: 3, label: "Significance", covers: "Step 5: test the trend for significance" },
];

export function Header({ current, onHome, onStep, onMethods, enabled = [1] }: HeaderProps) {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="container site-header-inner">
        <button type="button" className="wordmark" onClick={onHome} aria-label="Case Closed, home">
          <img src="/logo-mark.svg" width={32} height={32} alt="" />
          <span>Case Closed</span>
        </button>
        <div className="header-right">
          <nav className="steps" aria-label="Progress">
            {STEPS.map(({ n, label, covers }) => {
              const isCurrent = n === current;
              const canGo = enabled.includes(n) && !!onStep && !isCurrent;
              return (
                <button
                  key={n}
                  type="button"
                  className={`step-pill${isCurrent ? " step-current" : ""}`}
                  aria-disabled={!canGo && !isCurrent}
                  title={!canGo && !isCurrent ? `${covers} (pick a place first)` : covers}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Step ${n}: ${label}`}
                  onClick={() => canGo && onStep?.(n)}
                >
                  <span className="step-n">{n}</span> <span className="step-label">{label}</span>
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            className={`methods-link${current === "methods" ? " is-current" : ""}`}
            onClick={onMethods}
          >
            How it works
          </button>
        </div>
      </div>
    </header>
  );
}

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

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Place" },
  { n: 2, label: "Evidence" },
  { n: 3, label: "Verdict" },
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
            {STEPS.map(({ n, label }) => {
              const isCurrent = n === current;
              const canGo = enabled.includes(n) && !!onStep && !isCurrent;
              return (
                <button
                  key={n}
                  type="button"
                  className={`step-pill${isCurrent ? " step-current" : ""}`}
                  aria-disabled={!canGo && !isCurrent}
                  title={!canGo && !isCurrent ? "Pick a place first" : undefined}
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

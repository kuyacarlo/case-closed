import "./Header.css";

export type Step = 1 | 2 | 3;

interface HeaderProps {
  current: Step;
  onHome: () => void;
  onStep?: (step: Step) => void;
  /** Steps the user is allowed to jump to (a case must be open for 2 and 3). */
  enabled?: Step[];
}

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Case" },
  { n: 2, label: "Evidence" },
  { n: 3, label: "Verdict" },
];

export function Header({ current, onHome, onStep, enabled = [1] }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <a className="wordmark" onClick={onHome} role="button" tabIndex={0}>
          <img src="/logo-mark.svg" width={32} height={32} alt="" />
          <span>Case Closed</span>
        </a>
        <nav className="steps" aria-label="Progress">
          {STEPS.map(({ n, label }) => {
            const isCurrent = n === current;
            const canGo = enabled.includes(n) && !!onStep && !isCurrent;
            return (
              <button
                key={n}
                className={`step-pill${isCurrent ? " step-current" : ""}`}
                disabled={!canGo && !isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => canGo && onStep?.(n)}
              >
                {n} {label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

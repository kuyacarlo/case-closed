import "./Header.css";

export type Step = 1 | 2 | 3;

interface HeaderProps {
  current: Step | "methods";
  onHome: () => void;
  onStep: (step: Step) => void;
  onMethods: () => void;
}

// The challenge's workflow: set up (variable, region, time period), the time
// series, then the significance test. Every pill is always clickable; App
// decides where to go if no place has been picked yet.
const STEPS: { n: Step; label: string; covers: string }[] = [
  { n: 1, label: "Set up", covers: "Choose a variable, a region and a time period" },
  { n: 2, label: "Time series", covers: "Create the time series and examine it" },
  { n: 3, label: "Significance", covers: "Test the trend for significance" },
];

export function Header({ current, onHome, onStep, onMethods }: HeaderProps) {
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
              return (
                <button
                  key={n}
                  type="button"
                  className={`step-pill${isCurrent ? " step-current" : ""}`}
                  title={covers}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => onStep(n)}
                >
                  {label}
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

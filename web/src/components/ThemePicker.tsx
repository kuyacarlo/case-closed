import type { ReactNode } from "react";
import type { Theme, VariableInfo } from "../types";
import "./ThemePicker.css";

interface ThemePickerProps {
  variables: VariableInfo[];
  themes: Record<string, string>;
  theme: Theme;
  code: string;
  onTheme: (t: Theme) => void;
  onCode: (code: string) => void;
}

/** One line icon per theme, drawn on a 24 px grid. */
const THEME_ICONS: Record<Theme, ReactNode> = {
  heat: (
    <>
      <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" />
      <path d="M12 9v8" />
    </>
  ),
  water: <path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11Z" />,
  land: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6Z" />
      <path d="M12 15c0-3 2-5 6-5 0 3-2 5-6 5Z" />
    </>
  ),
  sky: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
  air: (
    <>
      <path d="M3 9h10a3 3 0 1 0-3-3" />
      <path d="M3 14h15a3 3 0 1 1-3 3" />
      <path d="M3 19h6" />
    </>
  ),
};

function ThemeIcon({ theme }: { theme: Theme }) {
  return (
    <svg className="theme-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {THEME_ICONS[theme]}
    </svg>
  );
}

/** Step 1 of an investigation: what do you want to look into? */
export function ThemePicker({ variables, themes, theme, code, onTheme, onCode }: ThemePickerProps) {
  // Only variables that have a nationwide map (not point-only ones like NO2).
  const mapped = variables.filter((v) => !v.static_place);
  const order = Object.keys(themes).filter((t) => mapped.some((v) => v.theme === t)) as Theme[];
  const inTheme = mapped.filter((v) => v.theme === theme);

  return (
    <div className="theme-picker">
      <fieldset className="theme-chips">
        <legend className="field">What do you want to investigate?</legend>
        {order.map((t) => (
          <label key={t} className={t === theme ? "is-on" : undefined}>
            <input type="radio" name="theme" value={t} checked={t === theme} onChange={() => onTheme(t)} />
            <ThemeIcon theme={t} />
            {themes[t]}
          </label>
        ))}
      </fieldset>

      <fieldset className="var-options">
        <legend className="sr-only">Pick a variable</legend>
        {inTheme.map((v) => (
          <label key={v.code} className={v.code === code ? "is-on" : undefined}>
            <input type="radio" name="variable" value={v.code} checked={v.code === code} onChange={() => onCode(v.code)} />
            <span className="var-label">
              <ThemeIcon theme={v.theme} />
              {v.label}
            </span>
            <span className="var-why">{v.why_it_matters}</span>
          </label>
        ))}
      </fieldset>

      <details className="all-vars">
        <summary>All {mapped.length} variables</summary>
        <label className="field sr-only" htmlFor="all-vars-select">
          Variable
        </label>
        <select
          id="all-vars-select"
          value={code}
          onChange={(e) => {
            const v = mapped.find((x) => x.code === e.target.value);
            if (v) {
              onTheme(v.theme);
              onCode(v.code);
            }
          }}
        >
          {mapped.map((v) => (
            <option key={v.code} value={v.code}>
              {v.label} ({themes[v.theme]})
            </option>
          ))}
        </select>
      </details>
    </div>
  );
}

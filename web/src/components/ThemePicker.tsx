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

/** Icons for single variables. A variable with no entry shows its theme icon. */
const VARIABLE_ICONS: Record<string, ReactNode> = {
  T2M_MAX: (
    <>
      <path d="M6 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" />
      <path d="M17 14V6M14 9l3-3 3 3" />
    </>
  ),
  T2M_MIN: (
    <>
      <path d="M6 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" />
      <path d="M17 6v8M14 11l3 3 3-3" />
    </>
  ),
  PRECTOTCORR: (
    <>
      <path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1.2A3.5 3.5 0 0 1 17 15Z" />
      <path d="M9 18v3M13 18v3M17 18v3" />
    </>
  ),
  IMERG: <path d="M7 4v5M12 8v6M17 4v5M7 14v5M17 14v5" />,
  EVLAND: (
    <>
      <path d="M4 21h16" />
      <path d="M8 17c-1.5-2 1.5-3 0-5s1.5-3 0-5M12 17c-1.5-2 1.5-3 0-5s1.5-3 0-5M16 17c-1.5-2 1.5-3 0-5s1.5-3 0-5" />
    </>
  ),
  GLDAS_EVAP: (
    <>
      <path d="M4 21h16" />
      <path d="M8 17V8M5.5 10.5 8 8l2.5 2.5M16 17V8M13.5 10.5 16 8l2.5 2.5" />
    </>
  ),
  GLDAS_RUNOFF: <path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />,
  GLDAS_ROOTMOIST: (
    <>
      <path d="M3 10h18" />
      <path d="M12 10V5M12 7c0-2 2-3 4-3 0 2-2 3-4 3Z" />
      <path d="M12 13c2 2.5 3 3.5 3 5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5Z" />
    </>
  ),
  RH2M: (
    <>
      <path d="M9 4c2.5 3.5 5 6 5 9a5 5 0 0 1-10 0c0-3 2.5-5.5 5-9Z" />
      <path d="M17 9h4M17 13h4M17 17h4" />
    </>
  ),
  CLOUD_AMT: <path d="M7 18a4.5 4.5 0 0 1 .5-9 5.5 5.5 0 0 1 10.5 1.4A3.9 3.9 0 0 1 17.5 18Z" />,
  OMI_NO2: (
    <>
      <circle cx="12" cy="8" r="3" />
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="18" cy="17" r="2.5" />
      <path d="M10.3 10.5 7.5 14.8M13.7 10.5l2.8 4.3" />
    </>
  ),
};

function ThemeIcon({ theme, code }: { theme: Theme; code?: string }) {
  return (
    <svg className="theme-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {(code && VARIABLE_ICONS[code]) || THEME_ICONS[theme]}
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
              <ThemeIcon theme={v.theme} code={v.code} />
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

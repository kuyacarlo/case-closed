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

/** Step 1 of an investigation: what do you want to look into? */
export function ThemePicker({ variables, themes, theme, code, onTheme, onCode }: ThemePickerProps) {
  // Only variables that have a nationwide map (not point-only ones like NO2).
  const mapped = variables.filter((v) => !v.static_place);
  const order = Object.keys(themes).filter((t) => mapped.some((v) => v.theme === t)) as Theme[];
  const inTheme = mapped.filter((v) => v.theme === theme);

  return (
    <div className="theme-picker">
      <fieldset className="theme-chips">
        <legend className="field">1 · Variable: what do you want to investigate?</legend>
        {order.map((t) => (
          <label key={t} className={t === theme ? "is-on" : undefined}>
            <input type="radio" name="theme" value={t} checked={t === theme} onChange={() => onTheme(t)} />
            {themes[t]}
          </label>
        ))}
      </fieldset>

      <fieldset className="var-options">
        <legend className="sr-only">Pick a variable</legend>
        {inTheme.map((v) => (
          <label key={v.code} className={v.code === code ? "is-on" : undefined}>
            <input type="radio" name="variable" value={v.code} checked={v.code === code} onChange={() => onCode(v.code)} />
            <span className="var-label">{v.label}</span>
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

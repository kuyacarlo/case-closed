import { MIN_YEARS_FOR_VERDICT } from "../api";
import "./PeriodPicker.css";

interface PeriodPickerProps {
  /** Years this variable has data for. */
  min: number;
  max: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  /** Visible label, e.g. "Time period". */
  label?: string;
  idPrefix: string;
}

/** Two-handle year range for the time series (challenge step 3). */
export function PeriodPicker({ min, max, start, end, onChange, label = "Time period", idPrefix }: PeriodPickerProps) {
  const years = end - start + 1;
  const short = years < MIN_YEARS_FOR_VERDICT;
  const pct = (y: number) => ((y - min) / Math.max(1, max - min)) * 100;

  return (
    <fieldset className="period-picker">
      <legend className="field">{label}</legend>
      <div className="period-track" aria-hidden="true">
        <div className="period-avail" />
        <div className="period-sel" style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }} />
      </div>
      <div className="period-inputs">
        <label htmlFor={`${idPrefix}-start`}>
          From
          <input
            id={`${idPrefix}-start`}
            type="range"
            min={min}
            max={max}
            value={start}
            onChange={(e) => {
              const s = Math.min(Number(e.target.value), end - 1);
              onChange(s, end);
            }}
            aria-valuetext={`Start year ${start}`}
          />
          <span className="num">{start}</span>
        </label>
        <label htmlFor={`${idPrefix}-end`}>
          To
          <input
            id={`${idPrefix}-end`}
            type="range"
            min={min}
            max={max}
            value={end}
            onChange={(e) => {
              const v = Math.max(Number(e.target.value), start + 1);
              onChange(start, v);
            }}
            aria-valuetext={`End year ${end}`}
          />
          <span className="num">{end}</span>
        </label>
      </div>
      <p className={`period-readout num${short ? " is-short" : ""}`} aria-live="polite">
        {start}–{end} · {years} years
        {short ? ` · under ${MIN_YEARS_FOR_VERDICT} years: too short for a significance verdict` : ""}
      </p>
      <p className="period-avail-note muted small">
        Data available {min}–{max}.{" "}
        {(start !== min || end !== max) && (
          <button type="button" className="link-btn" onClick={() => onChange(min, max)}>
            Use the full record
          </button>
        )}
      </p>
    </fieldset>
  );
}

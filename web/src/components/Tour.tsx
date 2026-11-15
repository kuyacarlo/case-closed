import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./Tour.css";

export interface TourStep {
  title: string;
  body: string;
  /** CSS selector of the element to highlight (optional for a closing step). */
  target?: string;
  /** Put the app in the right state for this step (navigate, pick, open...). */
  run?: () => void;
}

interface TourProps {
  name: string;
  steps: TourStep[];
  onExit: () => void;
}

const AUTO_MS = 6500;

function findTarget(sel: string | undefined, timeoutMs: number): Promise<Element | null> {
  if (!sel) return Promise.resolve(null);
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const el = document.querySelector(sel);
      if (el) return resolve(el);
      if (performance.now() - t0 > timeoutMs) return resolve(null);
      window.setTimeout(tick, 120);
    };
    tick();
  });
}

/** A watchable walkthrough that drives the real app, step by step. */
export function Tour({ name, steps, onExit }: TourProps) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [playing, setPlaying] = useState(false);
  const capRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Element | null>(null);
  const step = steps[i];

  // Run the step, wait for its target to render, then scroll to it and measure.
  useEffect(() => {
    let live = true;
    step.run?.();
    setRect(null);
    findTarget(step.target, 10000).then((el) => {
      if (!live) return;
      targetRef.current = el;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        window.setTimeout(() => live && setRect(el.getBoundingClientRect()), reduce ? 50 : 450);
      }
      capRef.current?.focus();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // Keep the highlight on the target while the page scrolls or resizes.
  useLayoutEffect(() => {
    const update = () => targetRef.current && setRect(targetRef.current.getBoundingClientRect());
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const next = useCallback(() => {
    if (i < steps.length - 1) setI(i + 1);
    else onExit();
  }, [i, steps.length, onExit]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(next, AUTO_MS);
    return () => window.clearTimeout(t);
  }, [playing, i, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, onExit]);

  const pad = 8;
  return (
    <div className="tour" role="dialog" aria-modal="false" aria-label={`Demo: ${name}`}>
      {rect && (
        <div
          className="tour-ring"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }}
          aria-hidden="true"
        />
      )}
      <div className="tour-card" ref={capRef} tabIndex={-1} aria-live="polite">
        <p className="tour-meta">
          Demo step {i + 1} of {steps.length}, {name}
        </p>
        <h2 className="tour-title">{step.title}</h2>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="btn btn-outline" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
            Back
          </button>
          {!reduce && (
            <button type="button" className="btn btn-outline" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
              {playing ? "Pause" : "Play"}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={next}>
            {i === steps.length - 1 ? "Finish" : "Next"}
          </button>
          <button type="button" className="link-btn tour-exit" onClick={onExit}>
            Exit demo
          </button>
        </div>
        <div className="tour-progress" aria-hidden="true">
          <span style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

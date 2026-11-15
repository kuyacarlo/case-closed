import { useEffect, useId, useRef, useState } from "react";
import { fold, loadPlaces, searchPlaces, toPlace, type RawPlace } from "../data";
import type { Place } from "../types";
import "./PlaceSearch.css";

interface PlaceSearchProps {
  onPick: (place: Place) => void;
  autoFocus?: boolean;
  /** Stable id for the input, so other controls can focus it. */
  inputId?: string;
}

/** Combobox (ARIA 1.2 pattern) over every PH region, province and town. */
export function PlaceSearch({ onPick, autoFocus, inputId }: PlaceSearchProps) {
  const [all, setAll] = useState<RawPlace[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPlaces().then(setAll, () => setLoadFailed(true));
  }, []);

  const results = all ? searchPlaces(all, text) : [];
  const showList = open && results.length > 0;
  const noMatch = open && all && fold(text).length >= 2 && results.length === 0;

  function choose(p: RawPlace) {
    onPick(toPlace(p));
    setText(p.n);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (showList && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="place-search">
      <label className="field" htmlFor={inputId ?? `${listId}-input`}>
        Search a town, city, province, region or island group
      </label>
      <div className="place-input-wrap">
      <input
        ref={inputRef}
        id={inputId ?? `${listId}-input`}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={all ? "e.g. Tuguegarao, Cebu, Cagayan Valley, Mindanao" : "Loading places…"}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="place-list" id={listId} role="listbox">
          {results.map((p, i) => (
            <li
              key={`${p.k}-${p.n}-${p.lat}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="place-name">{p.n}</span>
              <span className="place-context">{toPlace(p).context}</span>
            </li>
          ))}
        </ul>
      )}
      </div>
      <p className="place-hint" aria-live="polite">
        {loadFailed
          ? "Place names didn't load. You can still tap the map."
          : noMatch
            ? "No place by that name. Check the spelling, or tap the map."
            : "Or tap anywhere on the map."}
      </p>
    </div>
  );
}

import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, Rectangle, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Layer } from "../data";
import { cellBounds, type CellCentre } from "../grid";
import type { Theme } from "../types";
import { NOT_CLEAR, slopeColour } from "./colour";
import "./PhMap.css";

// Philippines with a little sea around it.
const PH_BOUNDS: LatLngBoundsExpression = [
  [4.2, 116.2],
  [21.4, 127.2],
];

interface PhMapProps {
  layer: Layer | null;
  theme: Theme;
  /** Colour-scale limit for this layer (see colour.scaleMax). */
  max: number;
  /** Hide squares whose trend isn't significant. */
  significantOnly?: boolean;
  selected: CellCentre | null;
  onPick?: (lat: number, lon: number) => void;
  /** Small, non-interactive map zoomed to the selected cell. */
  mini?: boolean;
  label: string;
}

function ClickHandler({ onPick }: { onPick?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ selected, mini }: { selected: CellCentre | null; mini?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!selected) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const zoom = mini ? 8 : Math.max(map.getZoom(), 6.5);
    if (mini || reduce) map.setView([selected.lat, selected.lon], zoom);
    else map.flyTo([selected.lat, selected.lon], zoom, { duration: 0.6 });
  }, [selected, mini, map]);
  return null;
}

let outlinesCache: GeoJSON.FeatureCollection | null = null;

export function PhMap({ layer, theme, max, significantOnly, selected, onPick, mini, label }: PhMapProps) {
  const [outlines, setOutlines] = useState<GeoJSON.FeatureCollection | null>(outlinesCache);

  useEffect(() => {
    if (outlinesCache) return;
    fetch("/data/ph_provinces.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        outlinesCache = g;
        setOutlines(g);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className={`ph-map${mini ? " ph-map-mini" : ""}`} role="region" aria-label={label}>
      <MapContainer
        bounds={selected && mini ? cellBounds(selected) : PH_BOUNDS}
        maxBounds={[
          [0, 110],
          [25, 132],
        ]}
        minZoom={5}
        maxZoom={11}
        zoomSnap={0.5}
        scrollWheelZoom={!mini}
        dragging={!mini}
        zoomControl={!mini}
        doubleClickZoom={!mini}
        keyboard={!mini}
        attributionControl
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Boundaries: geoBoundaries'
        />
        {outlines && (
          <GeoJSON
            data={outlines}
            interactive={false}
            style={{ color: "#8a96a3", weight: 0.6, fill: false, opacity: 0.7 }}
          />
        )}
        {!mini &&
          layer?.cells.map((c) => {
            const clear = c.sig;
            if (significantOnly && !clear) return null;
            const fill = c.dir === "flat" ? NOT_CLEAR : slopeColour(theme, c.sen, max);
            return (
              <Rectangle
                key={`${layer.code}-${c.lat},${c.lon}`}
                bounds={cellBounds(c)}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation();
                    onPick?.(c.lat, c.lon);
                  },
                }}
                pathOptions={{
                  // Significant: solid. Not significant: same colour, faded,
                  // so the direction still shows ("rising here, falling there").
                  fillColor: fill,
                  fillOpacity: clear ? 0.82 : 0.3,
                  color: c.state === "step" ? "#0f1a24" : "#ffffff",
                  weight: c.state === "step" ? 1.4 : 0.5,
                  dashArray: c.state === "step" ? "3 3" : undefined,
                }}
              />
            );
          })}
        {selected && (
          <Rectangle
            bounds={cellBounds(selected)}
            interactive={false}
            pathOptions={{ color: "#0f1a24", weight: 3, fill: mini, fillColor: "#1d4ed8", fillOpacity: 0.12 }}
          />
        )}
        {!mini && <ClickHandler onPick={onPick} />}
        <FlyTo selected={selected} mini={mini} />
      </MapContainer>
    </div>
  );
}

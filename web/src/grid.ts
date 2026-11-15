// NASA POWER (MERRA-2) grid: 0.5 deg lat x 0.625 deg lon cells. Mirrors
// api/case_closed/grid.py; keep the two in step.
export const DLAT = 0.5;
export const DLON = 0.625;

export interface CellCentre {
  lat: number;
  lon: number;
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

export function snap(lat: number, lon: number): CellCentre {
  let latC = Math.floor(lat / DLAT + 0.5) * DLAT;
  latC = Math.max(-90, Math.min(90, latC));
  let lonC = -180 + Math.floor((lon + 180) / DLON + 0.5) * DLON;
  if (lonC >= 180) lonC -= 360;
  return { lat: r4(latC), lon: r4(lonC) };
}

export function cellKey(c: CellCentre): string {
  return `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
}

/** [[south, west], [north, east]] for Leaflet. */
export function cellBounds(c: CellCentre): [[number, number], [number, number]] {
  return [
    [c.lat - DLAT / 2, c.lon - DLON / 2],
    [c.lat + DLAT / 2, c.lon + DLON / 2],
  ];
}

/** Rough cell size in km at this latitude, for plain-language labels. */
export function cellSizeKm(lat: number): { ns: number; ew: number } {
  const ns = DLAT * 111;
  const ew = DLON * 111 * Math.cos((lat * Math.PI) / 180);
  return { ns: Math.round(ns), ew: Math.round(ew) };
}

"""Build the Philippines places + land-cell datasets the web app ships.

Run offline by the team (not at request time):

    cd api && uv run --with shapely python ../tools/build_places.py

Inputs: geoBoundaries gbOpen PHL ADM1/ADM2/ADM3 simplified GeoJSON
(CC BY 3.0 IGO; data from NAMRIA, PSA and OCHA Philippines), downloaded once
into tools/.cache/ (git-ignored).

Outputs:
  web/public/data/ph_places.json      every region, province and city/municipality
                                      with a representative point inside it
  web/public/data/ph_provinces.geojson simplified province outlines for the map
  tools/ph_cells.json                 NASA POWER grid cells that cover PH land
                                      (input to build_ph_overview.py)
"""
from __future__ import annotations

import json
import sys
import unicodedata
import urllib.request
from pathlib import Path

from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / ".cache" / "geoboundaries"
OUT_WEB = ROOT / "web" / "public" / "data"
sys.path.insert(0, str(ROOT / "api"))
from case_closed.grid import DLAT, DLON, snap  # noqa: E402

API = "https://www.geoboundaries.org/api/current/gbOpen/PHL/{level}/"
# A cell counts as "PH land" when it touches any land at all (small islands
# and coastlines included), or a city/municipality's point falls inside it.
# Full-resolution ADM3 shapes are used for this test so small islands count.
MIN_LAND_SHARE = 0.0


def fetch_level(level: str) -> dict:
    """Download (once) and return the simplified GeoJSON for an admin level."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"PHL_{level}.geojson"
    if not path.exists():
        with urllib.request.urlopen(API.format(level=level), timeout=60) as r:
            meta = json.load(r)
        with urllib.request.urlopen(meta["simplifiedGeometryGeoJSON"], timeout=300) as r:
            path.write_bytes(r.read())
    return json.loads(path.read_text())


# geoBoundaries' 2020 names, mapped to what people search for today. Search
# matches both the display name and the original name.
DISPLAY = {
    "ARMM": "BARMM (Bangsamoro)",
    "NCR": "Metro Manila (NCR)",
    "NCR, City of Manila, First District": "City of Manila",
}


# Island group for each geoBoundaries 2020 region name (Mimaropa is
# administratively part of Luzon).
ISLAND_GROUP = {
    "NCR": "Luzon", "CAR": "Luzon", "Ilocos Region": "Luzon", "Cagayan Valley": "Luzon",
    "Central Luzon": "Luzon", "Calabarzon": "Luzon", "Mimaropa": "Luzon", "Bicol Region": "Luzon",
    "Western Visayas": "Visayas", "Central Visayas": "Visayas", "Eastern Visayas": "Visayas",
    "Zamboanga Peninsula": "Mindanao", "Northern Mindanao": "Mindanao", "Davao Region": "Mindanao",
    "Soccsksargen": "Mindanao", "Caraga": "Mindanao", "ARMM": "Mindanao",
}


def clean_name(s: str) -> str:
    return unicodedata.normalize("NFC", s).strip()


def display(name: str) -> str:
    if name in DISPLAY:
        return DISPLAY[name]
    if name.startswith("NCR, "):  # "NCR, Second District" -> "Metro Manila, Second District"
        return "Metro Manila, " + name[len("NCR, "):]
    return name


def main() -> None:
    adm1, adm2, adm3 = (fetch_level(level) for level in ("ADM1", "ADM2", "ADM3"))

    regions = [(clean_name(f["properties"]["shapeName"]), shape(f["geometry"])) for f in adm1["features"]]
    provinces = [(clean_name(f["properties"]["shapeName"]), shape(f["geometry"])) for f in adm2["features"]]
    region_tree = STRtree([g for _, g in regions])
    prov_tree = STRtree([g for _, g in provinces])

    def containing(tree, items, pt):
        for i in tree.query(pt):
            if items[i][1].covers(pt):
                return items[i][0]
        # Fall back to the nearest polygon (coastal points on simplified edges).
        return items[tree.nearest(pt)][0]

    places = []
    for name, geom in regions:
        pt = geom.representative_point()
        places.append({"n": display(name), "o": name, "k": "region", "lat": round(pt.y, 4), "lon": round(pt.x, 4)})
    for name, geom in provinces:
        pt = geom.representative_point()
        places.append({"n": display(name), "o": name, "k": "province",
                       "r": display(containing(region_tree, regions, pt)),
                       "lat": round(pt.y, 4), "lon": round(pt.x, 4)})
    town_cells = set()
    for f in adm3["features"]:
        geom = shape(f["geometry"])
        pt = geom.representative_point()
        prov = containing(prov_tree, provinces, pt)
        region = containing(region_tree, regions, pt)
        places.append({"n": clean_name(f["properties"]["shapeName"]), "k": "town", "p": display(prov),
                       "r": display(region), "g": ISLAND_GROUP[region],
                       "lat": round(pt.y, 4), "lon": round(pt.x, 4)})
        town_cells.add(snap(pt.y, pt.x))

    # Land cells: every cell touched by enough land, plus every town's cell.
    land = unary_union([shape(f["geometry"]) for f in adm3["features"]])
    minx, miny, maxx, maxy = land.bounds
    cells = set(town_cells)
    lat = snap(miny, minx).lat
    while lat <= maxy + DLAT:
        c0 = snap(lat, minx)
        lon = c0.lon
        while lon <= maxx + DLON:
            cell_box = box(lon - DLON / 2, lat - DLAT / 2, lon + DLON / 2, lat + DLAT / 2)
            if land.intersection(cell_box).area > MIN_LAND_SHARE * cell_box.area:
                cells.add(snap(lat, lon))
            lon += DLON
        lat += DLAT
    # A point on land inside each square: point datasets (Giovanni) are sampled
    # here rather than at the centre, which is often sea for coastal squares,
    # and land-only products such as GLDAS return nothing over sea.
    def land_point(c):
        b = box(c.lon - DLON / 2, c.lat - DLAT / 2, c.lon + DLON / 2, c.lat + DLAT / 2)
        part = land.intersection(b)
        if part.is_empty:
            return c.lat, c.lon
        # The largest piece of land in the square, then a point well inside it.
        geoms = getattr(part, "geoms", [part])
        biggest = max(geoms, key=lambda g: g.area)
        pt = biggest.representative_point()
        return round(pt.y, 4), round(pt.x, 4)

    cell_list = []
    for c in sorted(cells, key=lambda c: (-c.lat, c.lon)):
        plat, plon = land_point(c)
        cell_list.append({"lat": c.lat, "lon": c.lon, "plat": plat, "plon": plon})

    # Province outlines for the map: simplify further and round coordinates.
    def rounded(geom, nd=3):
        g = mapping(geom.simplify(0.005, preserve_topology=True))
        def rnd(x):
            return [rnd(v) for v in x] if isinstance(x, (list, tuple)) and x and isinstance(x[0], (list, tuple)) else [round(x[0], nd), round(x[1], nd)]
        g["coordinates"] = rnd(g["coordinates"])
        return g

    outlines = {
        "type": "FeatureCollection",
        "attribution": "geoBoundaries (CC BY 3.0 IGO); data: NAMRIA, PSA, OCHA Philippines",
        "features": [{"type": "Feature", "properties": {"n": display(n)}, "geometry": rounded(g)} for n, g in provinces],
    }

    # Areas for region-average analysis: every province, region, island
    # group and the whole country, with each square weighted by how much of
    # the area's land falls inside it.
    import re

    def slug(kind: str, name: str) -> str:
        return kind[0] + "-" + re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()).strip("-")

    groups: dict[str, list] = {}
    for name, geom in regions:
        groups.setdefault(ISLAND_GROUP[name], []).append(geom)
    area_shapes = (
        [("province", n, g) for n, g in provinces]
        + [("region", n, g) for n, g in regions]
        + [("group", n, unary_union(gs)) for n, gs in groups.items()]
        + [("country", "Philippines", land)]
    )
    cell_set = {(c["lat"], c["lon"]) for c in cell_list}
    areas = []
    for kind, name, geom in area_shapes:
        minx, miny, maxx, maxy = geom.bounds
        weights = []
        lat = snap(miny, minx).lat
        while lat <= maxy + DLAT:
            lon = snap(lat, minx).lon
            while lon <= maxx + DLON:
                c = snap(lat, lon)
                if (c.lat, c.lon) in cell_set:
                    b = box(c.lon - DLON / 2, c.lat - DLAT / 2, c.lon + DLON / 2, c.lat + DLAT / 2)
                    a = geom.intersection(b).area
                    if a > 0:
                        weights.append([c.lat, c.lon, round(a, 6)])
                lon += DLON
            lat += DLAT
        if not weights:
            continue
        total = sum(w for *_, w in weights)
        weights = [[la, lo, round(w / total, 5)] for la, lo, w in weights]
        areas.append({"id": slug(kind, name), "name": display(name), "kind": kind, "squares": weights})
    (ROOT / "tools" / "ph_areas.json").write_text(json.dumps({"areas": areas}, ensure_ascii=False))

    # Searchable entries for island groups and the whole country, and area ids
    # on provinces and regions so a pick can open an area-average case.
    ids = {(a["kind"], a["name"]): a["id"] for a in areas}
    for pl in places:
        if pl["k"] in ("province", "region"):
            pl["a"] = ids.get((pl["k"], pl["n"]))
    for kind, name, geom in area_shapes:
        if kind in ("group", "country"):
            pt = geom.representative_point()
            places.append({"n": name, "k": kind, "a": ids.get((kind, display(name))),
                           "lat": round(pt.y, 4), "lon": round(pt.x, 4)})

    OUT_WEB.mkdir(parents=True, exist_ok=True)
    (OUT_WEB / "ph_places.json").write_text(json.dumps(
        {"attribution": outlines["attribution"], "places": places}, ensure_ascii=False, separators=(",", ":")))
    (OUT_WEB / "ph_provinces.geojson").write_text(json.dumps(outlines, ensure_ascii=False, separators=(",", ":")))
    (ROOT / "tools" / "ph_cells.json").write_text(json.dumps({"dlat": DLAT, "dlon": DLON, "cells": cell_list}))

    kinds = {k: sum(1 for p in places if p["k"] == k) for k in ("country", "group", "region", "province", "town")}
    print(f"places: {kinds}; land cells: {len(cell_list)} (town cells {len(town_cells)}); areas: {len(areas)}")


if __name__ == "__main__":
    main()

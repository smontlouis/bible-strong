#!/usr/bin/env python3
"""Draws the ground of the atlas map: land, lakes and rivers of the biblical world.

The atlas places every located place of the entity publication on one map (ADR-0091). This
writes `public/atlas/map.svg`, whose shapes carry no colour: the page draws them with
`<use href="/atlas/map.svg#land">` and colours them from its theme.

Two levels of detail: the whole region from Natural Earth at 1:10m simplified to about 5 km,
and the land between Sinai and Damascus, where most places lie, simplified to about 500 m.

Natural Earth is in the public domain. Download its GeoJSON files (v5.1.2) next to each other:
  ne_10m_land.geojson, ne_10m_lakes.geojson, ne_10m_rivers_lake_centerlines.geojson
then run from `apps/site`, with shapely installed:
  python3 scripts/build-atlas-map.py <folder of the GeoJSON files>

The projection is `@bible-strong/resource-domain/biblical-map`; change both together. The same
shapes are written as path strings for the application, which draws them inline, to
`packages/biblical-map/src/groundPaths.ts`.
"""
import json
import math
import sys
from pathlib import Path

from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

# The map: from Rome to Persia, from the Black Sea to Upper Egypt.
WEST, EAST, SOUTH, NORTH = 8.0, 54.0, 20.0, 44.0
# Where most places lie: Sinai to Damascus.
DETAIL = (33.0, 28.0, 38.5, 34.5)
PARALLEL = 32.0
UNIT = 100  # SVG units per degree of latitude

OUT = Path(__file__).resolve().parents[1] / 'public/atlas/map.svg'
APP_OUT = Path(__file__).resolve().parents[3] / 'packages/biblical-map/src/groundPaths.ts'


def project(lon: float, lat: float) -> tuple[float, float]:
    return ((lon - WEST) * math.cos(math.radians(PARALLEL)) * UNIT, (NORTH - lat) * UNIT)


def path_of(geometry) -> str:
    parts = []

    def ring(coords, close=True):
        points = [project(lon, lat) for lon, lat in coords]
        if len(points) < 2:
            return
        head, *tail = points
        parts.append(f'M{head[0]:.1f} {head[1]:.1f}' + ''.join(f'L{x:.1f} {y:.1f}' for x, y in tail) + ('Z' if close else ''))

    def walk(geom):
        kind = geom.geom_type
        if kind == 'Polygon':
            ring(geom.exterior.coords)
            for interior in geom.interiors:
                ring(interior.coords)
        elif kind == 'LineString':
            ring(geom.coords, close=False)
        elif hasattr(geom, 'geoms'):
            for part in geom.geoms:
                walk(part)

    walk(geometry)
    return ''.join(parts)


def read(folder: Path, name: str, area):
    data = json.loads((folder / f'{name}.geojson').read_text())
    shapes = [shape(feature['geometry']) for feature in data['features']]
    return unary_union([item.intersection(area) for item in shapes if item.intersects(area)])


def main() -> None:
    folder = Path(sys.argv[1])
    region = box(WEST, SOUTH, EAST, NORTH)
    detail = box(*DETAIL)
    land = read(folder, 'ne_10m_land', region)
    lakes = read(folder, 'ne_10m_lakes', region)
    rivers = read(folder, 'ne_10m_rivers_lake_centerlines', region)

    coarse, fine = 0.05, 0.005
    shapes = {
        'land': land.difference(detail).simplify(coarse).union(land.intersection(detail).simplify(fine)),
        'lakes': lakes.simplify(fine),
        'rivers': rivers.simplify(coarse / 2),
    }
    width, height = project(EAST, SOUTH)
    # Paths in the coordinates of the page's own map, which places them with `<use>` at its origin.
    symbols = ''.join(f'<path id="{key}" d="{path_of(geometry)}"/>' for key, geometry in shapes.items())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}">'
        '<!-- Natural Earth (public domain), drawn by scripts/build-atlas-map.py -->'
        f'{symbols}</svg>\n'
    )
    print(f'{OUT}: {OUT.stat().st_size // 1024} KB, {width:.0f} x {height:.0f}')
    APP_OUT.parent.mkdir(parents=True, exist_ok=True)
    APP_OUT.write_text(
        '// The ground of the map of the places of the Bible: Natural Earth (public domain), drawn by\n'
        '// apps/site/scripts/build-atlas-map.py in the projection of @bible-strong/resource-domain/biblical-map.\n'
        '// Do not edit: run the script again.\n'
        + ''.join(f"export const BIBLICAL_MAP_{key.upper()} =\n  '{path_of(geometry)}'\n" for key, geometry in shapes.items())
    )
    print(f'{APP_OUT}: {APP_OUT.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()

"""Valence 1876: navigation document, occluder cutouts and reachable anchors.

Inputs (ignored workbench, art-workbench/experiments/valence-1876/):
- map/x2.png: the HD map at two pixels per map unit.
- sam/ground/output-*.png: SAM 3 "paved ground" masks at x2.
- objects/runs/*/masks.json: SAM 3 object masks per crop and prompt (first pass, large crops).
- objects/runs-dense/*/masks.json: the dense pass (scripts/valence/pipeline/detect-dense.py), 45
  small crops so that groves are not cut at SAM's 32 masks; its ground prompts widen the floor.
- scripts/valence/navigation-edits.json (committed): reviewed manual additions and blocks.

Outputs:
- public/valence-1876/navigation.json, only if missing or with --reset-navigation: the editable
  walkable polygons and obstacles. Once edited in the workshop it is the source of truth.
- public/valence-1876/layout.json, only if missing or with --reset-layout: arrival, stations,
  labels, objects and dotted thread, snapped to reachable ground.
- public/valence-1876/occlusion/*.webp and src/valence/generated/occluders.json, always.
- art-workbench/.../review/*.png: overlays for visual review.

Run from apps/world: art-workbench/.venv-tools/bin/python scripts/valence/build_navigation.py
"""
import json
import os
import shutil
import sys

import cv2
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WORK = os.path.join(ROOT, 'art-workbench', 'experiments', 'valence-1876')
EDITS = os.path.join(os.path.dirname(__file__), 'navigation-edits.json')
W, H = 1672, 941
RESET_NAVIGATION = '--reset-navigation' in sys.argv
RESET_LAYOUT = '--reset-layout' in sys.argv
S = 2  # pixels per map unit in the working rasters
RADIUS = 7  # avatar clearance, as in src/world.ts
MARGIN = 1.5  # polygon simplification can narrow a corridor by about one unit

FAMILY = {
    'tree': 'tree', 'cypress-tree': 'tree', 'street-lamp': 'lamp', 'lamp-post': 'lamp',
    'building': 'building', 'market-stall': 'stall', 'statue': 'statue', 'bandstand': 'bandstand',
    'steam-locomotive': 'locomotive', 'wooden-crate': 'crate', 'cannon': 'cannon', 'bench': 'bench',
    'stone-wall': 'wall', 'staircase': 'stairs', 'bush': 'bush',
}
# Dense-pass prompts that describe ground a visitor can stand on.
GROUND_PROMPTS = {'paved-ground', 'cobblestone-street', 'stone-quay', 'wooden-pier', 'staircase', 'bridge-deck', 'courtyard'}
# Ground drawn over the river: piers, pontoons and the bridge deck.
OVER_WATER = {'wooden-pier', 'bridge-deck'}
# Objects standing on open ground: their silhouette is walkable, only their footprint blocks.
STANDING = {'tree', 'bush', 'lamp', 'statue', 'bandstand', 'stall', 'crate', 'cannon', 'bench'}
MAX_AREA = {'building': 520000, 'wall': 160000, 'stairs': 80000, 'bandstand': 90000, 'stall': 70000}


def poly_mask(points, value=1, mask=None):
    mask = np.zeros((H * S, W * S), np.uint8) if mask is None else mask
    cv2.fillPoly(mask, [np.array([[x * S, y * S] for x, y in points], np.int32)], value)
    return mask


def run_files():
    for folder in ('runs', 'runs-dense'):
        runs = os.path.join(WORK, 'objects', folder)
        if not os.path.isdir(runs):
            continue
        for name in sorted(os.listdir(runs)):
            path = os.path.join(runs, name, 'masks.json')
            if os.path.exists(path):
                yield folder, json.load(open(path))


def load_ground():
    """Dense-pass ground masks at x2: (ground, over-water ground)."""
    ground = np.zeros((H * S, W * S), np.uint8)
    over = np.zeros_like(ground)
    for folder, data in run_files():
        slug = data['prompt'].replace(' ', '-')
        if folder != 'runs-dense' or slug not in GROUND_PROMPTS:
            continue
        x0, y0, cw, ch = data['crop']
        for entry in data['masks']:
            if (entry.get('score') or 0) < 0.35:
                continue
            crop = cv2.imread(entry['file'], cv2.IMREAD_UNCHANGED)
            if crop is None:
                continue
            if crop.ndim == 3:
                crop = crop[..., -1] if crop.shape[2] == 4 else crop[..., 0]
            target = over if slug in OVER_WATER else ground
            target[y0:y0 + ch, x0:x0 + cw] |= (crop > 127).astype(np.uint8)
    return ground, over


def load_objects():
    objects = []
    for folder, data in run_files():
        x0, y0, cw, ch = data['crop']
        slug = data['prompt'].replace(' ', '-')
        if folder == 'runs-dense' and slug in GROUND_PROMPTS:
            continue
        family = FAMILY.get(slug)
        if not family:
            continue
        for entry in data['masks']:
            crop = cv2.imread(entry['file'], cv2.IMREAD_UNCHANGED)
            if crop is None:
                continue
            if crop.ndim == 3:
                crop = crop[..., -1] if crop.shape[2] == 4 else crop[..., 0]
            crop = (crop > 127).astype(np.uint8)
            area = int(crop.sum())
            if area < 260 or area > MAX_AREA.get(family, 60000):
                continue
            ys, xs = np.nonzero(crop)
            # A mask cut by the crop edge is incomplete; another crop holds it whole.
            if (xs.min() <= 1 and x0 > 0) or (ys.min() <= 1 and y0 > 0) or (
                xs.max() >= cw - 2 and x0 + cw < W * S) or (ys.max() >= ch - 2 and y0 + ch < H * S):
                continue
            objects.append({
                'family': family, 'score': entry.get('score') or 0, 'area': area,
                'box': (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1),
                'crop': crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1],
            })
    return objects


def overlap(a, b):
    ax0, ay0, ax1, ay1 = a['box']
    bx0, by0, bx1, by1 = b['box']
    x0, y0, x1, y1 = max(ax0, bx0), max(ay0, by0), min(ax1, bx1), min(ay1, by1)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    ma = a['crop'][y0 - ay0:y1 - ay0, x0 - ax0:x1 - ax0]
    mb = b['crop'][y0 - by0:y1 - by0, x0 - bx0:x1 - bx0]
    inter = int((ma & mb).sum())
    return inter / max(1, min(a['area'], b['area']))


def dedupe(objects):
    kept = []
    for obj in sorted(objects, key=lambda o: (-o['score'], -o['area'])):
        same = [k for k in kept if (k['family'] == obj['family'] or {k['family'], obj['family']} <= STANDING) and overlap(k, obj) > 0.55]
        if not same:
            kept.append(obj)
    return kept


def full_mask(obj):
    mask = np.zeros((H * S, W * S), np.uint8)
    x0, y0, x1, y1 = obj['box']
    mask[y0:y1, x0:x1] = obj['crop']
    return mask


def footprint(obj):
    """The part of a standing object that touches the ground, in x2 pixels."""
    x0, y0, x1, y1 = obj['box']
    crop = obj['crop']
    height = y1 - y0
    if obj['family'] in ('tree', 'bush'):
        ys, xs = np.nonzero(crop[int(height * 0.8):])
        bottom = y1 - 1
        cx = x0 + (int(np.median(xs)) if len(xs) else (x1 - x0) // 2)
        # The trunk only, as in the archipelago: visitors pass close to and behind the canopy.
        rx = max(3 * S, min(10 * S, (x1 - x0) * (0.09 if obj['family'] == 'tree' else 0.18)))
        footprint = np.zeros((H * S, W * S), np.uint8)
        cv2.ellipse(footprint, (int(cx), int(bottom - 2.5 * S)), (int(rx), int(2.5 * S)), 0, 0, 360, 1, -1)
        return footprint
    band = int(np.clip(height * (0.34 if obj['family'] in ('bandstand', 'stall') else 0.22), 4 * S, 44 * S))
    part = np.zeros_like(crop)
    part[height - band:] = crop[height - band:]
    points = cv2.findNonZero(part)
    footprint = np.zeros((H * S, W * S), np.uint8)
    if points is not None:
        hull = cv2.convexHull(points) + np.array([x0, y0])
        cv2.fillPoly(footprint, [hull.astype(np.int32)], 1)
    return footprint


def contours_to_zones(mask, kind, prefix, epsilon=1.2):
    zones = []
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if hierarchy is None:
        return zones
    for index, contour in enumerate(contours):
        parent = hierarchy[0][index][3]
        is_hole = parent != -1
        if cv2.contourArea(contour) < (12 if is_hole else 6) * S * S:
            continue
        approx = cv2.approxPolyDP(contour, epsilon * S, True)
        if len(approx) < 3:
            continue
        points = [[round(float(p[0][0]) / S, 1), round(float(p[0][1]) / S, 1)] for p in approx]
        zone_kind = ('blocked' if kind == 'allowed' else 'allowed') if is_hole else kind
        zones.append({'id': f'{prefix}-{len(zones)}', 'name': f'{prefix} {len(zones)}', 'kind': zone_kind, 'points': points})
    return zones


FAMILY_NAMES = {
    'tree': 'Pied d’arbre', 'lamp': 'Réverbère', 'statue': 'Statue', 'bandstand': 'Kiosque',
    'stall': 'Étal', 'crate': 'Caisses', 'bush': 'Pied de buisson', 'cannon': 'Canon', 'bench': 'Banc', 'building': 'Bâtiment',
    'wall': 'Muret',
}


def simplified(contour, limit=240):
    epsilon = 1.0 * S
    approx = cv2.approxPolyDP(contour, epsilon, True)
    while len(approx) > limit:
        epsilon *= 1.25
        approx = cv2.approxPolyDP(contour, epsilon, True)
    return [[round(float(p[0][0]) / S, 1), round(float(p[0][1]) / S, 1)] for p in approx]


def editable_pieces(outer, limit=240):
    """Walkable polygons without holes, split in halves until each fits the editor limit."""
    pieces = []

    def visit(x0, y0, x1, y1):
        o = 4 * S
        clip = np.zeros_like(outer)
        clip[max(0, y0 - o):y1 + o, max(0, x0 - o):x1 + o] = outer[max(0, y0 - o):y1 + o, max(0, x0 - o):x1 + o]
        contours, _ = cv2.findContours(clip, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        contours = [c for c in contours if cv2.contourArea(c) >= 30 * S * S]
        exact = [cv2.approxPolyDP(c, 1.0 * S, True) for c in contours]
        if all(len(a) <= limit for a in exact) or (x1 - x0) < 60 * S:
            for contour in contours:
                pieces.append(simplified(contour, limit))
            return
        if (x1 - x0) >= (y1 - y0):
            middle = (x0 + x1) // 2
            visit(x0, y0, middle, y1)
            visit(middle, y0, x1, y1)
        else:
            middle = (y0 + y1) // 2
            visit(x0, y0, x1, middle)
            visit(x0, middle, x1, y1)

    visit(0, 0, W * S, H * S)
    return [{'id': f'sol-{i + 1}', 'name': f'Sol {i + 1}', 'kind': 'allowed', 'points': points} for i, points in enumerate(pieces)]


def obstacle_zones(holes, objects, edits):
    """Each hole in the walkable ground becomes one named obstacle."""
    zones = []
    contours, _ = cv2.findContours(holes, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    named = [(poly_mask(e['points']), e['name']) for e in edits['blocked']]
    for contour in contours:
        if cv2.contourArea(contour) < 6 * S * S:
            continue
        mask = np.zeros_like(holes)
        cv2.drawContours(mask, [contour], -1, 1, -1)
        name = next((label for m, label in named if (m & mask).sum() > 0.3 * mask.sum()), None)
        if not name:
            best, family = 0, None
            for obj in objects:
                ox0, oy0, ox1, oy1 = obj['box']
                inter = mask[oy0:oy1, ox0:ox1].sum()
                if inter > best:
                    best, family = inter, obj['family']
            name = FAMILY_NAMES.get(family, 'Bordure') if best > 0.2 * mask.sum() else 'Bordure'
        points = simplified(contour)
        if len(points) >= 3:
            zones.append({'id': f'obstacle-{len(zones) + 1}', 'name': f'{name} {len(zones) + 1}', 'kind': 'blocked', 'points': points})
    return zones


def thread_paths(reachable, anchors, order):
    import heapq
    # Max-pool to one cell per map unit so one-pixel corridors stay connected.
    grid = (cv2.resize(cv2.dilate(reachable, np.ones((3, 3), np.uint8)).astype(np.float32), (W, H), interpolation=cv2.INTER_AREA) > 0).astype(np.uint8)
    distance = cv2.distanceTransform(grid, cv2.DIST_L2, 5)
    cost = np.where(grid > 0, 1.0 + 6.0 / (1.0 + distance), np.inf)
    paths = []
    for a, b in zip(order, order[1:]):
        sx, sy = [int(round(v)) for v in anchors['stations'][a]]
        gx, gy = [int(round(v)) for v in anchors['stations'][b]]
        best = np.full(grid.shape, np.inf)
        parent = {}
        best[sy, sx] = 0
        queue = [(0.0, sx, sy)]
        while queue:
            d, x, y = heapq.heappop(queue)
            if (x, y) == (gx, gy):
                break
            if d > best[y, x]:
                continue
            for dx, dy, step in ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= W or ny >= H or not np.isfinite(cost[ny, nx]):
                    continue
                nd = d + step * cost[ny, nx]
                if nd < best[ny, nx]:
                    best[ny, nx] = nd
                    parent[(nx, ny)] = (x, y)
                    heapq.heappush(queue, (nd, nx, ny))
        node = (gx, gy)
        line = [node]
        while node in parent:
            node = parent[node]
            line.append(node)
        line.reverse()
        if line[0] != (sx, sy):
            raise SystemExit(f'thread {a} -> {b}: no path')
        simplified = cv2.approxPolyDP(np.array(line, np.int32).reshape(-1, 1, 2), 2.5, False)
        paths.append([[int(p[0][0]), int(p[0][1])] for p in simplified])
    return paths


def main():
    edits = json.load(open(EDITS))
    x2 = cv2.imread(os.path.join(WORK, 'map', 'x2.png'))
    ground = np.zeros((H * S, W * S), np.uint8)
    for name in sorted(os.listdir(os.path.join(WORK, 'sam', 'ground'))):
        if name.startswith('output-') and name != 'output-0.png':
            ground |= (cv2.imread(os.path.join(WORK, 'sam', 'ground', name), 0) > 127).astype(np.uint8)
    objects = dedupe(load_objects())
    # The dense pass adds streets, quays, courtyards and stairs the first pass missed. The river
    # and the buildings are never ground; piers and the bridge deck are, even over the water.
    dense, over_water = load_ground()
    ground |= dense
    effects = json.load(open(os.path.join(ROOT, 'public', 'valence-1876', 'effects.json')))
    ground = poly_mask(effects['river'], 0, ground)
    for obj in objects:
        if obj['family'] == 'building':
            ground &= 1 - full_mask(obj)
    ground |= over_water
    walk = ground.copy()
    blocked = np.zeros_like(ground)
    for poly in edits['allowed']:
        walk = poly_mask(poly['points'], 1, walk)
    for poly in edits['removed']:
        walk = poly_mask(poly['points'], 0, walk)
    # SAM leaves a halo of unclassified ground around each object: measure support beyond it,
    # then fill the halo so the avatar can pass behind canopies and roofs. Any standing object
    # inside walkable ground blocks only its footprint.
    halo = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))
    reach = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (71, 71))
    base_walk = walk.copy()
    for obj in objects:
        if obj['family'] not in STANDING:
            continue
        mask = full_mask(obj)
        near = cv2.dilate(mask, halo)
        ring = cv2.dilate(mask, reach) & (1 - near)
        support = (ring & ground).sum() / max(1, ring.sum())
        inside = (mask & base_walk).sum() / max(1, mask.sum())
        obj['standing'] = support > 0.35 or inside > 0.25
        if obj['standing']:
            walk |= near
            blocked |= footprint(obj)
    for poly in edits['removed']:
        walk = poly_mask(poly['points'], 0, walk)
    for poly in edits['blocked']:
        blocked = poly_mask(poly['points'], 1, blocked)
    walk = cv2.morphologyEx(walk, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    walk = cv2.morphologyEx(walk, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    usable = walk & (1 - blocked)
    cv2.imwrite(os.path.join(WORK, 'review', 'walk.png'), walk * 255)
    cv2.imwrite(os.path.join(WORK, 'review', 'blocked.png'), blocked * 255)
    # Keep only ground connected to the station, eroded by the avatar's clearance.
    reach_radius = int(round((RADIUS + MARGIN) * S))
    clearance = cv2.erode(usable, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * reach_radius + 1, 2 * reach_radius + 1)))
    count, labels = cv2.connectedComponents(clearance)
    spawn = edits['spawn']
    sx, sy = int(spawn[0] * S), int(spawn[1] * S)
    label = labels[sy, sx]
    if label == 0:
        ys, xs = np.nonzero(clearance)
        nearest = np.argmin((xs - sx) ** 2 + (ys - sy) ** 2)
        label = labels[ys[nearest], xs[nearest]]
    reachable = (labels == label).astype(np.uint8)
    reach_zone = cv2.dilate(reachable, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * RADIUS * S + 3, 2 * RADIUS * S + 3))) & usable
    allowed_mask = reach_zone
    cv2.imwrite(os.path.join(WORK, 'review', 'allowed.png'), allowed_mask * 255)
    # Editable document: a few large walkable polygons (at most 240 points each, split along
    # straight seams only when needed) and every hole as an obstacle. The runtime tiles the
    # walkable polygons for the pathfinder (src/valence/navigation-tiles.ts).
    outer = np.zeros_like(allowed_mask)
    contours, _ = cv2.findContours(allowed_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(outer, contours, -1, 1, -1)
    zones = editable_pieces(outer)
    holes = (outer & (1 - allowed_mask)).astype(np.uint8)
    zones += obstacle_zones(holes, objects, edits)
    navigation = {'version': 1, 'map': 'valence-1876', 'width': W, 'height': H, 'zones': zones}
    os.makedirs(os.path.join(ROOT, 'public', 'valence-1876'), exist_ok=True)
    navigation_file = os.path.join(ROOT, 'public', 'valence-1876', 'navigation.json')
    if RESET_NAVIGATION or not os.path.exists(navigation_file):
        with open(navigation_file, 'w') as handle:
            handle.write(json.dumps(navigation, indent=2) + '\n')
        print(f'navigation.json written: {len(zones)} zones')
    else:
        print('navigation.json kept (edited in the workshop); pass --reset-navigation to rebuild it')

    def snap(point, margin=2):
        x, y = int(point[0] * S), int(point[1] * S)
        inner = cv2.erode(reachable, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * margin * S + 1, 2 * margin * S + 1)))
        ys, xs = np.nonzero(inner)
        nearest = np.argmin((xs - x) ** 2 + (ys - y) ** 2)
        return [round(float(xs[nearest]) / S, 1), round(float(ys[nearest]) / S, 1)], float(np.hypot(xs[nearest] - x, ys[nearest] - y) / S)

    anchors = {'spawn': snap(spawn)[0], 'stations': {}, 'objects': {}}
    report = []
    for key, value in edits['stations'].items():
        anchors['stations'][key], moved = snap(value)
        report.append(f'station {key}: moved {moved:.1f}')
    for key, value in edits['objects'].items():
        anchors['objects'][key], moved = snap(value, 3)
        report.append(f'object {key}: moved {moved:.1f}')
    anchors['thread'] = thread_paths(reachable, anchors, edits['thread'])
    # Thread ends sit exactly on their stations, not on the rounded search grid.
    for index, line in enumerate(anchors['thread']):
        line[0] = anchors['stations'][edits['thread'][index]]
        line[-1] = anchors['stations'][edits['thread'][index + 1]]
    layout = {
        'version': 1,
        'spawn': anchors['spawn'],
        'stations': anchors['stations'],
        'labels': edits['labels'],
        'objects': anchors['objects'],
        # The train back to the archipelago, on the platform beside the locomotive.
        'portal': snap(edits['portal'])[0],
        'portalLabel': edits['portalLabel'],
        'thread': anchors['thread'],
    }
    layout_file = os.path.join(ROOT, 'public', 'valence-1876', 'layout.json')
    if RESET_LAYOUT or not os.path.exists(layout_file):
        with open(layout_file, 'w') as handle:
            handle.write(json.dumps(layout, indent=2) + '\n')
        print('layout.json written')
    else:
        print('layout.json kept (edited in the workshop); pass --reset-layout to rebuild it')

    # Occluders: only objects that can stand in front of a walkable point behind them. Once the
    # navigation is edited in the workshop, its walkable zones decide, not the detected ground.
    if not RESET_NAVIGATION:
        edited = json.load(open(navigation_file))
        reachable = np.zeros((H * S, W * S), np.uint8)
        for zone in edited['zones']:
            if zone['kind'] == 'allowed':
                reachable = poly_mask(zone['points'], 1, reachable)
        for zone in edited['zones']:
            if zone['kind'] == 'blocked':
                reachable = poly_mask(zone['points'], 0, reachable)
    out_dir = os.path.join(ROOT, 'public', 'valence-1876', 'occlusion')
    shutil.rmtree(out_dir, ignore_errors=True)
    os.makedirs(out_dir)
    manifest = []
    counters = {}
    for obj in sorted(objects, key=lambda o: o['box'][3]):
        if obj['family'] in ('stairs',):
            continue
        x0, y0, x1, y1 = obj['box']
        strips = [(x0, x1)]
        if (x1 - x0) > 90 * S and obj['family'] in ('building', 'wall', 'stall'):
            step = 48 * S
            strips = [(sx0, min(x1, sx0 + step)) for sx0 in range(x0, x1, step)]
        for sx0, sx1 in strips:
            crop = obj['crop'][:, sx0 - x0:sx1 - x0]
            rows = np.nonzero(crop.any(axis=1))[0]
            if len(rows) == 0:
                continue
            top, bottom = y0 + rows[0], y0 + rows[-1] + 1
            base = bottom / S
            # Is there reachable ground hidden behind this piece?
            region = reachable[top:bottom, sx0:sx1].copy()
            local = crop[rows[0]:rows[-1] + 1]
            region = region[:local.shape[0], :local.shape[1]] & local
            behind = region[: max(1, local.shape[0] - 6 * S)].sum()
            if behind < 40:
                continue
            # Reviewed areas where an automatic cutout would cover an animated scene.
            centre = ((sx0 + sx1) / 2 / S, (top + bottom) / 2 / S)
            if any(cv2.pointPolygonTest(np.array(z['points'], np.float32), centre, False) >= 0 for z in edits.get('noOccluders', [])):
                continue
            family = obj['family']
            counters[family] = counters.get(family, 0) + 1
            oid = f"{family}-{counters[family]:02d}"
            alpha = np.zeros((bottom - top, sx1 - sx0), np.uint8)
            alpha[:local.shape[0], :local.shape[1]] = local * 255
            alpha = cv2.GaussianBlur(alpha, (3, 3), 0.6)
            rgb = x2[top:bottom, sx0:sx1]
            rgba = np.dstack([rgb, alpha])
            cv2.imwrite(os.path.join(out_dir, f'{oid}.webp'), rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
            manifest.append({
                'id': oid, 'name': f'{family} {counters[family]}',
                'x': round(sx0 / S, 1), 'y': round(top / S, 1),
                'width': round((sx1 - sx0) / S, 1), 'height': round((bottom - top) / S, 1),
                'baseY': round(base, 1), 'url': f'./valence-1876/occlusion/{oid}.webp',
            })
    # Reviewed cutouts SAM has no prompt for (bridge railing, laundry frames...): a polygon of
    # the map, cut in 48-unit strips when wide so each strip sorts by its own ground line.
    for item in edits.get('occluders', []):
        mask = poly_mask(item['points'])
        ys, xs = np.nonzero(mask)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        step = 48 * S
        strips = [(sx0, min(x1, sx0 + step)) for sx0 in range(x0, x1, step)] if (x1 - x0) > 90 * S and not item.get('whole') else [(x0, x1)]
        for index, (sx0, sx1) in enumerate(strips):
            local = mask[y0:y1, sx0:sx1]
            rows = np.nonzero(local.any(axis=1))[0]
            if len(rows) == 0:
                continue
            top, bottom = y0 + rows[0], y0 + rows[-1] + 1
            oid = f"manual-{item['id']}-{index + 1}" if len(strips) > 1 else f"manual-{item['id']}"
            alpha = cv2.GaussianBlur(mask[top:bottom, sx0:sx1] * 255, (3, 3), 0.6)
            cv2.imwrite(os.path.join(out_dir, f'{oid}.webp'), np.dstack([x2[top:bottom, sx0:sx1], alpha]), [cv2.IMWRITE_WEBP_QUALITY, 92])
            manifest.append({
                'id': oid, 'name': item['name'],
                'x': round(sx0 / S, 1), 'y': round(top / S, 1),
                'width': round((sx1 - sx0) / S, 1), 'height': round((bottom - top) / S, 1),
                'baseY': item.get('baseY', round(bottom / S, 1)), 'url': f'./valence-1876/occlusion/{oid}.webp',
            })
    manifest.sort(key=lambda o: o['baseY'])
    with open(os.path.join(ROOT, 'src', 'valence', 'generated', 'occluders.json'), 'w') as handle:
        json.dump(manifest, handle, indent=1)
        handle.write('\n')

    # Review overlays.
    review = os.path.join(WORK, 'review')
    os.makedirs(review, exist_ok=True)
    over = x2.copy()
    over[allowed_mask > 0] = (over[allowed_mask > 0] * 0.55 + np.array([60, 200, 60]) * 0.45).astype(np.uint8)
    over[blocked > 0] = (over[blocked > 0] * 0.4 + np.array([40, 40, 220]) * 0.6).astype(np.uint8)
    for item in manifest:
        cv2.rectangle(over, (int(item['x'] * S), int(item['y'] * S)), (int((item['x'] + item['width']) * S), int(item['y'] * S + item['height'] * S)), (0, 190, 255), 1)
        cv2.line(over, (int(item['x'] * S), int(item['baseY'] * S)), (int((item['x'] + item['width']) * S), int(item['baseY'] * S)), (0, 120, 255), 2)
    for key, (x, y) in anchors['stations'].items():
        cv2.circle(over, (int(x * S), int(y * S)), 9, (255, 40, 40), -1)
        cv2.putText(over, key, (int(x * S) + 10, int(y * S)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (120, 0, 0), 2)
    for key, (x, y) in anchors['objects'].items():
        cv2.circle(over, (int(x * S), int(y * S)), 7, (200, 0, 200), -1)
        cv2.putText(over, key, (int(x * S) + 9, int(y * S)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (120, 0, 120), 2)
    cv2.imwrite(os.path.join(review, 'navigation.png'), over)
    cv2.imwrite(os.path.join(review, 'navigation-small.png'), cv2.resize(over, (W, H), interpolation=cv2.INTER_AREA))
    print(f'{len(objects)} objects after dedupe, {len(manifest)} occluder pieces, {len(zones)} zones '
          f'({sum(len(z["points"]) for z in zones)} points)')
    print('\n'.join(report))


if __name__ == '__main__':
    main()

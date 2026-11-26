"""Place every collection under its immutable key and write daily-readings/catalog.json; check all."""
import datetime, gzip, hashlib, json, pathlib, shutil
from paths import BUILD as B, OUT
scenes = json.load(open(B / 'scenes.json'))
books = json.load(open(OUT / 'books.json'))
root = B / 'daily-readings'
if root.exists(): shutil.rmtree(root)
collections, problems, total_gz = {}, [], 0
files = sorted(B.glob('verse-meditations-*.json')) + sorted(p for p in B.glob('*.json') if p.stem in books)
for f in files:
    raw = f.read_bytes(); doc = json.loads(raw)
    h = hashlib.sha256(raw).hexdigest()[:12]
    (root / doc['id']).mkdir(parents=True, exist_ok=True)
    (root / doc['id'] / f'{h}.json').write_bytes(raw)
    for key, e in doc['entries'].items():
        if e['scene'] not in scenes: problems.append((doc['id'], key, 'scene', e['scene']))
        if not e['cards'] or e['cards'][0]['type'] not in ('verse', 'opening'): problems.append((doc['id'], key, 'first card'))
        for c in e['cards']:
            if not (c.get('text') or c.get('items')): problems.append((doc['id'], key, 'empty card', c['type']))
    for d, key in doc['calendar'].items():
        if key not in doc['entries']: problems.append((doc['id'], d, 'calendar'))
    days = sorted(doc['calendar'])
    for a, b in zip(days, days[1:]):
        if doc['entries'][doc['calendar'][a]]['scene'] == doc['entries'][doc['calendar'][b]]['scene']: problems.append((doc['id'], a, 'same scene'))
    gz = len(gzip.compress(raw, 9)); total_gz += gz
    collections[doc['id']] = {'hash': h, 'language': doc['language'], 'kind': doc['kind'], 'bytes': len(raw), 'days': len(doc['calendar'])}
catalog = {'format': 'bible-strong-daily-readings-catalog', 'version': 1,
           'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
           'collections': collections, 'scenes': scenes}
(root / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + '\n')
print(len(collections), 'collections;', sum(c['bytes'] for c in collections.values()) // 1000, 'KB raw,', total_gz // 1000, 'KB gzip; catalog', (root / 'catalog.json').stat().st_size, 'bytes')
print('problems:', len(problems), problems[:10])

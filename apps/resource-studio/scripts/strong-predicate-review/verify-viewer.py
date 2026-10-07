"""Verify the local viewer serves the sealed readers and matching review indexes."""
import argparse
import hashlib
import json
import sqlite3
import urllib.parse
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, required=True)
parser.add_argument('--url', default='http://localhost:4173')
args = parser.parse_args()
root = args.root.resolve()
studio = Path(__file__).resolve().parents[2]
delivery = json.loads((root / 'delivery-manifest.json').read_text())

def get(endpoint, **params):
    url = args.url + '/api/jsonl-bibles/' + endpoint
    if params:
        url += '?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)

def sha(file):
    digest = hashlib.sha256()
    with file.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

catalog = {v['id']: v for v in get('catalog')['versions']}
report = {'url': args.url, 'editions': {}, 'canaries': []}
for edition, sealed in delivery['editions'].items():
    entry = catalog[edition.upper() + '-CANDIDATE']
    preview = json.loads((studio / entry['manifestPath']).read_text())
    assert entry['available'] and entry['verseCount'] == 31169
    assert entry['sha256'] == sealed['readerSha256']
    assert sha(studio / entry['relativePath']) == sealed['readerSha256']
    assert preview['review']['ledgerSha256'] == sealed['ledgerSha256']
    assert sha(studio / entry['sqliteRelativePath']) == preview['outputSha256']
    with sqlite3.connect(f"file:{studio / entry['reviewRelativePath']}?mode=ro", uri=True) as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        metadata = dict(db.execute('SELECT key,value FROM Metadata'))
        assert metadata['readerSha256'] == sealed['readerSha256']
        assert metadata['ledgerSha256'] == sealed['ledgerSha256']
        counts = dict(verses=0, sourceUnits=0, visible=0, empty=0, unresolved=0)
        for (raw,) in db.execute('SELECT reviewJson FROM ReviewVerses'):
            row = json.loads(raw)
            assert row['available'] and row['unresolved'] == len(row['items'])
            assert len({x['sourceUnitId'] for x in row['items']}) == len(row['items'])
            counts['verses'] += 1
            for key in ['sourceUnits', 'visible', 'unresolved']:
                counts[key] += row[key]
            counts['empty'] += row['establishedEmpty']
    assert all(counts[key] == sealed['counts'][key] for key in counts)
    report['editions'][edition] = dict(counts=counts, readerSha256=entry['sha256'], ledgerSha256=metadata['ledgerSha256'])

def verse(book, chapter, number):
    data = get('chapter', versions='S21-CANDIDATE,NEG79-CANDIDATE', book=book, chapter=chapter)
    for version in data['versions']:
        assert all(v['review']['available'] for v in version['verses'])
    return next(v for v in data['versions'][0]['verses'] if v['verse'] == number)

alliance = verse('1Kgs', 8, 21)
assert 'H3772' not in alliance['text']
assert any('H3772' in x['strong'] and x['reason'] == 'predicate' for x in alliance['review']['items'])
glory = verse('Rev', 15, 4)
assert '<w strong="G1392">rendre gloire</w>' in glory['text']
witness = verse('1John', 1, 2)
assert '<w strong="G3140">témoins</w>' in witness['text']
christ = verse('1John', 1, 3)
assert 'strong="G2424 G5547"' in christ['text']
report['canaries'] = [alliance, glory, witness, christ]
report['status'] = 'matching-local-reader-and-review-indexes'
(root / 'viewer-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('Viewer verified: two complete readers, distinct unresolved occurrences, four canaries.')

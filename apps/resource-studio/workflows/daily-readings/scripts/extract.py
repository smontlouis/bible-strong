"""Read-only export of the meditation books of Firestore `plans`: each book's document and its
`plan-sections`. Reads with the operator's Firebase CLI session (run `npx firebase-tools@15
projects:list` first to refresh its token); writes nothing to Firestore.

Output, in outputs/daily-readings/: plans-summary.json, books.json and raw/<book>.json.
"""
import collections
import json
import pathlib
import urllib.parse
import urllib.request

from paths import OUT

BASE = 'https://firestore.googleapis.com/v1/projects/bible-strong-app/databases/(default)/documents'
BOOK_TYPES = ('Livre de méditation', 'Meditation Book')


def token():
    store = pathlib.Path.home() / '.config/configstore/firebase-tools.json'
    return json.loads(store.read_text())['tokens']['access_token']


def decode(value):
    if 'mapValue' in value:
        return {k: decode(v) for k, v in value['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in value:
        return [decode(v) for v in value['arrayValue'].get('values', [])]
    if 'integerValue' in value:
        return int(value['integerValue'])
    if 'timestampValue' in value:
        return value['timestampValue']
    for key in ('stringValue', 'doubleValue', 'booleanValue', 'nullValue', 'referenceValue'):
        if key in value:
            return value[key]
    return value


def get(path, params=None):
    url = BASE + path + ('?' + urllib.parse.urlencode(params) if params else '')
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token()})
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def list_all(path):
    documents, page = [], None
    while True:
        params = {'pageSize': 300, **({'pageToken': page} if page else {})}
        answer = get(path, params)
        documents += answer.get('documents', [])
        page = answer.get('nextPageToken')
        if not page:
            return documents


def fields(document):
    return {k: decode(v) for k, v in document.get('fields', {}).items()}


def main():
    (OUT / 'raw').mkdir(parents=True, exist_ok=True)
    plans = [(d['name'].split('/')[-1], fields(d)) for d in list_all('/plans')]
    summary = [{'id': pid, 'type': p.get('type'), 'lang': p.get('lang'), 'title': p.get('title')} for pid, p in plans]
    (OUT / 'plans-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=1))
    print(len(plans), 'plans', dict(collections.Counter(s['type'] for s in summary)))
    books = {pid: p for pid, p in plans if p.get('type') in BOOK_TYPES}
    (OUT / 'books.json').write_text(json.dumps(books, ensure_ascii=False, indent=1))
    for pid in books:
        sections = [{'_id': d['name'].split('/')[-1], **fields(d)} for d in list_all(f'/plans/{pid}/plan-sections')]
        (OUT / 'raw' / f'{pid}.json').write_text(json.dumps(sections, ensure_ascii=False))
        days = sum(len(s.get('readingSlices', [])) for s in sections)
        print(pid, books[pid].get('lang'), days, 'days')


if __name__ == '__main__':
    main()

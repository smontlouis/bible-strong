"""Cut the 19 devotional books into story cards (FORMAT.md v1) and check every cut.

Input: normalized.json (the application's own projection of the Firestore export, normalize.ts).
Rules:
- the author's text only; the only repair is a glued sentence boundary: a lost paragraph break in
  the books that lost all their paragraphs, a missing space in the others;
- cards are cut between paragraphs, else between sentences, never inside a sentence;
- the text joined back must equal the repaired source, whitespace aside.
"""
import hashlib, json, math, pathlib, random, re, sys, collections

from paths import BUILD, OUT, SCENE_LIBRARY
SCENES = [s['id'] for s in json.load(open(SCENE_LIBRARY / 'catalog.json'))]
PARAGRAPHLESS = {'365j', 'lbs', 'tpqir'}
CITATION = re.compile(r'^(?:AD|CTr|CC|AG|LVH|PG|FLB|VRP)\s+\d+\.\d+\s*$')
GLUE = re.compile(r'((?:[a-zà-ÿ0-9»”)\]’]|[^\S\n])[.!?…»”]*[.!?…][»”]?)([A-ZÀ-ÝÉ«“])')
ABBREV = {'cf', 'st', 'ste', 'mr', 'dr', 'etc', 'p', 'v', 'vv', 'ch', 'no', 'mt', 'jn', 'jc', 'vol', 'éd', 'ed', 'av', 'apr', 'env'}
SENTENCE_END = re.compile(r'(?<=[.!?…»”])\s+(?=[«“"A-ZÀ-ÝÉ0-9—–-])')
TARGET, MAX, MIN = 550, 650, 160
BODY_CITATION = re.compile(r'^[A-Z][A-Za-z]{0,6}\s+\d+(?:[.:]\d+)?\s*$')
DATE_SUFFIX = re.compile(r',\s*(?:\d{1,2}(?:er)?\s+\S+|\S+\s+\d{1,2})\s*$')

flags = collections.defaultdict(list)

def repair(book, text):
    def fix(m):
        before = text[:m.start(1) + len(m.group(1))]
        word = re.search(r'([A-Za-zÀ-ÿ]+)[.!?…»”]*$', before)
        token = (word.group(1) if word else '').lower()
        if token in ABBREV or (word and len(word.group(1)) == 1):
            flags[book].append(('kept-abbreviation', m.group(0)))
            return m.group(0)
        return m.group(1) + ('\n\n' if book in PARAGRAPHLESS else ' ') + m.group(2)
    text = GLUE.sub(fix, text)
    if book in PARAGRAPHLESS:
        text = re.sub(r'([.:?!…])\s?-\s+(?=[A-ZÀ-ÝÉ])', r'\1\n\n- ', text)
    return text

def sentences(paragraph):
    parts, out = SENTENCE_END.split(paragraph), []
    for p in parts:
        prev = out[-1] if out else ''
        last = re.search(r'([A-Za-zÀ-ÿ]+)\.$', prev)
        if out and last and (last.group(1).lower() in ABBREV or len(last.group(1)) == 1):
            out[-1] = prev + ' ' + p
        else:
            out.append(p)
    return out

END_OK = re.compile(r'([.!?…»”"’)\]]|\b[A-Z][A-Za-z]{0,6}\s+\d+[.:]\d+)\s*$')

def split_long(paragraph):
    tail = ''
    lines = paragraph.split('\n')
    if len(lines) > 1 and BODY_CITATION.match(lines[-1]):
        paragraph, tail = '\n'.join(lines[:-1]), lines[-1]
    ss = sentences(paragraph)
    k = max(1, math.ceil(len(paragraph) / TARGET))
    goal = len(paragraph) / k
    chunks, cur = [], ''
    for s in ss:
        if cur and len(cur) + 1 + len(s) > goal * 1.15 and len(chunks) < k - 1:
            chunks.append(cur); cur = s
        else:
            cur = f'{cur} {s}' if cur else s
    chunks.append(cur + ('\n' + tail if tail else ''))
    return chunks

def cut(body):
    paragraphs = []
    for p in (p.strip() for p in re.split(r'\n\s*\n|\n', body)):
        if not p: continue
        if paragraphs and BODY_CITATION.match(p): paragraphs[-1] += '\n' + p
        else: paragraphs.append(p)
    pieces = []  # [text, joiner-before]
    for p in paragraphs:
        chunks = split_long(p) if len(p) > MAX else [p]
        for i, c in enumerate(chunks):
            pieces.append([c, '\n\n' if i == 0 else ' '])
    # A piece sticks to the next one when cutting there would leave a card ending on « : », in the
    # middle of a hymn or a list, or would start a card with a short signature line.
    stick = []
    for i, (text, _) in enumerate(pieces):
        nxt = pieces[i + 1][0] if i + 1 < len(pieces) else None
        s_ = text.rstrip().endswith(':') or not END_OK.search(text)
        if nxt is not None and len(nxt) < 40 and not END_OK.search(nxt): s_ = True
        stick.append(s_)
    cards, cur, prev_sticks = [], '', False
    for (text, joiner), sticks in zip(pieces, stick):
        if cur and not prev_sticks and len(cur) + len(joiner) + len(text) > MAX:
            cards.append(cur); cur = text
        else:
            cur = f'{cur}{joiner}{text}' if cur else text
        prev_sticks = sticks
    if cur: cards.append(cur)
    if len(cards) > 1 and len(cards[-1]) < MIN and len(cards[-2]) + len(cards[-1]) <= MAX + 200:
        last = cards.pop()
        cards[-1] = cards[-1] + '\n\n' + last
    return cards

def squash(s):
    return re.sub(r'\s+', ' ', s).strip()

def build(book, data, seed_order):
    entries, calendar = {}, {}
    readings = data['readings']
    dated = sorted((r for r in readings if r.get('calendarDate')), key=lambda r: r['calendarDate'])
    rng = random.Random(book)
    order = SCENES[:]; rng.shuffle(order)
    scene_of = {r['id']: order[i % len(order)] for i, r in enumerate(dated)}
    undated = [r for r in readings if not r.get('calendarDate')]
    for i, r in enumerate(undated):
        scene_of[r['id']] = order[(len(dated) + i) % len(order)]
    for r in readings:
        opening = [s for s in r['slices'] if s.get('subType') == 'devotional']
        bodies = [s for s in r['slices'] if s.get('subType') != 'devotional']
        assert len(opening) == 1 and len(bodies) == 1, (book, r['id'])
        lines = opening[0]['description'].strip().split('\n')
        citation = '\n'.join(l.strip() for l in lines if CITATION.match(l.strip()))
        open_text = '\n'.join(l for l in lines if not CITATION.match(l.strip())).strip()
        source = bodies[0]['description']
        repaired = repair(book, source)
        cards = cut(repaired)
        if squash(' '.join(cards)) != squash(repaired) or any(BODY_CITATION.match(c.split('\n')[0]) for c in cards):
            flags[book].append(('text-mismatch', r['id'])); continue
        for c in cards:
            if len(c) > MAX + 250: flags[book].append(('long-card', r['id'], len(c)))
            if not END_OK.search(c.strip()): flags[book].append(('card-end', r['id'], c[-30:]))
        title = r.get('title') or ''
        original = next((x for x in data['raw_titles'].get(r['id'], []) ), title)
        stripped = DATE_SUFFIX.sub('', original).strip() if DATE_SUFFIX.search(original) else original
        entry = {'scene': scene_of[r['id']], 'title': stripped,
                 'cards': [{'type': 'opening', 'text': open_text, **({'citation': citation} if citation else {})}]
                          + [{'type': 'text', 'text': c} for c in cards],
                 'source': {'sha256': hashlib.sha256(json.dumps(r['slices'], ensure_ascii=False, sort_keys=True).encode()).hexdigest()}}
        key = str(r['id'])
        assert key not in entries, (book, key)
        entries[key] = entry
        if r.get('calendarDate'): calendar[r['calendarDate']] = key
    days = sorted(calendar)
    for a, b in zip(days, days[1:]):
        assert entries[calendar[a]]['scene'] != entries[calendar[b]]['scene']
    return {'format': 'bible-strong-daily-readings', 'version': 1, 'id': book, 'kind': 'devotional-book',
            'language': data['lang'], 'calendar': {d: calendar[d] for d in days}, 'entries': entries}

def main():
    normalized = json.load(open(OUT / 'normalized.json'))
    BUILD.mkdir(parents=True, exist_ok=True)
    stats = {}
    for book, data in normalized.items():
        raw = json.load(open(OUT / 'raw' / f'{book}.json'))
        data['raw_titles'] = {sl['id']: [sl['title']] for sec in raw for sl in sec['readingSlices']}
        doc = build(book, data, None)
        out = BUILD / f'{book}.json'
        out.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')))
        lens = sorted(len(c['text']) for e in doc['entries'].values() for c in e['cards'] if c['type'] == 'text')
        ncards = collections.Counter(sum(c['type'] == 'text' for c in e['cards']) for e in doc['entries'].values())
        stats[book] = {'entries': len(doc['entries']), 'days': len(doc['calendar']), 'MB': round(out.stat().st_size / 1e6, 2),
                       'cards/day': dict(sorted(ncards.items())), 'card len p10/50/90/max': [lens[len(lens)//10], lens[len(lens)//2], lens[9*len(lens)//10], lens[-1]],
                       'flags': dict(collections.Counter(f[0] for f in flags[book]))}
        print(book, json.dumps(stats[book], ensure_ascii=False))
    (BUILD / 'flags.json').write_text(json.dumps(flags, ensure_ascii=False, indent=1))
    (BUILD / 'stats.json').write_text(json.dumps(stats, ensure_ascii=False, indent=1))
    if any(f[0] == 'text-mismatch' for fs in flags.values() for f in fs): sys.exit(1)

if __name__ == '__main__':
    main()

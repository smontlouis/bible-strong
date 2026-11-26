"""Build verse-meditations-fr/en.json (FORMAT.md v1) from the reviewed panel."""
import json, re, pathlib
from paths import BUILD, PRODUCTION as P
TITLE = re.compile(r'^(?:(?:Cantique des degrés|Cantique de David|Psaume de David|De David|De Salomon|Cantique)[.,]\s+)+')

def clean(text, ref, lang):
    t = text.strip()
    book, ch, vs = ref.split('.', 2)
    if lang == 'fr':
        if book == 'PSA' and vs.split('-')[0] == '1': t = TITLE.sub('', t)
        t = re.sub(r'\s*-?Pause\.\s*', ' ', t).strip()
    else:
        t = re.sub(r'\s+Selah\b\s*', ' ', t).strip()
    if re.search(r'[,;:—–-]$', t): t = re.sub(r'[\s,;:—–-]+$', '', t) + '…'
    return t[:1].upper() + t[1:]

def translit(t):
    # The panel was written before the lexicon corrections of 2026-11-26: same fixes, and one form.
    words = t.replace('ώ', 'ś').replace('philonexia', 'philoxenia').split(' ')
    words = [w for i, w in enumerate(words) if i == 0 or w != words[i - 1]]
    initials = {w.lstrip("'‛’")[:1].lower() for w in words}
    # Spellings of one word (nîyr nir nêyr…) keep the first; a name in two words (Eben-Ézer) stays whole.
    return words[0] if len(initials) == 1 else ' '.join(words)

def label(text):
    # « Jean 3:16 »: the design system writes a reference with a colon, in both languages.
    return re.sub(r'(\d+)\.(\d+)', r'\1:\2', text)

def entry(m, lang):
    ref = m['ref'] if lang == 'fr' else m['refEn']
    cards = [{'type': 'verse', 'text': clean(m['text'], m['ref'], lang), 'label': label(m['label'])},
             {'type': 'hook', 'text': m['hook']}]
    for p in m['parts']:
        c = {'type': 'part', 'title': p['title'], 'text': p['text']}
        if p.get('strong'): c['strong'] = {'word': p['strong']['word'], 'code': p['strong']['code'], 'translit': translit(p['strong']['translit'])}
        cards.append(c)
    cards += [{'type': 'prayer', 'text': m['prayer']}, {'type': 'questions', 'items': m['questions']}]
    assert 2 <= len(m['questions']) <= 3 and len(m['parts']) == 2
    return {'scene': m['scene'], 'ref': ref, 'label': label(m['label']), 'theme': m['theme'], 'cards': cards}

cal = json.load(open(P / 'calendar/calendar.json'))
for lang, src in (('fr', P / 'all.jsonl'), ('en', P / 'en/all_en.jsonl')):
    meds = {str(json.loads(l)['n']): json.loads(l) for l in open(src)}
    doc = {'format': 'bible-strong-daily-readings', 'version': 1, 'id': f'verse-meditations-{lang}',
           'kind': 'verse-meditations', 'language': lang,
           'calendar': {d: str(n) for d, n in sorted(cal['days'].items())},
           'reserve': [str(n) for n in cal['reserve']],
           'entries': {k: entry(m, lang) for k, m in meds.items()}}
    used = set(doc['calendar'].values()) | set(doc['reserve'])
    assert used == set(doc['entries']) and len(doc['calendar']) == 366
    BUILD.mkdir(parents=True, exist_ok=True)
    out = BUILD / f'verse-meditations-{lang}.json'
    out.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')))
    print(out.name, len(doc['entries']), round(out.stat().st_size / 1e6, 2), 'MB')

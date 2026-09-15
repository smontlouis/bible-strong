"""Collect the explicitly selected, authorized BibleProject editions from public pages.

Run with Python + requests + beautifulsoup4. HTML snapshots stay outside source control.
Never infer a translation from a localized YouVersion interface.
"""
import concurrent.futures, hashlib, json, pathlib, re, time
import requests
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parents[4]
OUT = ROOT / 'output/imports/reading-plans-2026-09'
CACHE = OUT / 'source-html'
# Stable editorial identity, duration, English publisher ID, official French publisher ID.
SELECTION = [
    ('character-of-god', 6, 28160, 64091),
    ('hope', 7, 38843, 40045),
    ('lords-prayer', 8, 53262, None),
    ('sermon-on-the-mount', 10, 55424, None),
    ('how-to-read-the-bible', 19, 29316, 64097),
    ('writings-of-john', 25, 9098, 20337),
    ('pauls-letters', 60, 4822, 20338),
    ('gospels', 90, 8868, 24152),
]

def fetch(url, name):
    path = CACHE / (name + '.html')
    if path.exists(): return path.read_text()
    for attempt in range(4):
        try:
            response = requests.get(url, timeout=45)
            response.raise_for_status()
            assert '<h1' in response.text, 'Missing page content'
            path.write_text(response.text)
            return response.text
        except (requests.RequestException, AssertionError):
            if attempt == 3: raise
            time.sleep(2 ** attempt)

def parse_day(html, publisher_id, day, days):
    soup = BeautifulSoup(html, 'html.parser')
    canonical = soup.select_one('meta[property="og:url"]')['content']
    assert re.search(rf'/reading-plans/{publisher_id}(?:-|/)', canonical), canonical
    assert canonical.endswith('/day/' + str(day)), canonical
    # The exact daily body, not the about/publisher/related-plan text.
    bodies = soup.select('.prose')
    assert len(bodies) <= 1, 'Ambiguous devotional body'
    body = bodies[0] if bodies else None
    heading = soup.find('h2', string=re.compile(r'^(Scripture|Écritures)$'))
    assert heading is not None, 'Missing Scripture section'
    refs = list(dict.fromkeys(
        re.search(r'/bible/\d+/([^/\"?#\s]+)', a['href'])[1]
        for a in heading.parent.select('a[href]') if re.search(r'/bible/\d+/', a['href'])
    ))
    assert refs, f'No Scripture: {canonical}'
    media = []
    if body:
        for node in body.select('iframe, video, img, audio'):
            media.append({'tag':node.name, 'src':node.get('src'), 'html':str(node)})
    return {'day':day, 'url':canonical, 'sha256':hashlib.sha256(html.encode()).hexdigest(),
            'html': str(body) if body else '', 'references':refs, 'media':media}

def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    plans = []
    for key, days, en, fr in SELECTION:
        for lang, publisher_id in [('fr',fr),('en',en)]:
            if not publisher_id: continue
            prefix = '/fr' if lang == 'fr' else ''
            url = f'https://www.bible.com{prefix}/reading-plans/{publisher_id}'
            html = fetch(url, str(publisher_id))
            soup = BeautifulSoup(html,'html.parser')
            title = soup.h1.get_text(' ',strip=True)
            assert 'BibleProject' in title, title
            description = soup.select_one('meta[name="description"]')['content']
            image = soup.select_one('meta[property="og:image"]')['content']
            plan = {'key':key,'lang':lang,'publisherId':publisher_id,'days':days,'url':url,
                    'title':title,'description':description,'image':image,'readings':[]}
            def get_day(day):
                raw = fetch(url + '/day/' + str(day), f'{publisher_id}-{day:03}')
                return parse_day(raw, publisher_id, day, days)
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
                plan['readings'] = list(pool.map(get_day, range(1,days+1)))
            plans.append(plan)
            (OUT/'sources.json').write_text(json.dumps(plans,ensure_ascii=False,indent=2))
            print(title,lang,len(plan['readings']),flush=True)
    print('Collected',len(plans),'editions',sum(p['days'] for p in plans),'days',flush=True)
if __name__ == '__main__': main()

"""Build deterministic plan documents; validate every day/reference before publication."""
import base64, collections, hashlib, io, json, pathlib, re
from bs4 import BeautifulSoup, NavigableString
from PIL import Image, ImageDraw, ImageFont
from collect import ROOT, OUT, SELECTION

BOOKS = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split()
COUNTS = {tuple(map(int,(b,c))):int(v) for b,c,v in re.findall(r"'(\d+)-(\d+)': (\d+)",(ROOT/'apps/expo/src/assets/bible_versions/countLsgChapters.ts').read_text())}
OWN = [
 ('mark',41,16,'Découvrir Jésus avec Marc','Discover Jesus in Mark','Marc','Mark','#1d5263'),
 ('john',43,21,'Lire l’Évangile de Jean','Read the Gospel of John','Jean','John','#69557e'),
 ('proverbs',20,31,'La sagesse des Proverbes','The Wisdom of Proverbs','Proverbes','Proverbs','#875d34'),
 ('acts',44,28,'Les débuts de l’Église : Actes','The Early Church: Acts','Actes','Acts','#426c58'),
 ('james',59,5,'Lire Jacques','Read James','Jacques','James','#47629a'),
 ('philippians',50,4,'Lire Philippiens','Read Philippians','Philippiens','Philippians','#93574f'),
]

def scripture(reference):
    # YouVersion's USFM IDs are independent of the displayed language/translation.
    match = re.fullmatch(r'([1-3A-Z]+)\.(\d+)(?:\.(\d+)(?:-(\d+))?|-(\d+))?\.([A-Za-z0-9]+)',reference.strip())
    assert match, reference
    code, chapter, first, last, end_chapter, version = match.groups()
    book = BOOKS.index(code)+1
    chapter = int(chapter)
    assert (book,chapter) in COUNTS, reference
    if first:
        assert 1 <= int(first) <= int(last or first) <= COUNTS[(book,chapter)], reference
        return {'type':'Verse','verses':f'{book}|{chapter}:{first}' + (f'-{last}' if last else '')}
    end = int(end_chapter or chapter)
    assert chapter <= end and all((book,c) in COUNTS for c in range(chapter,end+1)), reference
    return {'type':'Chapter','chapters':f'{book}|{chapter}' + (f'-{end}' if end_chapter else '')}

def body_slices(html, lang):
    soup = BeautifulSoup(html,'html.parser')
    body = soup.select_one('.prose')
    if not body: return []
    result, text = [], []
    def flush():
        if text:
            value='\n\n'.join(text).strip()
            if value: result.append({'type':'Text','description':value})
            text.clear()
    def walk(node):
        if isinstance(node,NavigableString):
            if node.strip(): text.append(str(node).strip())
            return
        if node.name == 'iframe':
            flush(); url=node['src']; match=re.search(r'(?:youtube(?:-nocookie)?\.com/embed/|youtu\.be/)([\w-]{11})',url)
            assert match,url
            result.append({'type':'Video','title':'BibleProject','url':'https://www.youtube.com/watch?v='+match[1]})
        elif node.name == 'video':
            flush(); sources=[s['src'] for s in node.select('source[src]')]
            hls=next((s for s in sources if s.endswith('.m3u8')),None)
            web=next((s for s in sources if s.endswith('.webm') or s.endswith('.mp4')),None)
            assert hls and web, sources
            result.append({'type':'Video','title':'BibleProject','url':hls,'webUrl':web,'poster':node.get('poster','')})
        elif node.name == 'img':
            flush(); result.append({'type':'Image','src':node['src'],'alt':node.get('alt','')})
        elif node.name in ('script','style'):
            raise ValueError('Unexpected executable content')
        elif node.find(['iframe','video','img']):
            for child in node.children: walk(child)
        elif node.name in ('ol','ul'):
            for i,li in enumerate(node.find_all('li',recursive=False),1):
                text.append((f'{i}. ' if node.name=='ol' else '• ') + li.get_text(' ',strip=True))
        elif node.name in ('p','h1','h2','h3','h4','blockquote','li'):
            for br in node.find_all('br'): br.replace_with('\n')
            value=node.get_text().replace('\xa0',' ').strip()
            if value: text.append(value)
        else:
            for child in node.children: walk(child)
    for node in body.children: walk(node)
    flush()
    return result

def cover(label, days, lang, color):
    image=Image.new('RGB',(640,360),color)
    d=ImageDraw.Draw(image)
    font=ROOT/'apps/expo/src/assets/fonts/eina-03-bold.otf'
    large=ImageFont.truetype(str(font),90 if len(label)<10 else 72)
    box=d.textbbox((0,0),label,font=large)
    d.text(((640-(box[2]-box[0]))/2,115),label,font=large,fill='#ffffff')
    # Broad page lines remain legible when the cover is displayed as a thumbnail.
    d.line((80,252,320,273,560,252),fill='#d9e2dc',width=5)
    d.line((80,273,320,294,560,273),fill='#d9e2dc',width=5)
    buf=io.BytesIO();image.save(buf,format='PNG',optimize=True)
    path=OUT/'covers'/f'{label.lower()}-{lang}.png';path.parent.mkdir(exist_ok=True);path.write_bytes(buf.getvalue())
    return 'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()

def make_documents(meta, readings):
    ids=set()
    for day, reading in enumerate(readings,1):
        reading['id']=f'day-{day:03}'
        for i,slice in enumerate(reading['slices'],1): slice['id']=f'{reading["id"]}-{i:02}'
        assert reading['slices'] and reading['id'] not in ids
        ids.add(reading['id'])
    meta={**meta,'kind':'reading-plan','type':'reading-plan','duration':len(readings),'lastUpdate':1789430400000}
    # Contents live in sections; the lightweight catalog knows the duration immediately.
    docs=[{'path':'plans/'+meta['id'],'data':meta}]
    for i,start in enumerate(range(0,len(readings),20),1):
        section={'id':f'{i:02}','title':meta['title'],'subTitle':'','readingSlices':readings[start:start+20]}
        docs.append({'path':f'plans/{meta["id"]}/plan-sections/{i:02}','data':section})
    return docs

def main():
    sources=json.loads((OUT/'sources.json').read_text())
    assert len(sources)==14
    docs=[]; summaries=[]
    for plan in sources:
        expected=next(p for p in SELECTION if p[0]==plan['key'])
        assert plan['days']==expected[1] and len(plan['readings'])==plan['days']
        readings=[]
        for day,r in enumerate(plan['readings'],1):
            assert r['day']==day
            slices=body_slices(r['html'],plan['lang'])
            slices.extend(scripture(ref) for ref in r['references'])
            readings.append({'title':('Jour ' if plan['lang']=='fr' else 'Day ')+str(day),'slices':slices})
        meta={'id':f'bibleproject-{plan["key"]}-{plan["lang"]}', 'title':plan['title'].split('|',1)[-1].strip(),
              'lang':plan['lang'],'description':plan['description'],'image':plan['image'],
              'author':{'id':'bibleproject','displayName':'BibleProject','photoUrl':''},
              'sourceUrl':plan['url'],'rights':'Publisher rights confirmed by Bible Strong owner, 2026-09-15.'}
        docs.extend(make_documents(meta,readings))
        summaries.append({'id':meta['id'],'days':len(readings),'source':plan['url']})
    for key,book,days,fr,en,frlabel,enlabel,color in OWN:
        assert len([c for b,c in COUNTS if b==book])==days
        for lang,title,label in [('fr',fr,frlabel),('en',en,enlabel)]:
            readings=[{'title':f'{label} {day}','slices':[{'type':'Chapter','chapters':f'{book}|{day}'}]} for day in range(1,days+1)]
            meta={'id':f'bible-strong-{key}-{lang}','title':title,'lang':lang,
                  'description': f'Parcourez {label} en {days} jours, à raison d’un chapitre par jour.' if lang=='fr' else f'Read {label} in {days} days, one chapter each day.',
                  'image':cover(label,days,lang,color),'author':{'id':'bible-strong','displayName':'Bible Strong','photoUrl':''},
                  'rights':'Original reference-only reading schedule by Bible Strong.'}
            docs.extend(make_documents(meta,readings));summaries.append({'id':meta['id'],'days':days,'source':'Bible Strong'})
    assert len(summaries)==26 and len({d['path'] for d in docs})==len(docs)
    for d in docs: assert len(json.dumps(d['data']).encode())<900000,d['path']
    serialized=json.dumps(docs,ensure_ascii=False,indent=2)
    (OUT/'documents.json').write_text(serialized)
    report={'projectId':'bible-strong-app','plans':26,'concepts':14,'days':sum(s['days'] for s in summaries),'documents':len(docs),
            'sha256':hashlib.sha256(serialized.encode()).hexdigest(),'editions':summaries}
    (OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='editions'},indent=2))
if __name__=='__main__':main()

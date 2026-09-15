"""Convert official HTML/PDF days to the existing plan format, preserving source text."""
import base64,hashlib,io,json,pathlib,re,textwrap,unicodedata
import pymupdf
from bs4 import BeautifulSoup,NavigableString
from PIL import Image,ImageDraw,ImageFont
from collect import OUT,ROOT
THEMES={
 2026:('Libérés !','Unleashed!','#245966'),
 2025:('Mais quand vous priez…','But When You Pray…','#6c527b'),
 2024:('Priorités à la foi','Priorities of Faith','#826338'),
 2023:('Retour à l’autel','Back to the Altar','#8b4c47'),
 2016:('Vivre en Christ','Abiding in Christ','#45664f'),
 2014:('Enseigne-nous à prier','Teach Us to Pray','#3e5990'),
}
# One-based page boundaries inspected in the official combined French PDFs.
FRENCH_PAGES={2026:[11,16,20,24,28,32,36,40,44,48,52],2023:[23,25,27,29,31,33,35,37,39,41,43],2016:[12,15,18,21,24,27,30,33,36,39,42]}
EN_NUMBERS=['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten']
FR_NUMBERS=['Premier','Deuxième','Troisième','Quatrième','Cinquième','Sixième','Septième','Huitième','Neuvième','Dixième']

def normalize(value):
    for a,b in {'\uf0b7':'•','\uf0fc':'✓','\uf0a7':'•','\ufb01':'fi','\ufb02':'fl','\ufb00':'ff','\ufb03':'ffi','\ufb04':'ffl','\xa0':' ','\u00ad':''}.items():value=value.replace(a,b)
    return unicodedata.normalize('NFC',value).strip()

def html_text(node):
    if isinstance(node,NavigableString):return str(node)
    if node.name=='br':return '\n'
    if node.name in ('script','style'):return ''
    if node.name=='li':
        prefix='• '
        if node.parent.name=='ol':prefix=str(list(node.parent.find_all('li',recursive=False)).index(node)+1)+'. '
        return '\n'+prefix+''.join(html_text(c) for c in node.children).strip()+'\n'
    text=''.join(html_text(c) for c in node.children)
    return '\n\n'+text.strip()+'\n\n' if node.name in ('div','p','h1','h2','h3','h4','ul','ol','blockquote') else text

def clean_paragraphs(value):
    value=normalize(value)
    value=re.sub(r'[ \t]+',' ',value)
    value=re.sub(r' *\n *','\n',value)
    return re.sub(r'\n{3,}','\n\n',value).strip()

def from_html(path,day):
    soup=BeautifulSoup(path.read_text(),'html.parser')
    link=soup.select_one(f'#study--day{day}__link');body=soup.select_one(f'#study--day{day}')
    assert link and body
    title=re.sub(r'^Day\s+\d+\s*','',link.get_text(' ',strip=True),flags=re.I)
    for node in body.select('.study__minimize,.study__printable'):node.decompose()
    text=clean_paragraphs(html_text(body))
    assert len(text)>500
    return title,text

def pdf_text(doc,start,end,omit=()):
    chunks=[]
    for page in doc[start-1:end-1]:
        headings=set()
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                spans=[span for span in line['spans'] if span['text'].strip()]
                text=normalize(''.join(span['text'] for span in spans))
                bold=sum(len(span['text']) for span in spans if span['flags'] & 16 or 'bold' in span['font'].lower())
                if text and len(text)<180 and bold > len(text)*0.7:headings.add(text)
        paragraph=[]
        def flush():
            if paragraph:chunks.append(' '.join(paragraph));paragraph.clear()
        for raw in page.get_text().splitlines():
            line=normalize(raw)
            if not line:flush();continue
            if page.number==start-1 and line in omit:continue
            if re.fullmatch(r'(?i)(?:10|Dix)\s+(?:Days of Prayer|Jours de pri[eè]re)\s*\d{4}',line):continue
            if re.fullmatch(r'(?i)(?:https?://)?www\.tendaysofprayer\.org',line):continue
            if re.match(r'^(Published by the General Conference|Daily Readings by|Publié par l.Association|Textes quotidiens de)',line):continue
            if re.fullmatch(r'[-_—]{3,}',line):continue
            if line in headings or re.match(r'^(?:Day \d|Day (?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b|JOUR \d|(?:Praise|Thanksgiving|Louanges?|Reconnaissance|Confession(?: and Claiming Victory Over Sin)?|Supplication and Intercession|Supplication et Intercession)\s*(?:$|\()|Suggested Format for the Prayer Time|Suggestions pour le temps de prière|Questions for Personal Reflection)',line):
                flush();chunks.append(line);continue
            if re.match(r'^(?:[•●✓](?:\s|$)|\d+[.)]\s)',line):flush()
            paragraph.append(line)
        flush()
    return clean_paragraphs('\n\n'.join(chunks))

def from_pdf(path,start,end,day,lang,year):
    doc=pymupdf.open(path);assert 1<=start<end<=len(doc)+1
    top=[normalize(l) for l in doc[start-1].get_text().splitlines() if normalize(l)]
    if year==2014:
        pattern=rf'(?i)^(?:Day {EN_NUMBERS[day-1]}|{FR_NUMBERS[day-1]} jour)\b\s*[–—:-]?\s*(.*)$'
    else:pattern=rf'(?i)^(?:JOUR\s*{day}|Day\s*{day}|{day}(?:er|ème|e)\s+jour)\b\s*[–—:-]?\s*(.*)$'
    found=next(((i,re.match(pattern,line)) for i,line in enumerate(top[:15]) if re.match(pattern,line)),None)
    assert found,(path.name,day,top[:8])
    i,match=found;title=match[1].strip()
    if not title:title=top[i+1].strip();i+=1
    if title.endswith(':') and i+1<len(top):title+=' '+top[i+1];i+=1
    # Recover words split only by character spacing in the PDF headings.
    title=title.replace('Saint -Esprit','Saint-Esprit')
    text=pdf_text(doc,start,end,omit=top[:i+1])
    assert len(text)>500,(path.name,day)
    return title,text, list(range(start,end))

def make_cover(theme,lang,year,color):
    image=Image.new('RGB',(640,360),color);d=ImageDraw.Draw(image);font=ROOT/'apps/expo/src/assets/fonts/eina-03-bold.otf'
    d.text((32,68),'10',font=ImageFont.truetype(str(font),112),fill='#ffffff')
    small=ImageFont.truetype(str(font),23);d.text((40,208),'JOURS' if lang=='fr' else 'DAYS',font=small,fill='#e2e8ed')
    large=ImageFont.truetype(str(font),34)
    lines=textwrap.wrap(theme,width=21)
    for i,line in enumerate(lines):d.text((224,100+i*48),line,font=large,fill='#ffffff')
    d.line((224,275,590,275),fill='#dce4e8',width=2);d.text((224,294),str(year),font=small,fill='#dce4e8')
    buf=io.BytesIO();image.save(buf,format='PNG',optimize=True)
    folder=OUT/'covers';folder.mkdir(exist_ok=True);(folder/f'{year}-{lang}.png').write_bytes(buf.getvalue())
    return 'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()

def main():
    downloads=json.loads((OUT/'downloads.json').read_text());assert len(downloads)==12
    docs=[];sources=[];counts=[]
    for entry in downloads:
        year,lang=entry['year'],entry['lang'];folder=OUT/'sources'/f'{year}-{lang}';readings=[]
        theme=THEMES[year][0 if lang=='fr' else 1]
        for day in range(1,11):
            if lang=='en' and year>=2023:
                path=folder/'web.html';title,text=from_html(path,day);pages=None;sourceUrl=f'https://www.tendaysofprayer.org/{year}#study--day{day}'
            else:
                sourceUrl=entry['url']
                if lang=='fr' and year in FRENCH_PAGES:
                    path=folder/'source.pdf';start,end=FRENCH_PAGES[year][day-1:day+1]
                else:
                    files=[folder/name for name in entry['files'] if re.search(rf'(?i)(?:Day|Jour)\s+{day}(?!\d)',name)]
                    assert len(files)==1,(year,lang,day,files)
                    path=files[0];start=4 if year==2014 and lang=='fr' and day==1 else 3 if year==2014 and lang=='en' and day==1 else 1
                    end=len(pymupdf.open(path))+1
                title,text,pages=from_pdf(path,start,end,day,lang,year)
            assert '\ufffd' not in text,(year,lang,day,'replacement character')
            assert not re.search('[\ue000-\uf8ff]',text),(year,lang,day,'unmapped glyph')
            # One full daily unit; Scripture quotations and prayer prompts remain in order.
            readings.append({'id':f'day-{day:02}','title':title,'slices':[{'id':'reading','type':'Text','description':text}],
                             'sourceUrl':sourceUrl})
            sources.append({'year':year,'lang':lang,'day':day,'title':title,'text':text,'sourceUrl':sourceUrl,
                            'sourceFile':path.name,'sourcePages':pages,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        identity=f'ten-days-of-prayer-{year}-{lang}'
        title=('10 jours de prière' if lang=='fr' else '10 Days of Prayer')+' — '+theme
        description=(f'Dix journées de lecture biblique, de réflexion et de prière autour du thème « {theme} ». Édition {year}. À suivre seul, en famille ou en groupe, à partir de la date de votre choix.' if lang=='fr' else f'Ten days of Bible reading, reflection and prayer around the theme “{theme}”. {year} edition. Follow individually, as a family or as a group, starting on the date you choose.')
        meta={'id':identity,'title':title,'description':description,'kind':'reading-plan','type':'reading-plan','lang':lang,
              'duration':10,'editionYear':year,'image':make_cover(theme,lang,year,THEMES[year][2]),
              'author':{'id':'general-conference-ministerial','displayName':'10 jours de prière' if lang=='fr' else '10 Days of Prayer','photoUrl':''},
              'attribution':{'text':'Publié par l’Association pastorale de la Conférence générale des adventistes du septième jour.' if lang=='fr' else 'Published by the Ministerial Association of the General Conference of Seventh-day Adventists.', 'url':f'https://www.tendaysofprayer.org/{year}' if year>=2023 else 'https://www.tendaysofprayer.org/'},
              'sourceUrl':entry['url'],'lastUpdate':1789430400002,
              'rights':{'basis':'publisher-permission','confirmation':'User confirmed Adventist content rights on 2026-09-15.'}}
        docs.extend([{'path':f'plans/{identity}','data':meta},{'path':f'plans/{identity}/plan-sections/01','data':{'id':'01','title':theme,'subTitle':'','readingSlices':readings}}])
        counts.append({'id':identity,'days':len(readings),'characters':sum(len(r['slices'][0]['description']) for r in readings)})
    assert len(docs)==24 and len(sources)==120 and len({d['path'] for d in docs})==24
    assert all(len(json.dumps(d,ensure_ascii=False).encode())<900000 for d in docs)
    raw=json.dumps(docs,ensure_ascii=False,indent=2)
    (OUT/'documents.json').write_text(raw);(OUT/'readings.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2))
    report={'projectId':'bible-strong-app','plans':12,'concepts':6,'days':120,'documents':24,'sha256':hashlib.sha256(raw.encode()).hexdigest(),'editions':counts}
    (OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(counts,ensure_ascii=False,indent=2))
if __name__=='__main__':main()

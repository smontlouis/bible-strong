import json,pathlib,datetime as dt,hashlib,collections,base64
ROOT=pathlib.Path(__file__).parent
MONTHS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
def build():
 rows=json.loads((ROOT/'readings.json').read_text());errors=json.loads((ROOT/'errors.json').read_text());assert not errors,errors
 dates=[r['date'] for r in rows];expected=[(dt.date(2021,1,1)+dt.timedelta(days=i)).isoformat() for i in range(2191)]
 assert dates==expected,'Incomplete, duplicated or unordered dates'
 docs=[];summary=[];revision=hashlib.sha256((ROOT/'readings.json').read_bytes()).hexdigest();updated=int(dt.datetime.now(dt.timezone.utc).timestamp()*1000)
 for year in range(2021,2027):
  identity=f'la-bonne-semence-{year}';entries=[r for r in rows if r['date'].startswith(str(year))];assert len(entries)==(366 if year==2024 else 365)
  root={'id':identity,'kind':'daily-meditation','type':'Livre de méditation','title':f'La Bonne Semence {year}','lang':'fr','image':'data:image/png;base64,'+base64.b64encode((ROOT/'neutral-cover.png').read_bytes()).decode(),'author':{'id':'bpc','displayName':'Bibles et Publications Chrétiennes','photoUrl':''},'description':f'Édition {year} du calendrier La Bonne Semence. Bibles et Publications Chrétiennes. https://editeurbpc.com/calendriers/la-bonne-semence','editionYear':year,'sourceUrl':'https://editeurbpc.com/calendriers/la-bonne-semence','lastUpdate':updated,'downloads':0,'importRevision':revision,'rights':{'basis':'publisher-permission','confirmation':'User confirmed permission from BPC and production import on 2026-09-14','publisher':'Bibles et Publications Chrétiennes'}}
  docs.append({'path':f'plans/{identity}','data':root})
  for m in range(1,13):
   month=[r for r in entries if int(r['date'][5:7])==m]
   readings=[{'id':r['date'],'calendarDate':r['date'][5:],'publicationDate':r['date'],'title':r['title']+f", {int(r['date'][8:])} {MONTHS[m-1].lower()}",'sourceUrl':r['source'],'sourceSha256':r['sourceSha256'],'slices':[{'id':'0','type':'Text','subType':'devotional','description':r['opening']},{'id':'1','type':'Text','description':r['body']}]} for r in month]
   doc={'path':f'plans/{identity}/plan-sections/{m:02}','data':{'id':f'{m:02}','title':MONTHS[m-1],'subTitle':'','readingSlices':readings}}
   assert len(json.dumps(doc,ensure_ascii=False).encode())<900_000
   docs.append(doc)
  summary.append({'id':identity,'year':year,'readings':len(entries),'sections':12,'first':entries[0]['date'],'last':entries[-1]['date']})
 # Repeated content may be editorially intentional: report, never delete it.
 groups=collections.defaultdict(list)
 for r in rows:groups[hashlib.sha256((r['opening']+'\n'+r['body']).encode()).hexdigest()].append(r['date'])
 report={'projectId':'bible-strong-app','documents':len(docs),'readings':len(rows),'revision':revision,'editions':summary,'repeatedContentDates':[v for v in groups.values() if len(v)>1],'maxDocumentJsonBytes':max(len(json.dumps(d,ensure_ascii=False).encode()) for d in docs)}
 (ROOT/'documents.json').write_text(json.dumps(docs,ensure_ascii=False,indent=2));(ROOT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':build()

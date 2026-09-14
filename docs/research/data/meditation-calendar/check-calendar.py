import json,pathlib,re,unicodedata,calendar,collections,hashlib,datetime
root=pathlib.Path('.scratch/meditations-audit')
months=['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre']
english=['january','february','march','april','may','june','july','august','september','october','november','december']
def normalize(s):return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if unicodedata.category(c)!='Mn')
monthnums={s:i+1 for names in [months,english] for i,s in enumerate(names)}
monthpattern='|'.join(monthnums)
results=[]
for p in sorted(root.glob('*.json')):
 d=json.load(open(p))
 if d['documentId'].startswith('bible-project'):continue
 rows=[]; anomalies=[]; counts=[]
 for s in d['sections']:
  sectionmonth=re.match('('+monthpattern+')',normalize(s['title']))
  m=monthnums[sectionmonth[1]] if sectionmonth else None
  counts.append([m,len(s.get('readingSlices',[]))])
  for index,r in enumerate(s.get('readingSlices',[])):
   title=normalize(r.get('title','')).strip()
   match=re.search(r'(\d{1,2})(?:er)?\s+('+monthpattern+r')\s*$',title)
   reverse=re.search('('+monthpattern+r')\s+(\d{1,2})\s*$',title)
   day=int(match[1]) if match else int(reverse[2]) if reverse else None
   month=monthnums[match[2]] if match else monthnums[reverse[1]] if reverse else None
   date=f'{month:02}-{day:02}' if month and day else None
   if not date:anomalies.append(['unparsed',s['id'],r['id'],r.get('title')])
   elif month!=m or day!=index+1:anomalies.append(['positionMismatch',s['id'],r['id'],date,index+1])
   if date and not 1<=day<=calendar.monthrange(2024,month)[1]:anomalies.append(['invalidDate',date])
   if not r.get('slices'):anomalies.append(['emptyEntry',r['id']])
   rows.append({'sectionId':s['id'],'readingSliceId':r['id'],'date':date})
 dates=collections.Counter(r['date'] for r in rows);ids=collections.Counter(r['readingSliceId'] for r in rows)
 expected={f'{m:02}-{day:02}' for m in range(1,13) for day in range(1,calendar.monthrange(2024,m)[1]+1)}
 result={'id':d['id'],'title':d['title'],'lang':d['lang'],'sourceType':d['type'],'sourceLastUpdate':d.get('lastUpdate'),'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'entryCount':len(rows),'monthCounts':sorted(counts),'hasFebruary29':'02-29'in dates,'missingDates':sorted(expected-set(dates)),'duplicateDates':{k:v for k,v in dates.items() if v>1},'duplicateReadingIds':{k:v for k,v in ids.items() if v>1},'anomalies':anomalies,'mapping':rows}
 results.append(result)
 print(json.dumps({k:v for k,v in result.items() if k not in ['mapping','sourceSha256','sourceLastUpdate','sourceType','lang']},ensure_ascii=False))
for c in results:
 c['mapping']={r['date']:[r['sectionId'],r['readingSliceId']] for r in c['mapping']}
pathlib.Path('docs/research/data/meditation-calendar/audit.json').write_text(json.dumps({'auditedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'Firestore bible-strong-app / plans / plan-sections (read-only)','collections':results,'mappingFormat':'MM-DD -> [legacy section ID, legacy reading slice ID]; identifiers are strings scoped to collection ID'},ensure_ascii=False,indent=2)+'\n')

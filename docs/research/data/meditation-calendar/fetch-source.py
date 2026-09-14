import json,urllib.request,urllib.parse,concurrent.futures,pathlib
root=pathlib.Path('.scratch/meditations-audit')
root.mkdir(parents=True, exist_ok=True)
def decode(v):
 if 'mapValue'in v:return {k:decode(x) for k,x in v['mapValue'].get('fields',{}).items()}
 if 'arrayValue'in v:return [decode(x) for x in v['arrayValue'].get('values',[])]
 for k in ['stringValue','integerValue','doubleValue','booleanValue','nullValue','timestampValue']:
  if k in v:return v[k]
 return v
catalog={'documents':[]}
token=None
while True:
 url='https://firestore.googleapis.com/v1/projects/bible-strong-app/databases/(default)/documents/plans?pageSize=100'
 if token:url+='&pageToken='+urllib.parse.quote(token)
 page=json.load(urllib.request.urlopen(url, timeout=30))
 catalog['documents']+=page.get('documents',[])
 token=page.get('nextPageToken')
 if not token:break
def fetch(doc):
 id=doc['name'].split('/')[-1]; sections=[];token=None
 while True:
  url='https://firestore.googleapis.com/v1/'+doc['name']+'/plan-sections?pageSize=100'
  if token:url+='&pageToken='+urllib.parse.quote(token)
  data=json.load(urllib.request.urlopen(url, timeout=30))
  sections += [{'documentId':x['name'].split('/')[-1],**{k:decode(v) for k,v in x['fields'].items()}} for x in data.get('documents',[])]
  token=data.get('nextPageToken')
  if not token:break
 out={'documentId':id,**{k:decode(v) for k,v in doc['fields'].items()},'sections':sections}
 (root/(id+'.json')).write_text(json.dumps(out,ensure_ascii=False,indent=2))
 return id, len(sections),[(s.get('title'),len(s.get('readingSlices',[])),[(r.get('id'),r.get('title')) for r in s.get('readingSlices',[])[:2]]) for s in sections[:2]]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for result in pool.map(fetch,catalog['documents']):print(result)

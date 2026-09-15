"""Create six new yearly collections only; existing documents cannot be overwritten."""
import json,pathlib,urllib.request,urllib.error,sys,hashlib,datetime as dt
ROOT=pathlib.Path(__file__).parent
PROJECT='bible-strong-app'
BASE=f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'
def token():
 d=json.loads((pathlib.Path.home()/'.config/configstore/firebase-tools.json').read_text())
 return d['tokens']['access_token']
def request(url,data=None,authenticated=True):
 headers={'Content-Type':'application/json'}
 if authenticated:headers['Authorization']='Bearer '+token()
 req=urllib.request.Request(url,data=json.dumps(data,ensure_ascii=False).encode() if data is not None else None,headers=headers)
 with urllib.request.urlopen(req,timeout=90) as r:return json.load(r)
def encode(x):
 if x is None:return {'nullValue':None}
 if isinstance(x,bool):return {'booleanValue':x}
 if isinstance(x,int):return {'integerValue':str(x)}
 if isinstance(x,float):return {'doubleValue':x}
 if isinstance(x,str):return {'stringValue':x}
 if isinstance(x,list):return {'arrayValue':{'values':[encode(v) for v in x]}}
 if isinstance(x,dict):return {'mapValue':{'fields':{k:encode(v) for k,v in x.items()}}}
 raise TypeError(type(x))
def decode(x):
 if 'mapValue' in x:return {k:decode(v) for k,v in x['mapValue'].get('fields',{}).items()}
 if 'arrayValue' in x:return [decode(v) for v in x['arrayValue'].get('values',[])]
 if 'integerValue' in x:return int(x['integerValue'])
 for key in ['stringValue','doubleValue','booleanValue','nullValue']:
  if key in x:return x[key]
 raise ValueError(x)
def main():
 mode=sys.argv[1] if len(sys.argv)>1 else 'preflight'
 docs=json.loads((ROOT/'documents.json').read_text());report=json.loads((ROOT/'validation.json').read_text())
 assert report['projectId']==PROJECT and report['readings']==2191 and len(docs)==78
 assert len({d['path'] for d in docs})==78
 for d in docs:assert d['path'].split('/')[1] in [f'la-bonne-semence-{y}' for y in range(2021,2027)]
 batches=[]
 for year in range(2021,2027):
  batch=[d for d in docs if d['path'].split('/')[1]==f'la-bonne-semence-{year}'];assert len(batch)==13
  payload={'writes':[{'update':{'name':f'projects/{PROJECT}/databases/(default)/documents/'+d['path'],'fields':{k:encode(v) for k,v in d['data'].items()}},'currentDocument':{'exists':False}} for d in batch]}
  size=len(json.dumps(payload,ensure_ascii=False).encode());assert size<9_000_000
  batches.append((year,batch,payload));print('Prepared',year,len(batch),'documents;',size,'bytes')
 if mode=='prepare':return
 if mode=='verify':
  for d in docs:
   result=request(BASE+'/'+d['path']);actual={k:decode(v) for k,v in result['fields'].items()};assert actual==d['data'],d['path']
  print('VERIFIED: all78 documents match the2191 validated readings');return
 # Fail closed on any collision, including orphaned sections. Never overwrite.
 for d in docs:
  try:request(BASE+'/'+d['path'],authenticated=False)
  except urllib.error.HTTPError as e:
   if e.code!=404:raise
  else:raise RuntimeError('Existing destination: '+d['path'])
 print('Preflight: all78 destination documents absent')
 if mode!='publish':return
 receipt={'projectId':PROJECT,'revision':report['revision'],'documents':[]}
 for year,batch,payload in batches:
  result=request(BASE+':commit',payload)
  for d,write in zip(batch,result['writeResults']):receipt['documents'].append({'path':d['path'],'updateTime':write['updateTime']})
  (ROOT/'receipt.json').write_text(json.dumps(receipt,indent=2));print('Created edition',year,flush=True)
  for d in batch:
   actual=request(BASE+'/'+d['path']);assert {k:decode(v) for k,v in actual['fields'].items()}==d['data'],d['path']
 print('Published and verified all6 editions')
if __name__=='__main__':main()

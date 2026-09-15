"""Create the selected reading-plan release atomically in the existing Firestore catalog.

No overwrite, merge, or deletion. Auth stays in Firebase CLI's local credential store.
Usage: python3 scripts/publish-ten-days-of-prayer.py preflight|publish|verify
"""
import datetime, hashlib, json, pathlib, sys, urllib.error, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'output/imports/ten-days-of-prayer-2026-09'
PROJECT='bible-strong-app'
BASE=f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'

def encode(x):
    if x is None: return {'nullValue':None}
    if isinstance(x,bool): return {'booleanValue':x}
    if isinstance(x,int): return {'integerValue':str(x)}
    if isinstance(x,str): return {'stringValue':x}
    if isinstance(x,list): return {'arrayValue':{'values':[encode(v) for v in x]}}
    if isinstance(x,dict): return {'mapValue':{'fields':{k:encode(v) for k,v in x.items()}}}
    raise TypeError(type(x))

def decode(x):
    if 'mapValue' in x: return {k:decode(v) for k,v in x['mapValue'].get('fields',{}).items()}
    if 'arrayValue' in x: return [decode(v) for v in x['arrayValue'].get('values',[])]
    if 'integerValue' in x: return int(x['integerValue'])
    for key in ['stringValue','doubleValue','booleanValue','nullValue']:
        if key in x: return x[key]
    raise ValueError(x)

def request(path,data=None):
    tokens=json.loads((pathlib.Path.home()/'.config/configstore/firebase-tools.json').read_text())['tokens']
    req=urllib.request.Request(BASE+path, data=json.dumps(data,ensure_ascii=False).encode() if data is not None else None,
        headers={'Content-Type':'application/json','Authorization':'Bearer '+tokens['access_token']})
    with urllib.request.urlopen(req,timeout=90) as response: return json.load(response)

def main():
    mode=sys.argv[1] if len(sys.argv)>1 else 'preflight'
    assert mode in ('preflight','publish','verify')
    raw=(OUT/'documents.json').read_bytes(); docs=json.loads(raw); report=json.loads((OUT/'validation.json').read_text())
    assert report['sha256']==hashlib.sha256(raw).hexdigest()
    assert report['projectId']==PROJECT and report['plans']==12 and report['days']==120 and len(docs)==24
    ids={e['id'] for e in report['editions']}
    assert len(ids)==12 and len({d['path'] for d in docs})==len(docs)
    for d in docs:
        assert d['path'].split('/')[0]=='plans' and d['path'].split('/')[1] in ids
        assert len(d['path'].split('/'))==2 or (len(d['path'].split('/'))==4 and d['path'].split('/')[2]=='plan-sections')
    if mode=='verify':
        results=[]
        for d in docs:
            remote=request('/'+d['path'])
            actual={k:decode(v) for k,v in remote['fields'].items()}
            # Downloads are a mutable usage counter, not editorial content.
            actual.pop('downloads',None)
            assert actual==d['data'],d['path']
            results.append({'path':d['path'],'updateTime':remote['updateTime']})
        (OUT/'verification.json').write_text(json.dumps({'projectId':PROJECT,'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':report['sha256'],'documents':results},indent=2))
        print('Verified 12 editions, 120 days, 24 documents.');return
    for d in docs:
        try: request('/'+d['path'])
        except urllib.error.HTTPError as e:
            if e.code!=404: raise
        else: raise RuntimeError('Destination already exists: '+d['path'])
    payload={'writes':[{'update':{'name':f'projects/{PROJECT}/databases/(default)/documents/'+d['path'],
        'fields':{k:encode(v) for k,v in d['data'].items()}},'currentDocument':{'exists':False}} for d in docs]}
    size=len(json.dumps(payload).encode());assert size<9000000
    print('Preflight OK:',len(docs),'absent destinations;',size,'bytes; project',PROJECT,flush=True)
    if mode!='publish':return
    result=request(':commit',payload)
    receipt={'projectId':PROJECT,'sha256':report['sha256'],'commitTime':result['commitTime'],'documents':[
        {'path':d['path'],'updateTime':r['updateTime']} for d,r in zip(docs,result['writeResults'])]}
    (OUT/'receipt.json').write_text(json.dumps(receipt,indent=2))
    print('Created all 12 editions atomically. Run verify.')
if __name__=='__main__':main()

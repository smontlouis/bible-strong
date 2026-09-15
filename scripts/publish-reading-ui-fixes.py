"""Apply the reviewed reading UI/content patch without overwriting unrelated edits.

Run preflight, publish, verify. Parent identities removed since the initial import are
skipped, not recreated. Each update uses a field mask and an updateTime precondition.
"""
import importlib.util,json,pathlib,sys,datetime,hashlib,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'output/imports/reading-ui-fixes-2026-09'
spec=importlib.util.spec_from_file_location('reading_release',ROOT/'scripts/publish-reading-plans.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def main():
 mode=sys.argv[1] if len(sys.argv)>1 else 'preflight';assert mode in ('preflight','publish','verify')
 patches=json.loads((OUT/'patches.json').read_text())
 if mode=='verify':
  receipt=json.loads((OUT/'receipt.json').read_text())
  for d in receipt['updates']:
   result=m.request('/'+d['path']);actual={k:m.decode(v) for k,v in result['fields'].items()}
   assert all(actual.get(k)==v for k,v in d['after'].items()),d['path']
  print('Verified',len(receipt['updates']),'updated documents');return
 identities={p['path'].split('/')[1] for p in patches};parents={};skipped=[]
 for identity in sorted(identities):
  try:parents[identity]=m.request('/plans/'+identity)
  except urllib.error.HTTPError as e:
   if e.code!=404:raise
   skipped.append(identity)
 updates=[];before=[];writes=[];stamp=int(datetime.datetime.now(datetime.timezone.utc).timestamp()*1000)
 for p in patches:
  identity=p['path'].split('/')[1]
  if identity in skipped:continue
  remote=parents[identity] if len(p['path'].split('/'))==2 else m.request('/'+p['path'])
  actual={k:m.decode(v) for k,v in remote['fields'].items()}
  assert all(actual.get(k)==v for k,v in p['before'].items()),'Content changed since preparation: '+p['path']
  after=dict(p['after'])
  if len(p['path'].split('/'))==2:after['lastUpdate']=stamp
  updates.append({'path':p['path'],'after':after})
  before.append({'path':p['path'],'data':actual,'updateTime':remote['updateTime']})
  writes.append({'update':{'name':remote['name'],'fields':{k:m.encode(v) for k,v in after.items()}},'updateMask':{'fieldPaths':list(after)},'currentDocument':{'updateTime':remote['updateTime']}})
 (OUT/'preflight.json').write_text(json.dumps({'updates':len(updates),'skippedDeletedIdentities':skipped,'patchSha256':hashlib.sha256((OUT/'patches.json').read_bytes()).hexdigest()},indent=2))
 print('Prepared',len(updates),'updates. Skipped deleted identities:',len(skipped),flush=True)
 if mode!='publish':return
 (OUT/'before.json').write_text(json.dumps(before,ensure_ascii=False,indent=2))
 assert len(writes)<500 and len(json.dumps(writes).encode())<9000000
 result=m.request(':commit',{'writes':writes})
 (OUT/'receipt.json').write_text(json.dumps({'commitTime':result['commitTime'],'updates':updates,'skippedDeletedIdentities':skipped},ensure_ascii=False,indent=2))
 # Keep the checked-in import documents aligned without changing historical receipts.
 for folder in ['la-bonne-semence-2021-2026','reading-plans-2026-09']:
  path=ROOT/'output/imports'/folder/'documents.json';docs=json.loads(path.read_text())
  for d in docs:
   for u in updates:
    if d['path']==u['path']:d['data'].update(u['after'])
  path.write_text(json.dumps(docs,ensure_ascii=False,indent=2))
  reportpath=path.parent/'validation.json';report=json.loads(reportpath.read_text())
  if 'sha256' in report:report['sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
  report['latestCorrectionReceipt']='../reading-ui-fixes-2026-09/receipt.json'
  reportpath.write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('Published atomically; run verify.')
if __name__=='__main__':main()

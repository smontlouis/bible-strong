"""Native-generator parity and identical replay with all evaluator directories hidden."""
import argparse,gzip,hashlib,json,subprocess
from collections import Counter
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
cases=[('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]
def raw(p):
 if p.exists():return p.read_bytes()
 with gzip.open(str(p)+'.gz','rb') as f:return f.read()
def carriers(v):return Counter((p.get('originalOccurrenceId'),p['strong'],p['kind'],p.get('startWordIndex'),p.get('endWordIndex'),p.get('insertAfterWordIndex')) for p in v['placements'])
def units(v):return [(u['sourceUnitId'],u['occurrenceIds'],u['strong'],u['state'],u['targetWordIndices']) for u in v['units']]
hidden=[];reports=[];replay=[]
try:
 for name in ['evaluator-only','evaluation','acquisition']:
  src=r/name;dest=r/('hidden-for-replay-'+name);src.rename(dest);hidden.append((src,dest))
 for ed,sc in cases:
  f=r/f'predictions/consensus-heads/{ed}-{sc}/test.json';before=hashlib.sha256(raw(f)).hexdigest();expected=json.loads(raw(f))
  with (r/f'integration-{ed}-{sc}.log').open('w') as log:
   subprocess.run(['node','--max-old-space-size=8192','--import','tsx','scripts/strong-surface-recovery/native.ts',str(r),ed,sc,'candidate','test'],stdout=log,stderr=subprocess.STDOUT,check=True)
  actual=json.loads(raw(r/f'predictions/integrated/{ed}-{sc}/test.json'))
  assert [v['ref'] for v in expected]==[v['ref'] for v in actual]
  differences=[x['ref'] for x,y in zip(expected,actual) if x['text']!=y['text'] or carriers(x)!=carriers(y) or units(x)!=units(y)]
  reports.append({'edition':ed,'scenario':sc,'verses':len(actual),'differences':differences,'evaluatorDirectoriesHidden':True})
  (r/'integration-verification.json').write_text(json.dumps(reports,indent=2)+'\n')
  assert not differences,differences
  with (r/f'blind-replay-{ed}-{sc}.log').open('w') as log:
   subprocess.run(['node','--max-old-space-size=8192','--import','tsx','scripts/strong-surface-recovery/refine.ts',str(r),ed,sc,'test','consensus-heads'],stdout=log,stderr=subprocess.STDOUT,check=True)
  after=hashlib.sha256(raw(f)).hexdigest();assert before==after
  replay.append({'edition':ed,'scenario':sc,'sha256':after,'identical':True})
  (r/'blind-replay-verification.json').write_text(json.dumps(replay,indent=2)+'\n')
  print('Integrated parity and blind replay',ed,sc,len(actual),flush=True)
finally:
 for src,dest in reversed(hidden):dest.rename(src)
assert len(reports)==len(replay)==7

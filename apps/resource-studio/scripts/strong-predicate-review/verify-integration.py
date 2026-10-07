"""Check native generator parity with the pure recovery and replay without labels."""
import argparse,gzip,hashlib,json,subprocess
from collections import Counter
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
cases=[('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]
def carriers(v):return Counter((p.get('originalOccurrenceId'),p['strong'],p['kind'],p.get('startWordIndex'),p.get('endWordIndex'),p.get('insertAfterWordIndex')) for p in v['placements'])
def units(v):return [(u['sourceUnitId'],u['occurrenceIds'],u['strong'],u['state'],u['targetWordIndices']) for u in v['units']]
reports=[]
for ed,sc in cases:
 with (r/f'integration-{ed}-{sc}.log').open('w') as f:
  subprocess.run(['node','--max-old-space-size=12288','--import','tsx','scripts/strong-predicate-review/predict.ts',str(r),ed,sc,'candidate','test'],stdout=f,stderr=subprocess.STDOUT,check=True)
 expected=json.loads((r/f'predictions/all/{ed}-{sc}/test.json').read_text());actual=json.loads((r/f'predictions/integrated/{ed}-{sc}/test.json').read_text())
 assert [v['ref'] for v in expected]==[v['ref'] for v in actual]
 differences=[x['ref'] for x,y in zip(expected,actual) if x['text']!=y['text'] or carriers(x)!=carriers(y) or units(x)!=units(y)]
 reports.append({'edition':ed,'scenario':sc,'verses':len(actual),'differences':differences});assert not differences,differences
 print('Integrated parity',ed,sc,len(actual),flush=True)
(r/'integration-verification.json').write_text(json.dumps(reports,indent=2)+'\n')
hidden=[]
try:
 for name in ['evaluator-only','evaluation','acquisition']:
  source=r/name;dest=r/('hidden-for-replay-'+name);source.rename(dest);hidden.append((source,dest))
 replay=[]
 for ed,sc in cases:
  file=r/f'predictions/all/{ed}-{sc}/test.json';before=hashlib.sha256(file.read_bytes()).hexdigest()
  with (r/f'blind-replay-{ed}-{sc}.log').open('w') as f:
   subprocess.run(['node','--max-old-space-size=12288','--import','tsx','scripts/strong-predicate-review/refine.ts',str(r),ed,sc,'test'],stdout=f,stderr=subprocess.STDOUT,check=True)
  after=hashlib.sha256(file.read_bytes()).hexdigest();assert before==after
  for variant in ['guard','expressions','common']:
   scratch=r/f'predictions/{variant}/{ed}-{sc}/test.json'
   with gzip.open(str(scratch)+'.gz','wb',compresslevel=3) as f:f.write(scratch.read_bytes())
   scratch.unlink()
  replay.append({'edition':ed,'scenario':sc,'sha256':after,'identical':True})
 (r/'blind-replay-verification.json').write_text(json.dumps(replay,indent=2)+'\n')
finally:
 for source,dest in reversed(hidden):dest.rename(source)

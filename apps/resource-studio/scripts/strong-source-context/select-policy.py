"""Reproduce the declared selection and require its development regression gate."""
import argparse,json
from pathlib import Path
from collections import Counter
p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=Path);a=p.parse_args();r=a.root.resolve();result={}
def key(p):return (p['strong'],'e',p.get('insertAfterWordIndex')) if p['kind']=='empty' else (p['strong'],'v',tuple(p.get('targetWordIndices') or range(p['startWordIndex'],p['endWordIndex']+1)))
for case in ['SG21-target-excluded','NEG-target-excluded','SG21-family-excluded','NEG-family-excluded','Sg1910-control-segond','Darby-control-darby','DarbyR-control-darby']:
 before=json.loads((r/f'evaluation/source/{case}/development.json').read_text());after=json.loads((r/f'evaluation/all/{case}/development.json').read_text());losses=[]
 for x,y in zip(before['scores'],after['scores']):
  assert x['ref']==y['ref'];n=sum((Counter(map(key,y['unmatchedExpected']))-Counter(map(key,x['unmatchedExpected']))).values())
  if n:losses.append([x['ref'],n])
 b=before['summary']['metrics']['exact'];c=after['summary']['metrics']['exact'];assert not losses,(case,losses)
 result[case]={'tpDelta':c['tp']-b['tp'],'fpDelta':c['fp']-b['fp'],'losses':losses,'f1':c['f1']}
data=json.dumps({'selected':'all','displayAdaptation':'existing-heads-for-CSV-controls','results':result,'noReservedLabelsConsulted':True},indent=2)+'\n'
f=r/'development-selection.json'
if f.exists():assert f.read_text()==data,'selection-already-recorded-with-other-content'
else:f.write_text(data)
print('Selected the declared combined policy; seven development gates passed.')

import argparse,json,collections,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=Path);a=p.parse_args();r=a.root.resolve();summary={}
cases=['SG21-target-excluded','NEG-target-excluded','SG21-family-excluded','NEG-family-excluded','Sg1910-control-segond','Darby-control-darby','DarbyR-control-darby']
def key(p):return (p['strong'],'empty',p.get('insertAfterWordIndex',-1)) if p['kind']=='empty' else (p['strong'],'visible',tuple(p.get('targetWordIndices') or range(p['startWordIndex'],p['endWordIndex']+1)))
for split in ['development','test']:
 summary[split]={}
 for case in cases:
  data={v:json.loads((r/f'evaluation/{v}/{case}/{split}.json').read_text()) for v in ['baseline','source','light','local','groups','all','common']}
  lost=[];new=[]
  for old,candidate in zip(data['baseline']['scores'],data['all']['scores']):
   assert old['ref']==candidate['ref'];loss=collections.Counter(map(key,candidate['unmatchedExpected']))-collections.Counter(map(key,old['unmatchedExpected']));extra=collections.Counter(map(key,candidate['unmatchedPredicted']))-collections.Counter(map(key,old['unmatchedPredicted']))
   if loss:lost.append({'ref':old['ref'],'carriers':[(k,n) for k,n in loss.items()]})
   if extra:new.append({'ref':old['ref'],'carriers':[(k,n) for k,n in extra.items()]})
  changes=json.loads((r/f'predictions/all/{case}/{split}-changes.json').read_text())
  summary[split][case]={'variants':{v:x['summary'] for v,x in data.items()},'lostPreviouslyExact':lost,'newDisagreements':new,'contextChanges':dict(collections.Counter(c['rule'] for v in changes for c in v['changes']))}
(r/'comparison-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
for case,s in summary['test'].items():
 b=s['variants']['baseline']['metrics']['exact'];a=s['variants']['all']['metrics']['exact'];print(case,round(b['f1']*100,3),'->',round(a['f1']*100,3),'TP',a['tp']-b['tp'],'FP',a['fp']-b['fp'],'lost',len(s['lostPreviouslyExact']),'context',s['contextChanges'])

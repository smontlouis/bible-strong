"""Summarize comparable before/after scores and prepare the disagreement review."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve();summary={};review=[]
for split in ['development','test']:
 summary[split]={}
 for case in sorted((r/'evaluation/baseline').iterdir()):
  variants={v:json.loads((r/f'evaluation/{v}/{case.name}/{split}.json').read_text()) for v in ['baseline','lexicon','neighbors','compounds','all']}
  baseline=variants['baseline'];candidate=variants['all'];before={row['ref']:row for row in baseline['scores']}
  losses=[row['ref'] for row in candidate['scores'] if row['metrics']['exact']['tp']<before[row['ref']]['metrics']['exact']['tp']]
  summary[split][case.name]={'variants':{v:data['summary'] for v,data in variants.items()},'previousExactLosses':losses};assert not losses
  if split!='test' or case.name not in ['SG21-target-excluded','NEG-target-excluded']:continue
  ed=case.name.split('-')[0]
  predictions={v['ref']:v for v in json.loads((r/f'predictions/all/{case.name}/{split}.json').read_text())}
  gold={v['ref']:v for v in json.loads((r/f'evaluator-only/{ed}-{split}.gold.json').read_text())}
  for row in candidate['scores']:
   for placement in row['unmatchedPredicted']:
    if not placement['id'].startswith('recovery:'):continue
    v=predictions[row['ref']];at=placement['startWordIndex'];unit=next(u for u in v['units'] if placement['originalOccurrenceId'] in u['occurrenceIds'])
    expected=[{**g,'surface':' '.join(v['words'][i] for i in g.get('targetWordIndices',[]))} for g in gold[row['ref']]['placements'] if g['strong']==placement['strong'] or at in g.get('targetWordIndices',[])]
    review.append({'edition':ed,'ref':row['ref'],'text':v['text'],'placement':placement,'surface':v['words'][at],'source':unit['source'],'reasons':unit['reasons'],'reference':expected,'review':'pending-assisted-review'})
(r/'comparison-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
(r/'reserved-disagreements.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
for case,data in summary['test'].items():
 b=data['variants']['baseline']['metrics']['exact'];c=data['variants']['all']['metrics']['exact']
 print(case,'verses',data['variants']['all']['verses'],'F1',round(b['f1']*100,4),'->',round(c['f1']*100,4),'added exact',c['tp']-b['tp'],'added disagreements',c['fp']-b['fp'])

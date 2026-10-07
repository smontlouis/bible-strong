"""Report carrier scores separately from full translation-relation changes."""
import argparse,json
from collections import Counter
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve();summary={}
for split in ['development','test']:
 summary[split]={}
 for case in sorted((r/'evaluation/baseline').iterdir()):
  variants={v:json.loads((r/f'evaluation/{v}/{case.name}/{split}.json').read_text()) for v in ['baseline','guard','expressions','all','common']};before={v['ref']:v for v in variants['baseline']['scores']}
  losses=[v['ref'] for v in variants['all']['scores'] if v['metrics']['exact']['tp']<before[v['ref']]['metrics']['exact']['tp']]
  changes=json.loads((r/f'predictions/all/{case.name}/{split}-changes.json').read_text())
  rules=Counter(c['rule'] for row in changes for c in row['changes'])
  summary[split][case.name]={'variants':{k:v['summary'] for k,v in variants.items()},'previousExactLosses':losses,'relationRules':rules};assert not losses
  if split=='test':
   b=variants['baseline']['summary']['metrics']['exact'];c=variants['all']['summary']['metrics']['exact'];print(case.name,variants['all']['summary']['verses'],'F1',b['f1'],'->',c['f1'],'TP',c['tp']-b['tp'],'FP',c['fp']-b['fp'],'relations',dict(rules))
(r/'comparison-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')

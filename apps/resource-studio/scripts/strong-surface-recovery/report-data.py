"""Summarize exact/overlap/identity/empty metrics by scenario, testament and difficulty."""
import argparse,gzip,json,re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
books=re.findall(r'"([A-Za-z0-9]+)"',Path('src/books.ts').read_text().split('export const BOOK_IDS')[1].split(']')[0])
def read(p):
 with (p.open() if p.exists() else gzip.open(str(p)+'.gz','rt')) as f:return json.load(f)
def aggregate(rows):
 metrics={}
 for row in rows:
  for k,v in row['metrics'].items():
   acc=metrics.setdefault(k,dict(predicted=0,expected=0,tp=0))
   for name in acc:acc[name]+=v[name]
 for m in metrics.values():
  n,e,t=m['predicted'],m['expected'],m['tp'];m.update(fp=n-t,fn=e-t,precision=t/n if n else 0,recall=t/e if e else 0,f1=2*t/(n+e) if n+e else 0)
 units=sum(x['units'] for x in rows);unresolved=sum(x['unresolved'] for x in rows)
 return {'verses':len(rows),'metrics':metrics,'sourceUnits':units,'unresolved':unresolved,'uncertaintyRate':unresolved/units if units else 1,'establishedEmpty':sum(x['establishedEmpty'] for x in rows),'fullyAccountedVerses':sum(x['fullyAccounted'] for x in rows),'identityComparableVerses':sum(x['identityComparable'] for x in rows),'cardinalityError':sum(x['cardinalityError'] for x in rows)}
report={}
for split in ['development','test']:
 report[split]={}
 for case in sorted((r/'evaluation/baseline').iterdir()):
  variants={}
  for folder in sorted((r/'evaluation').iterdir()):
   file=folder/case.name/f'{split}.json'
   if file.exists():variants[folder.name]=read(file)['summary']
  by_testament={};by_difficulty={}
  for variant in ['baseline','consensus-heads']:
   rows=read(r/f'evaluation/{variant}/{case.name}/{split}-scores.json')
   by_testament[variant]={t:aggregate([x for x in rows if ('AT' if books.index(x['ref'].split('.')[0])<39 else 'NT')==t]) for t in ['AT','NT']}
   by_difficulty[variant]={d:aggregate([x for x in rows if d in x['difficulties']]) for d in sorted({d for x in rows for d in x['difficulties']})}
  b=variants['baseline']['metrics']['exact'];c=variants['consensus-heads']['metrics']['exact']
  report[split][case.name]={'variants':variants,'byTestament':by_testament,'byDifficulty':by_difficulty,'delta':{k:c[k]-b[k] for k in ['tp','fp','fn','precision','recall','f1']},'noExactPrecisionRecallRegression':c['precision']>=b['precision'] and c['recall']>=b['recall']}
  print(split,case.name,'verses',variants['baseline']['verses'],'TP+',c['tp']-b['tp'],'FP+',c['fp']-b['fp'],'F1',b['f1'],c['f1'])
(r/'comparison-summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

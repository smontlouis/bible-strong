"""Select stable audit samples from full-corpus recoveries; not a new test set."""
import argparse,hashlib,json,sqlite3
from collections import defaultdict
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve();samples=[]
for ed in ['s21','neg79']:
 db=sqlite3.connect(f'file:{r}/full/generated/{ed}/bible-{ed}-strong.sqlite?mode=ro',uri=True);groups=defaultdict(list)
 for item in json.loads((r/f'full-recovery-{ed}.json').read_text()):
  ref=item['ref'];row=db.execute('select book_order,tokens_json,resolution_json from verses where bible=? and ref=?',(ed,ref)).fetchone()
  tokens=json.loads(row[1]);res=json.loads(row[2]);unit=next(u for u in res['decisions'] if u['sourceUnitId']==item['sourceUnitId'])
  key=(item['rule'],'AT' if row[0]<39 else 'NT');rank=hashlib.sha256((ed+':recovery-audit-v1:'+ref+':'+item['sourceUnitId']).encode()).hexdigest()
  groups[key].append((rank,{'edition':ed,'ref':ref,'rule':item['rule'],'text':item['text'],'surface':tokens[item['placement']['startWordIndex']]['text'],'strong':item['placement']['strong'],'gloss':unit['source']['gloss'],'morphology':unit['source']['morphology'],'attestations':item['attestations'],'anchors':item['anchors'],'review':'pending-assisted-review'}))
 for key,values in groups.items():samples.extend(item for _,item in sorted(values)[:3])
 db.close()
(r/'full-assisted-review.json').write_text(json.dumps(samples,ensure_ascii=False,indent=2)+'\n')
print('Full-corpus stratified samples',len(samples))

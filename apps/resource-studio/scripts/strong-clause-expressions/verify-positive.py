"""Exercise actual generation on development passages where the optional layer acts."""
import argparse,gzip,hashlib,json,re,subprocess
from collections import Counter
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
def read(p):
 with (p.open() if p.exists() else gzip.open(str(p)+'.gz','rt')) as f:return json.load(f)
def save(p,v):
 p.parent.mkdir(parents=True,exist_ok=True);b=(json.dumps(v,ensure_ascii=False,separators=(',',':'))+'\n').encode();p.write_bytes(b);return hashlib.sha256(b).hexdigest()
def carriers(v):return Counter((p.get('originalOccurrenceId'),p['strong'],p['kind'],p.get('startWordIndex'),p.get('endWordIndex'),p.get('insertAfterWordIndex')) for p in v['placements'])
def units(v):return [(u['sourceUnitId'],u['occurrenceIds'],u['strong'],u['state'],u['targetWordIndices']) for u in v['units']]
meta=read(r/'prepared-inputs.json');reports=[]
books=re.findall(r'"([A-Za-z0-9]+)"',Path('src/books.ts').read_text().split('export const BOOK_IDS')[1].split(']')[0])
for ed in ['SG21','NEG']:
 changes=read(r/f'predictions/common-heads/{ed}-target-excluded/development-changes.json')
 chosen=sorted(changes,key=lambda x:hashlib.sha256(x['ref'].encode()).hexdigest())[:5];refs={x['ref'] for x in chosen}
 assert refs
 targets=[x for x in read(r/f'masked/{ed}-development.json') if x['ref'] in refs]
 original=read(r/f'masked/{ed}-development.bible.json');bible={}
 for target in targets:
  book,ch,v=target['ref'].split('.');bk=str(books.index(book)+1)
  assert original[bk][ch][v]==target['text']
  bible.setdefault(bk,{}).setdefault(ch,{})[v]=target['text']
 assert sum(len(v) for cs in bible.values() for v in cs.values())==len(refs)
 for name,value in [(f'masked/{ed}-integration-canary.json',targets),(f'masked/{ed}-integration-canary.bible.json',bible)]:meta['files'][name]=save(r/name,value)
 save(r/'prepared-inputs.json',meta)
 for variant in ['baseline','candidate']:
  with (r/f'positive-{ed}-{variant}.log').open('w') as log:
   subprocess.run(['node','--max-old-space-size=8192','--import','tsx','scripts/strong-clause-expressions/native.ts',str(r),ed,'target-excluded',variant,'integration-canary'],stdout=log,stderr=subprocess.STDOUT,check=True)
 with (r/f'positive-{ed}-pure.log').open('w') as log:
  subprocess.run(['node','--max-old-space-size=8192','--import','tsx','scripts/strong-clause-expressions/predict.ts',str(r),ed,'target-excluded','integration-canary','common-heads'],stdout=log,stderr=subprocess.STDOUT,check=True)
 base=read(r/f'predictions/baseline/{ed}-target-excluded/integration-canary.json');sparse=read(r/f'predictions/common-heads/{ed}-target-excluded/integration-canary.json');replacements={v['ref']:v for v in sparse['replacements']};expected=[replacements.get(v['ref'],v) for v in base];actual=read(r/f'predictions/integrated/{ed}-target-excluded/integration-canary.json')
 diffs=[x['ref'] for x,y in zip(expected,actual,strict=True) if x['ref']!=y['ref'] or x['text']!=y['text'] or carriers(x)!=carriers(y) or units(x)!=units(y)]
 count=sum(len(x['changes']) for x in read(r/f'predictions/common-heads/{ed}-target-excluded/integration-canary-changes.json'))
 assert not diffs,diffs;assert count>0,'positive integration integration-canary did not exercise the optional layer'
 reports.append({'edition':ed,'refs':sorted(refs),'newCarriers':count,'differences':diffs,'scope':'development-only-positive-integration'})
 save(r/'positive-integration-verification.json',reports)
 print('Positive native integration',ed,count,flush=True)
 meta=read(r/'prepared-inputs.json')

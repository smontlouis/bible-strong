"""Snapshot the current candidate and prepare consumed development data, before new rules."""
import argparse,hashlib,json,re,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--previous',type=Path,required=True);a=p.parse_args();r=a.root.resolve();old=a.previous.resolve();r.mkdir(parents=True,exist_ok=False);studio=Path.cwd()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(relative,value):
 f=r/relative;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');return sha(f)
delivery=json.loads((old/'delivery-manifest.json').read_text());previous=json.loads((old/'plan.json').read_text());prepared=json.loads((old/'prepared-inputs.json').read_text());files={}
save('baseline-origin.json',{'experiment':str(old),'developmentSource':str(old),'sourceDeliverySha256':sha(old/'delivery-manifest.json')})
for folder in ['src','scripts']:shutil.copytree(old/'full/code'/folder,r/'baseline-code'/folder,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
(r/'baseline-code/node_modules').symlink_to(studio/'node_modules',target_is_directory=True)
save('baseline-code/manifest.json',{str(f.relative_to(r/'baseline-code')):sha(f) for f in (r/'baseline-code').rglob('*') if f.is_file() and 'node_modules' not in f.parts})
(r/'environments').symlink_to(old/'environments',target_is_directory=True)
files.update({f:h for f,h in prepared['files'].items() if f.startswith('environments/')})
seen={c['ref'] for c in previous['chapters']}|set(previous.get('excludedChapters',[]))|{'1John.1'}
def review_refs(obj):
 if isinstance(obj,dict):
  ref=obj.get('ref')
  if isinstance(ref,str) and re.fullmatch(r'[A-Za-z0-9]+\.\d+\.\d+',ref):seen.add(ref.rsplit('.',1)[0])
  for v in obj.values():review_refs(v)
 elif isinstance(obj,list):
  for v in obj:review_refs(v)
for pattern in ['strong-*/*review*.json','strong-*/*/*review*.json']:
 for f in Path('outputs').glob(pattern):
  if f.stat().st_size<20_000_000:
   try:review_refs(json.loads(f.read_text()))
   except (ValueError,UnicodeError):pass
book_source=Path('src/books.ts').read_text().split('export const BOOK_IDS')[1].split(']')[0];books=re.findall(r'"([A-Za-z0-9]+)"',book_source);assert len(books)==66
text=json.loads((old/'full/environment/data/bibles/bible-s21.json').read_text())
groups={'loi':books[:5],'histoire':books[5:17],'poesie-sagesse':books[17:22],'prophetie':books[22:39],'evangiles':books[39:43],'actes':['Acts'],'epitres':books[44:65],'apocalypse':['Rev']};chosen=[]
for genre,ids in groups.items():
 candidates=[(hashlib.sha256(('predicate-relations-v1:'+bk+'.'+ch).encode()).hexdigest(),bk+'.'+ch) for bk in ids for ch in text[str(books.index(bk)+1)] if bk+'.'+ch not in seen];selected=[]
 for _,ref in sorted(candidates):
  if len(ids)>1 and any(x.split('.')[0]==ref.split('.')[0] for x in selected):continue
  selected.append(ref)
  if len(selected)==2:break
 chosen.extend({'ref':ref,'split':'test','genre':genre,'selection':'sha256-predicate-relations-v1-unseen-chapters'} for ref in selected)
plan={**previous,'version':'predicate-relations-v1','chapters':[{**c,'split':'development','alreadyExposed':True} for c in previous['chapters']]+chosen,'excludedChapters':sorted(seen),'reservedAnnotationsAccessed':False};save('plan.json',plan)
for ed in ['SG21','NEG','Sg1910','Darby','DarbyR']:
 targets=[];gold=[];bible={}
 for split in ['development','test']:
  f=f'masked/{ed}-{split}.json';assert sha(old/f)==prepared['files'][f];targets.extend(json.loads((old/f).read_text()))
  if ed in ['SG21','NEG']:
   f=f'evaluator-only/{ed}-{split}.gold.json';assert sha(old/f)==prepared['files'][f];gold.extend(json.loads((old/f).read_text()))
 assert len(targets)==len({x['ref'] for x in targets})
 for row in targets:
  bk,ch,v=row['ref'].split('.');bible.setdefault(str(books.index(bk)+1),{}).setdefault(ch,{})[v]=row['text']
 for f,value in [(f'masked/{ed}-development.json',targets),(f'masked/{ed}-development.bible.json',bible)]:files[f]=save(f,value)
 if gold:files[f'evaluator-only/{ed}-development.gold.json']=save(f'evaluator-only/{ed}-development.gold.json',gold)
origins={}
for ed,sc in [('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]:
 data=[]
 for split in ['development','test']:
  f=old/f'predictions/all/{ed}-{sc}/{split}.json';origins[str(f)]=sha(f);data.extend(json.loads(f.read_text()))
 f=f'predictions/baseline/{ed}-{sc}/development.json';files[f]=save(f,data)
save('baseline-prediction-origins.json',origins);save('prepared-inputs.json',{'files':files,'planSha256':sha(r/'plan.json')})
print('Prepared development and baseline snapshots. New chapter IDs only:',[x['ref'] for x in chosen])

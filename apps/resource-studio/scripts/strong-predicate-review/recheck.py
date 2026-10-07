"""Reuse the previous delivered baseline; consumed tests become development."""
import argparse,gzip,hashlib,json,re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--previous',type=Path,required=True);a=p.parse_args();r=a.root.resolve();old=a.previous.resolve();r.mkdir(parents=True,exist_ok=False)
def raw(f):
 if f.exists():return f.read_bytes()
 with gzip.open(str(f)+'.gz','rb') as stream:return stream.read()
def sha(f):return hashlib.sha256(raw(f)).hexdigest()
def save(name,value):
 f=r/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');return sha(f)
origin=json.loads((old/'baseline-origin.json').read_text());origin['developmentSource']=str(old);save('baseline-origin.json',origin)
(r/'baseline-code').symlink_to(old/'baseline-code',target_is_directory=True);(r/'environments').symlink_to(old/'environments',target_is_directory=True)
previous=json.loads((old/'plan.json').read_text());seen={c['ref'] for c in previous['chapters']}|set(previous['excludedChapters'])
audit=json.loads((old/'full-before-after.json').read_text())
for ed,data in audit.items():
 for issue in data['lostPriorRelationIndices']:seen.add(issue['ref'].rsplit('.',1)[0])
books=re.findall(r'"([A-Za-z0-9]+)"',Path('src/books.ts').read_text().split('export const BOOK_IDS')[1].split(']')[0]);assert len(books)==66
text=json.loads((Path(origin['experiment'])/'full/environment/data/bibles/bible-s21.json').read_text())
groups={'loi':books[:5],'histoire':books[5:17],'poesie-sagesse':books[17:22],'prophetie':books[22:39],'evangiles':books[39:43],'actes':['Acts'],'epitres':books[44:65],'apocalypse':['Rev']};chosen=[]
for genre,ids in groups.items():
 choices=sorted((hashlib.sha256(('predicate-relations-preserve-v2:'+bk+'.'+ch).encode()).hexdigest(),bk+'.'+ch) for bk in ids for ch in text[str(books.index(bk)+1)] if bk+'.'+ch not in seen);selected=[]
 for _,ref in choices:
  if len(ids)>1 and any(x.split('.')[0]==ref.split('.')[0] for x in selected):continue
  selected.append(ref)
  if len(selected)==2:break
 assert len(selected)==2
 chosen.extend({'ref':ref,'split':'test','genre':genre,'selection':'sha256-predicate-relations-preserve-v2'} for ref in selected)
save('plan.json',{**previous,'version':'predicate-relations-preserve-v2','chapters':[{**x,'split':'development','alreadyExposed':True} for x in previous['chapters']]+chosen,'excludedChapters':sorted(seen),'reservedAnnotationsAccessed':False})
meta=json.loads((old/'prepared-inputs.json').read_text());files={f:h for f,h in meta['files'].items() if f.startswith('environments/')}
for ed in ['SG21','NEG','Sg1910','Darby','DarbyR']:
 targets=[];gold=[];bible={}
 for split in ['development','test']:
  f=f'masked/{ed}-{split}.json';assert sha(old/f)==meta['files'][f];targets.extend(json.loads((old/f).read_text()))
  if ed in ['SG21','NEG']:
   f=f'evaluator-only/{ed}-{split}.gold.json';assert sha(old/f)==meta['files'][f];gold.extend(json.loads((old/f).read_text()))
 assert len(targets)==len({x['ref'] for x in targets})
 for t in targets:
  bk,ch,v=t['ref'].split('.');bible.setdefault(str(books.index(bk)+1),{}).setdefault(ch,{})[v]=t['text']
 for f,data in [(f'masked/{ed}-development.json',targets),(f'masked/{ed}-development.bible.json',bible)]:files[f]=save(f,data)
 if gold:files[f'evaluator-only/{ed}-development.gold.json']=save(f'evaluator-only/{ed}-development.gold.json',gold)
for ed,sc in [('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]:
 data=[]
 for split in ['development','test']:
  f=f'predictions/baseline/{ed}-{sc}/{split}.json';assert sha(old/f)==meta['files'][f];data.extend(json.loads(raw(old/f)))
 f=f'predictions/baseline/{ed}-{sc}/development.json';files[f]=save(f,data)
save('prepared-inputs.json',{'files':files,'planSha256':sha(r/'plan.json')})
(old/'retired.json').write_text(json.dumps({'reason':'prior relation complements overwritten; reader scores alone did not catch it','replacedBy':str(r),'reserveNowDevelopment':True},indent=2)+'\n')
print('New reserved chapter identifiers only:',[x['ref'] for x in chosen])

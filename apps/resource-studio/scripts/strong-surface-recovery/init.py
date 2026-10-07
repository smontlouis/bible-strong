"""Prepare compressed baselines and a new chapter reserve, without fetching labels."""
import argparse,gzip,hashlib,json,re
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,required=True);parser.add_argument('--previous',type=Path);args=parser.parse_args();root=args.root.resolve()
origin=json.loads((root/'baseline-origin.json').read_text());old=args.previous.resolve() if args.previous else Path(origin['experiment']);baseline_variant='baseline' if args.previous else 'all'
def raw(p):
 if p.exists():return p.read_bytes()
 with gzip.open(str(p)+'.gz','rb') as f:return f.read()
def sha(b):return hashlib.sha256(b).hexdigest()
files={}
def save(name,value,compressed=False):
 b=(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n').encode();p=root/name;p.parent.mkdir(parents=True,exist_ok=True)
 if compressed:p=Path(str(p)+'.gz');b2=gzip.compress(b,compresslevel=1,mtime=0)
 else:b2=b
 with p.open('xb') as f:f.write(b2)
 files[name]=sha(b)
previous=json.loads((old/'plan.json').read_text());seen=set(previous['excludedChapters'])|{c['ref'] for c in previous['chapters']}
for p in Path('outputs').rglob('*.html'):
 m=re.match(r'(?:SG21|NEG)-([A-Za-z0-9]+)-(\d+)\.html$',p.name)
 if m:seen.add(m[1]+'.'+m[2])
seen.update(['1Kgs.1','1Kgs.8','2Chr.6','Jer.22','Jer.38','Matt.5','Matt.9','Mark.2','Luke.5','Luke.7','Luke.13','Luke.23','John.11','Acts.5','Acts.11','1Pet.2','1Pet.4','Rev.15','1John.1'])
books=re.findall(r'"([A-Za-z0-9]+)"',Path('src/books.ts').read_text().split('export const BOOK_IDS')[1].split(']')[0]);assert len(books)==66
text=json.loads((Path(origin['experiment'])/'full/environment/data/bibles/bible-s21.json').read_text())
genres={'loi':books[:5],'histoire':books[5:17],'poesie-sagesse':books[17:22],'prophetie':books[22:39],'evangiles':books[39:43],'actes':['Acts'],'epitres':books[44:65],'apocalypse':['Rev']};chosen=[];exhausted=[]
for genre,ids in genres.items():
 candidates=sorted((sha((('surface-recovery-clauses-v2:' if args.previous else 'surface-recovery-v1:')+b+'.'+c).encode()),b+'.'+c) for b in ids for c in text[str(books.index(b)+1)] if b+'.'+c not in seen)
 selected=[]
 for _,ref in candidates:
  if len(ids)>1 and any(x.split('.')[0]==ref.split('.')[0] for x in selected):continue
  selected.append(ref)
  if len(selected)==2:break
 if len(selected)<2:exhausted.append({'genre':genre,'remainingUnseenChapters':len(selected)})
 chosen.extend({'ref':ref,'split':'test','genre':genre,'selection':'sha256-surface-recovery-clauses-v2' if args.previous else 'sha256-surface-recovery-v1'} for ref in selected)
save('plan.json',{**previous,'version':'surface-recovery-clauses-v2' if args.previous else 'surface-recovery-v1','chapters':[{**x,'split':'development','alreadyExposed':True} for x in previous['chapters']]+chosen,'excludedChapters':sorted(seen),'exhaustedReserveGenres':exhausted,'reservedAnnotationsAccessed':False})
prepared=json.loads((old/'prepared-inputs.json').read_text());files.update({f:h for f,h in prepared['files'].items() if f.startswith('environments/')})
for ed in ['SG21','NEG','Sg1910','Darby','DarbyR']:
 targets=[];gold=[];bible={}
 for split in ['development','test']:
  name=f'masked/{ed}-{split}.json';b=raw(old/name);assert sha(b)==prepared['files'][name];targets.extend(json.loads(b))
  if ed in ['SG21','NEG']:
   name=f'evaluator-only/{ed}-{split}.gold.json';b=raw(old/name);assert sha(b)==prepared['files'][name];gold.extend(json.loads(b))
 assert len(targets)==len({x['ref'] for x in targets})
 for t in targets:
  bk,ch,v=t['ref'].split('.');bible.setdefault(str(books.index(bk)+1),{}).setdefault(ch,{})[v]=t['text']
 save(f'masked/{ed}-development.json',targets);save(f'masked/{ed}-development.bible.json',bible)
 if gold:save(f'evaluator-only/{ed}-development.gold.json',gold)
cleanup=json.loads(Path('outputs/strong-experiment-cleanup-2026-10-02/receipt.json').read_text());hashes={x['path']:x['sha256'] for x in cleanup['events'] if x['action']=='archive-verified-diagnostic'}
for ed,sc in [('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]:
 predictions=[]
 for split in ['development','test']:
  name=f'predictions/{baseline_variant}/{ed}-{sc}/{split}.json';p=old/name;b=raw(p);assert sha(b)==(prepared['files'][name] if args.previous else hashes[str(p)]);predictions.extend(json.loads(b))
 save(f'predictions/baseline/{ed}-{sc}/development.json',predictions,True)
(root/'prepared-inputs.json').write_text(json.dumps({'files':files,'planSha256':files['plan.json']},indent=2)+'\n')
print('Reserved chapters (identifiers only):', [x['ref'] for x in chosen])

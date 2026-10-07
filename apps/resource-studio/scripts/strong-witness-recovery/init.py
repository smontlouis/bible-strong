"""Retire an exposed reserve and select new chapter ids before reading their labels."""
import argparse,hashlib,json,re,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--retired',type=Path,required=True);p.add_argument('--seed',default='witness-recovery-guard-v2');p.add_argument('--retirement-reason',default='unacceptable auxiliary and adposition homographs on the first reserve');a=p.parse_args();r=a.root.resolve();old=a.retired.resolve();r.mkdir(parents=True,exist_ok=False)
origin=json.loads((old/'baseline-origin.json').read_text());origin['developmentSource']=str(old)
(r/'baseline-origin.json').write_text(json.dumps(origin,indent=2)+'\n')
(r/'baseline-code').symlink_to(old/'baseline-code',target_is_directory=True)
shutil.copytree(old/'text-repair',r/'text-repair')
previous=json.loads((old/'plan.json').read_text());seen={c['ref'] for c in previous['chapters']}|set(previous.get('excludedChapters',[]))
book_source=Path('src/books.ts').read_text().split('export const BOOK_IDS')[1].split(']')[0];books=re.findall(r'"([A-Za-z0-9]+)"',book_source);assert len(books)==66
text=json.loads((Path(origin['experiment'])/'full/environment/data/bibles/bible-s21.json').read_text())
groups={'loi':books[:5],'histoire':books[5:17],'poesie-sagesse':books[17:22],'prophetie':books[22:39],'evangiles':books[39:43],'actes':['Acts'],'epitres':books[44:65],'apocalypse':['Rev']}
chosen=[]
for genre,ids in groups.items():
 candidates=[]
 for book in ids:
  for chapter in text[str(books.index(book)+1)]:
   ref=book+'.'+chapter
   if ref not in seen:candidates.append((hashlib.sha256((a.seed+':'+ref).encode()).hexdigest(),ref))
 selected=[]
 for _,ref in sorted(candidates):
  if len(ids)>1 and any(x.split('.')[0]==ref.split('.')[0] for x in selected):continue
  selected.append(ref)
  if len(selected)==2:break
 chosen.extend({'ref':ref,'split':'test','genre':genre,'selection':'sha256-'+a.seed+'-unseen-chapters'} for ref in selected)
plan={**previous,'version':a.seed,'chapters':[{**c,'split':'development','alreadyExposed':True} for c in previous['chapters']]+chosen,'excludedChapters':sorted(seen),'reservedAnnotationsAccessed':False}
(r/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
if not (old/'retired.json').exists():
 (old/'retired.json').write_text(json.dumps({'reason':a.retirement_reason,'replacedBy':str(r),'reserveNowDevelopment':True},indent=2)+'\n')
print('New reserved chapter ids:',[c['ref'] for c in chosen])

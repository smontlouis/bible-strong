"""Audit candidate additions, prior carrier retention, text changes and source identity."""
import argparse,hashlib,json,sqlite3
from collections import Counter
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
old=Path(json.loads((r/'baseline-origin.json').read_text())['experiment'])/'full'
repair=json.loads((r/'text-repair/repair.json').read_text())
changes={(int(c['book']),int(c['chapter']),int(c['verse'])):c for c in repair['changes']}
def connect(root,ed):return sqlite3.connect(f'file:{root}/generated/{ed}/bible-{ed}-strong.sqlite?mode=ro',uri=True)
def carriers(annotations):
 return Counter((p.get('originalOccurrenceId'),p['strong'],p['placement'],p.get('wordIndex'),p.get('startWordIndex'),p.get('endWordIndex'),p.get('insertAfterWordIndex')) for p in annotations if p['visibility']=='reader')
reports={}
for ed in ['s21','neg79']:
 b=connect(old,ed);n=connect(r/'full',ed)
 oldrows=b.execute('select ref,book_order,chapter,verse,text,annotations_json,resolution_json from verses order by book_order,chapter,verse')
 newrows=n.execute('select ref,book_order,chapter,verse,text,annotations_json,resolution_json from verses order by book_order,chapter,verse')
 report={'verses':0,'changedTextVerses':0,'recoveredUnits':0,'recoveryRules':Counter(),'previousCarrierLosses':[],'unexpectedChanges':[],'recoverySamples':[],'states':Counter()}
 all_changes=[];same_text_changes=0
 for before,after in zip(oldrows,newrows,strict=True):
  assert before[:4]==after[:4];ref,book,ch,v,text,raw_ann,raw_res=after;report['verses']+=1
  olda,olda_res=json.loads(before[5]),json.loads(before[6]);newa,new_res=json.loads(raw_ann),json.loads(raw_res)
  def identities(res):return [(u['sourceUnitId'],u['occurrenceIds'],u['strong']) for u in res['decisions']]
  assert identities(olda_res)==identities(new_res),f'source-identity-drift:{ed}:{ref}'
  repair_case=changes.get((book+1,ch,v)) if ed=='neg79' else None
  if text!=before[4]:
   report['changedTextVerses']+=1
   assert repair_case and repair_case['afterSha256']==hashlib.sha256(text.encode()).hexdigest(),f'unapproved-text-change:{ed}:{ref}'
  else:
   lost=carriers(olda)-carriers(newa)
   if lost:report['previousCarrierLosses'].append({'ref':ref,'lost':list(lost.elements())})
  for u in new_res['decisions']:report['states'][u['state']]+=1
  recovery=new_res.get('concordance',{}).get('recovery',{}).get('changes',[])
  for item in recovery:
   report['recoveredUnits']+=1;report['recoveryRules'][item['rule']]+=1
   all_changes.append({'ref':ref,'text':text,**item})
  if text==before[4] and carriers(olda)!=carriers(newa):
   same_text_changes+=1
   if not recovery:report['unexpectedChanges'].append(ref)
  if len(report['recoverySamples'])<12 and recovery:report['recoverySamples'].append({'ref':ref,'text':text,'changes':recovery})
 assert not report['previousCarrierLosses'] and not report['unexpectedChanges']
 assert report['changedTextVerses']==(repair['changedVerses'] if ed=='neg79' else 0)
 report['sameTextChangedVerses']=same_text_changes
 reports[ed]=report
 (r/f'full-recovery-{ed}.json').write_text(json.dumps(all_changes,ensure_ascii=False,indent=2)+'\n')
 print(ed,json.dumps({k:v for k,v in report.items() if k!='recoverySamples'},ensure_ascii=False),flush=True)
 b.close();n.close()
(r/'full-before-after.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')

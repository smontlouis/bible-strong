"""Verify unchanged texts/identities and require a predicate trace for every change."""
import argparse,json,sqlite3
from collections import Counter
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve();old=Path(json.loads((r/'baseline-origin.json').read_text())['experiment'])/'full';reports={}
def db(root,ed):return sqlite3.connect(f'file:{root}/generated/{ed}/bible-{ed}-strong.sqlite?mode=ro',uri=True)
def carriers(raw):return Counter((x.get('originalOccurrenceId'),x['strong'],x['placement'],x.get('wordIndex'),x.get('startWordIndex'),x.get('endWordIndex'),x.get('insertAfterWordIndex')) for x in json.loads(raw) if x['visibility']=='reader')
for ed in ['s21','neg79']:
 b=db(old,ed);n=db(r/'full',ed);query='select ref,text,annotations_json,resolution_json from verses order by book_order,chapter,verse';report={'verses':0,'readerChangedVerses':0,'rules':Counter(),'states':Counter(),'withdrawals':[],'lostPriorRelationIndices':[]};changes=[]
 for before,after in zip(b.execute(query),n.execute(query),strict=True):
  assert before[:2]==after[:2],'text-or-reference-drift';ref,text,ann,res=after;report['verses']+=1
  oldres=json.loads(before[3]);newres=json.loads(res)
  identity=lambda x:[(u['sourceUnitId'],u['occurrenceIds'],u['strong']) for u in x['decisions']]
  assert identity(oldres)==identity(newres),'source-inventory-drift'
  trace=newres.get('concordance',{}).get('predicates',{}).get('changes',[]);ids={c['sourceUnitId'] for c in trace};affected={occ for u in newres['decisions'] if u['sourceUnitId'] in ids for occ in u['occurrenceIds']}
  oldc=carriers(before[2]);newc=carriers(ann);changed=list((oldc-newc).elements())+list((newc-oldc).elements())
  if changed:report['readerChangedVerses']+=1
  assert all(c[0] in affected for c in changed),'untraced-reader-change'
  for oldunit,newunit in zip(oldres['decisions'],newres['decisions'],strict=True):
   report['states'][newunit['state']]+=1
   if oldunit['state']!=newunit['state']:
    assert oldunit['state']=='visible' and newunit['state']=='unresolved'
    assert newunit['assurance']=='unresolved-predicate-relation' and not newunit.get('anchor',{}).get('absenceEstablished')
    report['withdrawals'].append({'ref':ref,'strong':newunit['strong'],'unit':newunit['sourceUnitId']})
   elif not set(oldunit['targetWordIndices']).issubset(newunit['targetWordIndices']):report['lostPriorRelationIndices'].append({'ref':ref,'unit':newunit['sourceUnitId'],'before':oldunit['targetWordIndices'],'after':newunit['targetWordIndices']})
  for c in trace:report['rules'][c['rule']]+=1;changes.append({'ref':ref,'text':text,**c})
 reports[ed]=report;(r/f'full-predicate-changes-{ed}.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2)+'\n');b.close();n.close()
 print(ed,json.dumps(report,ensure_ascii=False),flush=True)
(r/'full-before-after.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')

assert not any(x['lostPriorRelationIndices'] for x in reports.values()), 'prior-relations-lost-see-report'

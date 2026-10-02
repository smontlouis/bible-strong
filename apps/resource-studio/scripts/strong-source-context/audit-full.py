"""Independent reader of full candidates; snapshots a small set of context changes."""
import argparse,json,sqlite3,hashlib
from pathlib import Path
from collections import Counter,defaultdict
p=argparse.ArgumentParser();p.add_argument('root',type=Path);p.add_argument('edition',choices=['neg79','s21']);a=p.parse_args();r=a.root.resolve();ed=a.edition
con=sqlite3.connect(f'file:{r}/full/generated/{ed}/bible-{ed}-strong.sqlite?mode=ro',uri=True)
counts=Counter();states=Counter();pools=defaultdict(list);problems=[];unresolved=Counter()
for ref,text,raw,tokens,annotations in con.execute('select ref,text,resolution_json,tokens_json,annotations_json from verses order by book_order,chapter,verse'):
 res=json.loads(raw);words=[t['text'] for t in json.loads(tokens)];anns=json.loads(annotations);reader=[p for p in anns if p['visibility']=='reader'];owners={p.get('originalOccurrenceId') for p in reader}
 for u in res['decisions']:
  states[u['state']]+=1
  if u['state']=='visible' and not any(x in owners for x in u['occurrenceIds']):problems.append([ref,u['sourceUnitId'],'visible-without-reader'])
  if u['state']=='unresolved':unresolved[u['assurance']]+=1
 for change in res['concordance'].get('context',{}).get('changes',[]):
  counts[change['rule']]+=1
  def carrier(p):
   if p['kind']=='empty':return ''
   return ' '.join(words[p['startWordIndex']:p['endWordIndex']+1])
  selected=[u for u in res['decisions'] if u['sourceUnitId'] in change['sourceUnitIds']]
  item={'ref':ref,'text':text,'change':change,'beforeWords':[carrier(p) for p in change['before']],'afterWords':[carrier(p) for p in change['after']],
        'decisions':[{'id':u['sourceUnitId'],'state':u['state'],'strong':u['strong'],'gloss':u['source']['gloss'],'relationWords':[words[i] for i in u['targetWordIndices']],'reasons':u['reasons']} for u in selected]}
  key=hashlib.sha256((ed+':full-context-audit-v1:'+ref+':'+change['rule']).encode()).hexdigest();pools[change['rule']].append((key,item))
samples=[]
for rule,pool in sorted(pools.items()):
 seen=set()
 for _,item in sorted(pool,key=lambda pair:pair[0]):
  if item['ref'] in seen:continue
  samples.append(item);seen.add(item['ref'])
  if len(seen)==2:break
assert not problems,problems[:3]
result={'edition':ed,'stateCounts':states,'contextChangeCounts':counts,'unresolvedAssuranceCounts':unresolved,'consistencyProblems':problems,'samples':samples,'reviewStatus':'pending-assisted-review-not-gold'}
f=r/f'full/audit/{ed}/context-audit.json';f.parent.mkdir(parents=True,exist_ok=True);f.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'edition':ed,'states':states,'contextChanges':counts,'sampleCount':len(samples)}))

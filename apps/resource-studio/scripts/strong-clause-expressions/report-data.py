"""Evaluator-only comparison and an exhaustive review packet for newly placed units."""
import argparse,gzip,hashlib,json
from pathlib import Path
from collections import Counter,defaultdict
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
def read(p):return json.loads(p.read_bytes() if p.exists() else gzip.decompress(Path(str(p)+'.gz').read_bytes()))
def write(name,value):(r/'evaluator-only'/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
cases=[p.name for p in sorted((r/'evaluation/baseline').iterdir())]
variants=[p.name for p in sorted((r/'evaluation').iterdir()) if p.name!='baseline']
comparisons={};packets={};slices={}
for split in ['development','test']:
 if not all((r/f'evaluation/baseline/{c}/{split}.json').exists() for c in cases):continue
 comparisons[split]={}
 for case in cases:
  base=read(r/f'evaluation/baseline/{case}/{split}.json')['summary'];bm=base['metrics']['exact'];rows={}
  for v in variants:
   c=read(r/f'evaluation/{v}/{case}/{split}.json')['summary'];cm=c['metrics']['exact']
   rows[v]={'baseline':base,'candidate':c,'tpAdded':cm['tp']-bm['tp'],'fpAdded':cm['fp']-bm['fp'],'f1Delta':cm['f1']-bm['f1'],'precisionDelta':cm['precision']-bm['precision'],'recallDelta':cm['recall']-bm['recall'],'unresolvedReduction':base['unresolved']-c['unresolved']}
  comparisons[split][case]=rows
 for ed in ['SG21','NEG']:
  case=f'{ed}-target-excluded';changes=read(r/f'predictions/common-heads/{case}/{split}-changes.json')
  sparse=read(r/f'predictions/common-heads/{case}/{split}.json');pred={v['ref']:v for v in sparse['replacements']}
  gold={v['ref']:v for v in read(r/f'evaluator-only/{ed}-{split}.gold.json')}
  scores=read(r/f'evaluation/common-heads/{case}/{split}-scores.json');before=read(r/f'evaluation/baseline/{case}/{split}-scores.json')
  byref={v['ref']:v for v in scores};packet=[];kinds=Counter()
  for v in changes:
   verse=pred[v['ref']];bad={p['id'] for p in byref[v['ref']]['unmatchedPredicted']}
   for c in v['changes']:
    pl=c['placement'];unit=next(u for u in verse['units'] if u['sourceUnitId']==c['sourceUnitId']);same=[p for p in gold[v['ref']]['placements'] if p['strong']==pl['strong']]
    kinds.update([c['matches'][0]['lexical']['kind']])
    if pl['id'] not in bad:continue
    overlap=[p for p in same if p['kind']!='empty' and max(p['startWordIndex'],pl['startWordIndex'])<=min(p['endWordIndex'],pl['endWordIndex'])]
    category='boundary' if overlap else 'reference-empty' if any(p['kind']=='empty' for p in same) else 'reference-omits-code' if not same else 'different-position'
    packet.append({'edition':ed,'split':split,'ref':v['ref'],'text':v['text'],'words':verse['words'],'source':unit['source'],'category':category,'change':c,'goldSameStrong':same})
  key=f'{ed}-{split}';packets[key]=packet
  sliceRows=defaultdict(lambda:Counter())
  for b,c in zip(before,scores,strict=True):
   assert b['ref']==c['ref'];book=c['ref'].split('.')[0];out=sliceRows[book]
   out['verses']+=1
   for n in ['tp','fp','fn']:out[n+'Before']+=b['metrics']['exact'][n];out[n+'After']+=c['metrics']['exact'][n]
  slices[key]={'byBook':dict(sliceRows),'newProofKinds':dict(kinds),'newDisagreements':len(packet),'newCarriers':sum(len(v['changes']) for v in changes)}
write('results-comparison.json',comparisons);write('disagreement-packets.json',packets);write('results-by-book.json',slices)
print('Comparison and evaluator-only disagreement packets saved.')

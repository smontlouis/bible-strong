"""Seal the local candidates only after prediction, storage and regression checks."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
def sha(f):
 h=hashlib.sha256()
 with f.open('rb') as stream:
  for chunk in iter(lambda:stream.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
frozen=json.loads((r/'candidate-freeze.json').read_text())
for file,h in frozen['code'].items():assert sha(Path(file))==h,file
integration=json.loads((r/'integration-verification.json').read_text());replay=json.loads((r/'blind-replay-verification.json').read_text())
assert len(integration)==7 and all(not x['differences'] for x in integration)
assert len(replay)==7 and all(x['identical'] for x in replay)
assert not json.loads((r/'test-comparison.json').read_text())['introduced']
audit=json.loads((r/'full-before-after.json').read_text());editions={}
for ed in ['s21','neg79']:
 assert audit[ed]['verses']==31169 and not audit[ed]['lostPriorRelationIndices']
 reader=f'full/generated/{ed}/bible-{ed}-strong.jsonl';ledger=f'full/generated/{ed}/bible-{ed}-strong.sqlite';v=json.loads((r/f'full/audit/{ed}/verification.json').read_text());assert v['status']=='local-candidate-structurally-verified'
 editions[ed]={'reader':reader,'readerSha256':sha(r/reader),'ledger':ledger,'ledgerSha256':sha(r/ledger),'counts':v['counts']}
scores=json.loads((r/'comparison-summary.json').read_text());reserve=scores['test']['SG21-target-excluded']['variants']['all']['verses'];development=scores['development']['SG21-target-excluded']['variants']['all']['verses']
proofs=['baseline-origin.json','candidate-freeze.json','development-selection.json','prepared-inputs.json','plan.json','comparison-summary.json','full-before-after.json','integration-verification.json','blind-replay-verification.json','canary.json','workspace-tests.log','test-comparison.json','compile.log','full/input-manifest.json','full/code/manifest.json','full/audit/s21/verification.json','full/audit/neg79/verification.json']
manifest={'status':'verified-local-candidates-with-explicit-uncertainty','policy':'supported-predicate-relations-v2','root':str(r),'editions':editions,'reserveVerses':reserve,'developmentVerses':development,'proofHashes':{f:sha(r/f) for f in proofs},'modelCalls':0,'published':False,'quality':'candidate; preserve complete relations and expose unresolved occurrences; no claim of exhaustive semantic correctness'}
(r/'delivery-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print('Sealed two verified local candidates; reserve:',reserve)

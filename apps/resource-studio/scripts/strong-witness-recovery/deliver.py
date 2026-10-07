"""Seal verified local candidates for the reader, without publication or activation."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
freeze=json.loads((r/'candidate-freeze.json').read_text())
for file,h in freeze['code'].items():assert sha(Path(file))==h,file
integration=json.loads((r/'integration-verification.json').read_text());replay=json.loads((r/'blind-replay-verification.json').read_text())
assert len(integration)==7 and all(not row['differences'] for row in integration)
assert len(replay)==7 and all(row['identical'] for row in replay)
assert not json.loads((r/'test-comparison.json').read_text())['introduced']
for file in ['reserved-disagreements.json','full-assisted-review.json']:
 assert all(row['review'].startswith('assisted-review-complete') for row in json.loads((r/file).read_text()))
audit=json.loads((r/'full-before-after.json').read_text());editions={}
for ed in ['s21','neg79']:
 assert not audit[ed]['previousCarrierLosses'] and not audit[ed]['unexpectedChanges']
 reader=f'full/generated/{ed}/bible-{ed}-strong.jsonl';ledger=f'full/generated/{ed}/bible-{ed}-strong.sqlite'
 verification=json.loads((r/f'full/audit/{ed}/verification.json').read_text())
 assert verification['status']=='local-candidate-structurally-verified'
 editions[ed]={'reader':reader,'readerSha256':sha(r/reader),'ledger':ledger,'ledgerSha256':sha(r/ledger),'counts':verification['counts'],'recoveredUnits':audit[ed]['recoveredUnits']}
proofs=['plan.json','candidate-freeze.json','development-selection.json','prepared-inputs.json','comparison-summary.json','reserved-disagreements.json','full-assisted-review.json','full-before-after.json','integration-verification.json','blind-replay-verification.json','test-comparison.json','workspace-tests.log','compile.log','text-repair/repair.json','text-repair/bible-neg79-canonical.json','text-repair/bible-neg79.json','full/input-manifest.json','full/code/manifest.json','full/audit/s21/verification.json','full/audit/neg79/verification.json']
manifest={'status':'verified-local-candidates-with-documented-semantic-limitations','date':'2026-10-02','policy':'attested-neighbor-recovery-v3','root':str(r),'editions':editions,'proofHashes':{file:sha(r/file) for file in proofs},'modelCalls':0,'published':False,'reserveVerses':503,'developmentVerses':2078,'retiredReserves':[433,476],'quality':'candidate; one known wrong added carrier and one expression-boundary disagreement on the final S21 reserve; no independent semantic certification'}
(r/'delivery-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':manifest['status'],'editions':{ed:{'verses':v['counts']['verses'],'recovered':v['recoveredUnits']} for ed,v in editions.items()}},ensure_ascii=False))

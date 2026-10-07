"""Select on development, verify retention, then freeze before opening the reserve."""
import argparse,datetime,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve();assert not (r/'candidate-freeze.json').exists()
results={}
for case in sorted((r/'evaluation/baseline').iterdir()):
 b=json.loads((case/'development.json').read_text())['summary'];c=json.loads((r/f'evaluation/all/{case.name}/development.json').read_text())['summary']
 old={v['ref']:v for v in json.loads((r/f'predictions/baseline/{case.name}/development.json').read_text())};new={v['ref']:v for v in json.loads((r/f'predictions/all/{case.name}/development.json').read_text())}
 losses=[]
 for ref,v in old.items():
  by_id={p['id']:p for p in new[ref]['placements']}
  if any(by_id.get(p['id'])!=p for p in v['placements']):losses.append(ref)
 assert not losses
 bm,cm=b['metrics']['exact'],c['metrics']['exact'];assert cm['f1']>=bm['f1']
 results[case.name]={'verses':b['verses'],'baseline':bm,'candidate':cm,'losses':losses,'addedExact':cm['tp']-bm['tp'],'addedDisagreements':cm['fp']-bm['fp']}
assert len(results)==7
selection={'selected':'all','policy':{'lexical':True,'neighbors':True,'compounds':True},'reason':'bounded two-family recovery; F1 nondecreasing and no previous carrier loss on development; generic French auxiliary and adposition homographs excluded','results':results,'noEditionSpecificRecoveryRules':True}
(r/'development-selection.json').write_text(json.dumps(selection,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files=[*Path('src').rglob('*.ts'),Path('scripts/strong-witness-recovery/refine.ts'),Path('scripts/strong-witness-recovery/predict.ts'),Path('scripts/strong-concordance-night/score.ts'),Path('scripts/strong-concordance-night/contract.ts'),Path('scripts/strong-source-context/evaluate.ts')]
for folder in ['src','scripts']:shutil.copytree(folder,r/'candidate-code'/folder,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
(r/'candidate-code/node_modules').symlink_to(Path('node_modules').resolve(),target_is_directory=True)
freeze={'frozenAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'code':{str(p):sha(p) for p in files},'planSha256':sha(r/'plan.json'),'selectionSha256':sha(r/'development-selection.json'),'testTargetAnnotationsConsulted':False,'modelCalls':0,'selected':'all'}
(r/'candidate-freeze.json').write_text(json.dumps(freeze,indent=2)+'\n')
print(json.dumps(results,indent=2))

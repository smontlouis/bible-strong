"""Freeze a policy selected solely from already consumed chapters."""
import argparse,datetime,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve();assert not (r/'candidate-freeze.json').exists()
results={}
for case in sorted((r/'evaluation/baseline').iterdir()):
 b=json.loads((case/'development.json').read_text());c=json.loads((r/f'evaluation/all/{case.name}/development.json').read_text());before={v['ref']:v for v in b['scores']}
 losses=[v['ref'] for v in c['scores'] if v['metrics']['exact']['tp']<before[v['ref']]['metrics']['exact']['tp']];assert not losses,losses
 bm=b['summary']['metrics']['exact'];cm=c['summary']['metrics']['exact'];assert cm['precision']>=bm['precision'] and cm['recall']>=bm['recall']
 results[case.name]={'verses':b['summary']['verses'],'baseline':bm,'candidate':cm,'previousExactLosses':losses}
assert len(results)==7
selection={'selected':'all','reason':'predicate relations preserve existing display; only newly recovered heads expand; nominal conflicts become unresolved; no loss of prior exact matches or precision/recall on development','results':results}
(r/'development-selection.json').write_text(json.dumps(selection,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
ui={'jsonlBibleViewer.ts','viewerServer.ts','strongCandidateReview.ts','strongCandidateReviewTypes.ts'}
files=[*[p for p in Path('src').rglob('*.ts') if p.name not in ui],Path('scripts/strong-predicate-review/refine.ts'),Path('scripts/strong-predicate-review/predict.ts'),Path('scripts/strong-concordance-night/score.ts'),Path('scripts/strong-concordance-night/contract.ts'),Path('scripts/strong-source-context/evaluate.ts')]
for folder in ['src','scripts']:shutil.copytree(folder,r/'candidate-code'/folder,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
(r/'candidate-code/node_modules').symlink_to(Path('node_modules').resolve(),target_is_directory=True)
freeze={'frozenAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'code':{str(p):sha(p) for p in files},'excludedPreviewOnlyModules':sorted(ui),'planSha256':sha(r/'plan.json'),'selectionSha256':sha(r/'development-selection.json'),'testTargetAnnotationsConsulted':False,'selected':'all','modelCalls':0}
(r/'candidate-freeze.json').write_text(json.dumps(freeze,indent=2)+'\n');print('Prediction policy frozen before new reserve acquisition.')

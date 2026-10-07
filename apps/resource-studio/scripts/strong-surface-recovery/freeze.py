"""Select the conservative common policy on development and freeze before acquisition."""
import argparse,datetime,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve();assert not (r/'candidate-freeze.json').exists()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
results={}
for case in sorted((r/'evaluation/baseline').iterdir()):
 b=json.loads((case/'development.json').read_text());c=json.loads((r/f'evaluation/consensus-heads/{case.name}/development.json').read_text());bm=b['summary']['metrics']['exact'];cm=c['summary']['metrics']['exact']
 assert cm['precision']>=bm['precision'] and cm['recall']>=bm['recall'],case.name
 assert all(x['after']['tp']>=x['before']['tp'] for x in c['changed'])
 results[case.name]={'verses':b['summary']['verses'],'baseline':bm,'candidate':cm}
assert len(results)==7
selection={'selected':'consensus-heads','reason':'common conservative policy; explicit inflections with two witness families agreeing in at least two other passages; preserve weaker competitors as ambiguous; preserve all existing carriers and relations; no exact precision/recall regression on development','results':results,'modelCalls':0}
(r/'development-selection.json').write_text(json.dumps(selection,indent=2)+'\n')
ui={'jsonlBibleViewer.ts','viewerServer.ts','strongCandidateReview.ts','strongCandidateReviewTypes.ts'}
files=[*[p for p in Path('src').rglob('*.ts') if p.name not in ui],*Path('scripts/strong-surface-recovery').glob('*.ts'),Path('scripts/strong-surface-recovery/prepare-morphology.py'),Path('scripts/strong-concordance-night/score.ts'),Path('scripts/strong-concordance-night/contract.ts'),Path('scripts/strong-concordance-night/acquire.py')]
for folder in ['src','scripts']:shutil.copytree(folder,r/'candidate-code'/folder,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
(r/'candidate-code/node_modules').symlink_to(Path('node_modules').resolve(),target_is_directory=True)
freeze={'frozenAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'code':{str(p):sha(p) for p in files},'planSha256':sha(r/'plan.json'),'selectionSha256':sha(r/'development-selection.json'),'inflectionsSha256':sha(r/'french-inflections.json'),'morphologyReceiptSha256':sha(r/'french-inflections-receipt.json'),'testTargetAnnotationsConsulted':False,'selected':'consensus-heads','modelCalls':0}
(r/'candidate-freeze.json').write_text(json.dumps(freeze,indent=2)+'\n');print('Policy frozen before test prediction and scoring.')
